# Virtual Cursor Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible animated cursor to tutorial steps that demonstrates interactions (hover, click) on the canvas — starting with step 2 ("hover over connected nodes").

**Architecture:** A standalone `VirtualCursor` component (Framer Motion, dynamically imported) renders as a fixed-position portal. The `useTutorial` hook resolves cursor coordinates from the step's `cursorAnimation` config and exposes them to `TutorialOverlay`. OccupationGraph accepts a `simulatedHoverId` prop to trigger hover visuals programmatically.

**Tech Stack:** React, Framer Motion v11+ (new dep), Next.js dynamic imports, CSS

**Spec:** `docs/superpowers/specs/2026-03-18-virtual-cursor-animation-design.md`

---

### Task 1: Install Framer Motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
npm install framer-motion@^11
```

Framer Motion v11+ is required — `onAnimationComplete` fires once when all animated properties finish (not per-property as in older versions).

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion dependency"
```

---

### Task 2: Update tutorial config types and hover step

**Files:**
- Modify: `components/tutorial/tutorialConfig.ts`

- [ ] **Step 1: Add `CursorAnimation` interface and update `TutorialStep`**

Add the new interface after the existing type declarations. Add `cursorAnimation?` to `TutorialStep`. Remove `'nodeHovered'` from `CompletionEvent`.

```ts
export type CompletionEvent = 'manual' | 'nodeSelected' | 'secondNodeSelected' | 'badgeInteracted' | 'panelOpened'

// ... existing interfaces ...

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
  autoAdvance?: boolean
  resolveSpotlight: ((context: SpotlightContext) => SpotlightTarget | null) | null
  cursorAnimation?: CursorAnimation
}
```

- [ ] **Step 2: Update the hover step**

Change the `hover` entry in `TUTORIAL_STEPS`:

```ts
{
  id: 'hover',
  prompt: 'Watch how hovering reveals connections between occupations.',
  completionEvent: 'manual',
  cursorAnimation: { target: 'neighbour' },
  resolveSpotlight: neighbourhoodSpotlight,
},
```

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/tutorialConfig.ts
git commit -m "feat(tutorial): add CursorAnimation config type and update hover step"
```

---

### Task 3: Create VirtualCursor component

**Files:**
- Create: `components/tutorial/VirtualCursor.tsx`

- [ ] **Step 1: Create the component**

The component renders a macOS-style cursor SVG as a fixed-position portal. It uses Framer Motion's `motion.div` with `animate` for the spring movement and opacity transitions.

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, useSpring, animate } from 'framer-motion'

interface VirtualCursorProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  delayMs?: number
  lingerMs?: number
  onArrive: () => void
  onComplete: () => void
}

// macOS-style pointer cursor as inline SVG
function CursorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 3l14 8.5-6.5 1.5-3 6L5 3z"
        fill="white"
        stroke="black"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function VirtualCursor({
  from,
  to,
  delayMs = 600,
  lingerMs = 1000,
  onArrive,
  onComplete,
}: VirtualCursorProps) {
  const [phase, setPhase] = useState<'waiting' | 'fadeIn' | 'moving' | 'lingering' | 'fadeOut' | 'done'>('waiting')
  const [mounted, setMounted] = useState(false)

  // Check reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    setMounted(true)
  }, [])

  // Phase state machine
  useEffect(() => {
    if (!mounted) return

    if (prefersReducedMotion) {
      // Skip animation: go straight to arrive → linger → complete
      const timer = setTimeout(() => {
        onArrive()
        setTimeout(() => {
          onComplete()
        }, lingerMs)
      }, delayMs)
      return () => clearTimeout(timer)
    }

    if (phase === 'waiting') {
      const timer = setTimeout(() => setPhase('fadeIn'), delayMs)
      return () => clearTimeout(timer)
    }
    if (phase === 'fadeIn') {
      // Fade-in duration: 200ms, then start moving
      const timer = setTimeout(() => setPhase('moving'), 200)
      return () => clearTimeout(timer)
    }
    // 'moving' phase is handled by onAnimationComplete on the motion.div
    if (phase === 'lingering') {
      onArrive()
      const timer = setTimeout(() => setPhase('fadeOut'), lingerMs)
      return () => clearTimeout(timer)
    }
    if (phase === 'fadeOut') {
      const timer = setTimeout(() => {
        setPhase('done')
        onComplete()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [phase, mounted, delayMs, lingerMs, prefersReducedMotion, onArrive, onComplete])

  if (!mounted || phase === 'done' || phase === 'waiting' || prefersReducedMotion) return null

  const isVisible = phase !== 'done'
  const opacity = phase === 'fadeIn' || phase === 'moving' || phase === 'lingering' ? 1 : 0

  // Position: during fadeIn use `from`, during moving/lingering/fadeOut animate to `to`
  const targetPos = phase === 'fadeIn' ? from : to

  const cursor = (
    <motion.div
      style={{
        position: 'fixed',
        zIndex: 60,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))',
      }}
      initial={{ x: from.x, y: from.y, opacity: 0 }}
      animate={{
        x: targetPos.x,
        y: targetPos.y,
        opacity,
      }}
      transition={
        phase === 'moving'
          ? { x: { type: 'spring', damping: 25, stiffness: 120 }, y: { type: 'spring', damping: 25, stiffness: 120 }, opacity: { duration: 0.2 } }
          : { opacity: { duration: phase === 'fadeOut' ? 0.3 : 0.2 }, x: { duration: 0 }, y: { duration: 0 } }
      }
      onAnimationComplete={() => {
        if (phase === 'moving') {
          setPhase('lingering')
        }
      }}
    >
      <CursorIcon />
    </motion.div>
  )

  return createPortal(cursor, document.body)
}
```

