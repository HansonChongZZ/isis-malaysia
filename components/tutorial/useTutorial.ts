import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  STEP_REGISTRY,
  CONNECTED_PATH,
  PANEL_DEPENDENT_STEPS,
  getNextStepId,
  resolveActivePath,
  type SpotlightContext,
  type SpotlightTarget,
} from './tutorialConfig'
import type { GraphEdge } from '@/lib/types'

export interface OccupationGraphHandle {
  nodeToScreenCoords: (nodeId: string) => { x: number; y: number } | null
}

interface UseTutorialProps {
  selectedNodeId: string | null
  secondSelectedNodeId: string | null
  hoveredNodeId: string | null
  edges: GraphEdge[]
  startActive?: boolean
  graphContainerRect: DOMRect | null
  heroSearchRect: DOMRect | null
  graphHandleRef: React.RefObject<OccupationGraphHandle | null>
  badgePos: { x: number; y: number } | null
  badgeInteracted: boolean
  isPanelOpen: boolean
  isComparing: boolean
  cardClicked: boolean
  onComplete?: () => void
}

interface UseTutorialReturn {
  isActive: boolean
  isVisible: boolean
  currentStepId: string
  currentStepIndex: number
  totalSteps: number
  isConfirming: boolean
  stepConfig: typeof STEP_REGISTRY[string] | null
  spotlight: SpotlightTarget | null
  advance: () => void
  skip: () => void
  cursorAnimProps: { from: { x: number; y: number }; to: { x: number; y: number }; clickEffect?: boolean; delayMs?: number; lingerMs?: number } | null
  simulatedHoverId: string | null
  onCursorArrive: () => void
  onCursorComplete: () => void
  tooltipPosition: { left: number; top: number } | null
}

