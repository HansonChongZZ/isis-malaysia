# Tutorial Branching Flow Design

**Date:** 2026-03-20
**Status:** Draft

## Overview

Refactor the tutorial system from a linear step sequence to a branching flow that forks based on user interaction at the `occupationClick` step. When the user clicks an occupation to see details, the tutorial adapts depending on whether they clicked the **center node** (detail mode) or a **connected node** (comparison mode). Additionally, update tooltip positioning to use DOM-anchored targets with spring animations, and add a new "skills" step.

## Problem

The current tutorial has a single linear path that assumes the user always clicks a connected node to enter comparison mode. In practice, users may click the center node first, which opens the detail/pathways view — not the comparison view. The tutorial should gracefully handle both paths and guide the user through the full feature set regardless of which node they click.

## Design

### Step Registry

Replace the static `TUTORIAL_STEPS` array with a `Map<string, TutorialStep>` keyed by step ID. Each step defines its own config (prompt, cursor, tooltip anchoring, completion event) independently of its position in the flow.

Export a `STEP_REGISTRY: Map<string, TutorialStep>` and remove the index-based `STEP_IDX` lookup.

### Flow Paths

Two ordered paths share the same step pool:

```
CONNECTED_PATH (user clicks connected node):
  search → hover → click → badge → occupationClick →
  compare → skills → backToPathways → pathways → closePanel → explore

CENTER_PATH (user clicks center node):
  search → hover → click → badge → occupationClick →
  pathwaysPick → compare → skills → backToPathways → closePanel → explore
```

Both paths have 11 steps. The first 5 steps and the final step are shared.

**Center path rationale:** The center-path user sees the pathways list first (at `pathwaysPick`) and must click a card to enter comparison mode. They then see compare → skills → back to pathways → close. There is no separate "browse pathways" step because the user already interacted with the pathways list during `pathwaysPick`.

### Flow Function

```ts
function getNextStepId(
  currentId: string,
  context: { isComparing: boolean }
): string | null
```

Before the fork (steps 1–5), both paths are identical so `isComparing` doesn't matter. At `occupationClick`, the function checks `isComparing`:
- `true` → connected path → next step is `compare`
- `false` → center path → next step is `pathwaysPick`

After the fork, the function follows the resolved path sequentially.

### Fork Detection

The fork is detected after `occupationClick` when the panel opens. The mechanism relies on `handleNodeSelect` in `page.tsx`:

- **Center node clicked** (`id === selectedNodeId`): Sets `panelNodeId = id`, `openedViaSecondary = false`. Panel opens with `initialComparisonId = null`, so `isComparing = false`. → **Center path.**
- **Connected node clicked** (`firstNodeNeighbours.has(id)`): Sets `secondSelectedNodeId`, then clicking opens panel with `openedViaSecondary = true`, `initialComparisonId = secondSelectedNodeId`, so `isComparing = true`. → **Connected path.**

The `useTutorial` hook already receives `isComparing` as a prop, so the fork is detected by checking this value when advancing from `occupationClick`.

### `allowedClickNodeId` at Fork Step

The current `allowedClickNodeId` constraint restricts clicks to a specific neighbour during `click` and `detail` steps. For the renamed `occupationClick` step, this constraint must be **removed** so the user can click either the center node or any connected node, enabling the fork. Update the `allowedClickNodeId` logic in `page.tsx` to exclude `occupationClick` from the restricted set.

### Step Definitions

Note: Step IDs are used below as headers. Ordinal position varies by path.

#### `occupationClick` (replaces old `detail`)
- **Prompt:** "Click on one of the occupations to see more details"
- **Completion event:** `panelOpened` (fires when either center or connected node is clicked and panel opens)
- **Cursor:** hint to a nearby node
- **Auto-advance:** true
- **Spotlight:** cleared
- **Note:** The old `detail` step hardcoded the occupation name "Retail And Wholesale Trade Managers" in its prompt. This is intentionally replaced with a generic prompt to support either click target.

#### `compare` (updated)
- **Prompt:** "This view compares the two occupations side-by-side. Notice that AI exposure is lower, while median wages is higher for the second occupation."
- **Completion event:** manual
- **Cursor:** none
- **Tooltip anchor:** right of AI exposure/median wage rows (`[data-tutorial-target="ai-exposure-row"]`)

#### `skills` (new)
- **Prompt:** "Notice that the skills required to transition to this occupation are listed. Hover over the skills to access training programmes for that skill (currently under construction)."
- **Completion event:** manual
- **Cursor:** none
- **Tooltip anchor:** right of skills sub-pane (`[data-tutorial-target="skills-section"]`)

