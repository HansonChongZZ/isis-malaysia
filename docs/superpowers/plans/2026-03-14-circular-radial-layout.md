# Circular Ring & Radial Tree Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the force-directed graph layout with a circular ring default view and a radial tree view on node selection, with animated transitions between them.

**Architecture:** Two new pure-function modules (`lib/layout.ts` for position computation, `lib/skills.ts` for skill distance calculation) feed positions into OccupationGraph, which handles animation via D3 transitions. A `layoutMode` state in `app/page.tsx` drives the mode switching alongside existing `selectedNodeId`/`secondSelectedNodeId`.

**Tech Stack:** React 19, D3.js v7 (zoom, transitions, easing), TypeScript, Next.js 16

**Spec:** `docs/superpowers/specs/2026-03-14-circular-radial-layout-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `lib/types.ts` | Add `LayoutMode` type, remove `TunerLayoutParams` | Modify |
| `lib/skills.ts` | Specific skill comparison and distance calculation (owns `SkillComparison` type) | Create |
| `lib/layout.ts` | Ring and radial position computation (owns `LayoutPosition` type) | Create |
| `components/graph/TunerPanel.tsx` | Remove force layout sliders and MST toggle; keep sizing + color-by-group | Modify |
| `components/graph/OccupationGraph.tsx` | Consume layout positions, animate transitions, render curved edges | Modify |
| `app/page.tsx` | Add `layoutMode` state, build `specificSkillsMap`, wire new props | Modify |

**Note on `hooks/useGraphInteraction.ts`:** This hook exists but is not imported or used by OccupationGraph — the graph component manages its own selection/hover state inline, and `app/page.tsx` owns the canonical `selectedNodeId`/`secondSelectedNodeId` state. The spec mentions adding `layoutMode` to this hook, but since the hook is currently unused by the main flow, we add `layoutMode` to `app/page.tsx` instead (where the actual state lives). The hook file is left unchanged.

---

## Chunk 1: Foundation — Types, Skills, and Layout Modules

### Task 1: Add new types to `lib/types.ts`

**Files:**
- Modify: `lib/types.ts:35-48`

- [ ] **Step 1: Add LayoutMode and remove TunerLayoutParams**

Append after the `TunerSizingParams` interface and remove `TunerLayoutParams`:

```typescript
// Add after TunerSizingParams (line 41):

export type LayoutMode = 'ring' | 'radial';
```

Remove `TunerLayoutParams` interface (lines 43-48) — it's no longer used after removing force layout sliders from TunerPanel. `SkillComparison` will be defined in `lib/skills.ts` (its canonical home) rather than here, to keep types close to the code that uses them.

- [ ] **Step 2: Verify no other files import TunerLayoutParams**

Run: `grep -r "TunerLayoutParams" --include="*.ts" --include="*.tsx" lib/ components/ app/ hooks/`

Expected: Only `lib/types.ts` (the definition itself). If other files import it, remove those imports too.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add LayoutMode type, remove TunerLayoutParams"
```

---

### Task 2: Create `lib/skills.ts` — skill distance computation

**Files:**
- Create: `lib/skills.ts`

- [ ] **Step 1: Create the skills module**

```typescript
// lib/skills.ts

export interface SkillComparison {
  shared: string[];
  toDevelop: string[];
  distance: number;
}

/**
 * Build a map of occupation ID → Set of specific skills
 * from the existing occupations data.
 */
export function buildSpecificSkillsMap(
  occupations: Record<string, { specificSkills: string[] }>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [id, occ] of Object.entries(occupations)) {
    map.set(id, new Set(occ.specificSkills));
  }
  return map;
}

/**
 * Compute skill comparison between two occupations.
 * - shared: specific skills both have
 * - toDevelop: specific skills the target has that the source doesn't
 * - distance: toDevelop.length / (shared.length + toDevelop.length)
 *   Range: 0 (identical) to 1 (no overlap). Division-by-zero returns 0.
 */
export function computeSkillDistance(
  sourceId: string,
  targetId: string,
  skillsMap: Map<string, Set<string>>,
): SkillComparison {
  const sourceSkills = skillsMap.get(sourceId) ?? new Set<string>();
  const targetSkills = skillsMap.get(targetId) ?? new Set<string>();

  const shared: string[] = [];
  const toDevelop: string[] = [];

  for (const skill of targetSkills) {
    if (sourceSkills.has(skill)) {
      shared.push(skill);
    } else {
      toDevelop.push(skill);
    }
  }

  const denominator = shared.length + toDevelop.length;
  const distance = denominator === 0 ? 0 : toDevelop.length / denominator;

  return { shared, toDevelop, distance };
}

/**
 * Compute skill distances from a source node to all its neighbors.
 */
export function computeNeighborDistances(
  sourceId: string,
  neighborIds: string[],
  skillsMap: Map<string, Set<string>>,
): Map<string, SkillComparison> {
  const result = new Map<string, SkillComparison>();
  for (const neighborId of neighborIds) {
    result.set(neighborId, computeSkillDistance(sourceId, neighborId, skillsMap));
  }
  return result;
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit lib/skills.ts`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/skills.ts
git commit -m "feat: add skills module for specific skill distance computation"
```

---

### Task 3: Create `lib/layout.ts` — position computation

**Files:**
- Create: `lib/layout.ts`

- [ ] **Step 1: Create the layout module**

```typescript
// lib/layout.ts