**Notes for implementer:**
- The `onAnimationComplete` callback from Framer Motion fires when ALL animated properties finish. The spring on `x`/`y` is the longest — so when it fires during the `'moving'` phase, the cursor has arrived at the target.
- The `CursorIcon` is a simple arrow shape. Feel free to adjust the SVG path for better visual fidelity, but keep it simple.
- The component returns `null` during `'waiting'` phase — this is intentional so no DOM element exists before the cursor should appear.

- [ ] **Step 2: Verify the component renders**

Temporarily import and render `<VirtualCursor>` in `page.tsx` with hardcoded coordinates to confirm the animation works visually. Remove after verification.

```tsx
// Temporary test — add at top level of page return, remove after verification
<VirtualCursor
  from={{ x: 100, y: 100 }}
  to={{ x: 400, y: 300 }}
  onArrive={() => console.log('arrived')}
  onComplete={() => console.log('complete')}
/>
```

- [ ] **Step 3: Remove temporary test code and commit**

```bash
git add components/tutorial/VirtualCursor.tsx
git commit -m "feat(tutorial): add VirtualCursor component with Framer Motion spring animation"
```

---

### Task 4: Add `simulatedHoverId` to OccupationGraph

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

- [ ] **Step 1: Add the prop to the component interface**

Find the props interface for OccupationGraph (look for `interface OccupationGraphProps` or the destructured props). Add:

```ts
simulatedHoverId?: string | null
```

- [ ] **Step 2: Add a `useEffect` to handle simulated hover**

Place this near the existing hover-related state (`hoveredNodeId`, `setHoveredNodeId`, around lines 425-457). When `simulatedHoverId` changes:
- Set `hoveredNodeId` to the simulated value
- Call `onNodeHover?.(simulatedHoverId)` to notify parent
- Set the tooltip using the same logic as `onMouseEnter` — get the node from the occupations array, compute screen position with `transformRef.current.applyX/Y`, and include `neighbourDistancesRef.current?.get(nodeId)` for skill comparison data
- On cleanup (or when `simulatedHoverId` becomes null), clear `hoveredNodeId`, `onNodeHover?.(null)`, and `setTooltip(null)`

```tsx
// Simulated hover from tutorial virtual cursor
useEffect(() => {
  if (!simulatedHoverId) return

  // nodeById is a ref (Map<string, GraphNode>) populated during layout — use it for node lookup
  const node = nodeById.current.get(simulatedHoverId)
  if (!node) return

  setHoveredNodeId(simulatedHoverId)
  onNodeHover?.(simulatedHoverId)

  const t = transformRef.current
  const sc =
    selectedNodeId &&
    simulatedHoverId !== selectedNodeId &&
    neighbourDistancesRef.current?.get(simulatedHoverId)
  setTooltip({
    x: t.applyX(node.x),
    y: t.applyY(node.y),
    node,
    skillComparison: sc || undefined,
  })

  return () => {
    setHoveredNodeId(null)
    onNodeHover?.(null)
    setTooltip(null)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- imperative effect driven by tutorial;
  // onNodeHover is a stable setState, selectedNodeId is read from ref-like state at effect time
}, [simulatedHoverId, selectedNodeId, onNodeHover])
```

