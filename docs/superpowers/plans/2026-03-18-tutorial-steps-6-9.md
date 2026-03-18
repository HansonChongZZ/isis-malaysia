# Tutorial Steps 6–9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the tutorial from 5 to 9 steps — guiding users through the comparison modal, back to transition pathways, closing the modal, and a final "happy exploring" message.

**Architecture:** Add `data-tutorial-target` attributes to DOM elements, extend the `useTutorial` hook with a DOM element position resolver and new completion events, raise TutorialOverlay z-index to layer above the Radix Dialog portal, and plumb `isComparing` state from OccupationPanel to page.tsx via a callback.

**Tech Stack:** React, Next.js, TypeScript, Radix Dialog, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-18-tutorial-steps-6-9-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `components/tutorial/tutorialConfig.ts` | Step definitions & types | Extend types, add 4 steps |
| `components/tutorial/useTutorial.ts` | Tutorial state machine | Add `isComparing` prop, DOM resolver, new events, immediate confirm logic, panel-closed guards |
| `components/tutorial/TutorialOverlay.tsx` | Overlay rendering | Raise z-index, "Finish" button text |
| `components/panel/ComparisonGrid.tsx` | Comparison view | Add `data-tutorial-target` attribute |
| `components/panel/OccupationPanel.tsx` | Modal wrapper | Add `data-tutorial-target` attribute, `onComparisonChange` callback |
| `app/page.tsx` | State orchestration | Wire `isComparing`, clear state on tutorial end |

---

### Task 1: Extend types and add new steps in tutorialConfig.ts

**Files:**
- Modify: `components/tutorial/tutorialConfig.ts`

- [ ] **Step 1: Extend `CompletionEvent` type**

In `components/tutorial/tutorialConfig.ts`, replace line 1:

```ts
export type CompletionEvent = 'manual' | 'nodeSelected' | 'secondNodeSelected' | 'badgeInteracted' | 'panelOpened' | 'backToPathways' | 'panelClosed'
```

- [ ] **Step 2: Extend `CursorAnimation` interface**

Add `'domElement'` to the `target` union and add `targetSelector` field. Replace the `CursorAnimation` interface (lines 13-24):

```ts
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
```

- [ ] **Step 3: Add a `clearSpotlight` field to `TutorialStep`**

Add an optional `clearSpotlight` boolean to the `TutorialStep` interface (after `preferredNeighbourId`):

```ts
  clearSpotlight?: boolean // When true, clears prevSpotlightRef on entry (tooltip centers on screen)
```

- [ ] **Step 4: Add 4 new steps to `TUTORIAL_STEPS` array**

Append after the existing `detail` step (before the closing `]` on line 122):

```ts
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
```

- [ ] **Step 5: Verify the build compiles**

Run: `cd /Users/alika_whoo/Documents/work/scoping/isis && npx next build 2>&1 | tail -20`

Expected: Build may have type errors in `useTutorial.ts` since it doesn't handle the new events yet — that's fine, we'll fix those in Task 2. If there are errors _only_ in `tutorialConfig.ts`, fix them before proceeding.

- [ ] **Step 6: Commit**

```bash
git add components/tutorial/tutorialConfig.ts
git commit -m "feat(tutorial): extend types and add steps 6-9 config"
```

---

### Task 2: Add `data-tutorial-target` attributes to DOM elements

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx`
- Modify: `components/panel/OccupationPanel.tsx`

- [ ] **Step 1: Add target attribute to ComparisonGrid back button**

In `components/panel/ComparisonGrid.tsx`, find the back button `<button>` element (line 119). Add the `data-tutorial-target` attribute:

```tsx
      <button
        type="button"
        onClick={onBack}
        data-tutorial-target="back-to-pathways"
        className="w-full flex items-center gap-3 px-5 py-2.5 bg-primary/15 hover:bg-primary/25 border-b border-primary/30 transition-colors cursor-pointer text-left"
      >
