# Remove MASCO Group Clustering — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove MASCO 1-digit group clustering so nodes arrange purely by skill connections with a single uniform color.

**Architecture:** Remove all group-aware force strengths, group coloring, group filtering, and group legend. Update the layout script and re-compute positions. Update tutorial demos to use uniform color.

**Tech Stack:** Next.js, React, D3, TypeScript, CSS custom properties

---

## Chunk 1: Core Graph — Remove Group Forces, Colors, and Filtering

### Task 1: Remove MASCO_GROUPS from constants

**Files:**
- Modify: `lib/constants.ts:1-12`

- [ ] **Step 1: Remove MASCO_GROUPS**

Delete the `MASCO_GROUPS` export from `lib/constants.ts`. Keep `QUARTILE_LABELS`, `QUARTILE_COLORS`, and the `NODE_RADIUS_*` constants.

```typescript
// DELETE lines 1-12 (the entire MASCO_GROUPS export)
```

- [ ] **Step 2: Verify no TypeScript errors in constants.ts**

Run: `npx tsc --noEmit lib/constants.ts 2>&1 | head -20`
Expected: No errors from constants.ts itself (downstream files will error until fixed)

- [ ] **Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "refactor: remove MASCO_GROUPS constant"
```

---

### Task 2: Remove group-aware forces from TunerPanel

**Files:**
- Modify: `components/graph/TunerPanel.tsx:90-91,126,128-138,153-173`

- [ ] **Step 1: Remove INTRA/INTER constants and groupOf map**

In `TunerPanel.tsx`:
- Delete `const INTRA_STRENGTH = 0.8;` (line 90)
- Delete `const INTER_STRENGTH = 0.001;` (line 91)
- In `runSimulation`, delete `const groupOf = new Map(...)` (line 126)
- Remove `group: n.group` from simNodes map (line 133)
- Replace the `.strength(...)` callback on the link force (lines 165-173) with a uniform strength:

```typescript
.strength(0.3)
```

This gives all edges equal pull regardless of group membership.

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit components/graph/TunerPanel.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add components/graph/TunerPanel.tsx
git commit -m "refactor: remove group-aware force strengths from TunerPanel"
```

---

### Task 3: Remove filterGroup from useGraphInteraction hook

**Files:**
- Modify: `hooks/useGraphInteraction.ts:13,80-81`

- [ ] **Step 1: Remove filterGroup state and exports**

In `useGraphInteraction.ts`:
- Delete `const [filterGroup, setFilterGroup] = useState<number | null>(null)` (line 13)
- Delete `filterGroup,` and `setFilterGroup,` from the return object (lines 80-81)

- [ ] **Step 2: Commit**

```bash
git add hooks/useGraphInteraction.ts
git commit -m "refactor: remove filterGroup from useGraphInteraction hook"
```

---

### Task 4: Remove filterGroup from OccupationGraph props and visibleIds

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:32,49,74-88,218-229,248-255,596-621,726-741`

- [ ] **Step 1: Remove filterGroup from props interface**

Delete `filterGroup: number | null;` from `OccupationGraphProps` (line 32) and the destructured prop (line 49).

- [ ] **Step 2: Remove group from pairLabelPositions type**

Remove the `group: number;` field from both `a` and `b` in the `pairLabelPositions` state type (lines 80, 87).

- [ ] **Step 3: Remove group from pairLabelPositions assignments**

Remove `group: nodeA.group,` and `group: nodeB.group,` from both places where `setPairLabelPositions` is called:
- Lines 611, 618 (in the selectionMode effect)
- Lines 731, 739 (in the zoom handler)

- [ ] **Step 4: Remove filterGroup from visibleIds computation**

In the `visibleIds` useMemo (line 218-255):
- Delete `const hasGroupFilter = filterGroup !== null;` (line 219)
- Remove `hasGroupFilter` from the early-return condition (line 223) — becomes `if (!hasSkillFilter && !hasThreshold) return null;`
- Delete `if (hasGroupFilter && node.group !== filterGroup) continue;` (line 229)
- Remove `filterGroup,` from the dependency array (line 250)

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "refactor: remove filterGroup and group references from OccupationGraph"
```