#### `backToPathways` (updated position)
- **Prompt:** "Click 'Back to pathways' to see other occupations you could transition to."
- **Completion event:** `backToPathways` (detected when `!isComparing && isPanelOpen`)
- **Auto-advance:** true
- **Cursor:** hint to back button (existing DOM target)
- **Tooltip anchor:** top-left, near back button (`[data-tutorial-target="back-to-pathways"]`)
- **Note on both paths:** On both the connected and center paths, the user reaches this step while in comparison mode (connected path: entered comparison at `occupationClick`; center path: entered comparison at `pathwaysPick` card click). The existing detection (`!isComparing && isPanelOpen`) works identically on both paths because "Back to pathways" always transitions from comparison mode to pathways view.

#### `pathways` (connected path only, updated)
- **Prompt:** "Explore different occupations that you can transition into by browsing the occupation cards here."
- **Completion event:** manual
- **Cursor:** none
- **Tooltip anchor:** right of pathways list (`[data-tutorial-target="pathways-list"]`)

#### `pathwaysPick` (center path only)
- **Prompt:** "Explore different occupations that you can transition into by clicking one of the occupation cards."
- **Completion event:** `cardClicked` (new event — fires when user clicks an occupation card, transitioning panel into comparison mode)
- **Cursor:** none
- **Tooltip anchor:** right of pathways list (`[data-tutorial-target="pathways-list"]`)

#### `closePanel` (updated position)
- **Prompt:** "Close this panel to return to the full graph."
- **Completion event:** `panelClosed`
- **Auto-advance:** true
- **Cursor:** hint to X button (existing DOM target)
- **Tooltip anchor:** top-right, near X button (`[data-tutorial-target="panel-close"]`)

#### `explore` (unchanged)
- **Prompt:** "You're all set — happy exploring!"
- **Completion event:** manual
- **Spotlight:** cleared (tooltip centers on screen)

### Tooltip Anchor System

New optional property on `TutorialStep`:

```ts
tooltipAnchor?: {
  selector: string
  position: 'right' | 'left' | 'top-left' | 'top-right'
  offsetX?: number  // default: 16
  offsetY?: number  // default: 0
}
```

**Resolution flow:** The tooltip anchor position is resolved in `useTutorial` (not during render), similar to how `cursorAnimProps` already performs DOM queries in a `useMemo`. The hook computes the resolved `{ left, top }` coordinates and passes them to `TutorialOverlay` as a `tooltipPosition` prop. When `tooltipAnchor` is defined on the step, the hook queries `document.querySelector(selector)`, gets `getBoundingClientRect()`, and computes coordinates based on `position`. When absent, `TutorialOverlay` falls back to the existing `computeTooltipPosition` spotlight-based logic.

