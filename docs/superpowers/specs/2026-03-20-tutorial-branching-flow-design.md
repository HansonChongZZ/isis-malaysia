# Tutorial Branching Flow Design

**Date:** 2026-03-20
**Status:** Draft

## Overview

Refactor the tutorial system from a linear step sequence to a branching flow that forks based on user interaction at Step 7. When the user clicks an occupation to see details, the tutorial adapts depending on whether they clicked the **center node** (detail mode) or a **connected node** (comparison mode). Additionally, update tooltip positioning to use DOM-anchored targets with spring animations, and add a new "skills" step.

## Problem

The current tutorial has a single linear path that assumes the user always clicks a connected node to enter comparison mode. In practice, users may click the center node first, which opens the detail/pathways view — not the comparison view. The tutorial should gracefully handle both paths and guide the user through the full feature set regardless of which node they click.

## Design

### Step Registry

Replace the static `TUTORIAL_STEPS` array with a `Map<string, TutorialStep>` keyed by step ID. Each step defines its own config (prompt, cursor, tooltip anchoring, completion event) independently of its position in the flow.

Export a `STEP_REGISTRY: Map<string, TutorialStep>` and remove the index-based `STEP_IDX` lookup.

### Flow Paths

Two ordered paths share the same step pool:

```
CONNECTED_PATH (user clicks connected node at Step 7):
  search → hover → click → badge → occupationClick →
  compare → skills → backToPathways → pathways → closePanel → explore

CENTER_PATH (user clicks center node at Step 7):
  search → hover → click → badge → occupationClick →
  pathwaysPick → compare → skills → backToPathways → closePanel → explore
```

Both paths have 11 steps. Steps 1–5 and the final step are shared.

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

The fork is detected after Step 7 (`occupationClick`) when the panel opens. The `useTutorial` hook already receives `isComparing` as a prop:
- `isComparing === true` → connected node was clicked → connected path
- `isComparing === false` → center node was clicked → center path

### Step Definitions

#### Step 7 — `occupationClick` (replaces old `detail`)
- **Prompt:** "Click on one of the occupations to see more details"
- **Completion event:** `panelOpened` (fires when either center or connected node is clicked and panel opens)
- **Cursor:** hint to a nearby node
- **Auto-advance:** true
- **Spotlight:** cleared

#### Step 8 — `compare` (updated)
- **Prompt:** "This view compares the two occupations side-by-side. Notice that AI exposure is lower, while median wages is higher for the second occupation."
- **Completion event:** manual
- **Cursor:** none
- **Tooltip anchor:** right of AI exposure/median wage rows (`[data-tutorial-target="ai-exposure-row"]`)

#### Step 9 — `skills` (new)
- **Prompt:** "Notice that the skills required to transition to this occupation are listed. Hover over the skills to access training programmes for that skill (currently under construction)."
- **Completion event:** manual
- **Cursor:** none
- **Tooltip anchor:** right of skills sub-pane (`[data-tutorial-target="skills-section"]`)

#### Step 10 — `backToPathways` (updated position)
- **Prompt:** "Click 'Back to pathways' to see other occupations you could transition to."
- **Completion event:** `backToPathways`
- **Auto-advance:** true
- **Cursor:** hint to back button (existing DOM target)
- **Tooltip anchor:** top-left, near back button (`[data-tutorial-target="back-to-pathways"]`)

#### Step 11 — `pathways` (connected path only, updated)
- **Prompt:** "Explore different occupations that you can transition into by browsing the occupation cards here."
- **Completion event:** manual
- **Cursor:** none
- **Tooltip anchor:** right of pathways list (`[data-tutorial-target="pathways-list"]`)

#### `pathwaysPick` (center path only)
- **Prompt:** "Explore different occupations that you can transition into by clicking one of the occupation cards."
- **Completion event:** `cardClicked` (new event — fires when user clicks an occupation card, transitioning panel into comparison mode)
- **Cursor:** none
- **Tooltip anchor:** right of pathways list (`[data-tutorial-target="pathways-list"]`)

#### Step 12 — `closePanel` (updated position)
- **Prompt:** "Close this panel to return to the full graph."
- **Completion event:** `panelClosed`
- **Auto-advance:** true
- **Cursor:** hint to X button (existing DOM target)
- **Tooltip anchor:** top-right, near X button (`[data-tutorial-target="panel-close"]`)

#### Step 13 — `explore` (unchanged)
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

When `tooltipAnchor` is defined, `computeTooltipPosition` queries the anchor element via `document.querySelector(selector)` and places the tooltip relative to its bounding rect based on `position`. When absent, falls back to the existing spotlight-based positioning logic.

### Tooltip Spring Animation

Replace the CSS `transition-all duration-300` on the tooltip container with Framer Motion `motion.div` using spring physics:

```ts
transition: { type: 'spring', damping: 25, stiffness: 200 }
```

The tooltip animates `left`/`top` properties smoothly between steps, consistent with the virtual cursor's spring physics.

### New `data-tutorial-target` Attributes

Add to existing components:

| Selector | Component | Element |
|----------|-----------|---------|
| `ai-exposure-row` | `ComparisonGrid` | The row containing AI exposure index and median wage |
| `skills-section` | `ComparisonGrid` | The skills sub-pane (shared skills / skills to develop) |
| `pathways-list` | `OccupationPanel` or `ComparisonGrid` | The transition occupation cards container |

Already exist: `back-to-pathways`, `panel-close`.

### New Completion Event: `cardClicked`

Add `cardClicked` to the `CompletionEvent` union type. Detection in `useTutorial`: when on the `pathwaysPick` step, detect `isComparing` transitioning from `false` to `true` (meaning the user clicked a card and the panel switched to comparison mode).

`OccupationPanel` already handles the card click → comparison transition internally, so no new callback prop is needed — the existing `isComparing` prop change is sufficient for detection.

### useTutorial Hook Changes

- **State:** Track `currentStepId: string` instead of `currentStep: number`
- **Advance:** `advance()` calls `getNextStepId(currentStepId, { isComparing })` to determine the next step
- **Step index:** Computed from the active path for progress dots: `activePath.indexOf(currentStepId)`
- **Total steps:** `activePath.length` (both paths = 11)
- **Path resolution:** Before the fork, path is undetermined — use either path (shared prefix). After `occupationClick`, lock the path based on `isComparing`
- **Guards:** Update panel-close guard to use step IDs: if `currentStepId` is in `['compare', 'skills', 'backToPathways', 'pathways', 'pathwaysPick', 'closePanel']` and `!isPanelOpen`, jump to `explore`

### Component Changes

| File | Changes |
|------|---------|
| `tutorialConfig.ts` | Step registry map, flow paths, `getNextStepId()`, `tooltipAnchor` property, `skills` + `pathwaysPick` steps, `cardClicked` event |
| `useTutorial.ts` | String-based step tracking, `getNextStepId()` in advance, `cardClicked` detection, path-aware progress, updated guards |
| `TutorialOverlay.tsx` | Framer Motion spring on tooltip, resolve `tooltipAnchor` in positioning, path-aware total steps |
| `ComparisonGrid.tsx` | Add `data-tutorial-target` attributes on AI exposure row, skills section |
| `OccupationPanel.tsx` | Add `data-tutorial-target="pathways-list"` on cards container |
| `app/page.tsx` | Minor wiring adjustments for new step IDs |

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