**Important:** Use `nodeById.current.get(id)` to look up the node — `occupations` is a `Record<string, OccupationDetail>`, not an array. `nodeById` is a `useRef<Map<string, GraphNode>>` that contains the D3 simulation nodes with `x`/`y` coordinates needed for tooltip positioning.

**Important:** The existing hover visual logic already handles `hoveredNodeId`:
- Stroke highlight on the hovered node (lines 1454-1466): checks `isHovered` which is `node.id === hoveredNodeId` — this will work.
- The `hoveredNeighbourIds` memo (line 430) returns `null` when `selectedNodeId` is set — this is expected and fine. The neighbourhood is already visible via `connectedIds`.

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat(tutorial): add simulatedHoverId prop to OccupationGraph"
```

---

### Task 5: Update useTutorial hook to resolve cursor coordinates

**Files:**
- Modify: `components/tutorial/useTutorial.ts`

- [ ] **Step 1: Remove `nodeHovered` detection logic**

In the completion event detection `useEffect` (around line 169-205), remove the `else if (event === 'nodeHovered' ...)` block (lines 175-182).

- [ ] **Step 2: Add cursor coordinate resolution**

Add a `useMemo` that computes `cursorAnimProps` when the current step has `cursorAnimation`:

```ts
const cursorAnimProps = useMemo(() => {
  if (!stepConfig?.cursorAnimation || !spotlightReady || !spotlight) return null

  // Resolve target coordinates
  let to: { x: number; y: number } | null = null
  const { target } = stepConfig.cursorAnimation

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
    // Scale factor to reach the rect edge
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
    delayMs: stepConfig.cursorAnimation.delayMs,
    lingerMs: stepConfig.cursorAnimation.lingerMs,
  }
}, [stepConfig, spotlightReady, spotlight, resolvedNeighbourId, getNodeScreenCoords, graphContainerRect, heroSearchRect, selectedNodeId, allNeighbourIds, badgePos])
```

- [ ] **Step 3: Add `simulatedHoverId` state, cursor callbacks, and fallback logic**

```ts
const [simulatedHoverId, setSimulatedHoverId] = useState<string | null>(null)

const onCursorArrive = useCallback(() => {
  if (!stepConfig?.cursorAnimation) return
  const { target } = stepConfig.cursorAnimation
  if (target === 'neighbour' && resolvedNeighbourId) {
    setSimulatedHoverId(resolvedNeighbourId)
  }
  // Future: handle other targets (badge, selectedNode) here
}, [stepConfig, resolvedNeighbourId])

const onCursorComplete = useCallback(() => {
  setSimulatedHoverId(null)
  setIsConfirming(true)
}, [])

// Fallback: if step has cursorAnimation but coordinates couldn't resolve,
// skip the animation and show "Got it, next" immediately
useEffect(() => {
  if (
    stepConfig?.cursorAnimation &&
    stepConfig.completionEvent === 'manual' &&
    spotlightReady &&
    !cursorAnimProps &&
    !isConfirming
  ) {
    setIsConfirming(true)
  }
}, [stepConfig, spotlightReady, cursorAnimProps, isConfirming])
```

- [ ] **Step 4: Update the return object**

Add the new values to the return:

```ts
return {
  isActive, isVisible, currentStep, isConfirming, stepConfig, spotlight, advance, skip,
  cursorAnimProps,
  simulatedHoverId,
  onCursorArrive,
  onCursorComplete,
}
```

Update the `UseTutorialReturn` interface to include:

```ts
cursorAnimProps: { from: { x: number; y: number }; to: { x: number; y: number }; delayMs?: number; lingerMs?: number } | null
simulatedHoverId: string | null
onCursorArrive: () => void
onCursorComplete: () => void
```

- [ ] **Step 5: Commit**

```bash
git add components/tutorial/useTutorial.ts
git commit -m "feat(tutorial): resolve cursor coordinates and manage simulated hover in useTutorial"
```

---

### Task 6: Update TutorialOverlay to render VirtualCursor

**Files:**
- Modify: `components/tutorial/TutorialOverlay.tsx`

- [ ] **Step 1: Add VirtualCursor import (dynamic)**

At the top of the file, add a dynamic import:

```tsx
import dynamic from 'next/dynamic'

