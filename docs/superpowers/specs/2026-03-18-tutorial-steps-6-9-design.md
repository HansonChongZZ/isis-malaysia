# Tutorial Steps 6–9: Modal Walkthrough & Completion

## Overview

Extend the existing 5-step spotlight tutorial with 4 new steps that guide users through the occupation comparison modal, back to the transition pathways list, closing the modal, and a final "happy exploring" message.

## Approach

**Portal-based tooltip targeting DOM elements (Approach C).** Add `data-tutorial-target` attributes to existing DOM elements. A generic DOM element resolver in `useTutorial` queries selectors, computes bounding rects, and feeds positions to the existing tooltip/cursor system. One unified tutorial system — no separate in-modal overlay.

### Z-index & Portal Layering

The Radix Dialog renders via a portal to `document.body` at `z-50`. The TutorialOverlay also uses `z-50` but is rendered inside `graphContainerRef` — meaning the Dialog portal paints on top regardless of z-index.

**Solution:** For steps where the Dialog is open (steps 6, 7, 8), raise TutorialOverlay to `z-[60]`. The overlay already uses `position: fixed`, so it just needs the higher z-index. The VirtualCursor already portals to `document.body` at `z-index: 60` and will layer correctly. On steps where the Dialog is closed (steps 1-5, 9), the existing `z-50` is fine — but using `z-[60]` uniformly is also safe since nothing else occupies that layer. Simplest approach: always use `z-[60]` on TutorialOverlay.

## New Infrastructure

### 1. `data-tutorial-target` attributes

Add to two existing elements:

- `data-tutorial-target="back-to-pathways"` — on the back button in `ComparisonGrid.tsx` (line ~119)
- `data-tutorial-target="panel-close"` — on the `<DialogClose>` button in `OccupationPanel.tsx` (line ~151)

### 2. Extended `CursorAnimation` type

```ts
// tutorialConfig.ts
export interface CursorAnimation {
  target: 'neighbour' | 'badge' | 'selectedNode' | 'domElement'
  targetSelector?: string           // CSS selector, used when target === 'domElement'
  mode?: 'demo' | 'hint'
  clickEffect?: boolean
  delayMs?: number
  lingerMs?: number
}
```

### 3. New completion events

```ts
export type CompletionEvent =
  | 'manual'
  | 'nodeSelected'
  | 'secondNodeSelected'
  | 'badgeInteracted'
  | 'panelOpened'
  | 'backToPathways'    // NEW: comparison view exits back to transition cards
  | 'panelClosed'       // NEW: panel closes entirely
```

### 4. DOM element position resolver (in `useTutorial`)

When `cursorAnimation.target === 'domElement'`:

1. Query `document.querySelector(targetSelector)` to get the element
2. Call `getBoundingClientRect()` for viewport coordinates
3. Compute `to` as the rect center
4. Compute `from` using a **fixed offset** from `to` (e.g. 120px above and to the right — inside the modal area but away from the button). This is a **separate code path** from the existing spotlight-based ray-casting used for graph node targets, because steps 6-8 have no meaningful spotlight geometry to compute from.

This runs inside the `cursorAnimProps` memo, re-queried on step change to stay accurate. No `ResizeObserver` needed — buttons don't change size during the tutorial.

### 5. New `useTutorial` input

```ts
interface UseTutorialProps {
  // ... existing props ...
  isComparing: boolean   // NEW: true when ComparisonGrid is showing
}
```

`isComparing` transitions from `true` → `false` to trigger the `'backToPathways'` completion event.

**How `isComparing` flows to `page.tsx`:** Add an `onComparisonChange?: (isComparing: boolean) => void` callback prop to `OccupationPanel`. Inside `OccupationPanel`, call it from the existing `useEffect` that manages `comparisonNodeId`. In `page.tsx`, store the value in a `useState<boolean>` and pass it to `useTutorial`. This preserves OccupationPanel's encapsulation of `comparisonNodeId`.

### 6. "Finish" button on last step

In `TutorialOverlay.tsx`, change the advance button text:
- Last step: `"Finish"`
- All other steps: `"Got it, next →"` (unchanged)

## New Steps

### Step 6: `compare` — Explore the comparison

| Field | Value |
|---|---|
| **id** | `compare` |
| **prompt** | "This view compares AI exposure, median wages, and skills between the two occupations — shared skills and skills to develop." |
| **completionEvent** | `'manual'` |
| **autoAdvance** | `false` |
| **resolveSpotlight** | `null` (no spotlight — modal content is visible) |
| **cursorAnimation** | None |

Tooltip appears immediately with "Got it, next →" button (`isConfirming: true` from the start). No spotlight or cursor — user reads the comparison at their own pace.