---

### Task 5: Remove filterGroup from page.tsx and GraphControls

**Files:**
- Modify: `app/page.tsx:33,102-109,205-206,249`
- Modify: `components/graph/GraphControls.tsx:4,27-28,49-50,124-137,182-193`

- [ ] **Step 1: Remove filterGroup state from page.tsx**

In `app/page.tsx`:
- Delete `const [filterGroup, setFilterGroup] = useState<number | null>(null)` (line 33)
- Simplify `occupationList` useMemo (lines 102-109) — remove the group filter:

```typescript
const occupationList = useMemo<{ id: string; label: string }[]>(() => {
  return nodes
    .map((n) => ({ id: n.id, label: n.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}, [nodes])
```

- Remove `filterGroup={filterGroup}` and `setFilterGroup={setFilterGroup}` from `<GraphControls>` props (lines 205-206)
- Remove `filterGroup={filterGroup}` from `<OccupationGraph>` props (line 249)

- [ ] **Step 2: Remove MASCO group filter from GraphControls**

In `GraphControls.tsx`:
- Delete `import { MASCO_GROUPS } from '@/lib/constants'` (line 4)
- Delete `filterGroup: number | null;` and `setFilterGroup: (v: number | null) => void;` from `GraphControlsProps` interface (lines 27-28)
- Delete the destructured props `filterGroup,` and `setFilterGroup,` (lines 49-50)
- Delete the entire MASCO Group filter `<select>` block (lines 124-137)
- Update the "Clear filters" button condition (line 182) — remove `filterGroup !== null ||`:

```typescript
{filterSkills.length > 0 && (
```

- In the clear button's onClick (lines 184-187), remove `setFilterGroup(null);`

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/graph/GraphControls.tsx
git commit -m "refactor: remove MASCO group filter from page and controls"
```

---

### Task 6: Remove GraphLegend component

**Files:**
- Delete: `components/graph/GraphLegend.tsx`

Note: GraphLegend is not imported anywhere — it is already unused. The "Node size = ..." indicator it contains is already not visible to users. The node size metric selector already exists in GraphControls' Visualization Settings popover, so no relocation is needed.

- [ ] **Step 1: Delete GraphLegend.tsx**

```bash
rm components/graph/GraphLegend.tsx
```

- [ ] **Step 2: Commit**

```bash
git rm components/graph/GraphLegend.tsx
git commit -m "refactor: remove unused GraphLegend component"
```

---

### Task 7: Remove MASCO group references from OccupationPanel

**Files:**
- Modify: `components/panel/OccupationPanel.tsx:31,137-138,198-208`

- [ ] **Step 1: Remove group display from panel header**

In `OccupationPanel.tsx`:
- Remove `MASCO_GROUPS` from the import (line 31) — keep `QUARTILE_COLORS`
- Delete `const group = nodeId ? parseInt(nodeId[0], 10) : null` (line 137)
- Delete `const groupInfo = group ? MASCO_GROUPS[group] : null` (line 138)
- Remove the group dot and group label from the header (lines 199-208):

Delete this block:
```tsx
{groupInfo && (
  <span
    className="inline-block w-3 h-3 rounded-full shrink-0"
    style={{ backgroundColor: `var(${groupInfo.colorVar})` }}
  />
)}
```

And this block:
```tsx
{groupInfo && (
  <span className="text-xs text-muted-foreground">· {groupInfo.label}</span>
)}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add components/panel/OccupationPanel.tsx
git commit -m "refactor: remove MASCO group display from OccupationPanel header"
```

---

### Task 8: Remove MASCO CSS variables from globals.css

**Files:**
- Modify: `app/globals.css:173-181`

- [ ] **Step 1: Delete MASCO color aliases**

Delete lines 173-181:
```css
  --color-masco-1: var(--masco-1);
  --color-masco-2: var(--masco-2);
  --color-masco-3: var(--masco-3);
  --color-masco-4: var(--masco-4);
  --color-masco-5: var(--masco-5);
  --color-masco-6: var(--masco-6);
  --color-masco-7: var(--masco-7);
  --color-masco-8: var(--masco-8);
  --color-masco-9: var(--masco-9);