```

- [ ] **Step 2: Add target attribute to OccupationPanel close button**

In `components/panel/OccupationPanel.tsx`, find the `<DialogClose>` element (line 151). Add the `data-tutorial-target` attribute:

```tsx
                <DialogClose
                  data-tutorial-target="panel-close"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mt-0.5"
                >
```

- [ ] **Step 3: Add `onComparisonChange` callback prop to OccupationPanel**

In `components/panel/OccupationPanel.tsx`, add the prop to the interface (after `initialComparisonId`):

```ts
  onComparisonChange?: (isComparing: boolean) => void
```

Add it to the destructured props:

```ts
export default function OccupationPanel({
  nodeId,
  detail,
  nodes,
  edges,
  occupations,
  isOpen,
  onClose,
  initialComparisonId,
  onComparisonChange,
}: OccupationPanelProps) {
```

Then add a `useEffect` after the existing `isComparing` derived variable (after line 123) to notify the parent. Use the existing `isComparing` local variable rather than recomputing:

```ts
  useEffect(() => {
    onComparisonChange?.(isComparing)
  }, [isComparing, onComparisonChange])
```

- [ ] **Step 4: Commit**

```bash
git add components/panel/ComparisonGrid.tsx components/panel/OccupationPanel.tsx
git commit -m "feat(tutorial): add data-tutorial-target attributes and onComparisonChange callback"
```

---

### Task 3: Update useTutorial hook with new logic

**Files:**
- Modify: `components/tutorial/useTutorial.ts`

- [ ] **Step 1: Add `isComparing` to props interface**

In `components/tutorial/useTutorial.ts`, add to `UseTutorialProps` (after `isPanelOpen: boolean` on line 20):

```ts
  isComparing: boolean
```

Add it to the destructured params of `useTutorial` (after `isPanelOpen`):

```ts
  isComparing,
```

- [ ] **Step 2: Add DOM element resolver to `cursorAnimProps` memo**

In the `cursorAnimProps` memo (starting line 177), the first guard checks `!spotlight`. For `domElement` targets, we don't need a spotlight. Replace the entire memo with:

```ts
  const cursorAnimProps = useMemo(() => {
    if (!stepConfig?.cursorAnimation || !spotlightReady) return null

    // Resolve target coordinates
    let to: { x: number; y: number } | null = null
    const { target } = stepConfig.cursorAnimation

    if (target === 'domElement' && stepConfig.cursorAnimation.targetSelector) {
      // DOM element targeting — separate code path from graph-based targets
      const el = document.querySelector(stepConfig.cursorAnimation.targetSelector)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      // Fixed offset: cursor enters from 120px above-right of target
      const from = { x: to.x + 80, y: to.y - 90 }
      return {
        from,
        to,
        clickEffect: stepConfig.cursorAnimation.clickEffect,
        delayMs: stepConfig.cursorAnimation.delayMs,
        lingerMs: stepConfig.cursorAnimation.lingerMs,
      }
    }

    // Graph-based targets require spotlight for `from` computation
    if (!spotlight) return null

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
      clickEffect: stepConfig.cursorAnimation.clickEffect,
      delayMs: stepConfig.cursorAnimation.delayMs,
      lingerMs: stepConfig.cursorAnimation.lingerMs,
    }
  }, [stepConfig, spotlightReady, spotlight, resolvedNeighbourId, getNodeScreenCoords, graphContainerRect, heroSearchRect, selectedNodeId, allNeighbourIds, badgePos])
```

- [ ] **Step 3: Add immediate confirm for manual steps without cursor**

Add a new `useEffect` after the existing fallback effect (after line 271):

```ts
  // Immediate confirm for manual steps with no cursor animation (e.g. "compare", "explore")
  useEffect(() => {
    if (
      stepConfig &&
      stepConfig.completionEvent === 'manual' &&
      !stepConfig.cursorAnimation &&
      !isConfirming
    ) {
      setIsConfirming(true)
    }
  }, [stepConfig, isConfirming])
