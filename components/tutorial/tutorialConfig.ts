export type CompletionEvent =
  | 'manual'
  | 'nodeSelected'
  | 'secondNodeSelected'
  | 'badgeInteracted'
  | 'panelOpened'
  | 'backToPathways'
  | 'panelClosed'
  | 'cardClicked';

export type SpotlightShape = 'circle' | 'rect';

export interface SpotlightTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: SpotlightShape;
}

export interface CursorAnimation {
  /** Which element the cursor moves to. Resolved to screen coords at runtime. */
  target: 'neighbour' | 'badge' | 'selectedNode' | 'domElement';
  /** CSS selector for the target element. Used when target === 'domElement'. */
  targetSelector?: string;
  /** 'demo' triggers effects on arrive (e.g. simulated hover). 'hint' just points visually. Default: 'demo'. */
  mode?: 'demo' | 'hint';
  /** Show a press-down click animation when cursor arrives at target. Default: false. */
  clickEffect?: boolean;
  /** Override initial delay before cursor appears (default: 800ms) */
  delayMs?: number;
  /** Override linger duration on target (default: 1400ms) */
  lingerMs?: number;
}

export type TooltipPosition = 'right' | 'left' | 'top-left' | 'top-right';

export interface TooltipAnchor {
  /** CSS selector for the anchor element */
  selector: string;
  /** Where to place tooltip relative to anchor */
  position: TooltipPosition;
  /** Fine-tuning horizontal offset (default: 16) */
  offsetX?: number;
  /** Fine-tuning vertical offset (default: 0) */
  offsetY?: number;
}

export interface TutorialStep {
  id: string;
  prompt: string;
  completionEvent: CompletionEvent;
  autoAdvance?: boolean;
  resolveSpotlight:
    | ((context: SpotlightContext) => SpotlightTarget | null)
    | null;
  cursorAnimation?: CursorAnimation;
  preferredNeighbourId?: string;
  clearSpotlight?: boolean;
  tooltipAnchor?: TooltipAnchor;
}

export interface SpotlightContext {
  graphContainerRect: DOMRect | null;
  heroSearchRect: DOMRect | null;
  nodeToScreenCoords:
    | ((nodeId: string) => { x: number; y: number } | null)
    | null;
  selectedNodeId: string | null;
  neighbourNodeId: string | null;
  neighbourIds: string[];
  badgeScreenPos: { x: number; y: number } | null;
}

// ─── Step Registry ───────────────────────────────────────────────────────────

