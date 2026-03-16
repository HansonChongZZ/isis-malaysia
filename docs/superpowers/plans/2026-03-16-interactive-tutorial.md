# Interactive Tutorial Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal-based tutorial with a spotlight + tooltip overlay that guides users through the real force-directed network graph in 4 interactive steps.

**Architecture:** A `TutorialOverlay` component renders an SVG dim layer with spotlight cutouts and a positioned tooltip. A `useTutorial` hook manages step state and observes graph state changes to detect user actions. The graph component exposes a new `onNodeHover` callback and an `onReady` callback (passing a handle with `nodeToScreenCoords`). The overlay sits above the graph in `page.tsx` and is mostly additive — the only graph-level change is a new `forceSelectionMode` prop to override derived `selectionMode` during tutorial steps 2-3.

**Tech Stack:** React 19, TypeScript, D3.js zoom transform, SVG masks, CSS transitions, Next.js 16

**Spec:** `docs/superpowers/specs/2026-03-16-interactive-tutorial-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `components/tutorial/tutorialConfig.ts` | Create | Step definitions (id, prompt, spotlightTarget resolver, completionEvent type) |
| `components/tutorial/useTutorial.ts` | Create | Hook: step state, active/confirming flags, advance/skip logic, event detection |
| `components/tutorial/TutorialOverlay.tsx` | Create | SVG dim layer, spotlight cutout, tooltip, progress dots, skip/next buttons |
| `components/graph/OccupationGraph.tsx` | Modify | Add `onNodeHover` callback prop, `onReady` callback prop (passes handle with `nodeToScreenCoords`), `forceSelectionMode` prop |
| `app/page.tsx` | Modify | Mount overlay, wire tutorial state, add `hoveredNodeId` state, pass tutorial-active flag |
| `app/layout.tsx` | Modify | Remove `TutorialButton` from header |
| `components/tutorial/TutorialModal.tsx` | Delete | Old modal tutorial |
| `components/tutorial/TutorialButton.tsx` | Delete | Old trigger button |
| `components/tutorial/tutorialSteps.ts` | Delete | Old step config with sample data |
| `components/tutorial/steps/*.tsx` | Delete | All 5 demo components |

---

## Chunk 1: Foundation — Config, Hook, and Graph Integration

### Task 1: Create tutorial step configuration

**Files:**
- Create: `components/tutorial/tutorialConfig.ts`

- [ ] **Step 1: Create tutorialConfig.ts with step definitions**

```typescript
export type CompletionEvent = 'manual' | 'nodeSelected' | 'nodeHovered' | 'secondNodeSelected'

export type SpotlightShape = 'circle' | 'rect'

export interface SpotlightTarget {
  x: number
  y: number
  width: number
  height: number
  shape: SpotlightShape
}

export interface TutorialStep {
  id: string
  prompt: string
  completionEvent: CompletionEvent
  resolveSpotlight: (context: SpotlightContext) => SpotlightTarget | null
}

export interface SpotlightContext {
  graphContainerRect: DOMRect | null
  heroSearchRect: DOMRect | null
  nodeToScreenCoords: ((nodeId: string) => { x: number; y: number } | null) | null
  selectedNodeId: string | null
  neighbourNodeId: string | null
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'orient',
    prompt: 'Each circle is a Malaysian occupation. Lines connect jobs that share skills. Bigger circles = higher AI exposure.',
    completionEvent: 'manual',
    resolveSpotlight: ({ graphContainerRect }) => {
      if (!graphContainerRect) return null
      const size = Math.min(graphContainerRect.width, graphContainerRect.height) * 0.4
      return {
        x: graphContainerRect.left + graphContainerRect.width / 2,
        y: graphContainerRect.top + graphContainerRect.height / 2,
        width: size,
        height: size,
        shape: 'circle',
      }
    },
  },
  {
    id: 'search',
    prompt: 'Search for any occupation — try typing a job title (e.g. \u201CPharmacists\u201D).',
    completionEvent: 'nodeSelected',
    resolveSpotlight: ({ heroSearchRect }) => {
      if (!heroSearchRect) return null
      return {
        x: heroSearchRect.left + heroSearchRect.width / 2,
        y: heroSearchRect.top + heroSearchRect.height / 2,
        width: heroSearchRect.width + 16,
        height: heroSearchRect.height + 16,
        shape: 'rect',
      }
    },
  },
  {
    id: 'hover',
    prompt: 'Hover over connected nodes to see how they relate.',
    completionEvent: 'nodeHovered',
    resolveSpotlight: ({ nodeToScreenCoords, neighbourNodeId }) => {
      if (!nodeToScreenCoords || !neighbourNodeId) return null
      const pos = nodeToScreenCoords(neighbourNodeId)
      if (!pos) return null
      return { x: pos.x, y: pos.y, width: 120, height: 120, shape: 'circle' }
    },
  },
  {
    id: 'click',
    prompt: 'Click a connected occupation to compare skills and see transition pathways.',
    completionEvent: 'secondNodeSelected',
    resolveSpotlight: ({ nodeToScreenCoords, neighbourNodeId }) => {
      if (!nodeToScreenCoords || !neighbourNodeId) return null
      const pos = nodeToScreenCoords(neighbourNodeId)
      if (!pos) return null
      return { x: pos.x, y: pos.y, width: 120, height: 120, shape: 'circle' }
    },
  },
]
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to tutorialConfig.ts

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/tutorialConfig.ts
git commit -m "feat(tutorial): add interactive tutorial step configuration"
```

---

### Task 2: Create useTutorial hook

**Files:**
- Create: `components/tutorial/useTutorial.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { TUTORIAL_STEPS, type SpotlightContext, type SpotlightTarget } from './tutorialConfig'
import type { GraphEdge } from '@/lib/types'

export interface OccupationGraphHandle {
  nodeToScreenCoords: (nodeId: string) => { x: number; y: number } | null
}

interface UseTutorialProps {
  selectedNodeId: string | null
  secondSelectedNodeId: string | null
  hoveredNodeId: string | null
  edges: GraphEdge[]
  graphContainerRect: DOMRect | null
  heroSearchRect: DOMRect | null
  graphHandleRef: React.RefObject<OccupationGraphHandle | null>
}

interface UseTutorialReturn {
  isActive: boolean
  isVisible: boolean // true during fade-out, false after animation completes
  currentStep: number
  isConfirming: boolean
  stepConfig: typeof TUTORIAL_STEPS[number] | null
  spotlight: SpotlightTarget | null
  advance: () => void
  skip: () => void
}

export function useTutorial({
  selectedNodeId,
  secondSelectedNodeId,
  hoveredNodeId,
  edges,
  graphContainerRect,
  heroSearchRect,
  graphHandleRef,
}: UseTutorialProps): UseTutorialReturn {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [isVisible, setIsVisible] = useState(true) // for fade-out animation
  const [isConfirming, setIsConfirming] = useState(false)

  const stepConfig = isActive ? TUTORIAL_STEPS[currentStep] ?? null : null

  // Read nodeToScreenCoords from ref (stable reference, no dependency issues)
  const getNodeScreenCoords = useCallback((nodeId: string) => {
    return graphHandleRef.current?.nodeToScreenCoords(nodeId) ?? null
  }, [graphHandleRef])

  // Find the best neighbour for steps 3-4: highest edge weight, tiebreak by screen distance
  const neighbourNodeId = useMemo(() => {
    if (!selectedNodeId) return null
    const neighbours = edges
      .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
      .map(e => ({
        id: e.source === selectedNodeId ? e.target : e.source,
        weight: e.weight,
      }))

    if (neighbours.length === 0) return null

    const maxWeight = Math.max(...neighbours.map(n => n.weight))
    const topNeighbours = neighbours.filter(n => n.weight === maxWeight)

    if (topNeighbours.length === 1) return topNeighbours[0].id

    // Tiebreak by screen distance to selected node
    const selectedPos = getNodeScreenCoords(selectedNodeId)
    if (!selectedPos) return topNeighbours[0].id

    let closest = topNeighbours[0]
    let closestDist = Infinity
    for (const n of topNeighbours) {
      const pos = getNodeScreenCoords(n.id)
      if (!pos) continue
      const dist = Math.hypot(pos.x - selectedPos.x, pos.y - selectedPos.y)
      if (dist < closestDist) {
        closestDist = dist
        closest = n
      }
    }
    return closest.id
  }, [selectedNodeId, edges, getNodeScreenCoords])

  // Lock neighbourNodeId once resolved (don't update if simulation shifts)
  const lockedNeighbourRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentStep >= 2 && neighbourNodeId && !lockedNeighbourRef.current) {
      lockedNeighbourRef.current = neighbourNodeId
    }
    if (currentStep < 2) {
      lockedNeighbourRef.current = null
    }
  }, [currentStep, neighbourNodeId])

  const resolvedNeighbourId = lockedNeighbourRef.current ?? neighbourNodeId

  // Resolve spotlight position
  const spotlight = useMemo(() => {
    if (!stepConfig) return null
    const context: SpotlightContext = {
      graphContainerRect,
      heroSearchRect,
      nodeToScreenCoords: getNodeScreenCoords,
      selectedNodeId,
      neighbourNodeId: resolvedNeighbourId,
    }
    return stepConfig.resolveSpotlight(context)
  }, [stepConfig, graphContainerRect, heroSearchRect, getNodeScreenCoords, selectedNodeId, resolvedNeighbourId])

  // Detect completion events
  useEffect(() => {
    if (!isActive || isConfirming) return
    const event = stepConfig?.completionEvent
    if (event === 'nodeSelected' && selectedNodeId) {
      setIsConfirming(true)
    } else if (event === 'nodeHovered' && hoveredNodeId && resolvedNeighbourId) {
      // Accept hover on any neighbour, not just the spotlighted one
      const neighbourIds = new Set(
        edges
          .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
          .map(e => (e.source === selectedNodeId ? e.target : e.source))
      )
      if (neighbourIds.has(hoveredNodeId)) {
        setIsConfirming(true)
      }
    } else if (event === 'secondNodeSelected' && secondSelectedNodeId) {
      setIsConfirming(true)
    }
  }, [isActive, isConfirming, stepConfig, selectedNodeId, secondSelectedNodeId, hoveredNodeId, resolvedNeighbourId, edges])

  // Fade-out: when isActive becomes false, keep isVisible true for 300ms
  useEffect(() => {
    if (!isActive && isVisible) {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isActive, isVisible])

  const advance = useCallback(() => {
    setIsConfirming(false)
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      setIsActive(false)
    }
  }, [currentStep])

  const skip = useCallback(() => {
    setIsActive(false)
    setIsConfirming(false)
  }, [])

  return { isActive, isVisible, currentStep, isConfirming, stepConfig, spotlight, advance, skip }
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to useTutorial.ts

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/useTutorial.ts
git commit -m "feat(tutorial): add useTutorial hook for step state and event detection"
```

---

### Task 3: Add onNodeHover, onReady, and forceSelectionMode to OccupationGraph

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

- [ ] **Step 1: Add new props to the component props interface**

At the props interface (around line 50-80), add:

```typescript
onNodeHover?: (nodeId: string | null) => void
onReady?: (handle: { nodeToScreenCoords: (nodeId: string) => { x: number; y: number } | null }) => void
forceSelectionMode?: 'single' | null  // Override derived selectionMode when tutorial is active
```

- [ ] **Step 2: Call `onReady` after graph setup**

After the D3 setup is complete (after the zoom initialisation around line 1040), call `onReady` with the handle. Use a `useEffect` that runs once the graph is mounted:

```typescript
useEffect(() => {
  onReady?.({
    nodeToScreenCoords: (nodeId: string) => {
      const node = nodeById.current.get(nodeId)
      if (!node) return null
      const t = transformRef.current
      return { x: t.applyX(node.x), y: t.applyY(node.y) }
    },
  })
}, [onReady])
```

- [ ] **Step 3: Apply forceSelectionMode override**

Where `selectionMode` is derived (around line 143-147), update to respect the override:

```typescript
const derivedSelectionMode = !selectedNodeId
  ? 'none'
  : secondSelectedNodeId
    ? 'pair'
    : 'single'
const selectionMode = forceSelectionMode ?? derivedSelectionMode
```

This ensures hover events are not suppressed during tutorial steps 2-3 when `forceSelectionMode='single'` is passed.

- [ ] **Step 4: Wire `onNodeHover` into existing hover handlers**

In the `onMouseEnter` handler (around line 1322-1345), after the existing `setHoveredNodeId(node.id)` call, add:

```typescript
onNodeHover?.(node.id)
```

In the `onMouseLeave` handler (around line 1346-1352), inside the timeout callback after `setHoveredNodeId(null)`, add:

```typescript
onNodeHover?.(null)
```

- [ ] **Step 5: Verify file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to OccupationGraph.tsx

- [ ] **Step 6: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat(tutorial): add onNodeHover, onReady, and forceSelectionMode props to OccupationGraph"
```

---

## Chunk 2: Overlay Component and Page Integration

### Task 4: Create TutorialOverlay component

**Files:**
- Create: `components/tutorial/TutorialOverlay.tsx`

- [ ] **Step 1: Create the overlay component**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { type SpotlightTarget } from './tutorialConfig'

interface TutorialOverlayProps {
  isActive: boolean
  currentStep: number
  totalSteps: number
  isConfirming: boolean
  prompt: string
  spotlight: SpotlightTarget | null
  onAdvance: () => void
  onSkip: () => void
}

export default function TutorialOverlay({
  isActive,
  currentStep,
  totalSteps,
  isConfirming,
  prompt,
  spotlight,
  onAdvance,
  onSkip,
}: TutorialOverlayProps) {
  // Track viewport dimensions for tooltip positioning (updates on resize)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Tooltip positioning: opposite side of spotlight
  const tooltipStyle = computeTooltipPosition(spotlight, viewport.w, viewport.h)

  return (
    <div
      className="fixed inset-0 z-50 transition-opacity duration-300"
      style={{
        pointerEvents: 'none',
        opacity: isActive ? 1 : 0,
      }}
    >
      {/* SVG dim layer with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="spotlight-blur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              spotlight.shape === 'circle' ? (
                <circle
                  cx={spotlight.x}
                  cy={spotlight.y}
                  r={spotlight.width / 2}
                  fill="black"
                  filter="url(#spotlight-blur)"
                  className="transition-all duration-300 ease-out"
                />
              ) : (
                <rect
                  x={spotlight.x - spotlight.width / 2}
                  y={spotlight.y - spotlight.height / 2}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx={12}
                  fill="black"
                  filter="url(#spotlight-blur)"
                  className="transition-all duration-300 ease-out"
                />
              )
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Tooltip */}
      <div
        className="absolute transition-all duration-300 ease-out"
        style={{
          ...tooltipStyle,
          pointerEvents: 'auto',
          transitionDelay: '50ms',
        }}
      >
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 max-w-[280px]">
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-3">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Step text */}
          <p className="text-sm text-foreground leading-relaxed mb-4">
            {prompt}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tutorial
            </button>
            {(currentStep === 0 || isConfirming) && (
              <button
                onClick={onAdvance}
                className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
              >
                {currentStep === 0 ? 'Next \u2192' : 'Got it, next \u2192'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function computeTooltipPosition(
  spotlight: SpotlightTarget | null,
  vw: number,
  vh: number,
): React.CSSProperties {
  if (!spotlight || vw === 0) {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  }

  const pad = 20
  const style: React.CSSProperties = {}

  if (spotlight.x < vw / 2) {
    style.left = spotlight.x + spotlight.width / 2 + pad
  } else {
    style.right = vw - spotlight.x + spotlight.width / 2 + pad
  }

  if (spotlight.y < vh / 2) {
    style.top = spotlight.y + spotlight.height / 2 + pad
  } else {
    style.bottom = vh - spotlight.y + spotlight.height / 2 + pad
  }

  return style
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/TutorialOverlay.tsx
git commit -m "feat(tutorial): add TutorialOverlay component with spotlight and tooltip"
```

---

### Task 5: Integrate tutorial into page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add imports and state**

Add at top of file:

```typescript
import TutorialOverlay from '@/components/tutorial/TutorialOverlay'
import { useTutorial, type OccupationGraphHandle } from '@/components/tutorial/useTutorial'
import { TUTORIAL_STEPS } from '@/components/tutorial/tutorialConfig'
```

Add new state inside `HomePage`:

```typescript
const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
const graphHandleRef = useRef<OccupationGraphHandle | null>(null)
const graphContainerRef = useRef<HTMLDivElement>(null)
const [graphContainerRect, setGraphContainerRect] = useState<DOMRect | null>(null)
const [heroSearchRectState, setHeroSearchRectState] = useState<DOMRect | null>(null)
```

- [ ] **Step 2: Add useTutorial hook call**

After the existing state declarations:

```typescript
const tutorial = useTutorial({
  selectedNodeId,
  secondSelectedNodeId,
  hoveredNodeId,
  edges,
  graphContainerRect,
  heroSearchRect: heroSearchRectState,
  graphHandleRef,
})
```

- [ ] **Step 3: Add rect measurement effects**

```typescript
// Measure graph container and hero search positions for tutorial spotlight
useEffect(() => {
  if (!tutorial.isActive) return
  const measure = () => {
    if (graphContainerRef.current) {
      setGraphContainerRect(graphContainerRef.current.getBoundingClientRect())
    }
    if (heroSearchRef.current) {
      setHeroSearchRectState(heroSearchRef.current.getBoundingClientRect())
    }
  }
  measure()
  window.addEventListener('resize', measure)
  return () => window.removeEventListener('resize', measure)
}, [tutorial.isActive, tutorial.currentStep])
```

- [ ] **Step 4: Add tutorial skip handler**

```typescript
const handleTutorialSkip = () => {
  tutorial.skip()
  setSelectedNodeId(null)
  setSecondSelectedNodeId(null)
  setPanelNodeId(null)
  setIsPanelOpen(false)
}
```

- [ ] **Step 5: Wire new props into OccupationGraph**

On the `<OccupationGraph>` component, add:

```typescript
onNodeHover={setHoveredNodeId}
onReady={(handle) => { graphHandleRef.current = handle }}
forceSelectionMode={tutorial.isActive && tutorial.currentStep <= 2 ? 'single' : null}
```

Note: `forceSelectionMode='single'` is passed during steps 0-2 (orient, search, hover) to prevent pair-selection mode from suppressing hover events. At step 3 (click), it returns to `null` so normal selection behaviour resumes.

- [ ] **Step 6: Add ref to graph container div**

Change the graph area wrapper `<div className="flex-1 relative min-h-0">` to:

```tsx
<div ref={graphContainerRef} className="flex-1 relative min-h-0">
```

- [ ] **Step 7: Prevent hero search dismiss during tutorial step 2 only**

Update the hero search `onDismiss` prop:

```tsx
onDismiss={tutorial.isActive && tutorial.currentStep === 1 ? undefined : () => setHeroDismissed(true)}
```

Note: Step 2 is index 1. Only hide the dismiss button during the search step, not all tutorial steps.

- [ ] **Step 8: Force viewMode to 'force' during tutorial**

Add an effect that forces viewMode to 'force' when tutorial starts, and block view mode changes while active:

```typescript
// Force viewMode to 'force' when tutorial is active
useEffect(() => {
  if (tutorial.isActive && viewMode !== 'force') {
    setViewMode('force')
    setLayoutMode('ring')
  }
}, [tutorial.isActive, viewMode])
```

In the `handleViewModeChange` function, early-return if tutorial is active:

```typescript
const handleViewModeChange = (mode: ViewMode) => {
  if (tutorial.isActive) return
  // ... existing logic
}
```

- [ ] **Step 9: Mount TutorialOverlay**

Inside the graph area div, after the node count badge, before the closing `</div>`:

```tsx
{tutorial.isVisible && tutorial.stepConfig && (
  <TutorialOverlay
    isActive={tutorial.isActive}
    currentStep={tutorial.currentStep}
    totalSteps={TUTORIAL_STEPS.length}
    isConfirming={tutorial.isConfirming}
    prompt={tutorial.stepConfig.prompt}
    spotlight={tutorial.spotlight}
    onAdvance={tutorial.advance}
    onSkip={handleTutorialSkip}
  />
)}
```

Note: `tutorial.isVisible` stays true for 300ms after `isActive` becomes false, allowing the CSS opacity transition to fade out before unmounting.

- [ ] **Step 10: Verify file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add app/page.tsx
git commit -m "feat(tutorial): integrate interactive tutorial overlay into page"
```

---

## Chunk 3: Delete Old Tutorial and Final Cleanup

### Task 6: Remove old tutorial components

**Files:**
- Delete: `components/tutorial/TutorialModal.tsx`
- Delete: `components/tutorial/TutorialButton.tsx`
- Delete: `components/tutorial/tutorialSteps.ts`
- Delete: `components/tutorial/steps/NodeRepresentationDemo.tsx`
- Delete: `components/tutorial/steps/NodeArrangementDemo.tsx`
- Delete: `components/tutorial/steps/NodeSizingDemo.tsx`
- Delete: `components/tutorial/steps/HoverBehaviourDemo.tsx`
- Delete: `components/tutorial/steps/ClickBehaviourDemo.tsx`
- Modify: `app/layout.tsx` — remove TutorialButton import and usage

- [ ] **Step 1: Remove TutorialButton from layout.tsx**

In `app/layout.tsx` (around line 38), remove the `<TutorialButton />` element and its import at the top of the file.

- [ ] **Step 2: Delete old tutorial files**

```bash
rm components/tutorial/TutorialModal.tsx
rm components/tutorial/TutorialButton.tsx
rm components/tutorial/tutorialSteps.ts
rm -rf components/tutorial/steps/
```

- [ ] **Step 3: Verify no remaining imports of deleted files**

Run: `grep -r "TutorialModal\|TutorialButton\|tutorialSteps\|NodeRepresentationDemo\|NodeArrangementDemo\|NodeSizingDemo\|HoverBehaviourDemo\|ClickBehaviourDemo" --include="*.tsx" --include="*.ts" components/ app/`
Expected: No matches (all references removed)

- [ ] **Step 4: Verify no broken imports**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(tutorial): remove old modal-based tutorial components"
```

---

### Task 7: Manual QA and polish

**Files:**
- Possibly modify: `components/tutorial/TutorialOverlay.tsx`, `components/tutorial/useTutorial.ts`

- [ ] **Step 1: Run the dev server and test the full flow**

Run: `npm run dev`

Test checklist:
1. Page loads → tutorial overlay appears with step 1 (orient) spotlight
2. Click "Next" → step 2 spotlight on hero search bar
3. Type "Pharmacists" in search → select it → "Got it, next" button appears
4. Click "Got it, next" → step 3 spotlight on a neighbour node
5. Hover over a connected node → "Got it, next" button appears
6. Click "Got it, next" → step 4 spotlight same area
7. Click a connected node → "Got it, next" button appears
8. Click "Got it, next" → overlay fades out, two nodes selected with panel open
9. Refresh page → tutorial starts again
10. Test "Skip tutorial" at each step — overlay dismisses, graph resets
11. Test light/dark theme — tooltip respects theme
12. Test window resize — spotlight repositions correctly

- [ ] **Step 2: Fix any issues found during QA**

Address visual alignment, transition timing, or edge cases discovered.

- [ ] **Step 3: Final commit if changes made**

```bash
git add -A
git commit -m "fix(tutorial): polish interactive tutorial after QA"
```