**Trigger for `isConfirming`:** Add a new `useEffect` in `useTutorial`: when `completionEvent === 'manual'` and `cursorAnimation` is `undefined`, set `isConfirming: true` immediately on step entry. This is a **separate code path** from the existing fallback (which handles the case where `cursorAnimation` is defined but coordinates fail to resolve). The new effect fires on `currentStep` changes and checks the step config directly.

### Step 7: `backToPathways` — Navigate to transition pathways

| Field | Value |
|---|---|
| **id** | `backToPathways` |
| **prompt** | "Click 'Back to pathways' to see other occupations you could transition to." |
| **completionEvent** | `'backToPathways'` |
| **autoAdvance** | `true` |
| **resolveSpotlight** | `null` (no spotlight) |
| **cursorAnimation** | `{ target: 'domElement', targetSelector: '[data-tutorial-target="back-to-pathways"]', mode: 'hint', clickEffect: true }` |

Virtual cursor animates to the "Back to pathways" button. When user clicks it, `isComparing` flips to `false`, triggering auto-advance.

### Step 8: `closePanel` — Close the modal

| Field | Value |
|---|---|
| **id** | `closePanel` |
| **prompt** | "Close this panel to return to the full graph." |
| **completionEvent** | `'panelClosed'` |
| **autoAdvance** | `true` |
| **resolveSpotlight** | `null` (no spotlight) |
| **cursorAnimation** | `{ target: 'domElement', targetSelector: '[data-tutorial-target="panel-close"]', mode: 'hint', clickEffect: true }` |

Virtual cursor animates to the X close button. When user clicks it, `isPanelOpen` flips to `false`, triggering auto-advance.

### Step 9: `explore` — Happy exploring

| Field | Value |
|---|---|
| **id** | `explore` |
| **prompt** | "You're all set — happy exploring!" |
| **completionEvent** | `'manual'` |
| **autoAdvance** | `false` |
| **resolveSpotlight** | `null` — clears `prevSpotlightRef` on entry to this step so `computeTooltipPosition` receives `null` and centers the tooltip |
| **cursorAnimation** | None |

Centered tooltip with "Finish" button. Clicking "Finish" ends the tutorial.

## On Tutorial End

When the tutorial completes (step 9 "Finish" clicked) or is skipped at any point:

- Clear `selectedNodeId` and `secondSelectedNodeId`
- Set `viewMode` back to `'force'` (default force-directed layout)
- Set `layoutMode` back to default
- Remove any locked selections

This is handled in `page.tsx` by reacting to `tutorialPhase` transitioning to `'done'`.

## Files Modified

| File | Change |
|---|---|
| `components/tutorial/tutorialConfig.ts` | Add 4 new steps, extend `CompletionEvent` and `CursorAnimation` types, add `targetSelector` |
| `components/tutorial/useTutorial.ts` | Add `isComparing` prop, DOM element position resolver, `'backToPathways'`/`'panelClosed'` event detection, immediate confirm for manual steps without cursor |
| `components/tutorial/TutorialOverlay.tsx` | "Finish" button text on last step, raise z-index to `z-[60]` to layer above Radix Dialog portal |
| `components/panel/ComparisonGrid.tsx` | Add `data-tutorial-target="back-to-pathways"` attribute |
| `components/panel/OccupationPanel.tsx` | Add `data-tutorial-target="panel-close"` attribute |
| `app/page.tsx` | Pass `isComparing` to `useTutorial`, clear selections on tutorial end |

## Edge Cases

- **DOM element not found:** If `querySelector` returns null (e.g. modal not yet rendered), skip cursor animation and show "Got it, next →" immediately. Existing fallback logic handles this.
- **Panel closed during steps 6 or 7:** If `isPanelOpen` transitions to `false` during step 6 or 7 (e.g. user presses Escape or clicks outside the Dialog), auto-advance directly to step 9 ("happy exploring"), skipping steps 7/8 which require the modal. This prevents the tutorial from being stranded with modal-specific prompts when no modal is visible.
- **Panel already closed before step 8:** If user closes the panel before step 8, detect `isPanelOpen === false` and auto-advance through step 8.
- **Comparison already exited:** If user clicks "Back to pathways" before step 7, detect `isComparing === false` and auto-advance through step 7.
- **Escape key during modal steps:** Radix Dialog closes on Escape by default. Rather than suppressing this behavior (which would feel broken), handle it via the "panel closed during steps 6 or 7" edge case above — gracefully skip to step 9.
- **Resize/scroll:** DOM element positions are re-queried on each render cycle via `getBoundingClientRect()` inside the memo, so they stay accurate.
