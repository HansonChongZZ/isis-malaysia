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
  /** Override initial delay before cursor appears (default: 600ms) */
  delayMs?: number
  /** Override linger duration on target (default: 1000ms) */
  lingerMs?: number
}
```

Changes to the `hover` step:
- `completionEvent`: `'nodeHovered'` → `'manual'`
- `prompt`: Update to "Watch how hovering reveals connections between occupations"
- Add `cursorAnimation: { target: 'neighbour' }`

Remove `'nodeHovered'` from the `CompletionEvent` union type since no step uses it anymore. Remove the corresponding detection logic in `useTutorial.ts`.

Target resolution uses existing `SpotlightContext` data:
- `'neighbour'` → `nodeToScreenCoords(resolvedNeighbourId)`
- `'badge'` → `badgeScreenPos`
- `'selectedNode'` → `nodeToScreenCoords(selectedNodeId)`

### 2. VirtualCursor Component (`components/tutorial/VirtualCursor.tsx`)

**New file.** A standalone React component using Framer Motion.

**Import strategy:** Dynamically imported via `next/dynamic` (or `React.lazy`) to avoid adding Framer Motion to the main bundle. The project already uses `next/dynamic` for OccupationGraph, so this pattern is established.

**Props:**
```ts
interface VirtualCursorProps {
  from: { x: number; y: number }   // Origin point (spotlight edge)
  to: { x: number; y: number }     // Target point (node/element position)
  delayMs?: number                  // Initial delay (default: 600)
  lingerMs?: number                 // Linger on target (default: 1000)
  onArrive: () => void              // Called when cursor reaches target
  onComplete: () => void            // Called after linger, cursor fully done
}
```

**Visual:** A macOS-style pointer arrow SVG, ~20px, with a subtle drop shadow for contrast against the dark overlay.

**Animation sequence:**
1. **Delay ~600ms** (configurable via `delayMs`) — lets user orient after spotlight settles
2. **Fade in** at `from` position (opacity 0 → 1, ~200ms)
3. **Spring move** to `to` position (Framer Motion spring: damping ~25, stiffness ~120)
4. **On arrival** — calls `onArrive` callback
5. **Linger ~1000ms** (configurable via `lingerMs`) — cursor stays on target so user sees the effect
6. **Fade out** (opacity 1 → 0, ~300ms)
7. **Calls `onComplete`**

**Rendering:** Rendered as a React portal at the document body level to avoid clipping. Uses `position: fixed` with viewport coordinates. Z-index set to `z-[60]` — above the overlay mask (`z-50`) but the cursor is a non-interactive visual element so layering above the tooltip is acceptable.

**Accessibility:** Checks `window.matchMedia('(prefers-reduced-motion: reduce)')`. When active, skips the spring animation — cursor appears directly at the target, lingers, then the step completes. The user still sees the hover effect, just without the movement.

### 3. useTutorial Hook Changes (`useTutorial.ts`)

When the current step has a `cursorAnimation` property:

**Coordinate resolution:**
- `to`: Resolved from `cursorAnimation.target` using `nodeToScreenCoords`, `badgeScreenPos`, etc. from the existing `SpotlightContext`
- `from`: Computed as a point on the spotlight edge. For a **circle** spotlight: the point on the perimeter at the angle from center to `to`, offset by π (opposite side). Formula: `from.x = spotlight.x + r * cos(angle + π)`, `from.y = spotlight.y + r * sin(angle + π)`, where `angle = atan2(to.y - spotlight.y, to.x - spotlight.x)`. For a **rect** spotlight: use the intersection of the line from center to `to` (reversed) with the rect boundary.

**Fallback when resolution fails:** If `nodeToScreenCoords` returns `null` for the target (node not yet laid out, handle not ready), `cursorAnimProps` is set to `null` and the step falls back to showing the "Got it, next" button immediately — no cursor animation.

**New return values:**
```ts
cursorAnimProps: { from: { x: number; y: number }; to: { x: number; y: number }; delayMs?: number; lingerMs?: number } | null
simulatedHoverId: string | null
onCursorArrive: () => void
onCursorComplete: () => void
```

**Callbacks:**
- `onCursorArrive`: Sets internal `simulatedHoverId` state to trigger hover effects on the graph
- `onCursorComplete`: Clears `simulatedHoverId`, sets `isConfirming: true` so "Got it, next" button appears

Cursor animation waits for `spotlightReady` before starting (reuses existing 600ms zoom delay logic).

### 4. TutorialOverlay Changes (`TutorialOverlay.tsx`)

- Receives `cursorAnimProps`, `onCursorArrive`, and `onCursorComplete` as new props
- Renders `<VirtualCursor>` when `cursorAnimProps` is non-null
- No structural changes to tooltip, progress dots, or skip button

### 5. OccupationGraph Changes (`OccupationGraph.tsx`)

New prop: `simulatedHoverId: string | null`

**Hover effect strategy:** The existing hover logic suppresses `hoveredNeighbourIds` and `hoveredEdges` when `selectedNodeId` is set (lines 430-457). During step 2, a node IS selected (from step 1). Rather than modifying these guards (which serve a real UX purpose), the simulated hover targets the **selected-neighbourhood visual effects** that are already active:

- When `simulatedHoverId` is set, a `useEffect` sets internal `hoveredNodeId` to the simulated value
- The graph already shows the selected node's neighbourhood (connected nodes highlighted, others dimmed) — the hover adds the **stroke highlight** on the hovered neighbour and the **tooltip** showing the skill comparison
- The tooltip is rendered by the graph using `nodeToScreenCoords` (exposed via the handle) rather than the internal `transformRef` — this avoids coupling. Alternatively, the `useEffect` can call the same tooltip-setting logic that `onMouseEnter` uses, since `transformRef` is accessible within the component
- When `simulatedHoverId` is cleared, `hoveredNodeId` resets and the tooltip dismisses

**Key point:** The simulated hover does NOT need `hoveredNeighbourIds`/`hoveredEdges` because those features (dimming non-neighbours, showing hover edges) are for the unselected state. In the selected state, the neighbourhood is already visible — the hover just adds a stroke highlight and tooltip on the specific neighbour, which works fine with just `hoveredNodeId`.

**Interaction guards:** During step 2, `disableClick` is already `true` and `disableInteraction` is `false`. No changes needed to these guards. The simulated hover sets state inside the component, bypassing the `onMouseEnter` handler entirely.

### 6. page.tsx Changes

- Passes `simulatedHoverId` from useTutorial return to OccupationGraph as a prop
- Passes `cursorAnimProps`, `onCursorArrive`, `onCursorComplete` to TutorialOverlay
- Minimal wiring only

## Animation Flow (Step 2)

```
Step 1 complete (node selected)
  → auto-advance to step 2
  → spotlight zooms to neighbourhood (~600ms, existing)
  → spotlightReady = true
  → resolve cursor coordinates (target = neighbour node, from = opposite spotlight edge)
    → if resolution fails: skip animation, show "Got it, next" immediately
  → VirtualCursor fades in at spotlight edge (~600ms delay + 200ms fade)
  → cursor spring-animates to neighbour node
  → onArrive → simulatedHoverId set → graph shows stroke highlight + tooltip on neighbour
  → cursor lingers ~1000ms
  → cursor fades out
  → onComplete → simulatedHoverId cleared → isConfirming = true → "Got it, next" appears
  → user clicks → advance to step 3
