export type CompletionEvent = 'manual' | 'nodeSelected' | 'nodeHovered' | 'secondNodeSelected' | 'badgeInteracted' | 'panelOpened'

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
  autoAdvance?: boolean // Skip confirmation, advance immediately on completion
  resolveSpotlight: ((context: SpotlightContext) => SpotlightTarget | null) | null // null = keep previous spotlight
}

export interface SpotlightContext {
  graphContainerRect: DOMRect | null
  heroSearchRect: DOMRect | null
  nodeToScreenCoords: ((nodeId: string) => { x: number; y: number } | null) | null
  selectedNodeId: string | null
  neighbourNodeId: string | null
  neighbourIds: string[]
  allNodeIds: string[]
  badgeScreenPos: { x: number; y: number } | null
}

/** Compute a spotlight circle that encloses the selected node and all its neighbours. */
function neighbourhoodSpotlight({ nodeToScreenCoords, selectedNodeId, neighbourIds }: SpotlightContext): SpotlightTarget | null {
  if (!nodeToScreenCoords || !selectedNodeId || neighbourIds.length === 0) return null

  // Gather screen positions of selected node + all neighbours
  const points: { x: number; y: number }[] = []
  const selectedPos = nodeToScreenCoords(selectedNodeId)
  if (selectedPos) points.push(selectedPos)
  for (const id of neighbourIds) {
    const pos = nodeToScreenCoords(id)
    if (pos) points.push(pos)
  }
  if (points.length === 0) return null

  // Compute bounding circle: centre is centroid, radius is max distance from centroid + padding
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  const maxDist = Math.max(...points.map(p => Math.hypot(p.x - cx, p.y - cy)))
  const diameter = (maxDist + 40) * 2 // 40px padding beyond outermost node

  return { x: cx, y: cy, width: diameter, height: diameter, shape: 'circle' }
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'orient',
    prompt: 'Each circle is a Malaysian occupation. Lines connect jobs that share skills. Bigger circles = higher AI exposure.',
    completionEvent: 'manual',
    resolveSpotlight: ({ nodeToScreenCoords, allNodeIds, graphContainerRect }) => {
      if (!nodeToScreenCoords || allNodeIds.length === 0 || !graphContainerRect) return null

      const points: { x: number; y: number }[] = []
      for (const id of allNodeIds) {
        const pos = nodeToScreenCoords(id)
        if (pos) points.push(pos)
      }
      if (points.length === 0) {
        // Fallback: centre of graph container
        const size = Math.min(graphContainerRect.width, graphContainerRect.height) * 0.6
        return {
          x: graphContainerRect.left + graphContainerRect.width / 2,
          y: graphContainerRect.top + graphContainerRect.height / 2,
          width: size, height: size, shape: 'circle',
        }
      }

      const cx = points.reduce((s, p) => s + p.x, 0) / points.length
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length
      const maxDist = Math.max(...points.map(p => Math.hypot(p.x - cx, p.y - cy)))
      const diameter = (maxDist + 50) * 2

      return { x: cx, y: cy, width: diameter, height: diameter, shape: 'circle' }
    },
  },
  {
    id: 'search',
    prompt: 'Search for any occupation — try typing a job title (e.g. "Pharmacists").',
    completionEvent: 'nodeSelected',
    autoAdvance: true,
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
    resolveSpotlight: neighbourhoodSpotlight,
  },
  {
    id: 'click',
    prompt: 'Click a connected occupation to compare skills and see transition pathways.',
    completionEvent: 'secondNodeSelected',
    autoAdvance: true,
    resolveSpotlight: null,
  },
  {
    id: 'badge',
    prompt: 'Hover or click the shared skills badge in the middle to see shared skills.',
    completionEvent: 'badgeInteracted',
    autoAdvance: true,
    resolveSpotlight: null,
  },
  {
    id: 'detail',
    prompt: 'Click on one of the occupation nodes for further details.',
    completionEvent: 'panelOpened',
    autoAdvance: true,
    resolveSpotlight: null,
  },
]