**Scroll handling:** Anchor elements may be inside scrollable containers (e.g., `ComparisonGrid`'s root div has `overflow-y-auto`). To prevent desync, add a `scroll` event listener on the scrollable container during anchored tutorial steps. Use a `data-tutorial-scroll-container` attribute on `ComparisonGrid`'s scrollable root to target it reliably. On scroll, re-compute the anchor position. This listener is added/removed in a `useEffect` keyed to the current step's `tooltipAnchor`.

### Tooltip Spring Animation

Replace the CSS `transition-all duration-300` on the tooltip container with Framer Motion `motion.div` using spring physics:

```ts
transition: { type: 'spring', damping: 25, stiffness: 200 }
```

**Important:** To ensure smooth spring interpolation between positions, `computeTooltipPosition` and the anchor resolution must always output `left`/`top` coordinates (never `right`/`bottom`). Update the existing `computeTooltipPosition` to convert any `right`/`bottom` values to equivalent `left`/`top` before returning. This includes the no-spotlight fallback case (currently `{ left: 16, bottom: 16 }`) which must become `{ left: 16, top: vh - 16 - tooltipHeight }` so that the spring animation always has a `top` value to interpolate from. Framer Motion animates `{ left, top }` via `animate` prop.

### New `data-tutorial-target` Attributes

Add to existing components:

| Selector | Component | Element |
|----------|-----------|---------|
| `ai-exposure-row` | `ComparisonGrid` | The row containing AI exposure index and median wage |
| `skills-section` | `ComparisonGrid` | The skills sub-pane (shared skills / skills to develop) |
| `pathways-list` | `OccupationPanel` or `ComparisonGrid` | The transition occupation cards container |

Already exist: `back-to-pathways`, `panel-close`.

### New Completion Event: `cardClicked`

Add `cardClicked` to the `CompletionEvent` union type.

**Detection mechanism:** Add an explicit `onCardClick` callback prop to `OccupationPanel`, fired when a transition occupation card is clicked. This callback fires **in addition to** the existing internal `setComparisonNodeId(id)` handler — it does not replace it. Implementation in the card click handler:

```ts
onCardClick={(id) => {
  setComparisonNodeId(id)   // existing: enters comparison mode
  onCardClick?.(id)         // new: bubbles up to page.tsx for tutorial
}}
```

This is wired through `page.tsx` to set a `cardClicked` state flag (similar to `badgeInteracted`). The flag is set once and never reset during the tutorial, matching the `badgeInteracted` pattern. In `useTutorial`, the `cardClicked` completion event checks this flag:

```ts
} else if (event === 'cardClicked' && cardClicked) {
  triggered = true
}
```

This follows the same pattern as the existing `badgeInteracted` event and avoids the fragility of detecting `isComparing` state transitions via `useRef` tracking. The `cardClicked` flag is passed as a prop to `useTutorial`.

### useTutorial Hook Changes

- **State:** Track `currentStepId: string` instead of `currentStep: number`
- **Advance:** `advance()` calls `getNextStepId(currentStepId, { isComparing })` to determine the next step
- **Step index:** Computed from the active path for progress dots: `activePath.indexOf(currentStepId)`
- **Total steps:** `activePath.length` (both paths = 11)
- **Path resolution:** Before the fork, path is undetermined — use either path (shared prefix). After `occupationClick`, lock the path based on `isComparing`
- **Guards:** Update panel-close guard to use step IDs: if `currentStepId` is in `['compare', 'skills', 'backToPathways', 'pathways', 'pathwaysPick']` and `!isPanelOpen`, jump to `explore`. Note: `closePanel` is excluded from the guard since `panelClosed` fires naturally at that step.
- **New prop:** `cardClicked: boolean` for the `cardClicked` completion event
- **Tooltip anchor resolution:** New `useMemo` that resolves `tooltipAnchor` selector to `{ left, top }` coordinates, plus `useEffect` for scroll listener on panel container during anchored steps

### Component Changes

| File | Changes |
|------|---------|
| `tutorialConfig.ts` | Step registry map, flow paths, `getNextStepId()`, `tooltipAnchor` property, `skills` + `pathwaysPick` steps, `cardClicked` event |
| `useTutorial.ts` | String-based step tracking, `getNextStepId()` in advance, `cardClicked` detection via prop, path-aware progress, updated guards, tooltip anchor resolution, scroll listener |
| `TutorialOverlay.tsx` | Framer Motion spring on tooltip via `motion.div`, accept resolved `tooltipPosition` prop, `computeTooltipPosition` outputs `left`/`top` only |
| `ComparisonGrid.tsx` | Add `data-tutorial-target` attributes on AI exposure row, skills section |
| `OccupationPanel.tsx` | Add `data-tutorial-target="pathways-list"` on cards container, add `onCardClick` callback prop |
| `app/page.tsx` | Wire `onCardClick` callback + `cardClicked` state flag, relax `allowedClickNodeId` for `occupationClick`, update `preventInteractOutside` guard to include `skills` and `pathwaysPick` step IDs, adjust other step ID references |

### What Stays the Same

- `VirtualCursor.tsx` — no changes
- `TutorialModal.tsx` — no changes (pre-spotlight modal unaffected)
- Steps 1–5 (search through badge) — configs unchanged, moved into registry
- Spotlight rendering system — unchanged
- Existing `data-tutorial-target` attributes — unchanged

## Testing

- **Connected path:** Select occupation → hover → click connected node → badge → click connected node again → compare view → skills → back to pathways → browse → close → explore
- **Center path:** Select occupation → hover → click connected node → badge → click center node → pathways pick card → compare view → skills → back to pathways → close → explore
- **Panel close guard:** Close panel during any panel-dependent step → should jump to explore
- **Tooltip positioning:** Verify tooltips anchor correctly to DOM targets at various viewport sizes
- **Tooltip animation:** Verify smooth spring transitions between step positions
- **Progress dots:** Verify correct count and highlight on both paths
- **Panel scroll:** Scroll the panel content during an anchored tooltip step → tooltip should track the anchor element
- **Tutorial restart:** Restart tutorial → should reset to `search`, clear path lock
- **`allowedClickNodeId`:** At `occupationClick` step, verify both center and connected nodes are clickable