const VirtualCursor = dynamic(() => import('./VirtualCursor'), { ssr: false })
```

- [ ] **Step 2: Add new props to TutorialOverlayProps**

```ts
interface TutorialOverlayProps {
  // ... existing props ...
  cursorAnimProps?: { from: { x: number; y: number }; to: { x: number; y: number }; delayMs?: number; lingerMs?: number } | null
  onCursorArrive?: () => void
  onCursorComplete?: () => void
}
```

Destructure in the component function signature. Note: `currentStep` is already a prop (used for progress dots), so no new prop needed for the `key`.

- [ ] **Step 3: Render VirtualCursor conditionally**

Inside the component's return JSX, after the tooltip `<div>` and before the closing `</div>`, add:

```tsx
{cursorAnimProps && onCursorArrive && onCursorComplete && (
  <VirtualCursor
    key={currentStep}
    from={cursorAnimProps.from}
    to={cursorAnimProps.to}
    delayMs={cursorAnimProps.delayMs}
    lingerMs={cursorAnimProps.lingerMs}
    onArrive={onCursorArrive}
    onComplete={onCursorComplete}
  />
)}
```

**Important:** The `key={currentStep}` forces React to remount VirtualCursor when the tutorial step changes. Without this, if multiple steps have `cursorAnimation`, the component's internal phase state machine would be stuck at `'done'` from the previous animation.

- [ ] **Step 4: Commit**

```bash
git add components/tutorial/TutorialOverlay.tsx
git commit -m "feat(tutorial): render VirtualCursor in TutorialOverlay"
```

---

### Task 7: Wire everything together in page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Pass cursor props from useTutorial to TutorialOverlay**

Find where `<TutorialOverlay>` is rendered (search for `TutorialOverlay`). Add the new props:

```tsx
<TutorialOverlay
  // ... existing props ...
  cursorAnimProps={tutorial.cursorAnimProps}
  onCursorArrive={tutorial.onCursorArrive}
  onCursorComplete={tutorial.onCursorComplete}
/>
```

- [ ] **Step 2: Pass `simulatedHoverId` to OccupationGraph**

Find where `<OccupationGraph>` is rendered. Add:

```tsx
<OccupationGraph
  // ... existing props ...
  simulatedHoverId={tutorial.simulatedHoverId}
/>
```

Note: `tutorial.simulatedHoverId` will be `null` when no cursor animation is active, which is the default/no-op state for the graph.

- [ ] **Step 3: Verify the full flow**

Run the app (`npm run dev`), go through the tutorial:
1. Step 1: Select "Commercial Sales Representatives" from search
2. Step 2 should now show: spotlight on neighbourhood → virtual cursor appears from edge → moves to neighbour node → hover effects appear → cursor fades → "Got it, next" button appears
3. Click "Got it, next" → proceeds to step 3

Check:
- Cursor appears smoothly after spotlight settles
- Spring animation feels natural (not too bouncy, not too stiff)
- Hover stroke highlight and tooltip appear on the target node when cursor arrives
- Tooltip dismisses and cursor fades before "Got it, next" appears
- Skip button still works during animation
- No console errors

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(tutorial): wire virtual cursor animation through page.tsx"
```

---

### Task 8: Polish and edge cases

**Files:**
- Modify: `components/tutorial/VirtualCursor.tsx` (if needed)
- Modify: `components/tutorial/useTutorial.ts` (if needed)

- [ ] **Step 1: Test reduced motion**

In browser DevTools, enable `prefers-reduced-motion: reduce` (Rendering tab → Emulate CSS media feature). Verify the cursor animation is skipped gracefully — hover effect should still appear on the target, and "Got it, next" should show after the delay.

- [ ] **Step 2: Test window resize during animation**

Resize the browser window during the cursor animation. The cursor uses fixed viewport coordinates computed at animation start — verify it still looks reasonable. If the spotlight/nodes shift significantly, the cursor may be slightly off, which is acceptable for a tutorial animation.

- [ ] **Step 3: Test skip during animation**

Click "Skip tutorial" while the cursor is mid-animation. Verify the tutorial dismisses cleanly with no orphaned cursor element or console errors. The portal should unmount when TutorialOverlay unmounts.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(tutorial): polish virtual cursor edge cases"
```
