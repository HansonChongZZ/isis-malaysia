# Virtual Cursor Animation for Tutorial Steps

## Overview

Add a visible animated cursor graphic to tutorial steps that demonstrates interactions (hover, click) on the canvas without requiring user input. The cursor enters from the spotlight edge, moves to a target element using spring physics (Framer Motion), triggers the visual effect (e.g. node hover), lingers briefly, then fades out. The user watches the demo and clicks "Got it, next" to proceed.

The system is designed to be reusable — any tutorial step can add a `cursorAnimation` config to get the behavior.

## Motivation

Step 2 ("Hover over connected nodes") currently requires the user to discover and perform a hover interaction. A virtual cursor demo makes the tutorial passive and more accessible — the user watches what hovering does, then proceeds.

## Design

### 1. Tutorial Config Changes (`tutorialConfig.ts`)

Add a `CursorAnimation` interface and make it an optional property on `TutorialStep`:

```ts
interface CursorAnimation {
  /** Which element the cursor moves to. Resolved to screen coords at runtime. */
  target: 'neighbour' | 'badge' | 'selectedNode'
}
```

Changes to the `hover` step:
- `completionEvent`: `'nodeHovered'` → `'manual'`
- `prompt`: Update to "Watch how hovering reveals connections between occupations"
- Add `cursorAnimation: { target: 'neighbour' }`

Target resolution uses existing `SpotlightContext` data:
- `'neighbour'` → `nodeToScreenCoords(resolvedNeighbourId)`
- `'badge'` → `badgeScreenPos`
- `'selectedNode'` → `nodeToScreenCoords(selectedNodeId)`

### 2. VirtualCursor Component (`components/tutorial/VirtualCursor.tsx`)

**New file.** A standalone React component using Framer Motion.

**Props:**
```ts
interface VirtualCursorProps {
  from: { x: number; y: number }   // Origin point (spotlight edge)
  to: { x: number; y: number }     // Target point (node/element position)
  onArrive: () => void              // Called when cursor reaches target
  onComplete: () => void            // Called after linger, cursor fully done
}
```

**Visual:** A macOS-style pointer arrow SVG, ~20px, with a subtle drop shadow for contrast against the dark overlay.

**Animation sequence:**
1. **Delay ~600ms** — lets user orient after spotlight settles
2. **Fade in** at `from` position (opacity 0 → 1, ~200ms)
3. **Spring move** to `to` position (Framer Motion spring: damping ~25, stiffness ~120)
4. **On arrival** — calls `onArrive` callback
5. **Linger ~1000ms** — cursor stays on target so user sees the effect
6. **Fade out** (opacity 1 → 0, ~300ms)
7. **Calls `onComplete`**

**Rendering:** Rendered as a React portal at the document body level to avoid clipping. Uses `position: fixed` with viewport coordinates.

### 3. useTutorial Hook Changes (`useTutorial.ts`)

When the current step has a `cursorAnimation` property:

**Coordinate resolution:**
- `to`: Resolved from `cursorAnimation.target` using `nodeToScreenCoords`, `badgeScreenPos`, etc. from the existing `SpotlightContext`
- `from`: Computed as a point on the spotlight circle/rect edge, on the opposite side from the target (cursor travels across the spotlight toward the target)

**New return values:**
```ts
cursorAnimProps: { from: { x: number; y: number }; to: { x: number; y: number } } | null
onCursorArrive: () => void
onCursorComplete: () => void
```

**Callbacks:**
- `onCursorArrive`: Sets `simulatedHoverId` (or equivalent state) to trigger hover effects on the graph
- `onCursorComplete`: Sets `isConfirming: true` so "Got it, next" button appears

Cursor animation waits for `spotlightReady` before starting (reuses existing 600ms zoom delay logic).

### 4. TutorialOverlay Changes (`TutorialOverlay.tsx`)

- Receives `cursorAnimProps`, `onCursorArrive`, and `onCursorComplete` as new props
- Renders `<VirtualCursor>` when `cursorAnimProps` is non-null
- No structural changes to tooltip, progress dots, or skip button

### 5. OccupationGraph Changes (`OccupationGraph.tsx`)

- New prop: `simulatedHoverId: string | null`
- When `simulatedHoverId` is set, the graph treats it identically to a real hover: sets internal `hoveredNodeId`, shows tooltip, applies opacity/stroke effects
- Implemented as a `useEffect` that mirrors the `onMouseEnter` logic when `simulatedHoverId` changes
- No cursor rendering or animation logic in this component

### 6. page.tsx Changes

- Plumbs `simulatedHoverId` from useTutorial to OccupationGraph
- Passes cursor callback props from useTutorial to TutorialOverlay
- Minimal wiring only

## Animation Flow (Step 2)

```
Step 1 complete (node selected)
  → auto-advance to step 2
  → spotlight zooms to neighbourhood (~600ms, existing)
  → spotlightReady = true
  → VirtualCursor fades in at spotlight edge (~600ms delay + 200ms fade)
  → cursor spring-animates to neighbour node
  → onArrive → simulatedHoverId set → graph shows hover effects
  → cursor lingers ~1000ms
  → cursor fades out
  → onComplete → isConfirming = true → "Got it, next" button appears
  → user clicks → advance to step 3
```

## Files Changed

| File | Type | Change |
|------|------|--------|
| `components/tutorial/tutorialConfig.ts` | Modified | Add `CursorAnimation` type, add to hover step, change event to `'manual'` |
| `components/tutorial/VirtualCursor.tsx` | **New** | Framer Motion animated cursor component |
| `components/tutorial/useTutorial.ts` | Modified | Resolve cursor coordinates, expose animation props/callbacks |
| `components/tutorial/TutorialOverlay.tsx` | Modified | Render `<VirtualCursor>` conditionally |
| `components/graph/OccupationGraph.tsx` | Modified | Add `simulatedHoverId` prop |
| `app/page.tsx` | Modified | Plumb `simulatedHoverId` and cursor props |
| `package.json` | Modified | Add `framer-motion` dependency |

## New Dependency

- `framer-motion` — React animation library for spring-based cursor movement

## Reusability

Any future tutorial step can add cursor animation by adding to its config:

```ts
{
  id: 'someStep',
  prompt: '...',
  completionEvent: 'manual',
  cursorAnimation: { target: 'badge' }, // cursor moves to badge
  resolveSpotlight: ...,
}
```

The VirtualCursor component, coordinate resolution, and callback wiring are all generic — no step-specific logic needed.
