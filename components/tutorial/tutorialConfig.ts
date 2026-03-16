export type CompletionEvent = 'manual' | 'nodeSelected' | 'nodeHovered' | 'secondNodeSelected'

export type SpotlightShape = 'circle' | 'rect'

export interface SpotlightTarget {
  x: number
  y: number
  width: number
  height: number
  shape: SpotlightShape
}

export interface TutorialStep {
  id: string
  prompt: string
  completionEvent: CompletionEvent
  resolveSpotlight: (context: SpotlightContext) => SpotlightTarget | null
}

export interface SpotlightContext {
  graphContainerRect: DOMRect | null
  heroSearchRect: DOMRect | null
  nodeToScreenCoords: ((nodeId: string) => { x: number; y: number } | null) | null
  selectedNodeId: string | null
  neighbourNodeId: string | null
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'orient',
    prompt: 'Each circle is a Malaysian occupation. Lines connect jobs that share skills. Bigger circles = higher AI exposure.',
    completionEvent: 'manual',
    resolveSpotlight: ({ graphContainerRect }) => {
      if (!graphContainerRect) return null
      const size = Math.min(graphContainerRect.width, graphContainerRect.height) * 0.4
      return {
        x: graphContainerRect.left + graphContainerRect.width / 2,
        y: graphContainerRect.top + graphContainerRect.height / 2,
        width: size,
        height: size,
        shape: 'circle',
      }
    },
  },
  {
    id: 'search',
    prompt: 'Search for any occupation — try typing a job title (e.g. "Pharmacists").',
    completionEvent: 'nodeSelected',
    resolveSpotlight: ({ heroSearchRect }) => {
      if (!heroSearchRect) return null
      return {
        x: heroSearchRect.left + heroSearchRect.width / 2,
        y: heroSearchRect.top + heroSearchRect.height / 2,
        width: heroSearchRect.width + 16,
        height: heroSearchRect.height + 16,
        shape: 'rect',
      }
    },
  },
  {
    id: 'hover',
    prompt: 'Hover over connected nodes to see how they relate.',
    completionEvent: 'nodeHovered',
    resolveSpotlight: ({ nodeToScreenCoords, neighbourNodeId }) => {
      if (!nodeToScreenCoords || !neighbourNodeId) return null
      const pos = nodeToScreenCoords(neighbourNodeId)
      if (!pos) return null
      return { x: pos.x, y: pos.y, width: 120, height: 120, shape: 'circle' }
    },
  },
  {
    id: 'click',
    prompt: 'Click a connected occupation to compare skills and see transition pathways.',
    completionEvent: 'secondNodeSelected',
    resolveSpotlight: ({ nodeToScreenCoords, neighbourNodeId }) => {
      if (!nodeToScreenCoords || !neighbourNodeId) return null
      const pos = nodeToScreenCoords(neighbourNodeId)
      if (!pos) return null
      return { x: pos.x, y: pos.y, width: 120, height: 120, shape: 'circle' }
    },
  },
]