```

Note: The base `--masco-*` tokens referenced by these aliases are not defined in `globals.css` (they come from Tailwind theme config). Only the `--color-masco-*` aliases above need removal.

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "refactor: remove MASCO color CSS variables"
```

---

### Task 9: Build verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Fix any remaining compilation errors**

The build is expected to fail at this point due to tutorial component imports of `MASCO_GROUPS`. Verify all errors originate exclusively from files in `components/tutorial/`. These are fixed in Chunk 2.

**Note:** `lib/types.ts` requires no changes — the `group` field stays inert in the data to avoid reprocessing `nodes.json`.

---

## Chunk 2: Tutorial Components — Remove Group Colors

### Task 10: Update NodeRepresentationDemo to use uniform color

**Files:**
- Modify: `components/tutorial/steps/NodeRepresentationDemo.tsx`

- [ ] **Step 1: Rewrite to show uniform-colored nodes**

This demo currently shows all 9 MASCO groups as individually colored circles. Rewrite to show a set of varied-size circles in uniform `--node-color`, representing occupations of different AI exposure levels. Keep the same animation style (staggered appearance + pulse).

Replace the entire file content:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const WIDTH = 340;
const HEIGHT = 220;

// Sample nodes with varied sizes to represent different occupations
const DEMO_NODES = [
  { label: 'Manager', r: 12 },
  { label: 'Engineer', r: 16 },
  { label: 'Technician', r: 10 },
  { label: 'Clerk', r: 18 },
  { label: 'Sales Worker', r: 8 },
  { label: 'Farmer', r: 6 },
  { label: 'Operator', r: 14 },
];

function getPosition(index: number, total: number) {
  const spacing = 44;
  const totalWidth = (total - 1) * spacing;
  const startX = WIDTH / 2 - totalWidth / 2;
  return { cx: startX + index * spacing, cy: HEIGHT / 2 };
}

