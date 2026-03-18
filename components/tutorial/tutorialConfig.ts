export type CompletionEvent = 'manual' | 'nodeSelected' | 'secondNodeSelected' | 'badgeInteracted' | 'panelOpened'

export type SpotlightShape = 'circle' | 'rect'

export interface SpotlightTarget {
  x: number
  y: number
  width: number
  height: number
  shape: SpotlightShape
}

export interface CursorAnimation {
  /** Which element the cursor moves to. Resolved to screen coords at runtime. */
  target: 'neighbour' | 'badge' | 'selectedNode'
  /** Override initial delay before cursor appears (default: 600ms) */
  delayMs?: number
  /** Override linger duration on target (default: 1000ms) */
  lingerMs?: number
}

export interface TutorialStep {
  id: string
  prompt: string
  completionEvent: CompletionEvent
  autoAdvance?: boolean // Skip confirmation, advance immediately on completion
  resolveSpotlight: ((context: SpotlightContext) => SpotlightTarget | null) | null // null = keep previous spotlight
  cursorAnimation?: CursorAnimation
}

export interface SpotlightContext {
  graphContainerRect: DOMRect | null
  heroSearchRect: DOMRect | null
  nodeToScreenCoords: ((nodeId: string) => { x: number; y: number } | null) | null
  selectedNodeId: string | null
  neighbourNodeId: string | null
  neighbourIds: string[]
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
    id: 'search',
    prompt: 'Select an occupation to explore — try "Commercial Sales Representatives" at the top of the list.',
    completionEvent: 'nodeSelected',
    autoAdvance: true,
    resolveSpotlight: ({ heroSearchRect }) => {
      if (!heroSearchRect) return null
      // Extend downward to cover the dropdown list (max-h-96 = 384px + gap)
      const dropdownHeight = 400
      const totalHeight = heroSearchRect.height + dropdownHeight
      return {
        x: heroSearchRect.left + heroSearchRect.width / 2,
        y: heroSearchRect.top + totalHeight / 2,
        width: heroSearchRect.width + 16,
        height: totalHeight + 16,
        shape: 'rect',
      }
    },
  },
  {
    id: 'hover',
    prompt: 'Watch how hovering reveals connections between occupations.',
    completionEvent: 'manual',
    cursorAnimation: { target: 'neighbour' },
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

// Step index lookup (computed once, avoids hardcoded indices)
export const STEP_IDX = Object.fromEntries(
  TUTORIAL_STEPS.map((s, i) => [s.id, i])
) as Record<string, number>