```

- [ ] **Step 4: Add `clearSpotlight` handling in spotlight memo**

In the `spotlight` memo (line 157), add a check for `clearSpotlight` right after the `if (!stepConfig || !spotlightReady)` guard:

```ts
  const spotlight = useMemo(() => {
    if (!stepConfig || !spotlightReady) return prevSpotlightRef.current
    // Clear spotlight when step requests it (e.g. final "happy exploring" step)
    if (stepConfig.clearSpotlight) {
      prevSpotlightRef.current = null
      return null
    }
    // null resolveSpotlight = keep previous spotlight
    if (!stepConfig.resolveSpotlight) return prevSpotlightRef.current
    // ... rest unchanged
```

- [ ] **Step 5: Add new completion event detection**

In the completion event detection `useEffect` (line 274), add two new event cases after the `panelOpened` check (after line 286):

```ts
    } else if (event === 'backToPathways' && !isComparing && isPanelOpen) {
      // Guard: only trigger if panel is still open — if panel closed, the panel-closed guard handles it
      triggered = true
    } else if (event === 'panelClosed' && !isPanelOpen) {
      triggered = true
    }
```

Also add `isComparing` to the effect's dependency array (line 301):

```ts
  }, [isActive, isConfirming, stepConfig, currentStep, selectedNodeId, secondSelectedNodeId, hoveredNodeId, resolvedNeighbourId, edges, badgeInteracted, isPanelOpen, isComparing])
```

- [ ] **Step 6: Add panel-closed guard for steps 6-7**

Add a new `useEffect` after the completion event detection effect to handle the user closing the panel during modal-dependent steps:

```ts
  // Guard: if panel closes during modal-dependent steps (compare, backToPathways),
  // skip ahead to the "explore" step to avoid stranded prompts
  useEffect(() => {
    if (!isActive) return
    const stepId = stepConfig?.id
    if ((stepId === 'compare' || stepId === 'backToPathways') && !isPanelOpen) {
      const exploreIdx = STEP_IDX.explore
      if (exploreIdx !== undefined) {
        setCurrentStep(exploreIdx)
        setIsConfirming(false)
      }
    }
  }, [isActive, stepConfig, isPanelOpen])
```

- [ ] **Step 7: Verify the build compiles**

Run: `cd /Users/alika_whoo/Documents/work/scoping/isis && npx next build 2>&1 | tail -20`

Expected: May still fail since `page.tsx` doesn't pass `isComparing` yet — that's Task 5. Verify no errors in `useTutorial.ts` itself.

- [ ] **Step 8: Commit**

```bash
git add components/tutorial/useTutorial.ts
git commit -m "feat(tutorial): add DOM element resolver, new events, and panel-closed guards"
```

---

### Task 4: Update TutorialOverlay with z-index and Finish button

**Files:**
- Modify: `components/tutorial/TutorialOverlay.tsx`

- [ ] **Step 1: Raise z-index**

In `components/tutorial/TutorialOverlay.tsx`, change `z-50` to `z-[60]` on line 51:

```tsx
      className="fixed inset-0 z-[60] transition-opacity duration-300"
```

- [ ] **Step 2: Add `isLastStep` prop and Finish button text**

Add a new optional prop to `TutorialOverlayProps` interface (optional to avoid breaking the build before page.tsx is updated):

```ts
  isLastStep?: boolean
```

Add it to the destructured props. Then change the advance button text (line 138):

```tsx
                {isConfirming && (
                  <button
                    onClick={onAdvance}
                    className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
                  >
                    {isLastStep ? 'Finish' : 'Got it, next \u2192'}
                  </button>
                )}
```

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/TutorialOverlay.tsx
git commit -m "feat(tutorial): raise z-index to z-60 and add Finish button on last step"
```

---

### Task 5: Wire everything in page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `isComparing` state**

In `app/page.tsx`, add a new state variable after `tutorialPhase` state (after line 54):

