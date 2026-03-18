# Tutorial Revamp Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-step popup modal before the existing spotlight tutorial, and remove the spotlight's "orient" step so the flow is: modal intro → interactive spotlight.

**Architecture:** Revive old `TutorialModal` and `NodeSizingDemo` components. Create simplified `NodeRepresentationDemo`. Wire modal → spotlight handoff via `tutorialPhase` state in `page.tsx`. Remove `orient` step from spotlight config and replace hardcoded step indices with ID-based lookups.

**Tech Stack:** React, D3.js, Radix Dialog (via shadcn/ui), Next.js

---

### Task 1: Revive tutorialSteps.ts data file

**Files:**
- Create: `components/tutorial/tutorialSteps.ts`

- [ ] **Step 1: Create the data file**

This provides `SAMPLE_NODES` used by the demo components. Revive from old commit but remove `group` field from nodes (MASCO groups no longer exist). Use a single node color CSS variable.

```ts
import type { ComponentType } from 'react'

export interface ModalStep {
  title: string
  description: string
  component: ComponentType
}

// Shared sample data used across demo animations
export const SAMPLE_NODES = [
  { id: '1', label: 'Manager', aiExposure: 0.45 },
  { id: '2', label: 'Engineer', aiExposure: 0.72 },
  { id: '3', label: 'Technician', aiExposure: 0.58 },
  { id: '4', label: 'Clerk', aiExposure: 0.85 },
  { id: '5', label: 'Sales Worker', aiExposure: 0.35 },
  { id: '6', label: 'Farmer', aiExposure: 0.15 },
  { id: '7', label: 'Operator', aiExposure: 0.62 },
] as const
```

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/tutorialSteps.ts
git commit -m "feat(tutorial): add sample data for tutorial demo animations"
```

---

### Task 2: Create simplified NodeRepresentationDemo

**Files:**
- Create: `components/tutorial/steps/NodeRepresentationDemo.tsx`

- [ ] **Step 1: Create the component**

Simplified version: ~7 circles appearing with staggered animation. No MASCO labels — just circles in the app's node color to convey "each circle = an occupation." Includes labels underneath each circle.

```tsx
'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const WIDTH = 340
const HEIGHT = 220
const CX = WIDTH / 2
const ROW_Y = 100

const OCCUPATIONS = [
  'Manager',
  'Engineer',
  'Technician',
  'Clerk',
  'Sales Worker',
  'Farmer',
  'Operator',
]

export default function NodeRepresentationDemo() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const g = svg.append('g')

    const spacing = 42
    const totalWidth = (OCCUPATIONS.length - 1) * spacing
    const startX = CX - totalWidth / 2

    const nodes = OCCUPATIONS.map((label, i) => ({
      label,
      x: startX + i * spacing,
      y: ROW_Y,
    }))

    // Circles
    const circles = g
      .selectAll('circle.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 0)
      .attr('fill', 'var(--node-color)')
      .attr('opacity', 0)

    circles
      .transition()
      .delay((_, i) => i * 150)
      .duration(400)
      .attr('r', 11)
      .attr('opacity', 1)

    // Labels
    const labels = g
      .selectAll('text.label')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => d.x)
      .attr('y', d => d.y + 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text(d => d.label)

    labels
      .transition()
      .delay((_, i) => i * 150 + 200)
      .duration(300)
      .attr('opacity', 1)

    // Pulse highlight on one node after all appear
    const totalDelay = OCCUPATIONS.length * 150 + 600
    const pulseNode = nodes[1] // Engineer

    const pulseRing = g
      .append('circle')
      .attr('cx', pulseNode.x)
      .attr('cy', pulseNode.y)
      .attr('r', 11)
      .attr('fill', 'none')
      .attr('stroke', 'var(--node-color)')
      .attr('stroke-width', 2)
      .attr('opacity', 0)

    function pulse() {
      pulseRing
        .attr('r', 11)
        .attr('opacity', 0.8)
        .attr('stroke-width', 2)
        .transition()
        .duration(1000)
        .attr('r', 21)
        .attr('opacity', 0)
        .attr('stroke-width', 0.5)
        .on('end', pulse)
    }

    const pulseTimer = d3.timeout(pulse, totalDelay)

    return () => {
      pulseTimer.stop()
      svg.selectAll('*').interrupt()
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: 320 }}
      role="img"
      aria-label="Animation showing occupation nodes appearing as circles"
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/steps/NodeRepresentationDemo.tsx
git commit -m "feat(tutorial): add simplified NodeRepresentationDemo component"
```

---

### Task 3: Revive and update NodeSizingDemo

**Files:**
- Create: `components/tutorial/steps/NodeSizingDemo.tsx`

- [ ] **Step 1: Create the component**

Revive from old commit but replace `MASCO_GROUPS[d.group].colorVar` with `var(--node-color)` since MASCO groups no longer exist. Keep the AI exposure scaling animation.

```tsx
'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { SAMPLE_NODES } from '../tutorialSteps'
import { NODE_RADIUS_BASE, NODE_RADIUS_SCALE, NODE_RADIUS_EXPONENT } from '@/lib/constants'