export default function NodeRepresentationDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    const nodes = DEMO_NODES.map((n, i) => ({
      ...n,
      ...getPosition(i, DEMO_NODES.length),
    }));

    // Circles
    const circles = g
      .selectAll('circle.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('cx', (d) => d.cx)
      .attr('cy', (d) => d.cy)
      .attr('r', 0)
      .attr('fill', 'var(--node-color)')
      .attr('opacity', 0);

    circles
      .transition()
      .delay((_, i) => i * 150)
      .duration(400)
      .attr('r', (d) => d.r)
      .attr('opacity', 1);

    // Labels
    const labels = g
      .selectAll('text.label')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', (d) => d.cx)
      .attr('y', (d) => d.cy + d.r + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text((d) => d.label);

    labels
      .transition()
      .delay((_, i) => i * 150 + 200)
      .duration(300)
      .attr('opacity', 1);

    // Pulse on one node after all appear
    const totalDelay = DEMO_NODES.length * 150 + 600;
    const pulseNode = nodes[1]; // Engineer

    const pulseRing = g
      .append('circle')
      .attr('cx', pulseNode.cx)
      .attr('cy', pulseNode.cy)
      .attr('r', pulseNode.r)
      .attr('fill', 'none')
      .attr('stroke', 'var(--node-color)')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    function pulse() {
      pulseRing
        .attr('r', pulseNode.r)
        .attr('opacity', 0.8)
        .attr('stroke-width', 2)
        .transition()
        .duration(1000)
        .attr('r', pulseNode.r + 10)
        .attr('opacity', 0)
        .attr('stroke-width', 0.5)
        .on('end', pulse);
    }

    const pulseTimer = d3.timeout(pulse, totalDelay);

    return () => {
      pulseTimer.stop();
      svg.selectAll('*').interrupt();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: 320 }}
      role="img"
      aria-label="Animation showing occupations as circles of different sizes"
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/steps/NodeRepresentationDemo.tsx
git commit -m "refactor: update NodeRepresentationDemo to use uniform color"
```

---

### Task 11: Update NodeArrangementDemo to remove group forces

**Files:**
- Modify: `components/tutorial/steps/NodeArrangementDemo.tsx`

- [ ] **Step 1: Remove MASCO_GROUPS import and GROUP_TARGETS**

- Remove `import { MASCO_GROUPS } from '@/lib/constants'` (line 5)
- Remove `const GROUP_TARGETS` (lines 73-83)
- Replace group-colored fill with uniform `var(--node-color)`:
  - Line 126: change `.attr('fill', (d) => \`var(${MASCO_GROUPS[d.group].colorVar})\`)` to `.attr('fill', 'var(--node-color)')`
- Remove `.force('x', ...)` and `.force('y', ...)` that reference `GROUP_TARGETS` (lines 146-151)
- Remove `group` property from `DEMO_NODES` entries (lines 15-58) — just keep `id` and `r`
- Remove `group` from `SimNode` interface (line 88)
- Update aria-label to "Animation showing nodes clustering by skill connections"

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/steps/NodeArrangementDemo.tsx
git commit -m "refactor: update NodeArrangementDemo to remove group clustering"
```

---

### Task 12: Update NodeSizingDemo to use uniform color

**Files:**
- Modify: `components/tutorial/steps/NodeSizingDemo.tsx`

- [ ] **Step 1: Replace group color with uniform color**

- Remove `MASCO_GROUPS` from import (line 6) — keep `NODE_RADIUS_BASE`, `NODE_RADIUS_SCALE`, `NODE_RADIUS_EXPONENT`
- Line 53: change `.attr('fill', (d) => \`var(${MASCO_GROUPS[d.group].colorVar})\`)` to `.attr('fill', 'var(--node-color)')`

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/steps/NodeSizingDemo.tsx
git commit -m "refactor: update NodeSizingDemo to use uniform node color"
```

---

### Task 13: Update HoverBehaviorDemo to use uniform color

**Files:**
- Modify: `components/tutorial/steps/HoverBehaviorDemo.tsx`

- [ ] **Step 1: Replace group color with uniform color**

- Remove `import { MASCO_GROUPS } from '@/lib/constants'` (line 6)
- Line 70: change `.attr('fill', (d) => \`var(${MASCO_GROUPS[d.group].colorVar})\`)` to `.attr('fill', 'var(--node-color)')`

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/steps/HoverBehaviorDemo.tsx
git commit -m "refactor: update HoverBehaviorDemo to use uniform node color"
```

---

### Task 14: Update ClickBehaviorDemo to use uniform color

**Files:**
- Modify: `components/tutorial/steps/ClickBehaviorDemo.tsx`

- [ ] **Step 1: Replace group color with uniform color**

- Remove `import { MASCO_GROUPS } from '@/lib/constants'` (line 6)
- Line 74: change `.attr('fill', (d) => \`var(${MASCO_GROUPS[d.group].colorVar})\`)` to `.attr('fill', 'var(--node-color)')`
- Line 114: change `.attr('fill', \`var(${MASCO_GROUPS[targetNode.group].colorVar})\`)` to `.attr('fill', 'var(--node-color)')`
- Line 117: change the text `'2421 · Professionals'` to just the code `'2421'`
- Line 135: change `.attr('fill', \`var(${MASCO_GROUPS[targetNode.group].colorVar})\`)` to `.attr('fill', 'var(--node-color)')`
- Line 152: change `.attr('fill', \`var(${MASCO_GROUPS[targetNode.group].colorVar})\`)` to `.attr('fill', 'var(--node-color)')`

- [ ] **Step 2: Commit**

```bash
git add components/tutorial/steps/ClickBehaviorDemo.tsx
git commit -m "refactor: update ClickBehaviorDemo to use uniform node color"
```

---

### Task 15: Update tutorialSteps.ts and TutorialModal.tsx

**Files:**
- Modify: `components/tutorial/tutorialSteps.ts:11-17`
- Modify: `components/tutorial/TutorialModal.tsx:25-26,30-31`

- [ ] **Step 1: Remove group from SAMPLE_NODES**

In `tutorialSteps.ts`, remove the `group` property from each sample node (keep `id`, `label`, `aiExposure`):

```typescript
export const SAMPLE_NODES = [
  { id: "1", label: "Manager", aiExposure: 0.45 },
  { id: "2", label: "Engineer", aiExposure: 0.72 },
  { id: "3", label: "Technician", aiExposure: 0.58 },
  { id: "4", label: "Clerk", aiExposure: 0.85 },
  { id: "5", label: "Sales Worker", aiExposure: 0.35 },
  { id: "6", label: "Farmer", aiExposure: 0.15 },
  { id: "7", label: "Operator", aiExposure: 0.62 },
] as const
```

- [ ] **Step 2: Update TutorialModal descriptions**

In `TutorialModal.tsx`:
- Line 25-26: Change step 1 description from `'Every node represents one of 456 Malaysian occupations. Colors indicate the MASCO classification group.'` to `'Every node represents one of 456 Malaysian occupations. Larger nodes have higher AI exposure.'`
- Line 30-31: Change step 2 description from `'Occupations sharing similar skills are positioned closer. Clusters form naturally by occupation group.'` to `'Occupations sharing similar skills are positioned closer together, forming natural clusters.'`

- [ ] **Step 3: Commit**

```bash
git add components/tutorial/tutorialSteps.ts components/tutorial/TutorialModal.tsx
git commit -m "refactor: update tutorial text and sample data to remove group references"
```

---

### Task 16: Final build verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Fix any remaining issues**

---

## Chunk 3: Re-compute Layout Positions

### Task 17: Update compute-layout.mjs and re-run

**Files:**
- Modify: `scripts/compute-layout.mjs:31-34,41-43,51,57,71-97,130-137`
- Modify: `public/data/nodes.json` (generated output)

- [ ] **Step 1: Update compute-layout.mjs**

1. Reconcile radius constants with `lib/constants.ts`:
```javascript
const NODE_RADIUS_BASE = 16;
const NODE_RADIUS_SCALE = 38;
const NODE_RADIUS_EXPONENT = 0.9;
const NODE_RADIUS_COLLIDE_PADDING = 32;
```

2. Remove group-aware force constants:
```javascript
// DELETE these lines:
const INTRA_STRENGTH = 0.8;
const INTER_STRENGTH = 0.001;
```

3. Remove `const groupOf = new Map(...)` (line 51)

4. Remove `group: n.group` from simNodes map (line 57)

5. Replace the link force `.strength(...)` callback with uniform strength:
```javascript
.strength(0.3)
```

6. Remove the "Group centers" diagnostic output (lines 130-137)

- [ ] **Step 2: Run the layout script**

Run: `node scripts/compute-layout.mjs`
Expected: Outputs new positions to `public/data/nodes.json` with valid coordinates

- [ ] **Step 3: Verify the app still loads correctly**

Run: `npm run dev` and confirm the graph renders with the new positions.

- [ ] **Step 4: Commit**

```bash
git add scripts/compute-layout.mjs public/data/nodes.json
git commit -m "refactor: re-compute layout positions without group clustering"
```
