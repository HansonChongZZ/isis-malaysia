import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { TUTORIAL_STEPS, type SpotlightContext, type SpotlightTarget } from './tutorialConfig'
import type { GraphEdge } from '@/lib/types'

export interface OccupationGraphHandle {
  nodeToScreenCoords: (nodeId: string) => { x: number; y: number } | null
}

interface UseTutorialProps {
  selectedNodeId: string | null
  secondSelectedNodeId: string | null
  hoveredNodeId: string | null
  edges: GraphEdge[]
  graphContainerRect: DOMRect | null
  heroSearchRect: DOMRect | null
  graphHandleRef: React.RefObject<OccupationGraphHandle | null>
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
}

export function useTutorial({
  selectedNodeId,
  secondSelectedNodeId,
  hoveredNodeId,
  edges,
  graphContainerRect,
  heroSearchRect,
  graphHandleRef,
}: UseTutorialProps): UseTutorialReturn {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)

  const stepConfig = isActive ? TUTORIAL_STEPS[currentStep] ?? null : null

  const getNodeScreenCoords = useCallback((nodeId: string) => {
    return graphHandleRef.current?.nodeToScreenCoords(nodeId) ?? null
  }, [graphHandleRef])

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
    if (currentStep >= 2 && neighbourNodeId && !lockedNeighbourRef.current) {
      lockedNeighbourRef.current = neighbourNodeId
    }
    if (currentStep < 2) {
      lockedNeighbourRef.current = null
    }
  }, [currentStep, neighbourNodeId])

  const resolvedNeighbourId = lockedNeighbourRef.current ?? neighbourNodeId

  const spotlight = useMemo(() => {
    if (!stepConfig) return null
    const context: SpotlightContext = {
      graphContainerRect,
      heroSearchRect,
      nodeToScreenCoords: getNodeScreenCoords,
      selectedNodeId,
      neighbourNodeId: resolvedNeighbourId,
    }
    return stepConfig.resolveSpotlight(context)
  }, [stepConfig, graphContainerRect, heroSearchRect, getNodeScreenCoords, selectedNodeId, resolvedNeighbourId])

  // Detect completion events
  useEffect(() => {
    if (!isActive || isConfirming) return
    const event = stepConfig?.completionEvent
    let triggered = false
    if (event === 'nodeSelected' && selectedNodeId) {
      triggered = true
    } else if (event === 'nodeHovered' && hoveredNodeId && resolvedNeighbourId) {
      const neighbourIds = new Set(
        edges
          .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
          .map(e => (e.source === selectedNodeId ? e.target : e.source))
      )
      if (neighbourIds.has(hoveredNodeId)) {
        triggered = true
      }
    } else if (event === 'secondNodeSelected' && secondSelectedNodeId) {
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
  }, [isActive, isConfirming, stepConfig, currentStep, selectedNodeId, secondSelectedNodeId, hoveredNodeId, resolvedNeighbourId, edges])

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
  }, [])

  return { isActive, isVisible, currentStep, isConfirming, stepConfig, spotlight, advance, skip }
}
