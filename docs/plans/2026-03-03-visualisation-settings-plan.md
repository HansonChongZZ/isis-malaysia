# Visualization Settings Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visualization settings popover with a node-size threshold slider (AI Exposure or Wages) to the graph controls bar.

**Architecture:** State lives in `HomePage` (Approach A), passed as props to `GraphControls` (UI) and `OccupationGraph` (filtering). The popover is a simple click-toggled div with a segmented metric toggle and range slider.

**Tech Stack:** React 19, Next.js, Tailwind CSS v4, lucide-react icons, existing codebase patterns.

**Design doc:** `docs/plans/2026-03-03-visualisation-settings-design.md`

---

### Task 1: Add visualization settings state to HomePage

**Files:**
- Modify: `app/page.tsx`

**Step 1: Add state variables and compute maxWage**

In `app/page.tsx`, add two state variables after the existing filter state (line ~31), and a `maxWage` memo after the existing memos:

```typescript
const [sizeMetric, setSizeMetric] = useState<'aiExposure' | 'wage'>('aiExposure')
const [sizeThreshold, setSizeThreshold] = useState(0)
```

Add a memo to compute the max wage from nodes (after `uniqueSkills` memo, around line ~65):

```typescript
const maxWage = useMemo(() => {
  let max = 0
  for (const n of nodes) {
    if (n.wage !== null && n.wage > max) max = n.wage
  }
  return max
}, [nodes])
```

Add a handler that resets threshold when metric changes:

```typescript
const handleSizeMetricChange = (metric: 'aiExposure' | 'wage') => {
  setSizeMetric(metric)
  setSizeThreshold(0)
}
```

**Step 2: Pass new props to GraphControls**

Add these props to the `<GraphControls>` JSX:

```tsx
<GraphControls
  // ...existing props...
  sizeMetric={sizeMetric}
  onSizeMetricChange={handleSizeMetricChange}
  sizeThreshold={sizeThreshold}
  onSizeThresholdChange={setSizeThreshold}
  maxWage={maxWage}
/>
```

**Step 3: Pass threshold props to OccupationGraph**

Add these props to the `<OccupationGraph>` JSX:

```tsx
<OccupationGraph
  // ...existing props...
  sizeMetric={sizeMetric}
  sizeThreshold={sizeThreshold}
/>
```

**Step 4: Verify it compiles**

Run: `npx next build` or check dev server for TypeScript errors. Expect type errors in GraphControls and OccupationGraph (props not defined yet) — that's expected, we'll fix them in Tasks 2 and 3.

**Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add visualization settings state to HomePage"
```

---

### Task 2: Add cog button and settings popover to GraphControls

**Files:**
- Modify: `components/graph/GraphControls.tsx`

**Step 1: Update the props interface**

Add the new props to `GraphControlsProps`:

```typescript
interface GraphControlsProps {
  // ...existing props...
  sizeMetric: 'aiExposure' | 'wage'
  onSizeMetricChange: (metric: 'aiExposure' | 'wage') => void
  sizeThreshold: number
  onSizeThresholdChange: (value: number) => void
  maxWage: number
}
```

Destructure them in the component params.

**Step 2: Add popover state and imports**

Add to imports:
```typescript
import { useState, useRef, useMemo, useEffect } from 'react';
import { Settings2, X } from 'lucide-react';
```

Add local state inside the component:
```typescript
const [settingsOpen, setSettingsOpen] = useState(false)
const settingsRef = useRef<HTMLDivElement>(null)
```

Add click-outside handler:
```typescript
useEffect(() => {
  if (!settingsOpen) return
  const handler = (e: MouseEvent) => {
    if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
      setSettingsOpen(false)
    }
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [settingsOpen])
```

**Step 3: Add cog button and popover JSX**

After the "Clear filters" button (before the closing `</div>` of the filter row at line ~159), add:

```tsx
{/* Visualization Settings */}
<div className="relative ml-auto shrink-0" ref={settingsRef}>
  <button
    onClick={() => setSettingsOpen((o) => !o)}
    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    aria-label="Visualization settings"
  >
    <Settings2 className="w-4 h-4" />
  </button>

  {settingsOpen && (
    <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-semibold">Visualization Settings</span>
        <button
          onClick={() => setSettingsOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Node Size section */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Node Size</p>

        {/* Metric toggle */}
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          <button
            onClick={() => onSizeMetricChange('aiExposure')}
            className={`flex-1 px-3 py-1.5 transition-colors ${
              sizeMetric === 'aiExposure'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            AI Exposure
          </button>
          <button
            onClick={() => onSizeMetricChange('wage')}
            className={`flex-1 px-3 py-1.5 transition-colors ${
              sizeMetric === 'wage'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            Wages
          </button>
        </div>

        {/* Threshold slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Threshold</span>
            <span className="font-medium">
              {sizeMetric === 'aiExposure'
                ? `≥ ${sizeThreshold}%`
                : `≥ RM ${sizeThreshold.toLocaleString()}`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={sizeMetric === 'aiExposure' ? 100 : maxWage}
            step={sizeMetric === 'aiExposure' ? 1 : 100}
            value={sizeThreshold}
            onChange={(e) => onSizeThresholdChange(Number(e.target.value))}
            className="w-full accent-primary h-1.5 cursor-pointer"
          />
        </div>

        {/* Reset */}
        {sizeThreshold > 0 && (
          <button
            onClick={() => onSizeThresholdChange(0)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Default Settings
          </button>
        )}
      </div>
    </div>
  )}
</div>
```

**Step 4: Verify visually**

Run: `npm run dev`
Check: Cog button appears at right end of controls bar. Click opens popover. Toggle switches metric. Slider moves and displays value. Close button and click-outside both close.

**Step 5: Commit**

```bash
git add components/graph/GraphControls.tsx
git commit -m "feat: add visualization settings popover with node size controls"
```

---

### Task 3: Integrate threshold filtering into OccupationGraph

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

**Step 1: Update the props interface**

Add to `OccupationGraphProps`:

```typescript
interface OccupationGraphProps {
  // ...existing props...
  sizeMetric: 'aiExposure' | 'wage'
  sizeThreshold: number
}
```

Destructure them in the component params.

**Step 2: Integrate threshold into visibleIds**

Modify the `visibleIds` useMemo (around line ~86) to also apply the threshold filter. The threshold should compose with existing group/skill filters:

```typescript
const visibleIds = useMemo<Set<string> | null>(() => {
  const hasGroupFilter = filterGroup !== null;
  const hasSkillFilter = filterSkills.length > 0;
  const hasThreshold = sizeThreshold > 0;

  if (!hasGroupFilter && !hasSkillFilter && !hasThreshold) return null;

  const result = new Set<string>();
  const skillQueries = filterSkills.map((s) => s.toLowerCase());

  for (const node of simNodes) {
    if (hasGroupFilter && node.group !== filterGroup) continue;
    if (hasSkillFilter) {
      const nodeSkills = allSkills.get(node.id);
      if (!nodeSkills) continue;
      const match = skillQueries.some((fq) =>
        [...nodeSkills].some((s) => s.toLowerCase().includes(fq)),
      );
      if (!match) continue;
    }
    if (hasThreshold) {
      if (sizeMetric === 'aiExposure') {
        if (node.aiExposure * 100 < sizeThreshold) continue;
      } else {
        if (node.wage === null || node.wage < sizeThreshold) continue;
      }
    }
    result.add(node.id);
  }
  return result;
}, [simNodes, filterGroup, filterSkills, allSkills, sizeMetric, sizeThreshold]);
```

**Step 3: Verify end-to-end**

Run: `npm run dev`
Check:
1. Open settings, select AI Exposure, drag slider to ~50% — nodes with AI exposure < 0.5 should dim
2. Switch to Wages, slider resets to 0 — all nodes visible again
3. Drag wages slider — nodes with lower wages dim, nodes with null wage dim
4. Combine with MASCO group filter — both filters apply together
5. Reset via "Default Settings" — all nodes visible

**Step 4: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: integrate visualization threshold into graph node visibility"
```

---

### Task 4: Final verification and cleanup

**Step 1: Run production build**

Run: `npx next build`
Expected: Build succeeds with no errors.

**Step 2: Manual smoke test**

Run: `npm run dev`
Verify:
- Cog button is right-aligned in the controls bar
- Popover opens/closes correctly (click cog, click X, click outside)
- AI Exposure toggle + slider dims nodes below threshold
- Wages toggle + slider dims nodes below threshold (null wages always dimmed)
- Switching metric resets slider to 0
- Composable with MASCO group filter and skill filter
- "Default Settings" button resets threshold
- Dark mode: popover matches theme

**Step 3: Commit if any final fixes were needed**

```bash
git add -A
git commit -m "feat: visualization settings panel — polish and fixes"
```