```ts
  const [isComparing, setIsComparing] = useState(false)
```

- [ ] **Step 2: Pass `isComparing` to `useTutorial`**

Add `isComparing` to the `useTutorial` call (after `isPanelOpen` on line 67):

```ts
    isComparing,
```

- [ ] **Step 3: Pass `isLastStep` to TutorialOverlay**

In the `TutorialOverlay` JSX (line 548), add the new prop:

```tsx
            isLastStep={tutorial.currentStep === TUTORIAL_STEPS.length - 1}
```

- [ ] **Step 4: Pass `onComparisonChange` to OccupationPanel**

In the `OccupationPanel` JSX (line 565), add the callback:

```tsx
        onComparisonChange={setIsComparing}
```

- [ ] **Step 5: Update `handleTutorialSkip` to reset to default view**

First, update `handleTutorialSkip` (line 98) to also reset view mode and `isComparing`:

```ts
  const handleTutorialSkip = () => {
    tutorial.skip()
    setTutorialPhase('done')
    setSelectedNodeId(null)
    setSecondSelectedNodeId(null)
    setPanelNodeId(null)
    setIsPanelOpen(false)
    setOpenedViaSecondary(false)
    setIsComparing(false)
    setViewMode('force')
    setLayoutMode('ring')
  }
```

Then add a `useEffect` after the existing tutorial-phase effects to detect normal tutorial completion (step 9 "Finish" clicked):

```ts
  // Detect tutorial completion (reached last step and became inactive)
  useEffect(() => {
    if (tutorialPhase === 'spotlight' && !tutorial.isActive && tutorial.currentStep === TUTORIAL_STEPS.length - 1) {
      setTutorialPhase('done')
      setSelectedNodeId(null)
      setSecondSelectedNodeId(null)
      setPanelNodeId(null)
      setIsPanelOpen(false)
      setOpenedViaSecondary(false)
      setIsComparing(false)
      setViewMode('force')
      setLayoutMode('ring')
    }
  }, [tutorialPhase, tutorial.isActive, tutorial.currentStep])
```

Also update the `onClose` handler on `OccupationPanel` (line 572) to reset `isComparing` — this ensures correct state even if `OccupationPanel` unmounts before its effect fires:

```tsx
        onClose={() => {
          setIsPanelOpen(false)
          setPanelNodeId(null)
          setOpenedViaSecondary(false)
          setIsComparing(false)
        }}
```

- [ ] **Step 6: Verify the full build compiles**

Run: `cd /Users/alika_whoo/Documents/work/scoping/isis && npx next build 2>&1 | tail -20`

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat(tutorial): wire isComparing state and tutorial completion in page.tsx"
```

---

### Task 6: Manual smoke test

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/alika_whoo/Documents/work/scoping/isis && npm run dev`

- [ ] **Step 2: Walk through the full 9-step tutorial**

1. Refresh the page — TutorialModal appears (2 intro steps)
2. Complete intro → spotlight tutorial begins
3. Steps 1-5: search, hover, click, badge, detail (panel opens)
4. **Step 6 (compare):** Tooltip appears over the modal explaining the comparison sections. Press "Got it, next →"
5. **Step 7 (backToPathways):** Virtual cursor animates to "Back to pathways" button. Click the button → auto-advances
6. **Step 8 (closePanel):** Virtual cursor animates to the X close button. Click it → auto-advances
7. **Step 9 (explore):** Centered tooltip says "You're all set — happy exploring!" with "Finish" button. Click "Finish" → tutorial ends, selections cleared, default force-directed view

- [ ] **Step 3: Test edge cases**

1. During step 6, press Escape → should skip to step 9
2. During step 7, click outside modal to close → should skip to step 9
3. Skip tutorial at any new step → should clear state and return to default view

- [ ] **Step 4: Verify progress dots show 9 steps**

Check that the tooltip's progress dots display 9 dots total, with the correct one highlighted at each step.