const WIDTH = 340
const HEIGHT = 220
const CX = WIDTH / 2
const ROW_Y = 105

const SCALE = 0.55
const UNIFORM_R = 10

function scaledRadius(value: number) {
  return (NODE_RADIUS_BASE + Math.pow(value, NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE) * SCALE
}

// Sort by AI exposure so the row goes small → large
const SORTED_INDICES = SAMPLE_NODES.map((_, i) => i).sort(
  (a, b) => SAMPLE_NODES[a].aiExposure - SAMPLE_NODES[b].aiExposure
)

export default function NodeSizingDemo() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const g = svg.append('g')

    const spacing = 42
    const totalWidth = (SORTED_INDICES.length - 1) * spacing
    const startX = CX - totalWidth / 2

    const nodes = SORTED_INDICES.map((origIdx, sortPos) => ({
      ...SAMPLE_NODES[origIdx],
      x: startX + sortPos * spacing,
      y: ROW_Y,
    }))

    // Draw circles at uniform size
    const circles = g
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', UNIFORM_R)
      .attr('fill', 'var(--node-color)')

    // Scale axis line
    const axisLine = g
      .append('line')
      .attr('x1', nodes[0].x)
      .attr('y1', ROW_Y + 32)
      .attr('x2', nodes[nodes.length - 1].x)
      .attr('y2', ROW_Y + 32)
      .attr('stroke', 'var(--muted-foreground)')
      .attr('stroke-width', 1)
      .attr('opacity', 0)

    // "Low" label
    const lowLabel = g
      .append('text')
      .attr('x', nodes[0].x)
      .attr('y', ROW_Y + 44)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text('Low')

    // "High" label
    const highLabel = g
      .append('text')
      .attr('x', nodes[nodes.length - 1].x)
      .attr('y', ROW_Y + 44)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text('High')

    // Mode label at top
    const modeLabel = g
      .append('text')
      .attr('x', CX)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', 'var(--foreground)')
      .attr('opacity', 0)
      .text('Sized by: AI Exposure')

    let cancelled = false

    const t1 = d3.timeout(() => {
      if (cancelled) return
      circles
        .transition()
        .duration(800)
        .attr('r', d => scaledRadius(d.aiExposure))

      modeLabel.transition().delay(200).duration(300).attr('opacity', 1)
      axisLine.transition().delay(500).duration(400).attr('opacity', 0.3)
      lowLabel.transition().delay(600).duration(300).attr('opacity', 1)
      highLabel.transition().delay(600).duration(300).attr('opacity', 1)
    }, 400)

    return () => {
      cancelled = true
      t1.stop()
      svg.selectAll('*').interrupt()
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: 320 }}
      role="img"
      aria-label="Animation showing nodes sized by AI exposure"
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/steps/NodeSizingDemo.tsx
git commit -m "feat(tutorial): add NodeSizingDemo component for sizing animation"
```

---

### Task 4: Create TutorialModal

**Files:**
- Create: `components/tutorial/TutorialModal.tsx`

- [ ] **Step 1: Create the modal component**

Revive from old commit, adapted to 2 steps only. Uses `onComplete` callback (not just `onOpenChange`) for the handoff to spotlight. Closing/skipping sends `tutorialPhase` to `'done'`.

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ModalStep } from './tutorialSteps'
import NodeRepresentationDemo from './steps/NodeRepresentationDemo'
import NodeSizingDemo from './steps/NodeSizingDemo'

const STEPS: ModalStep[] = [
  {
    title: 'Each circle is an occupation',
    description:
      'Every node represents one of 456 Malaysian occupations.',
    component: NodeRepresentationDemo,
  },
  {
    title: 'Size shows AI exposure',
    description:
      'Larger circles indicate higher AI exposure. The bigger the circle, the more exposed that occupation is to AI.',
    component: NodeSizingDemo,
  },
]

interface TutorialModalProps {
  open: boolean
  onComplete: () => void
  onSkip: () => void
}

export default function TutorialModal({
  open,
  onComplete,
  onSkip,
}: TutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = STEPS[currentStep]
  const StepComponent = step.component
  const isLast = currentStep === STEPS.length - 1

  // Reset to first step when opening
  useEffect(() => {
    if (open) setCurrentStep(0)
  }, [open])

  const goBack = useCallback(() => {
    setCurrentStep(s => Math.max(0, s - 1))
  }, [])

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete()
    } else {
      setCurrentStep(s => s + 1)
    }
  }, [isLast, onComplete])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goBack()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, goBack, goNext])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip() }}>
      <DialogContent className="sm:max-w-xl" showCloseButton={true}>
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{step.title}</DialogTitle>
            <span className="text-xs text-muted-foreground shrink-0 ml-2">
              Step {currentStep + 1} of {STEPS.length}
            </span>
          </div>
          <DialogDescription className="sr-only">
            Tutorial step {currentStep + 1}: {step.title}
          </DialogDescription>
        </DialogHeader>

        {/* Animation area */}
        <div className="px-6">
          <div className="rounded-md bg-muted/30 border border-border/50 overflow-hidden">
            <StepComponent key={currentStep} />
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground px-6">{step.description}</p>

        {/* Footer with dots and nav */}
        <DialogFooter className="px-6 pb-6 pt-2 flex-row items-center justify-between sm:justify-between">
          {/* Dot indicators */}
          <div className="flex gap-1.5" role="tablist" aria-label="Tutorial steps">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentStep}
                aria-label={`Go to step ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                onClick={() => setCurrentStep(i)}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              disabled={currentStep === 0}
              aria-label="Previous step"
            >
              <ChevronLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={goNext}
              aria-label={isLast ? 'Start exploring' : 'Next step'}
            >
              {isLast ? (
                'Got it!'
              ) : (
                <>
                  Next
                  <ChevronRight className="size-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/TutorialModal.tsx
git commit -m "feat(tutorial): add TutorialModal with two-step intro flow"
```

---

### Task 5: Remove orient step from spotlight config

**Files:**
- Modify: `components/tutorial/tutorialConfig.ts`

- [ ] **Step 1: Remove the orient step**

Remove the first entry (`id: 'orient'`) from the `TUTORIAL_STEPS` array. The array should now start with `search`.

In `components/tutorial/tutorialConfig.ts`, remove lines 56–85 (the entire `orient` object from the array). The `TUTORIAL_STEPS` array should be:

```ts
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'search',
    prompt: 'Search for any occupation — try typing a job title (e.g. "Pharmacists").',
    completionEvent: 'nodeSelected',
    autoAdvance: true,
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
  // ... hover, click, badge, detail unchanged
]
```

Also remove the `allNodeIds` field from `SpotlightContext` since only the orient step used it.

- [ ] **Step 2: Add STEP_IDX lookup constant**

Add this export after the `TUTORIAL_STEPS` array. This will be used by both `useTutorial.ts` and `page.tsx` to avoid hardcoded step indices:

```ts
// Step index lookup (computed once, avoids hardcoded indices)
export const STEP_IDX = Object.fromEntries(
  TUTORIAL_STEPS.map((s, i) => [s.id, i])
) as Record<string, number>
```

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/tutorialConfig.ts
git commit -m "feat(tutorial): remove orient step and add STEP_IDX lookup"
```

---

### Task 6: Update useTutorial to accept startActive parameter and use ID-based lookups

**Files:**
- Modify: `components/tutorial/useTutorial.ts`

- [ ] **Step 1: Add startActive parameter**

Add `startActive?: boolean` to `UseTutorialProps`. Change `useState(true)` on line 48 to `useState(false)`.

Add an effect to activate when `startActive` flips to `true`:

```ts
useEffect(() => {
  if (startActive) {
    setIsActive(true)
    setIsVisible(true)
  }
}, [startActive])
```

- [ ] **Step 2: Replace hardcoded step indices with ID-based lookups**

Import `STEP_IDX` from tutorialConfig (added in Task 5):

```ts
import { TUTORIAL_STEPS, STEP_IDX, type SpotlightContext, type SpotlightTarget } from './tutorialConfig'
```

Replace the hardcoded index checks:

1. **Line 109** (`currentStep >= 2`) — locks neighbour once past search step:
   ```ts
   if (currentStep > STEP_IDX.search && neighbourNodeId && !lockedNeighbourRef.current) {
     lockedNeighbourRef.current = neighbourNodeId
   }
   if (currentStep <= STEP_IDX.search) {
     lockedNeighbourRef.current = null
   }
   ```

2. **Line 131** (spotlight delay after zoom animations):
   ```ts
   if ((prevStep === STEP_IDX.search && currentStep === STEP_IDX.hover) ||
       (prevStep === STEP_IDX.click && currentStep === STEP_IDX.badge)) {
   ```

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/useTutorial.ts
git commit -m "feat(tutorial): add startActive param and ID-based step lookups"
```

---

### Task 7: Update TutorialOverlay button logic

**Files:**
- Modify: `components/tutorial/TutorialOverlay.tsx`

- [ ] **Step 1: Fix "Next" button visibility**

Line 124 currently shows the "Next" button when `currentStep === 0`. After removing orient, step 0 is `search` which auto-advances — it should NOT show a "Next" button.

Replace `currentStep === 0 || isConfirming` with just `isConfirming`:

```tsx
{isConfirming && (
  <button
    onClick={onAdvance}
    className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
  >
    Got it, next →
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/TutorialOverlay.tsx
git commit -m "fix(tutorial): remove Next button from auto-advancing steps"
```

---

### Task 8: Wire up page.tsx with tutorialPhase state

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add TutorialModal import and tutorialPhase state**

Add import at top:
```ts
import TutorialModal from '@/components/tutorial/TutorialModal'
```

Add state:
```ts
const [tutorialPhase, setTutorialPhase] = useState<'modal' | 'spotlight' | 'done'>('modal')
```

- [ ] **Step 2: Pass startActive to useTutorial**

Update the `useTutorial` call to include `startActive`:
```ts
const tutorial = useTutorial({
  startActive: tutorialPhase === 'spotlight',
  // ... rest of existing props unchanged
})
```

- [ ] **Step 3: Replace hardcoded step index checks in page.tsx**

Import `STEP_IDX` (exported from `tutorialConfig.ts` in Task 5):
```ts
import { TUTORIAL_STEPS, STEP_IDX } from '@/components/tutorial/tutorialConfig'
```

Replace in page.tsx:
- Line 497: `tutorial.currentStep <= 2` → `tutorial.stepConfig && ['search', 'hover'].includes(tutorial.stepConfig.id)` or use `STEP_IDX`: `tutorial.currentStep <= STEP_IDX.hover`
- Line 498: `tutorial.currentStep <= 1` → `tutorial.currentStep <= STEP_IDX.search`
- Line 499: `tutorial.currentStep <= 2` → `tutorial.currentStep <= STEP_IDX.hover`
- Line 515: `tutorial.currentStep === 1` → `tutorial.stepConfig?.id === 'search'`

Also guard these with `tutorialPhase === 'spotlight'` since during modal phase the spotlight should be inactive:
```ts
forceSelectionMode={tutorialPhase === 'spotlight' && tutorial.isActive && tutorial.currentStep <= STEP_IDX.hover ? 'single' : null}
disableInteraction={tutorialPhase === 'spotlight' && tutorial.isActive && tutorial.currentStep <= STEP_IDX.search}
disableClick={tutorialPhase === 'spotlight' && tutorial.isActive && tutorial.currentStep <= STEP_IDX.hover}
```

And for the hero search dismiss:
```ts
onDismiss={tutorialPhase === 'spotlight' && tutorial.isActive && tutorial.stepConfig?.id === 'search' ? undefined : () => setHeroDismissed(true)}
```

- [ ] **Step 4: Mount TutorialModal and wire callbacks**

Add above the `{tutorial.isVisible && ...}` block:

```tsx
<TutorialModal
  open={tutorialPhase === 'modal'}
  onComplete={() => setTutorialPhase('spotlight')}
  onSkip={() => setTutorialPhase('done')}
/>
```

- [ ] **Step 5: Update handleTutorialSkip to set phase to done**

```ts
const handleTutorialSkip = () => {
  tutorial.skip()
  setTutorialPhase('done')
  setSelectedNodeId(null)
  setSecondSelectedNodeId(null)
  setPanelNodeId(null)
  setIsPanelOpen(false)
  setOpenedViaSecondary(false)
}
```

- [ ] **Step 6: Guard tutorial-dependent effects with phase check**

The `viewMode` force effect (line 98-103) should only apply during spotlight phase:
```ts
useEffect(() => {
  if (tutorialPhase === 'spotlight' && tutorial.isActive && viewMode !== 'force') {
    setViewMode('force')
    setLayoutMode('ring')
  }
}, [tutorialPhase, tutorial.isActive, viewMode])
```

The measurement effect (line 70-83) should only run during spotlight phase:
```ts
useEffect(() => {
  if (tutorialPhase !== 'spotlight' || !tutorial.isActive) return
  // ... rest unchanged
}, [tutorialPhase, tutorial.isActive, tutorial.currentStep])
```

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx components/tutorial/tutorialConfig.ts
git commit -m "feat(tutorial): wire modal→spotlight handoff via tutorialPhase state"
```

---

### Task 9: Remove allNodeIds from SpotlightContext

**Files:**
- Modify: `components/tutorial/tutorialConfig.ts`
- Modify: `components/tutorial/useTutorial.ts`

- [ ] **Step 1: Clean up SpotlightContext**

In `tutorialConfig.ts`, remove `allNodeIds: string[]` from the `SpotlightContext` interface.

In `useTutorial.ts`, remove `allNodeIds` from the `context` object passed to `resolveSpotlight` (around line 148-155). Also remove `allNodeIds` from `UseTutorialProps` if it's no longer needed.

Check that no remaining step's `resolveSpotlight` uses `allNodeIds`. After removing orient, none should.

- [ ] **Step 2: Remove allNodeIds prop from page.tsx**

In `page.tsx`, remove the `allNodeIds` memo and the `allNodeIds` prop passed to `useTutorial` if no longer needed.

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/tutorialConfig.ts components/tutorial/useTutorial.ts app/page.tsx
git commit -m "refactor(tutorial): remove unused allNodeIds from SpotlightContext"
```

---

### Task 10: Manual verification

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Verify in browser**

Open the app in the browser and verify:
1. On page load, the popup modal appears with step 1 "Each circle is an occupation"
2. Clicking "Next" shows step 2 "Size shows AI exposure" with the sizing animation
3. Clicking "Got it!" closes the modal and the spotlight overlay starts at "Search for any occupation..."
4. The old "orient" step (spotlight over entire graph) no longer appears
5. Clicking the X on the modal skips the entire tutorial (both modal and spotlight)
6. Spotlight steps work correctly: search → hover → click → badge → detail
7. "Skip tutorial" in spotlight phase ends the tutorial completely