export const STEP_REGISTRY: Record<string, TutorialStep> = {
  search: {
    id: 'search',
    prompt: 'Select an occupation from the list to begin.',
    completionEvent: 'nodeSelected',
    autoAdvance: true,
    resolveSpotlight: ({ heroSearchRect }) => {
      if (!heroSearchRect) return null;
      const dropdownHeight = 400;
      const totalHeight = heroSearchRect.height + dropdownHeight;
      return {
        x: heroSearchRect.left + heroSearchRect.width / 2,
        y: heroSearchRect.top + totalHeight / 2,
        width: heroSearchRect.width + 16,
        height: totalHeight + 16,
        shape: 'rect',
      };
    },
  },
  hover: {
    id: 'hover',
    prompt:
      'Notice that your selected occupation and its connections are highlighted in the explorer. Hover over the nodes to reveal the occupation names.',
    completionEvent: 'manual',
    cursorAnimation: { target: 'neighbour' },
    preferredNeighbourId: '1421',
    resolveSpotlight: null,
    clearSpotlight: true,
  },
  click: {
    id: 'click',
    prompt:
      'Click on one of the connected occupations to see which skills they have in common.',
    completionEvent: 'secondNodeSelected',
    autoAdvance: true,
    cursorAnimation: { target: 'neighbour', mode: 'hint', clickEffect: true },
    preferredNeighbourId: '1421',
    resolveSpotlight: null,
  },
  badge: {
    id: 'badge',
    prompt:
      'Hover or click the shared skills badge in the middle to see shared skills.',
    completionEvent: 'badgeInteracted',
    autoAdvance: true,
    resolveSpotlight: null,
  },
  occupationClick: {
    id: 'occupationClick',
    prompt: 'Click on one of the occupations to see more details.',
    completionEvent: 'panelOpened',
    // NOT autoAdvance — fork resolution effect handles advancement
    // after isComparing settles from OccupationPanel
    cursorAnimation: { target: 'neighbour', mode: 'hint', clickEffect: true },
    resolveSpotlight: null,
    clearSpotlight: true,
  },
  compare: {
    id: 'compare',
    prompt:
      'This view compares the two occupations side-by-side. Notice that AI exposure is lower, while median wages is higher for the second occupation.',
    completionEvent: 'manual',
    resolveSpotlight: null,
    clearSpotlight: true,
    tooltipAnchor: {
      selector: '[data-tutorial-target="ai-exposure-row"]',
      position: 'top-right',
    },
  },
  skills: {
    id: 'skills',
    prompt:
      'Notice that the skills required to transition to this occupation are listed. Hover over the skills to access training programmes for that skill (currently under construction).',
    completionEvent: 'manual',
    resolveSpotlight: null,
    clearSpotlight: true,
    tooltipAnchor: {
      selector: '[data-tutorial-target="skills-section"]',
      position: 'right',
    },
  },
  backToPathways: {
    id: 'backToPathways',
    prompt:
      'Click "Back to pathways" to see other occupations you could transition to.',
    completionEvent: 'backToPathways',
    autoAdvance: true,
    resolveSpotlight: null,
    clearSpotlight: true,
    cursorAnimation: {
      target: 'domElement',
      targetSelector: '[data-tutorial-target="back-to-pathways"]',
      mode: 'hint',
      clickEffect: true,
    },
    tooltipAnchor: {
      selector: '[data-tutorial-target="back-to-pathways"]',
      position: 'top-left',
    },
  },
  pathways: {
    id: 'pathways',
    prompt:
      'Explore different occupations that you can transition into by browsing the occupation cards here.',
    completionEvent: 'manual',
    resolveSpotlight: null,
    clearSpotlight: true,
    tooltipAnchor: {
      selector: '[data-tutorial-target="pathways-list"]',
      position: 'right',
    },
  },
  pathwaysPick: {
    id: 'pathwaysPick',
    prompt: 'Click one of the occupations you can transition to.',
    completionEvent: 'cardClicked',
    autoAdvance: true,
    resolveSpotlight: null,
    clearSpotlight: true,
    cursorAnimation: {
      target: 'domElement',
      targetSelector: '[data-tutorial-target="pathways-list"] button:first-child',
      mode: 'hint',
      clickEffect: true,
    },
    tooltipAnchor: {
      selector: '[data-tutorial-target="pathways-list"]',
      position: 'right',
    },
  },
  closePanel: {
    id: 'closePanel',
    prompt: 'Close this panel to return to the full graph.',
    completionEvent: 'panelClosed',
    autoAdvance: true,
    resolveSpotlight: null,
    clearSpotlight: true,
    cursorAnimation: {
      target: 'domElement',
      targetSelector: '[data-tutorial-target="panel-close"]',
      mode: 'hint',
      clickEffect: true,
    },
    tooltipAnchor: {
      selector: '[data-tutorial-target="panel-close"]',
      position: 'top-left',
    },
  },
  explore: {
    id: 'explore',
    prompt: "You're all set — happy exploring!",
    completionEvent: 'manual',
    resolveSpotlight: null,
    clearSpotlight: true,
  },
};

// ─── Flow Paths ──────────────────────────────────────────────────────────────

export const CONNECTED_PATH = [
  'search', 'hover', 'click', 'badge', 'occupationClick',
  'compare', 'skills', 'backToPathways', 'pathways', 'closePanel', 'explore',
] as const;

export const CENTER_PATH = [
  'search', 'hover', 'click', 'badge', 'occupationClick',
  'pathwaysPick', 'compare', 'skills', 'backToPathways', 'pathways', 'closePanel', 'explore',
] as const;

/** Shared prefix before the fork point (exclusive of the fork step itself). */
const SHARED_PREFIX = ['search', 'hover', 'click', 'badge'];

/** Steps that depend on the panel being open — if panel closes, jump to explore. */
export const PANEL_DEPENDENT_STEPS = new Set([
  'compare', 'skills', 'backToPathways', 'pathways', 'pathwaysPick',
]);

/** Steps where outside interaction should be prevented on the panel. */
export const PREVENT_INTERACT_STEPS = new Set([
  'compare', 'skills', 'backToPathways', 'pathways', 'pathwaysPick', 'closePanel',
]);

/**
 * Determine the next step ID based on the current step and context.
 * Returns null if we're at the end of the path.
 */
export function getNextStepId(
  currentId: string,
  context: { isComparing: boolean },
): string | null {
  const path = resolveActivePath(currentId, context.isComparing);
  const idx = path.indexOf(currentId);
  if (idx === -1 || idx === path.length - 1) return null;
  return path[idx + 1];
}

/**
 * Resolve which path is active. Before the fork, returns CONNECTED_PATH
 * (both paths share the same prefix so it doesn't matter).
 * After the fork, checks isComparing.
 */
export function resolveActivePath(
  currentStepId: string,
  isComparing: boolean,
): readonly string[] {
  if (SHARED_PREFIX.includes(currentStepId)) {
    return CONNECTED_PATH; // doesn't matter — prefix is identical
  }
  return isComparing ? CONNECTED_PATH : CENTER_PATH;
}