import type { GraphNode } from './types';
import type { SkillComparison } from './skills';

export interface LayoutPosition {
  x: number;
  y: number;
}

/**
 * Compute ring positions for all nodes, sorted alphabetically by label.
 * Nodes are placed evenly on a circle centered at (0, 0).
 */
export function computeRingPositions(
  nodes: GraphNode[],
  viewportWidth: number,
  viewportHeight: number,
): Map<string, LayoutPosition> {
  const sorted = [...nodes].sort((a, b) => a.label.localeCompare(b.label));
  const radius = Math.min(viewportWidth, viewportHeight) * 0.4;
  const total = sorted.length;
  const positions = new Map<string, LayoutPosition>();

  for (let i = 0; i < total; i++) {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2; // start from top
    positions.set(sorted[i].id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return positions;
}

/**
 * Compute radial positions for a selected node and its neighbors.
 * Center node at (0, 0). Neighbors placed radially by skill distance.
 * Sorted by distance ascending (most similar = clockwise first from top).
 */
export function computeRadialPositions(
  centerNodeId: string,
  neighbors: GraphNode[],
  distances: Map<string, SkillComparison>,
  centerNodeRadius: number,
  viewportWidth: number,
  viewportHeight: number,
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();

  // Center node at origin
  positions.set(centerNodeId, { x: 0, y: 0 });

  if (neighbors.length === 0) return positions;

  const maxRadius = Math.min(viewportWidth, viewportHeight) * 0.4;
  const minRadius = centerNodeRadius * 3;

  // Sort neighbors by distance ascending (closest first)
  const sorted = [...neighbors].sort((a, b) => {
    const da = distances.get(a.id)?.distance ?? 1;
    const db = distances.get(b.id)?.distance ?? 1;
    return da - db;
  });

  // Find min/max distances for normalization
  const distValues = sorted.map((n) => distances.get(n.id)?.distance ?? 1);
  const minDist = Math.min(...distValues);
  const maxDist = Math.max(...distValues);
  const distRange = maxDist - minDist;

  for (let i = 0; i < sorted.length; i++) {
    const node = sorted[i];
    const dist = distances.get(node.id)?.distance ?? 1;

    // Normalize distance to [minRadius, maxRadius]
    const normalizedRadius =
      distRange === 0
        ? (minRadius + maxRadius) / 2
        : minRadius + ((dist - minDist) / distRange) * (maxRadius - minRadius);

    // Equal angular spacing, clockwise from top
    const angle = (i / sorted.length) * 2 * Math.PI - Math.PI / 2;

    positions.set(node.id, {
      x: Math.cos(angle) * normalizedRadius,
      y: Math.sin(angle) * normalizedRadius,
    });
  }

  return positions;
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit lib/layout.ts`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/layout.ts
git commit -m "feat: add layout module for ring and radial position computation"
```

---

## Chunk 2: TunerPanel Cleanup

### Task 4: Strip force layout controls from TunerPanel

**Files:**
- Modify: `components/graph/TunerPanel.tsx`

- [ ] **Step 1: Remove force layout imports, sliders, simulation, and MST toggle**

Remove from TunerPanel:
1. The `d3-force` imports (lines 4-10): `forceSimulation`, `forceLink`, `forceManyBody`, `forceCenter`, `forceCollide`
2. From `TunerPanelProps`: remove `mstEdges`, `onPositionsChange`, `showMstEdges`, `onShowMstEdgesChange` props
3. From `DEFAULTS`: remove `collidePadding`, `charge`, `linkDistanceBase`, `linkDistanceScale`, `linkStrengthDivisor`
4. From `SLIDER_CONFIG`: remove all entries with `group: 'layout'` (collidePadding, charge, linkDistanceBase, linkDistanceScale, linkStrengthDivisor)
5. Remove the entire `runSimulation` callback
6. Remove the "Layout Forces" section in the JSX (lines 339-365)
7. Remove the "Show MST edges" checkbox (lines 381-389)
8. Remove all references to `simulating`, `debounceRef`, `originalPositionsRef`
9. Remove the `handleDownload` function (exports nodes with positions — no longer relevant)
10. Update `handleChange` to only handle sizing params (no more layout param debounce)

The resulting TunerPanel should only have:
- Sizing sliders (base, scale, exponent)
- Color by MASCO group checkbox
- Copy Constants button

- [ ] **Step 2: Update OccupationGraph to remove TunerPanel force-related props**

In `OccupationGraph.tsx`, update the `<TunerPanel>` usage (around line 1182) to remove props that no longer exist:
- Remove: `mstEdges`, `onPositionsChange={setTunerPositions}`, `showMstEdges`, `onShowMstEdgesChange={setShowMstEdges}`
- Remove state: `tunerPositions`, `showMstEdges`
- Remove the `tunerPositions` useEffect (lines 157-180 that applies tuner position overrides)
- Remove `showMstEdges` from the `drawEdges` MST section (remove entire MST edge drawing block, lines 511-535)

- [ ] **Step 3: Verify the app compiles**

Run: `npx next build` or `npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add components/graph/TunerPanel.tsx components/graph/OccupationGraph.tsx
git commit -m "refactor: remove force layout controls and MST edges from TunerPanel"
```

---

## Chunk 3: Wire Layout Mode into Page and Graph — Ring Layout

### Task 5: Add `layoutMode` state and `specificSkillsMap` to `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add layoutMode state and specificSkillsMap**

Add imports at top:
```typescript
import type { LayoutMode } from '@/lib/types';
import { buildSpecificSkillsMap } from '@/lib/skills';
```

Add state after `nodeSizeMetric` state (line 37):
```typescript
const [layoutMode, setLayoutMode] = useState<LayoutMode>('ring');
```

Add memo after `allSkills` (line 61):
```typescript
const specificSkillsMap = useMemo(
  () => buildSpecificSkillsMap(occupations),
  [occupations],
);
```

- [ ] **Step 2: Update handleNodeSelect to manage layoutMode transitions**

Replace the `handleNodeSelect` function (lines 112-164) to integrate layout mode:

```typescript
const handleNodeSelect = (id: string | null) => {
  if (id === null) {
    if (secondSelectedNodeId) {
      // Pair mode → step back to single mode (stay radial)
      setSecondSelectedNodeId(null);
      setPanelNodeId(null);
      setIsPanelOpen(false);
    } else if (selectedNodeId) {
      // Single/radial mode → clear everything, back to ring
      setSelectedNodeId(null);
      setSecondSelectedNodeId(null);
      setPanelNodeId(null);
      setIsPanelOpen(false);
      setLayoutMode('ring');
    }
    return;
  }

  if (secondSelectedNodeId) {
    // In pair mode
    if (id === selectedNodeId || id === secondSelectedNodeId) {
      // Click either selected node → open panel
      setPanelNodeId(id);
      setIsPanelOpen(true);
    } else {
      // Click third node → not possible in radial (dimmed nodes not interactive)
      // But if somehow reached, reset to single
      setSelectedNodeId(id);
      setSecondSelectedNodeId(null);
      setPanelNodeId(null);
      setIsPanelOpen(false);
      setLayoutMode('radial');
    }
    return;
  }

  if (selectedNodeId) {
    // In single/radial mode
    if (id === selectedNodeId) {
      // Click center node → open panel
      setPanelNodeId(id);
      setIsPanelOpen(true);
    } else if (firstNodeNeighbors.has(id)) {
      // Click connected neighbor → pair mode
      // (firstNodeNeighbors is the existing memo at page.tsx:63-71)
      setSecondSelectedNodeId(id);
    } else {
      // Click unconnected node → not possible in radial (dimmed)
      // But if somehow reached, new single selection
      setSelectedNodeId(id);
      setSecondSelectedNodeId(null);
      setLayoutMode('radial');
    }
    return;
  }

  // No selection (ring mode) → first click → transition to radial
  setSelectedNodeId(id);
  setLayoutMode('radial');
};
```

- [ ] **Step 3: Update Escape key handler to reset layoutMode**

Update the keydown handler (lines 166-181):

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isPanelOpen) {
      if (secondSelectedNodeId) {
        setSecondSelectedNodeId(null);
        setPanelNodeId(null);
      } else {
        setSelectedNodeId(null);
        setSecondSelectedNodeId(null);
        setPanelNodeId(null);
        setLayoutMode('ring');
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isPanelOpen, secondSelectedNodeId]);
```

- [ ] **Step 4: Pass new props to OccupationGraph**

Add to the `<OccupationGraph>` JSX (around line 239):
```typescript
layoutMode={layoutMode}
specificSkillsMap={specificSkillsMap}
```

Remove `mstEdges` prop from OccupationGraph (line 242). Also remove the `mstEdges` memo (line 101) and the `computeMaxSpanningTree` import (line 7) since MST is no longer used anywhere.

- [ ] **Step 5: Verify the app compiles (type errors expected in OccupationGraph until next task)**

Run: `npx tsc --noEmit`

Note: This will likely show errors in OccupationGraph since we're passing new props it doesn't accept yet. That's expected — Task 6 will fix it.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx lib/skills.ts
git commit -m "feat: add layoutMode state and specificSkillsMap to page, update selection logic"
```

---

### Task 6: Integrate ring layout into OccupationGraph

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

- [ ] **Step 1: Update props interface and imports**

Add imports:
```typescript
import type { LayoutMode } from '@/lib/types';
import { computeRingPositions, computeRadialPositions } from '@/lib/layout';
import { computeNeighborDistances, type SkillComparison } from '@/lib/skills';
```

Update `OccupationGraphProps` interface:
- Add: `layoutMode: LayoutMode`
- Add: `specificSkillsMap: Map<string, Set<string>>`
- Remove: `mstEdges: GraphEdge[]` (no longer used)

Update the destructured props accordingly.

- [ ] **Step 2: Compute ring positions and apply them to nodes**

After the `simNodes` memo (line 134), add a ring positions memo:

```typescript
const ringPositions = useMemo(
  () => computeRingPositions(simNodes, 20000, 20000),
  [simNodes],
);
```

Note: We use a large fixed viewport (20000x20000) for graph-space coordinates, similar to the scale the force-directed layout used. The D3 zoom will handle fitting to actual viewport.

Replace the `simNodes` initialization so nodes use ring positions by default. After `simNodes` is created, add an effect that applies ring positions:

```typescript
// Apply layout positions to simNodes
useEffect(() => {
  if (layoutMode === 'ring') {
    for (const node of simNodes) {
      const pos = ringPositions.get(node.id);
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
      }
    }
  }
  // Update graph center for grid background
  if (simNodes.length) {
    const xs = simNodes.map((n) => n.x);
    const ys = simNodes.map((n) => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    let maxDist = 0;
    for (const n of simNodes) {
      const d = Math.hypot(n.x - cx, n.y - cy);
      if (d > maxDist) maxDist = d;
    }
    graphCenterRef.current = { cx, cy, radius: maxDist + 80 };
  }
  drawEdgesRef.current();
}, [layoutMode, simNodes, ringPositions]);
```

- [ ] **Step 3: Suppress edges in ring mode**

In `drawEdges` callback, after the grid drawing section and before the selection edges section, add an early return for ring mode:

```typescript
// No edges in ring mode — clean overview
// (selectionModeRef already exists in OccupationGraph at line 125)
if (selectionModeRef.current === 'none') {
  ctx.restore();
  return;
}
```

This ensures the grid background still draws but no edges appear in ring mode.

- [ ] **Step 4: Update the zoom auto-fit to use ring bounds**

The existing zoom setup (lines 673-780) calculates bounds from `simNodes` positions. Since ring positions are now applied to `simNodes`, the zoom auto-fit should work automatically. Verify the zoom scale extent is appropriate for the ring layout — the ring uses 20000x20000 graph space, so the existing `[0.01, 0.1]` scale extent should fit.

- [ ] **Step 5: Verify the ring layout renders**

Run: `npm run dev`

Open the app in a browser. All nodes should appear in a circle, alphabetically ordered, with no edges. Hovering should show tooltips. The grid background should render centered on the ring.

- [ ] **Step 6: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: integrate ring layout as default view in OccupationGraph"
```

---

## Chunk 4: Radial Layout and Transitions

### Task 7: Implement radial layout on node selection

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

- [ ] **Step 1: Compute radial positions when entering radial mode**

Add a memo that computes radial positions when a node is selected:

```typescript
const radialPositions = useMemo(() => {
  if (layoutMode !== 'radial' || !selectedNodeId || !connectedIds) return null;

  const neighborNodes = simNodes.filter(
    (n) => n.id !== selectedNodeId && connectedIds.has(n.id),
  );
  const neighborIds = neighborNodes.map((n) => n.id);
  const distances = computeNeighborDistances(
    selectedNodeId,
    neighborIds,
    specificSkillsMap,
  );

  const centerNode = simNodes.find((n) => n.id === selectedNodeId);
  const centerRadius = centerNode ? getNodeRadius(centerNode) : NODE_RADIUS_BASE;

  return computeRadialPositions(
    selectedNodeId,
    neighborNodes,
    distances,
    centerRadius,
    20000,
    20000,
  );
}, [layoutMode, selectedNodeId, connectedIds, simNodes, specificSkillsMap, getNodeRadius]);
```

- [ ] **Step 2: Store skill distances for tooltip and edge rendering**

Add a memo alongside radialPositions to store neighbor distances, plus a ref for the canvas drawEdges callback (which can't access React state directly):

```typescript
const neighborDistancesRef = useRef<Map<string, SkillComparison> | null>(null);

const neighborDistances = useMemo(() => {
  if (layoutMode !== 'radial' || !selectedNodeId || !connectedIds) return null;

  const neighborIds = simNodes
    .filter((n) => n.id !== selectedNodeId && connectedIds.has(n.id))
    .map((n) => n.id);

  return computeNeighborDistances(selectedNodeId, neighborIds, specificSkillsMap);
}, [layoutMode, selectedNodeId, connectedIds, simNodes, specificSkillsMap]);

// Keep ref in sync for canvas drawEdges callback
useEffect(() => {
  neighborDistancesRef.current = neighborDistances;
}, [neighborDistances]);
```

- [ ] **Step 3: Apply radial positions to simNodes when in radial mode**

Update the layout position effect (from Task 6, Step 2) to handle radial mode:

```typescript
useEffect(() => {
  if (layoutMode === 'ring') {
    for (const node of simNodes) {
      const pos = ringPositions.get(node.id);
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
      }
    }
  } else if (layoutMode === 'radial' && radialPositions) {
    for (const node of simNodes) {
      const pos = radialPositions.get(node.id);
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
      }
      // Non-neighbors keep their ring positions (already set)
    }
  }

  if (simNodes.length) {
    const xs = simNodes.map((n) => n.x);
    const ys = simNodes.map((n) => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    let maxDist = 0;
    for (const n of simNodes) {
      const d = Math.hypot(n.x - cx, n.y - cy);
      if (d > maxDist) maxDist = d;
    }
    graphCenterRef.current = { cx, cy, radius: maxDist + 80 };
  }
  drawEdgesRef.current();
}, [layoutMode, simNodes, ringPositions, radialPositions]);
```

- [ ] **Step 4: Update node opacity for radial mode**

Modify `getNodeOpacity` to use 0.06 for non-neighbors in radial mode (instead of the current 0.12):

In the existing `getNodeOpacity` callback, change the line:
```typescript
if (selectedNodeId && connectedIds && !connectedIds.has(node.id))
  return 0.12;
```
to:
```typescript
if (selectedNodeId && connectedIds && !connectedIds.has(node.id))
  return 0.06;
```

- [ ] **Step 5: Draw curved edges in radial mode**

In the `drawEdges` callback, replace the selection edges section (lines 537-571) with curved bezier arcs:

```typescript
// Draw selection edges as curved arcs (radial mode)
if (visibleEdges.length > 0 && selectionModeRef.current !== 'pair') {
  const centerNode = selectedNodeIdRef.current
    ? nodeById.current.get(selectedNodeIdRef.current)
    : null;

  for (const edge of visibleEdges) {
    const src = nodeById.current.get(
      typeof edge.source === 'string' ? edge.source : (edge.source as GraphNode).id,
    );
    const tgt = nodeById.current.get(
      typeof edge.target === 'string' ? edge.target : (edge.target as GraphNode).id,
    );
    if (!src || !tgt) continue;

    // Compute quadratic bezier control point
    const mx = (src.x + tgt.x) / 2;
    const my = (src.y + tgt.y) / 2;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const lineLength = Math.hypot(dx, dy);
    const offset = lineLength * 0.2; // 20% perpendicular offset
    // Perpendicular direction (clockwise)
    const px = -dy / lineLength * offset;
    const py = dx / lineLength * offset;
    const cpx = mx + px;
    const cpy = my + py;

    // Edge opacity based on skill distance (closer = more opaque)
    // Look up skill distance from neighborDistancesRef (stored from computeNeighborDistances)
    const neighborId = src.id === selectedNodeIdRef.current ? tgt.id : src.id;
    const comparison = neighborDistancesRef.current?.get(neighborId);
    const skillDist = comparison?.distance ?? 1;
    // Invert: distance 0 (closest) → opacity 0.6, distance 1 (farthest) → opacity 0.15
    ctx.strokeStyle = edgeColorRef.current;
    ctx.lineWidth = 1.5 / k;
    ctx.globalAlpha = 0.6 - skillDist * 0.45; // 0.6 to 0.15

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.quadraticCurveTo(cpx, cpy, tgt.x, tgt.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Pair mode edges (straight lines, same as before)
if (visibleEdges.length > 0 && selectionModeRef.current === 'pair') {
  ctx.strokeStyle = edgeColorRef.current;
  ctx.lineWidth = 2 / k;
  for (const edge of visibleEdges) {
    const src = nodeById.current.get(
      typeof edge.source === 'string' ? edge.source : (edge.source as GraphNode).id,
    );
    const tgt = nodeById.current.get(
      typeof edge.target === 'string' ? edge.target : (edge.target as GraphNode).id,
    );
    if (!src || !tgt) continue;
    ctx.globalAlpha = Math.min(0.05 + (edge.weight / 7) * 0.3 + 0.25, 0.8);
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 6: Update hover tooltip in radial mode to show skill info**

In the `onMouseEnter` handler for nodes (around line 1012), update the tooltip to show skill comparison info when in radial mode:

```typescript
onMouseEnter={() => {
  if (isIsolate) return;
  if (selectionMode === 'pair') return;
  const t = transformRef.current;
  setHoveredNodeId(node.id);

  // In radial mode with a selection, show skill comparison tooltip for neighbors
  if (layoutMode === 'radial' && selectedNodeId && neighborDistances) {
    const comparison = neighborDistances.get(node.id);
    if (comparison && node.id !== selectedNodeId) {
      setTooltip({
        x: t.applyX(node.x),
        y: t.applyY(node.y),
        node,
        skillComparison: comparison,
      });
      return;
    }
  }

  setTooltip({
    x: t.applyX(node.x),
    y: t.applyY(node.y),
    node,
  });
}}
```

Update the `TooltipState` interface to include optional skill comparison:
```typescript
interface TooltipState {
  x: number;
  y: number;
  node: GraphNode;
  skillComparison?: SkillComparison;
}
```

Update the tooltip rendering section to show skill info when available:
```typescript
{tooltip.skillComparison ? (
  <>
    <p className="font-semibold leading-tight">{tooltip.node.label}</p>
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Shared skills</span>
        <span className="font-medium">{tooltip.skillComparison.shared.length}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Skills to develop</span>
        <span className="font-medium">{tooltip.skillComparison.toDevelop.length}</span>
      </div>
    </div>
  </>
) : (
  /* Default tooltip — keep existing content unchanged */
  <>
    <p className="font-semibold leading-tight">{tooltip.node.label}</p>
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted-foreground text-[11px]">AI Exposure</span>
        <span className="font-medium text-[11px]">
          {(tooltip.node.aiExposure * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${tooltip.node.aiExposure * 100}%` }}
        />
      </div>
    </div>
  </>
)}
```

- [ ] **Step 7: Verify radial layout works**

Run: `npm run dev`

1. Click a node on the ring — it should move to center with neighbors positioned radially
2. Non-neighbors should dim to 0.06 opacity
3. Curved edges should appear from center to neighbors
4. Hover a neighbor — tooltip should show shared skills + skills to develop counts
5. Click background — should return to ring layout

- [ ] **Step 8: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: implement radial tree layout with curved edges and skill tooltips"
```

---

### Task 8: Animate transitions between ring and radial

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

- [ ] **Step 1: Add animation state and refs**

Add state/refs for tracking animation:

```typescript
const animatingRef = useRef(false);
const animationFrameRef = useRef<number | null>(null);
const nodePositionsRef = useRef<Map<string, LayoutPosition>>(new Map());
```

- [ ] **Step 2: Create animation function**

**SLC simplification:** The spec describes staggered animation timing (non-neighbors fade 0-400ms, selected node moves 0-800ms, neighbors stagger at 200-800ms, edges draw in 400-800ms). For the SLC v1, we use a single uniform interpolation for all node positions with a single duration. This looks good in practice — the different travel distances create natural visual staggering. If the user wants more sophisticated staggering later, it can be layered in without architectural changes.

Add an `animateToPositions` function that smoothly interpolates node positions:

```typescript
const animateToPositions = useCallback(
  (
    targetPositions: Map<string, LayoutPosition>,
    duration: number,
    onComplete?: () => void,
  ) => {
    // Capture starting positions
    const startPositions = new Map<string, LayoutPosition>();
    for (const node of simNodes) {
      startPositions.set(node.id, { x: node.x, y: node.y });
    }

    const startTime = performance.now();
    animatingRef.current = true;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const rawT = Math.min(elapsed / duration, 1);
      // Cubic ease in-out
      const t =
        rawT < 0.5
          ? 4 * rawT * rawT * rawT
          : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

      for (const node of simNodes) {
        const start = startPositions.get(node.id);
        const target = targetPositions.get(node.id);
        if (start && target) {
          node.x = start.x + (target.x - start.x) * t;
          node.y = start.y + (target.y - start.y) * t;
        }
      }

      // Redraw edges during animation
      drawEdgesRef.current();

      // Force SVG re-render by updating a counter or using D3
      const g = gRef.current;
      if (g) {
        const circles = d3.select(g).selectAll<SVGCircleElement, null>('.node');
        circles.each(function () {
          const el = d3.select(this);
          const id = el.attr('data-id');
          const node = nodeById.current.get(id);
          if (node) {
            el.attr('cx', node.x).attr('cy', node.y);
          }
        });
      }

      if (rawT < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animatingRef.current = false;
        onComplete?.();
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  },
  [simNodes],
);
```

- [ ] **Step 3: Trigger animation on layout mode change**

Replace the static position assignment effect (from Task 7, Step 3) with an animated version:

```typescript
const prevLayoutModeRef = useRef<LayoutMode>(layoutMode);

useEffect(() => {
  const prevMode = prevLayoutModeRef.current;
  prevLayoutModeRef.current = layoutMode;

  if (layoutMode === 'ring') {
    if (prevMode === 'radial') {
      // Animate from current positions back to ring
      animateToPositions(ringPositions, 600, () => {
        drawEdgesRef.current();
      });
    } else {
      // Initial render — set positions directly
      for (const node of simNodes) {
        const pos = ringPositions.get(node.id);
        if (pos) {
          node.x = pos.x;
          node.y = pos.y;
        }
      }
    }
  } else if (layoutMode === 'radial' && radialPositions) {
    // Build combined target: radial positions for center+neighbors,
    // ring positions for non-neighbors (they stay in place)
    const targetPositions = new Map<string, LayoutPosition>();
    for (const node of simNodes) {
      const radialPos = radialPositions.get(node.id);
      if (radialPos) {
        targetPositions.set(node.id, radialPos);
      } else {
        // Non-neighbors keep ring positions
        const ringPos = ringPositions.get(node.id);
        if (ringPos) targetPositions.set(node.id, ringPos);
      }
    }
    animateToPositions(targetPositions, 800, () => {
      drawEdgesRef.current();
    });
  }

  // Update graph center
  if (simNodes.length) {
    const xs = simNodes.map((n) => n.x);
    const ys = simNodes.map((n) => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    let maxDist = 0;
    for (const n of simNodes) {
      const d = Math.hypot(n.x - cx, n.y - cy);
      if (d > maxDist) maxDist = d;
    }
    graphCenterRef.current = { cx, cy, radius: maxDist + 80 };
  }
}, [layoutMode, simNodes, ringPositions, radialPositions, animateToPositions]);
```

- [ ] **Step 4: Clean up animation on unmount**

Add cleanup for the animation frame:

```typescript
useEffect(() => {
  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, []);
```

- [ ] **Step 5: Verify animated transitions work**

Run: `npm run dev`

1. Click a node — nodes should smoothly animate from ring to radial positions (~800ms)
2. Click background — nodes should smoothly animate back to ring (~600ms)
3. Edges should appear/disappear smoothly during the transition
4. No visual glitches or jumps

- [ ] **Step 6: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: add animated transitions between ring and radial layouts"
```

---

### Task 9: Update zoom behavior for layout modes

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

- [ ] **Step 1: Update auto-zoom to fit radial neighborhood**

The existing auto-zoom effect (lines 782-874) handles zooming for single/pair selection. Update it to work with the new layout modes:

In the single selection branch, instead of zooming to fit all connected nodes at their force-directed positions, zoom to fit the radial layout (center + neighbors):

```typescript
if (selectionMode === 'single' && selectedNodeId && radialPositions) {
  if (!preZoomTransformRef.current) {
    preZoomTransformRef.current = transformRef.current;
  }

  // Zoom to fit all radial positions with padding
  const positions = [...radialPositions.values()];
  const padding = 250;
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;
  const dx = maxX - minX;
  const dy = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = Math.min(dimensions.width / dx, dimensions.height / dy, 3);
  const tx = dimensions.width / 2 - cx * scale;
  const ty = dimensions.height / 2 - cy * scale;
  const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

  svg
    .transition()
    .duration(800)
    .ease(d3.easeCubicInOut)
    .call(zoom.transform, target);
}
```

- [ ] **Step 2: Verify zoom works**

Run: `npm run dev`

1. Click a node — zoom should smoothly fit the radial neighborhood
2. Click background — zoom should smoothly return to fit the full ring
3. Pair mode zoom should still work

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: update zoom behavior for ring and radial layout modes"
```

---

## Chunk 5: Polish and Edge Cases

### Task 10: Handle search transition back to ring

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update search/combobox selection to return to ring first**

In `handleNodeSelect` in `app/page.tsx`, the combobox (OccupationSearch) also calls `handleNodeSelect`. When a user searches while in radial mode, the state machine says to transition to ring first.

The current logic already handles this correctly — when `handleNodeSelect` is called with a new node ID while no prior selection exists (after clearing), it sets `layoutMode` to `radial`. But if called from the search bar while already in radial mode, we need to first clear to ring, then select.

Update the `onOccupationSelect` callback for `GraphControls` and `OccupationSearch` to ensure layout resets:

```typescript
const handleSearchSelect = (id: string | null) => {
  if (id === null) return;
  // If already in radial mode, reset to ring first, then select after a brief delay
  // to let the ring animation play
  if (layoutMode === 'radial') {
    setSelectedNodeId(null);
    setSecondSelectedNodeId(null);
    setPanelNodeId(null);
    setIsPanelOpen(false);
    setLayoutMode('ring');
    // Select after ring transition completes
    // Known fragility: hardcoded delay must match animation duration (600ms).
    // If animation duration changes, update this value too.
    setTimeout(() => {
      setSelectedNodeId(id);
      setLayoutMode('radial');
    }, 650);
    return;
  }
  handleNodeSelect(id);
};
```

Pass `handleSearchSelect` to `OccupationSearch` and `GraphControls` instead of `handleNodeSelect`.

- [ ] **Step 2: Verify search → ring → radial transition**

Run: `npm run dev`

1. Click a node to enter radial mode
2. Use the search bar to search for a different occupation
3. Graph should animate back to ring, then to radial centered on the new node

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: handle search transition through ring mode before radial"
```

---

### Task 11: Final cleanup, badge update, and end-to-end verification

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update the node count badge**

The current badge (line 274-276) shows MST edge count. Since MST is removed, update it:

```typescript
<div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/70 px-2 py-1 rounded">
  {nodes.length} occupations · {edges.length.toLocaleString()} skill connections
</div>
```

- [ ] **Step 2: Remove unused imports**

In `app/page.tsx`, remove:
- `import { computeMaxSpanningTree } from "@/lib/mst"` (if not already removed)
- Any other unused imports

In `components/graph/OccupationGraph.tsx`, remove:
- Any references to `mstEdges` that remain
- Unused `TunerLayoutParams` import if still present

- [ ] **Step 3: Verify the complete flow end-to-end**

Run: `npm run dev`

Test the complete interaction flow:
1. **Ring mode default:** All nodes on ring, alphabetical, no edges, sized by metric
2. **Hover in ring:** Tooltip with name + AI exposure
3. **Click node:** Animated transition to radial, center + neighbors positioned by skill distance
4. **Hover neighbor in radial:** Tooltip with shared skills + skills to develop
5. **Click neighbor:** Pair mode with badge and edge
6. **Click background in pair:** Back to radial single
7. **Click background in radial:** Animated transition back to ring
8. **Search while in radial:** Returns to ring, then selects new node
9. **Escape key:** Returns to ring from radial
10. **Filters:** Dim non-matching nodes in both modes
11. **Resize:** Layout stays centered

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/graph/OccupationGraph.tsx
git commit -m "chore: cleanup unused imports and update node count badge"
```
