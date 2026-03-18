# Tutorial Revamp Design

**Date:** 2026-03-18
**Status:** Approved

## Overview

Enhance the tutorial flow by adding a popup modal as an introductory phase before the existing spotlight overlay. The modal teaches static concepts (what circles are, what size means), then hands off to the interactive spotlight for hands-on guidance.

## Tutorial Flow

1. **Page load** → `TutorialModal` opens (step 1 of 2)
2. **Modal Step 1:** "Each circle is an occupation" — simplified animation showing circles appearing (no MASCO group labels, just varied circles)
3. **Modal Step 2:** "Size shows AI exposure" — `NodeSizingDemo` animation (circles animate from uniform to scaled by AI exposure)
4. **User clicks "Next"** on step 2 → modal closes → spotlight overlay starts immediately
5. **Spotlight steps** (5 steps, old "orient" step removed):
   - `search` — spotlight on search bar, auto-advances on node selection
   - `hover` — spotlight on neighbourhood, manual confirmation
   - `click` — click connected node, auto-advances
   - `badge` — interact with shared skills badge, auto-advances
   - `detail` — click node for details, auto-advances

## Component Changes

### Revive from old commit (50cf488)

- **`TutorialModal.tsx`** — Dialog with step navigation, dot indicators, keyboard nav (left/right arrows). Final step's "Next" button triggers handoff to spotlight.
- **`NodeSizingDemo.tsx`** — D3 animation: circles start uniform, then scale by AI exposure with a Low/High axis label.

### Create new (simplified)

- **`NodeRepresentationDemo.tsx`** — Stripped-down version of the old demo: ~7-10 circles appearing with staggered animation. No MASCO group labels or legend. Just varied colors to convey "each dot = an occupation."

### Modify existing

- **`tutorialConfig.ts`** — Remove the `orient` step (index 0). `TUTORIAL_STEPS` starts at `search`. Step count goes from 6 to 5.
- **`useTutorial.ts`** — Tutorial no longer auto-starts on page load. It starts when `isActive` is set to `true` externally (after modal finishes). Adjust step count references.
- **`TutorialOverlay.tsx`** — Progress dots update from 6 to 5 (derived from `TUTORIAL_STEPS.length`, so this should be automatic).
- **`app/page.tsx`** — Mount `TutorialModal`. Manage `tutorialPhase: 'modal' | 'spotlight' | 'done'`. Starts as `'modal'`. Modal completion triggers `'spotlight'`. Spotlight completion triggers `'done'`.

### Revive data file

- **`tutorialSteps.ts`** — Revive with `SAMPLE_NODES` and `SAMPLE_EDGES` data needed by the demo components.

## Handoff Mechanism

`page.tsx` holds a `tutorialPhase` state:
- `'modal'` — popup modal is showing, spotlight inactive
- `'spotlight'` — modal closed, spotlight overlay active
- `'done'` — tutorial complete

The modal's final "Next" click calls a callback that transitions phase from `'modal'` → `'spotlight'`. The spotlight's completion/skip callback transitions from `'spotlight'` → `'done'`.

## Approach

**Approach A (selected):** Reuse the old `TutorialModal` component and `NodeSizingDemo` from commit `50cf488`. Simplify `NodeRepresentationDemo` to remove MASCO-specific content. Wire modal → spotlight handoff via shared state in `page.tsx`.

## Out of Scope

- Tutorial persistence (replay on every visit)
- Mobile-specific flows
- Analytics tracking
