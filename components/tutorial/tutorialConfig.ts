export type CompletionEvent = 'manual' | 'nodeSelected' | 'secondNodeSelected' | 'badgeInteracted' | 'panelOpened' | 'backToPathways' | 'panelClosed'

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
  target: 'neighbour' | 'badge' | 'selectedNode' | 'domElement'
  /** CSS selector for the target element. Used when target === 'domElement'. */
  targetSelector?: string
  /** 'demo' triggers effects on arrive (e.g. simulated hover). 'hint' just points visually. Default: 'demo'. */
  mode?: 'demo' | 'hint'
  /** Show a press-down click animation when cursor arrives at target. Default: false. */
  clickEffect?: boolean
  /** Override initial delay before cursor appears (default: 800ms) */
  delayMs?: number
  /** Override linger duration on target (default: 1400ms) */
  lingerMs?: number
}

export interface TutorialStep {
  id: string
  prompt: string
  completionEvent: CompletionEvent
  autoAdvance?: boolean // Skip confirmation, advance immediately on completion
  resolveSpotlight: ((context: SpotlightContext) => SpotlightTarget | null) | null // null = keep previous spotlight
  cursorAnimation?: CursorAnimation
  preferredNeighbourId?: string // Force a specific neighbour for cursor/spotlight targeting
  clearSpotlight?: boolean // When true, clears prevSpotlightRef on entry (tooltip centers on screen)
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
    prompt: 'Watch how hovering over "Retail And Wholesale Trade Managers" reveals connections.',
    completionEvent: 'manual',
    cursorAnimation: { target: 'neighbour' },
    preferredNeighbourId: '1421',
    resolveSpotlight: null,
    clearSpotlight: true,
  },
  {
    id: 'click',
    prompt: 'Click on "Retail And Wholesale Trade Managers" to compare skills and see transition pathways.',
    completionEvent: 'secondNodeSelected',
    autoAdvance: true,
    cursorAnimation: { target: 'neighbour', mode: 'hint', clickEffect: true },
    preferredNeighbourId: '1421',
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
    prompt: 'Click on "Retail And Wholesale Trade Managers" to see further details.',
    completionEvent: 'panelOpened',
    autoAdvance: true,
    cursorAnimation: { target: 'neighbour', mode: 'hint', clickEffect: true },
    preferredNeighbourId: '1421',
    resolveSpotlight: null,
  },
  {
    id: 'compare',
    prompt: 'This view compares AI exposure, median wages, and skills between the two occupations — shared skills and skills to develop.',
    completionEvent: 'manual',
    resolveSpotlight: null,
  },
  {
    id: 'backToPathways',
    prompt: 'Click "Back to pathways" to see other occupations you could transition to.',
    completionEvent: 'backToPathways',
    autoAdvance: true,
    resolveSpotlight: null,
    cursorAnimation: { target: 'domElement', targetSelector: '[data-tutorial-target="back-to-pathways"]', mode: 'hint', clickEffect: true },
  },
  {
    id: 'pathways',
    prompt: 'Browse transition pathways — each card shows skill overlap, AI exposure, and wages for occupations you could move into.',
    completionEvent: 'manual',
    resolveSpotlight: null,
  },
  {
    id: 'closePanel',
    prompt: 'Close this panel to return to the full graph.',
    completionEvent: 'panelClosed',
    autoAdvance: true,
    resolveSpotlight: null,
    cursorAnimation: { target: 'domElement', targetSelector: '[data-tutorial-target="panel-close"]', mode: 'hint', clickEffect: true },
  },
  {
    id: 'explore',
    prompt: "You're all set — happy exploring!",
    completionEvent: 'manual',
    resolveSpotlight: null,
    clearSpotlight: true,
  },
]

// Step index lookup (computed once, avoids hardcoded indices)
export const STEP_IDX = Object.fromEntries(
  TUTORIAL_STEPS.map((s, i) => [s.id, i])
) as Record<string, number>
