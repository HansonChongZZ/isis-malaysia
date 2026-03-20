# Tutorial Branching Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the tutorial from a linear step array to a branching flow that forks based on whether the user clicks the center node or a connected node.

**Architecture:** Replace index-based step progression with a string-based step ID system. Define two flow paths sharing a step registry. Add DOM-anchored tooltip positioning with Framer Motion spring animations.

**Tech Stack:** React, TypeScript, Framer Motion (already in project)

---

### Task 1: Refactor tutorialConfig.ts — Step Registry + Flow Paths

**Files:**
- Modify: `components/tutorial/tutorialConfig.ts`

- [ ] **Step 1: Convert to step registry with flow paths**

Replace `TUTORIAL_STEPS` array and `STEP_IDX` with:
- `STEP_REGISTRY` map keyed by step ID
- `CONNECTED_PATH` and `CENTER_PATH` arrays
- `getNextStepId()` flow function
- New `tooltipAnchor` property on `TutorialStep`
- New `cardClicked` completion event
- New step definitions: `occupationClick` (replaces `detail`), `skills`, `pathwaysPick`
- Updated prompts for `compare`, `backToPathways`, `pathways`, `closePanel`

### Task 2: Refactor useTutorial.ts — String-based Step Tracking + Branching

**Files:**
- Modify: `components/tutorial/useTutorial.ts`

- [ ] **Step 1: Switch from index to step ID tracking**

Replace `currentStep: number` with `currentStepId: string`. Derive `currentStepIndex` and `activePath` from the resolved flow path. Update `advance()` to call `getNextStepId()`. Add `cardClicked` prop and detection. Update panel-close guard to use step IDs.

- [ ] **Step 2: Add tooltip anchor resolution**

Add `useMemo` that resolves `tooltipAnchor.selector` to `{ left, top }` coordinates. Add `useEffect` for scroll listener on `[data-tutorial-scroll-container]` during anchored steps. Return resolved `tooltipPosition` from the hook.

### Task 3: Refactor TutorialOverlay.tsx — Spring Animation + Anchor Positioning

**Files:**
- Modify: `components/tutorial/TutorialOverlay.tsx`

- [ ] **Step 1: Add Framer Motion spring to tooltip**

Replace CSS `transition-all` with `motion.div` using `animate={{ left, top }}` with spring physics (`damping: 25, stiffness: 200`). Accept `tooltipPosition` prop from hook. Update `computeTooltipPosition` to always return `left`/`top` (convert `right`/`bottom`). Accept `totalSteps` and `stepIndex` as props instead of computing from array length.

### Task 4: Add data-tutorial-target Attributes

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx`
- Modify: `components/panel/OccupationPanel.tsx`

- [ ] **Step 1: Add tutorial target attributes to ComparisonGrid**

Add `data-tutorial-target="ai-exposure-row"` on the AI Exposure row div (line 169). Add `data-tutorial-target="skills-section"` on the skills section div (line 286). Add `data-tutorial-scroll-container` on the scrollable root div (line 79).

- [ ] **Step 2: Add tutorial target attributes to OccupationPanel**

Add `data-tutorial-target="pathways-list"` on the TransitionCards container div (line 196). Add `onCardClick` callback prop. Wire it to fire alongside existing `setComparisonNodeId`.

### Task 5: Update page.tsx — Wire New Props + Relax Constraints

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Wire cardClicked state and update tutorial integration**

Add `cardClicked` state flag. Wire `onCardClick` from OccupationPanel. Pass `cardClicked` to `useTutorial`. Update imports (remove `TUTORIAL_STEPS`, `STEP_IDX`; import new flow utilities). Update `forceSelectionMode`, `disableInteraction`, `disableClick`, `allowedClickNodeId` to use step IDs. Relax `allowedClickNodeId` for `occupationClick`. Update `preventInteractOutside` to include `skills` and `pathwaysPick`. Update `TutorialOverlay` props for new step index/total system.
