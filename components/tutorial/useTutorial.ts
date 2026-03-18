import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { TUTORIAL_STEPS, STEP_IDX, type SpotlightContext, type SpotlightTarget } from './tutorialConfig'
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
}

interface UseTutorialReturn {
  isActive: boolean
  isVisible: boolean
  currentStep: number
  isConfirming: boolean
  stepConfig: typeof TUTORIAL_STEPS[number] | null
  spotlight: SpotlightTarget | null
  advance: () => void
  skip: () => void
  cursorAnimProps: { from: { x: number; y: number }; to: { x: number; y: number }; delayMs?: number; lingerMs?: number } | null
  simulatedHoverId: string | null
  onCursorArrive: () => void
  onCursorComplete: () => void
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
}: UseTutorialProps): UseTutorialReturn {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [simulatedHoverId, setSimulatedHoverId] = useState<string | null>(null)

  useEffect(() => {
    if (startActive) {
      setIsActive(true)
      setIsVisible(true)
    }
  }, [startActive])

  const stepConfig = isActive ? TUTORIAL_STEPS[currentStep] ?? null : null

  // nodeToScreenCoords returns positions relative to the graph SVG container.
  // The overlay is position:fixed (viewport-relative), so we add the container's
  // viewport offset to convert from container-local to viewport coordinates.
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
  }, [selectedNodeId, edges, getNodeScreenCoords])

  const lockedNeighbourRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentStep > STEP_IDX.search && neighbourNodeId && !lockedNeighbourRef.current) {
      lockedNeighbourRef.current = neighbourNodeId
    }
    if (currentStep <= STEP_IDX.search) {
      lockedNeighbourRef.current = null
    }
  }, [currentStep, neighbourNodeId])

  const resolvedNeighbourId = lockedNeighbourRef.current ?? neighbourNodeId

  // Delay spotlight after steps that trigger graph zoom animations.
  // When step 2 auto-advances to step 3, the graph zooms to the selected node
  // (500ms animation). We wait for it to settle before computing spotlight positions.
  const [spotlightReady, setSpotlightReady] = useState(true)
  const prevStepRef = useRef(currentStep)
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      const prevStep = prevStepRef.current
      prevStepRef.current = currentStep
      // Steps that trigger zoom animations (~500ms in OccupationGraph):
      // Step 2→3: selecting a node zooms to neighbourhood
      // Step 3→4: clicking second node zooms to pair view
      if ((prevStep === STEP_IDX.search && currentStep === STEP_IDX.hover) ||
          (prevStep === STEP_IDX.click && currentStep === STEP_IDX.badge)) {
        setSpotlightReady(false)
        const timer = setTimeout(() => setSpotlightReady(true), 600)
        return () => clearTimeout(timer)
      }
    }
  }, [currentStep])

  const prevSpotlightRef = useRef<SpotlightTarget | null>(null)
  const spotlight = useMemo(() => {
    if (!stepConfig || !spotlightReady) return prevSpotlightRef.current
    // null resolveSpotlight = keep previous spotlight
    if (!stepConfig.resolveSpotlight) return prevSpotlightRef.current
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
    return result
  }, [stepConfig, spotlightReady, graphContainerRect, heroSearchRect, getNodeScreenCoords, selectedNodeId, resolvedNeighbourId, allNeighbourIds, badgePos])

  const cursorAnimProps = useMemo(() => {
    if (!stepConfig?.cursorAnimation || !spotlightReady || !spotlight) return null

    // Resolve target coordinates
    let to: { x: number; y: number } | null = null
    const { target } = stepConfig.cursorAnimation

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

    if (!to) return null // Fallback: skip cursor animation

    // Compute `from` on the opposite side of the spotlight edge
    const angle = Math.atan2(to.y - spotlight.y, to.x - spotlight.x)
    const oppositeAngle = angle + Math.PI
    let from: { x: number; y: number }

    if (spotlight.shape === 'circle') {
      const r = spotlight.width / 2
      from = {
        x: spotlight.x + r * Math.cos(oppositeAngle),
        y: spotlight.y + r * Math.sin(oppositeAngle),
      }
    } else {
      // Rect spotlight: find intersection of ray from center at oppositeAngle with rect boundary
      const hw = spotlight.width / 2
      const hh = spotlight.height / 2
      const dx = Math.cos(oppositeAngle)
      const dy = Math.sin(oppositeAngle)
      // Scale factor to reach the rect edge
      const sx = dx !== 0 ? Math.abs(hw / dx) : Infinity
      const sy = dy !== 0 ? Math.abs(hh / dy) : Infinity
      const s = Math.min(sx, sy)
      from = {
        x: spotlight.x + dx * s,
        y: spotlight.y + dy * s,
      }
    }

    return {
      from,
      to,
      delayMs: stepConfig.cursorAnimation.delayMs,
      lingerMs: stepConfig.cursorAnimation.lingerMs,
    }
  }, [stepConfig, spotlightReady, spotlight, resolvedNeighbourId, getNodeScreenCoords, graphContainerRect, heroSearchRect, selectedNodeId, allNeighbourIds, badgePos])

  const onCursorArrive = useCallback(() => {
    if (!stepConfig?.cursorAnimation) return
    const { target } = stepConfig.cursorAnimation
    if (target === 'neighbour' && resolvedNeighbourId) {
      setSimulatedHoverId(resolvedNeighbourId)
    }
    // Future: handle other targets (badge, selectedNode) here
  }, [stepConfig, resolvedNeighbourId])

  const onCursorComplete = useCallback(() => {
    setSimulatedHoverId(null)
    setIsConfirming(true)
  }, [])

  // Fallback: if step has cursorAnimation but coordinates couldn't resolve,
  // skip the animation and show "Got it, next" immediately
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

  // Detect completion events
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
    }

    if (triggered) {
      if (stepConfig?.autoAdvance) {
        // Auto-advance: skip confirmation, go straight to next step
        setIsConfirming(false)
        if (currentStep < TUTORIAL_STEPS.length - 1) {
          setCurrentStep(prev => prev + 1)
        } else {
          setIsActive(false)
        }
      } else {
        setIsConfirming(true)
      }
    }
  }, [isActive, isConfirming, stepConfig, currentStep, selectedNodeId, secondSelectedNodeId, hoveredNodeId, resolvedNeighbourId, edges, badgeInteracted, isPanelOpen])

  useEffect(() => {
    if (!isActive && isVisible) {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isActive, isVisible])

  const advance = useCallback(() => {
    setIsConfirming(false)
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      setIsActive(false)
    }
  }, [currentStep])

  const skip = useCallback(() => {
    setIsActive(false)
    setIsConfirming(false)
    setSimulatedHoverId(null)
  }, [])

  return {
    isActive, isVisible, currentStep, isConfirming, stepConfig, spotlight, advance, skip,
    cursorAnimProps,
    simulatedHoverId,
    onCursorArrive,
    onCursorComplete,
  }
}