```

## Files Changed

| File | Type | Change |
|------|------|--------|
| `components/tutorial/tutorialConfig.ts` | Modified | Add `CursorAnimation` type, add to hover step, change event to `'manual'`, remove `'nodeHovered'` from union |
| `components/tutorial/VirtualCursor.tsx` | **New** | Framer Motion animated cursor component (dynamically imported) |
| `components/tutorial/useTutorial.ts` | Modified | Resolve cursor coordinates, expose animation props/callbacks, manage `simulatedHoverId` |
| `components/tutorial/TutorialOverlay.tsx` | Modified | Render `<VirtualCursor>` conditionally |
| `components/graph/OccupationGraph.tsx` | Modified | Add `simulatedHoverId` prop, `useEffect` to set hover state + tooltip |
| `app/page.tsx` | Modified | Plumb `simulatedHoverId` and cursor props |
| `package.json` | Modified | Add `framer-motion` dependency |

## New Dependency

- `framer-motion` — React animation library for spring-based cursor movement. Dynamically imported so it does not affect initial page load (~30-40KB gzipped).

## Reusability

Any future tutorial step can add cursor animation by adding to its config:

```ts
{
  id: 'someStep',
  prompt: '...',
  completionEvent: 'manual',
  cursorAnimation: { target: 'badge', lingerMs: 1500 },
  resolveSpotlight: ...,
}
```

The VirtualCursor component, coordinate resolution, and callback wiring are all generic — no step-specific logic needed.