export function useTutorial({
  selectedNodeId,
  secondSelectedNodeId,
  hoveredNodeId,
  edges,
  startActive,
  graphContainerRect,
  heroSearchRect,
  graphHandleRef,
  badgePos,
  badgeInteracted,
  isPanelOpen,
  isComparing,
  cardClicked,
  onComplete,
}: UseTutorialProps): UseTutorialReturn {
  const [currentStepId, setCurrentStepId] = useState('search')
  const [isActive, setIsActive] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [simulatedHoverId, setSimulatedHoverId] = useState<string | null>(null)

  // Lock the path after the fork point
  const lockedPathRef = useRef<readonly string[] | null>(null)

  useEffect(() => {
    if (startActive) {
      setIsActive(true)
      setIsVisible(true)
    }
  }, [startActive])

  const stepConfig = isActive ? STEP_REGISTRY[currentStepId] ?? null : null

  // Resolve active path — use locked path after fork, otherwise compute
  const activePath = useMemo(() => {
    if (lockedPathRef.current) return lockedPathRef.current
    return resolveActivePath(currentStepId, isComparing)
  }, [currentStepId, isComparing])

  const currentStepIndex = activePath.indexOf(currentStepId)
  const totalSteps = activePath.length

  // Lock path when we advance past the fork point
  useEffect(() => {
    if (currentStepId === 'occupationClick') {
      // About to fork — don't lock yet
      lockedPathRef.current = null
    } else if (
      currentStepId !== 'search' &&
      currentStepId !== 'hover' &&
      currentStepId !== 'click' &&
      currentStepId !== 'badge' &&
      currentStepId !== 'occupationClick' &&
      !lockedPathRef.current
    ) {
      // Past the fork — lock the path
      lockedPathRef.current = resolveActivePath(currentStepId, isComparing)
    }
  }, [currentStepId, isComparing])

  // Reset path lock when tutorial restarts
  useEffect(() => {
    if (currentStepId === 'search') {
      lockedPathRef.current = null
    }
  }, [currentStepId])

  // nodeToScreenCoords with viewport offset
  const getNodeScreenCoords = useCallback((nodeId: string) => {
    const pos = graphHandleRef.current?.nodeToScreenCoords(nodeId)
    if (!pos || !graphContainerRect) return null
    return {
      x: pos.x + graphContainerRect.left,
      y: pos.y + graphContainerRect.top,
    }
  }, [graphHandleRef, graphContainerRect])

  // All neighbour IDs for the selected node
  const allNeighbourIds = useMemo(() => {
    if (!selectedNodeId) return [] as string[]
    return edges
      .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
      .map(e => (e.source === selectedNodeId ? e.target : e.source))
  }, [selectedNodeId, edges])

  const neighbourNodeId = useMemo(() => {
    if (!selectedNodeId) return null
    const neighbours = edges
      .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
      .map(e => ({
        id: e.source === selectedNodeId ? e.target : e.source,
        weight: e.weight,
      }))

    if (neighbours.length === 0) return null

    const maxWeight = Math.max(...neighbours.map(n => n.weight))
    const topNeighbours = neighbours.filter(n => n.weight === maxWeight)

    if (topNeighbours.length === 1) return topNeighbours[0].id

    const selectedPos = getNodeScreenCoords(selectedNodeId)
    if (!selectedPos) return topNeighbours[0].id

    let closest = topNeighbours[0]
    let closestDist = Infinity
    for (const n of topNeighbours) {
      const pos = getNodeScreenCoords(n.id)
      if (!pos) continue
      const dist = Math.hypot(pos.x - selectedPos.x, pos.y - selectedPos.y)
      if (dist < closestDist) {
        closestDist = dist
        closest = n
      }
    }
    return closest.id
  }, [selectedNodeId, edges, getNodeScreenCoords, stepConfig])

  const lockedNeighbourRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentStepId !== 'search' && neighbourNodeId && !lockedNeighbourRef.current) {
      lockedNeighbourRef.current = neighbourNodeId
    }
    if (currentStepId === 'search') {
      lockedNeighbourRef.current = null
    }
  }, [currentStepId, neighbourNodeId])

  const resolvedNeighbourId = lockedNeighbourRef.current ?? neighbourNodeId

  // Delay spotlight after steps that trigger graph zoom animations
  const [spotlightReady, setSpotlightReady] = useState(true)
  const prevStepRef = useRef(currentStepId)
  useEffect(() => {
    if (prevStepRef.current !== currentStepId) {
      const prevStep = prevStepRef.current
      prevStepRef.current = currentStepId
      if ((prevStep === 'search' && currentStepId === 'hover') ||
          (prevStep === 'click' && currentStepId === 'badge')) {
        setSpotlightReady(false)
        const timer = setTimeout(() => setSpotlightReady(true), 600)
        return () => clearTimeout(timer)
      }
    }
  }, [currentStepId])

  const prevSpotlightRef = useRef<SpotlightTarget | null>(null)
  const [spotlight, setSpotlight] = useState<SpotlightTarget | null>(null)

  useEffect(() => {
    if (!stepConfig || !spotlightReady) {
      setSpotlight(prevSpotlightRef.current)
      return
    }
    if (stepConfig.clearSpotlight) {
      prevSpotlightRef.current = null
      setSpotlight(null)
      return
    }
    if (!stepConfig.resolveSpotlight) {
      setSpotlight(prevSpotlightRef.current)
      return
    }
    const context: SpotlightContext = {
      graphContainerRect,
      heroSearchRect,
      nodeToScreenCoords: getNodeScreenCoords,
      selectedNodeId,
      neighbourNodeId: resolvedNeighbourId,
      neighbourIds: allNeighbourIds,
      badgeScreenPos: badgePos && graphContainerRect
        ? { x: badgePos.x + graphContainerRect.left, y: badgePos.y + graphContainerRect.top }
        : null,
    }
    const result = stepConfig.resolveSpotlight(context)
    if (result) prevSpotlightRef.current = result
    setSpotlight(result)
  }, [stepConfig, spotlightReady, graphContainerRect, heroSearchRect, getNodeScreenCoords, selectedNodeId, resolvedNeighbourId, allNeighbourIds, badgePos])

  // ─── Tooltip Anchor Resolution ──────────────────────────────────────────────

  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!stepConfig?.tooltipAnchor) {
      setTooltipPosition(null)
      return
    }

    const resolve = () => {
      const el = document.querySelector(stepConfig.tooltipAnchor!.selector)
      if (!el) {
        setTooltipPosition(null)
        return
      }
      const rect = el.getBoundingClientRect()
      const { position, offsetX = 16, offsetY = 0 } = stepConfig.tooltipAnchor!
      const tooltipWidth = 300

      let left: number
      let top: number

      switch (position) {
        case 'right':
          left = rect.right + offsetX
          top = rect.top + rect.height / 2 - 80 + offsetY // roughly center on element
          break
        case 'left':
          left = rect.left - tooltipWidth - offsetX
          top = rect.top + rect.height / 2 - 80 + offsetY
          break
        case 'top-left':
          left = rect.left - tooltipWidth - offsetX
          top = rect.top + offsetY
          break
        case 'top-right':
          left = rect.right + offsetX
          top = rect.top + offsetY
          break
      }

      // Clamp to viewport
      const vw = window.innerWidth
      const vh = window.innerHeight
      left = Math.max(16, Math.min(left, vw - tooltipWidth - 16))
      top = Math.max(16, Math.min(top, vh - 160 - 16))

      setTooltipPosition({ left, top })
    }

    // Delay initial resolve by one frame to let the DOM settle after state changes
    const raf = requestAnimationFrame(() => {
      resolve()
    })

    // Re-resolve on scroll within the panel container
    const scrollContainer = document.querySelector('[data-tutorial-scroll-container]')
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', resolve, { passive: true })
    }
    window.addEventListener('resize', resolve)

    return () => {
      cancelAnimationFrame(raf)
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', resolve)
      }
      window.removeEventListener('resize', resolve)
    }
  }, [stepConfig, isPanelOpen, isComparing])

  // ─── Cursor Animation ──────────────────────────────────────────────────────

  const cursorAnimProps = useMemo(() => {
    if (!stepConfig?.cursorAnimation || !spotlightReady) return null

    let to: { x: number; y: number } | null = null
    const { target } = stepConfig.cursorAnimation

    if (target === 'domElement' && stepConfig.cursorAnimation.targetSelector) {
      const el = document.querySelector(stepConfig.cursorAnimation.targetSelector)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      const from = { x: to.x + 80, y: to.y - 90 }
      return {
        from,
        to,
        clickEffect: stepConfig.cursorAnimation.clickEffect,
        delayMs: stepConfig.cursorAnimation.delayMs,
        lingerMs: stepConfig.cursorAnimation.lingerMs,
      }
    }

    if (target === 'neighbour' && resolvedNeighbourId) {
      to = getNodeScreenCoords(resolvedNeighbourId)
    } else if (target === 'badge') {
      const ctx: SpotlightContext = {
        graphContainerRect,
        heroSearchRect,
        nodeToScreenCoords: getNodeScreenCoords,
        selectedNodeId,
        neighbourNodeId: resolvedNeighbourId,
        neighbourIds: allNeighbourIds,
        badgeScreenPos: badgePos && graphContainerRect
          ? { x: badgePos.x + graphContainerRect.left, y: badgePos.y + graphContainerRect.top }
          : null,
      }
      to = ctx.badgeScreenPos
    } else if (target === 'selectedNode' && selectedNodeId) {
      to = getNodeScreenCoords(selectedNodeId)
    }

    if (!to) return null

    let from: { x: number; y: number }

    if (spotlight) {
      const angle = Math.atan2(to.y - spotlight.y, to.x - spotlight.x)
      const oppositeAngle = angle + Math.PI

      if (spotlight.shape === 'circle') {
        const r = spotlight.width / 2
        from = {
          x: spotlight.x + r * Math.cos(oppositeAngle),
          y: spotlight.y + r * Math.sin(oppositeAngle),
        }
      } else {
        const hw = spotlight.width / 2
        const hh = spotlight.height / 2
        const dx = Math.cos(oppositeAngle)
        const dy = Math.sin(oppositeAngle)
        const sx = dx !== 0 ? Math.abs(hw / dx) : Infinity
        const sy = dy !== 0 ? Math.abs(hh / dy) : Infinity
        const s = Math.min(sx, sy)
        from = {
          x: spotlight.x + dx * s,
          y: spotlight.y + dy * s,
        }
      }
    } else {
      from = { x: to.x + 80, y: to.y - 90 }
    }

    return {
      from,
      to,
      clickEffect: stepConfig.cursorAnimation.clickEffect,
      delayMs: stepConfig.cursorAnimation.delayMs,
      lingerMs: stepConfig.cursorAnimation.lingerMs,
    }
  }, [stepConfig, spotlightReady, spotlight, resolvedNeighbourId, getNodeScreenCoords, graphContainerRect, heroSearchRect, selectedNodeId, allNeighbourIds, badgePos])

  const onCursorArrive = useCallback(() => {
    if (!stepConfig?.cursorAnimation) return
    const { target, mode } = stepConfig.cursorAnimation
    if (mode === 'hint') return
    if (target === 'neighbour' && resolvedNeighbourId) {
      setSimulatedHoverId(resolvedNeighbourId)
    }
  }, [stepConfig, resolvedNeighbourId])

  const onCursorComplete = useCallback(() => {
    if (stepConfig?.cursorAnimation?.mode === 'hint') return
    setIsConfirming(true)
  }, [stepConfig])

  // Fallback: if step has cursorAnimation but coordinates couldn't resolve
  useEffect(() => {
    if (
      stepConfig?.cursorAnimation &&
      stepConfig.completionEvent === 'manual' &&
      spotlightReady &&
      !cursorAnimProps &&
      !isConfirming
    ) {
      setIsConfirming(true)
    }
  }, [stepConfig, spotlightReady, cursorAnimProps, isConfirming])

  // Immediate confirm for manual steps with no cursor animation
  useEffect(() => {
    if (
      stepConfig &&
      stepConfig.completionEvent === 'manual' &&
      !stepConfig.cursorAnimation &&
      !isConfirming
    ) {
      setIsConfirming(true)
    }
  }, [stepConfig, isConfirming])

  // ─── Completion Event Detection ────────────────────────────────────────────

  useEffect(() => {
    if (!isActive || isConfirming) return
    const event = stepConfig?.completionEvent
    let triggered = false
    if (event === 'nodeSelected' && selectedNodeId) {
      triggered = true
    } else if (event === 'secondNodeSelected' && secondSelectedNodeId) {
      triggered = true
    } else if (event === 'badgeInteracted' && badgeInteracted) {
      triggered = true
    } else if (event === 'panelOpened' && isPanelOpen) {
      triggered = true
    } else if (event === 'backToPathways' && !isComparing && isPanelOpen) {
      triggered = true
    } else if (event === 'panelClosed' && !isPanelOpen) {
      triggered = true
    } else if (event === 'cardClicked' && cardClicked) {
      triggered = true
    }

    if (triggered) {
      if (stepConfig?.autoAdvance) {
        setIsConfirming(false)
        const nextId = getNextStepId(currentStepId, { isComparing })
        if (nextId) {
          setCurrentStepId(nextId)
        } else {
          setIsActive(false)
        }
      } else {
        setIsConfirming(true)
      }
    }
  }, [isActive, isConfirming, stepConfig, currentStepId, selectedNodeId, secondSelectedNodeId, hoveredNodeId, resolvedNeighbourId, edges, badgeInteracted, isPanelOpen, isComparing, cardClicked])

  // Fork resolution: when panel opens at occupationClick, defer advancement
  // by one frame so isComparing has time to settle from OccupationPanel.
  // If isComparing changes (connected node path), the effect re-fires and
  // cancels the stale rAF, scheduling a new one with the correct value.
  useEffect(() => {
    if (currentStepId !== 'occupationClick' || !isPanelOpen || !isActive) return
    const raf = requestAnimationFrame(() => {
      setIsConfirming(false)
      const nextId = getNextStepId('occupationClick', { isComparing })
      if (nextId) setCurrentStepId(nextId)
    })
    return () => cancelAnimationFrame(raf)
  }, [currentStepId, isPanelOpen, isActive, isComparing])

  // Guard: if panel closes during panel-dependent steps, jump to explore
  useEffect(() => {
    if (!isActive) return
    if (PANEL_DEPENDENT_STEPS.has(currentStepId) && !isPanelOpen) {
      setCurrentStepId('explore')
      setIsConfirming(false)
    }
  }, [isActive, currentStepId, isPanelOpen])

  useEffect(() => {
    if (!isActive && isVisible) {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isActive, isVisible])

  const advance = useCallback(() => {
    setIsConfirming(false)
    setSimulatedHoverId(null)
    const nextId = getNextStepId(currentStepId, { isComparing })
    if (nextId) {
      setCurrentStepId(nextId)
    } else {
      setIsActive(false)
      onComplete?.()
    }
  }, [currentStepId, isComparing, onComplete])

  const skip = useCallback(() => {
    setIsActive(false)
    setIsConfirming(false)
    setSimulatedHoverId(null)
    lockedPathRef.current = null
    onComplete?.()
  }, [onComplete])

  return {
    isActive, isVisible, currentStepId, currentStepIndex, totalSteps,
    isConfirming, stepConfig, spotlight, advance, skip,
    cursorAnimProps,
    simulatedHoverId,
    onCursorArrive,
    onCursorComplete,
    tooltipPosition,
  }
}
