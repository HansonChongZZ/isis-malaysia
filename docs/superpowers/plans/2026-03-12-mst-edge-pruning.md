# MST Edge Pruning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace weight-threshold edge filtering with a maximum spanning forest to create clear visual clusters in the occupation graph.

**Architecture:** New `lib/mst.ts` module with Kruskal's algorithm + Union-Find. MST edges used for layout/default rendering; full edges used for hover/click interactions. Inlined JS copy in the offline compute script.

**Tech Stack:** TypeScript, D3-force, Next.js (React)

**Spec:** `docs/superpowers/specs/2026-03-12-mst-edge-pruning-design.md`

---

## Chunk 1: MST Algorithm and Layout Script

### Task 1: Create `lib/mst.ts`

**Files:**
- Create: `lib/mst.ts`

- [ ] **Step 1: Write the MST module**

```typescript
import type { GraphEdge } from './types';

class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    const rankA = this.rank.get(rootA)!;
    const rankB = this.rank.get(rootB)!;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
    return true;
  }
}

/**
 * Compute the maximum spanning forest of the given edges using Kruskal's algorithm.
 * Returns a subset of edges that form a spanning tree per connected component,
 * preferring edges with the highest weight.
 */
export function computeMaxSpanningTree(edges: GraphEdge[]): GraphEdge[] {
  const sorted = [...edges].sort((a, b) => b.weight - a.weight);
  const uf = new UnionFind();
  const result: GraphEdge[] = [];
  for (const edge of sorted) {
    const src = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
    const tgt = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
    if (uf.union(src, tgt)) {
      result.push(edge);
    }
  }
  return result;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Quick smoke test via Node**

Run: `npx tsx -e "import { computeMaxSpanningTree } from './lib/mst'; const edges = JSON.parse(require('fs').readFileSync('public/data/edges.json','utf-8')); const mst = computeMaxSpanningTree(edges); console.log('Input:', edges.length, 'MST:', mst.length); const nodes = new Set(); for (const e of mst) { nodes.add(e.source); nodes.add(e.target); } console.log('Connected nodes:', nodes.size);"`
Expected: MST edge count < 359, connected nodes = 359

- [ ] **Step 4: Commit**

```bash
git add lib/mst.ts
git commit -m "feat: add maximum spanning tree algorithm (lib/mst.ts)"
```

---

### Task 2: Update `scripts/compute-layout.mjs`

**Files:**
- Modify: `scripts/compute-layout.mjs:40-68` (replace MIN_EDGE_WEIGHT filter with inlined MST)

- [ ] **Step 1: Replace edge filtering with inlined MST algorithm**

Remove the `MIN_EDGE_WEIGHT` constant (line 43) and the `strongEdges` filter block (lines 60-62). Replace with:

```javascript
// Maximum spanning forest — canonical implementation in lib/mst.ts
function computeMaxSpanningTree(edges) {
  const parent = new Map();
  const rank = new Map();
  function find(x) {
    if (!parent.has(x)) { parent.set(x, x); rank.set(x, 0); }
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let curr = x;
    while (curr !== root) { const next = parent.get(curr); parent.set(curr, root); curr = next; }
    return root;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    const ka = rank.get(ra), kb = rank.get(rb);
    if (ka < kb) parent.set(ra, rb);
    else if (ka > kb) parent.set(rb, ra);
    else { parent.set(rb, ra); rank.set(ra, ka + 1); }
    return true;
  }
  const sorted = [...edges].sort((a, b) => b.weight - a.weight);
  const result = [];
  for (const e of sorted) { if (union(e.source, e.target)) result.push(e); }
  return result;
}
```

Then replace the edge pruning block:

```javascript
// Compute maximum spanning forest
const mstEdges = computeMaxSpanningTree(edges);
console.log(`MST: ${mstEdges.length} edges (from ${edges.length})`);

const simEdges = mstEdges.map((e) => ({
  source: e.source,
  target: e.target,
  weight: e.weight,
}));
```

- [ ] **Step 2: Run the layout script**

Run: `node scripts/compute-layout.mjs`
Expected: Output shows "MST: <N> edges (from 3348)" where N < 359, all valid positions

- [ ] **Step 3: Commit**

```bash
git add scripts/compute-layout.mjs
git commit -m "feat: use MST for layout edge pruning in compute script"
```

---

## Chunk 2: Runtime Integration

### Task 3: Update `app/page.tsx` and remove `MIN_EDGE_WEIGHT`

**Files:**
- Modify: `app/page.tsx:6` (imports)
- Modify: `app/page.tsx:40-44` (data loading)
- Modify: `app/page.tsx:237-251` (OccupationGraph props)
- Modify: `app/page.tsx:270-273` (badge)
- Modify: `lib/constants.ts:15-17` (remove MIN_EDGE_WEIGHT)

- [ ] **Step 1: Remove `MIN_EDGE_WEIGHT` from constants**

Delete these lines from `lib/constants.ts`:

```typescript
// Minimum edge weight to include in the layout and rendering.
// Pruning weak edges allows natural clusters to form.
export const MIN_EDGE_WEIGHT = 2;
```

- [ ] **Step 2: Update imports in `app/page.tsx`**

Replace:
```typescript
import { MIN_EDGE_WEIGHT } from "@/lib/constants"
```
With:
```typescript
import { computeMaxSpanningTree } from "@/lib/mst"
```

- [ ] **Step 3: Store full edges (remove weight filter)**

Replace the data loading callback:
```typescript
.then(([n, e, o]) => {
  setNodes(n)
  setEdges(e.filter((edge) => edge.weight >= MIN_EDGE_WEIGHT))
  setOccupations(o)
  setLoading(false)
})
```
With:
```typescript
.then(([n, e, o]) => {
  setNodes(n)
  setEdges(e)
  setOccupations(o)
  setLoading(false)
})
```

- [ ] **Step 4: Add mstEdges memo**

Add after the `maxWorkers` memo (around line 98):

```typescript
const mstEdges = useMemo(() => computeMaxSpanningTree(edges), [edges])
```

- [ ] **Step 5: Pass mstEdges to OccupationGraph**

Add `mstEdges={mstEdges}` prop to the OccupationGraph component:

```tsx
<OccupationGraph
  nodes={nodes}
  edges={edges}
  mstEdges={mstEdges}
  onNodeSelect={handleNodeSelect}
  // ... rest of props unchanged
/>
```

- [ ] **Step 6: Update the node count badge**

Replace:
```tsx
{nodes.length} occupations · {edges.length} skill edges
```
With:
```tsx
{nodes.length} occupations · {mstEdges.length} skill edges ({edges.length.toLocaleString()} total)
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Error about `mstEdges` not in OccupationGraphProps (will be fixed in Task 4)

- [ ] **Step 8: Commit**

```bash
git add lib/constants.ts app/page.tsx
git commit -m "feat: compute MST edges at load time, remove MIN_EDGE_WEIGHT"
```

**Note:** After this change, `isolateIds` detection in OccupationGraph now uses the full edge set, so nodes that previously appeared as isolates (those with only weight-1 edges) will now correctly appear as connected nodes.

---

### Task 4: Update `components/graph/OccupationGraph.tsx`

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:40-54` (props interface)
- Modify: `components/graph/OccupationGraph.tsx:56-70` (destructuring)
- Modify: `components/graph/OccupationGraph.tsx:459-568` (drawEdges — add baseline MST rendering)
- Modify: `components/graph/OccupationGraph.tsx:1135-1140` (TunerPanel props)

- [ ] **Step 1: Add `mstEdges` to props interface**

In the `OccupationGraphProps` interface, add after `edges`:
```typescript
mstEdges: GraphEdge[];
```

- [ ] **Step 2: Destructure the new prop**

Add `mstEdges` to the destructured props:
```typescript
export default function OccupationGraph({
  nodes,
  edges,
  mstEdges,
  // ... rest
```

- [ ] **Step 3: Add baseline MST edge rendering in `drawEdges`**

In the `drawEdges` callback, after the grid rendering (after line 504 `ctx.globalCompositeOperation = 'source-over';`) and before the existing `// Draw selection edges` block, add:

```typescript
    // Draw baseline MST edges — always visible, dimmed during hover/selection
    {
      const hasFocus = visibleEdges.length > 0 || hoveredEdges.length > 0;
      ctx.strokeStyle = edgeColorRef.current;
      ctx.lineWidth = 0.5 / k;
      ctx.globalAlpha = hasFocus ? 0.04 : 0.15;
      ctx.beginPath();
      for (const edge of mstEdges) {
        const src = nodeById.current.get(
          typeof edge.source === 'string'
            ? edge.source
            : (edge.source as GraphNode).id,
        );
        const tgt = nodeById.current.get(
          typeof edge.target === 'string'
            ? edge.target
            : (edge.target as GraphNode).id,
        );
        if (!src || !tgt) continue;
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
```

- [ ] **Step 4: Add `mstEdges` to `drawEdges` dependencies**

Update the `drawEdges` dependency array to include `mstEdges`:
```typescript
}, [selectionMode, visibleEdges, hoveredEdges, mstEdges]);
```

- [ ] **Step 5: Pass mstEdges to TunerPanel**

Update the TunerPanel usage:
```tsx
<TunerPanel
  nodes={simNodes}
  edges={edges}
  mstEdges={mstEdges}
  onSizingChange={setTunerSizing}
  onPositionsChange={setTunerPositions}
  colorByGroup={colorByGroup}
  onColorByGroupChange={setColorByGroup}
/>
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Error about `mstEdges` not in TunerPanelProps (will be fixed in Task 6)

- [ ] **Step 7: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: render MST edges at rest, use full edges on interaction"
```

---

### Task 5: Update `components/graph/TunerPanel.tsx`

**Files:**
- Modify: `components/graph/TunerPanel.tsx:19-26` (props interface)
- Modify: `components/graph/TunerPanel.tsx:28-36` (DEFAULTS — remove minEdgeWeight)
- Modify: `components/graph/TunerPanel.tsx:38-95` (SLIDER_CONFIG — remove minEdgeWeight slider)
- Modify: `components/graph/TunerPanel.tsx:101-108` (destructuring)
- Modify: `components/graph/TunerPanel.tsx:147-157` (simulation — use mstEdges)
- Modify: `components/graph/TunerPanel.tsx:223-228` (layout keys — remove minEdgeWeight)

- [ ] **Step 1: Add `mstEdges` to props, remove old import**

Update the interface:
```typescript
interface TunerPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mstEdges: GraphEdge[];
  onSizingChange: (params: TunerSizingParams) => void;
  onPositionsChange: (positions: Map<string, { x: number; y: number }>) => void;
  colorByGroup: boolean;
  onColorByGroupChange: (value: boolean) => void;
}
```

And destructure it:
```typescript
export default function TunerPanel({
  nodes,
  edges,
  mstEdges,
  onSizingChange,
  onPositionsChange,
  colorByGroup,
  onColorByGroupChange,
}: TunerPanelProps) {
```

- [ ] **Step 2: Remove `minEdgeWeight` from DEFAULTS**

Remove `minEdgeWeight: 2,` from the DEFAULTS object.

- [ ] **Step 3: Remove `minEdgeWeight` slider from SLIDER_CONFIG**

Remove this entry from SLIDER_CONFIG:
```typescript
  {
    key: 'minEdgeWeight',
    label: 'Min Edge Weight',
    min: 1,
    max: 7,
    step: 1,
    group: 'layout',
  },
```

- [ ] **Step 4: Use `mstEdges` in simulation instead of filtering**

In `runSimulation`, replace the entire edge mapping block (the `.filter().map()` chain) with:
```typescript
        const simEdges = mstEdges.map((e) => ({
          source:
            typeof e.source === 'string'
              ? e.source
              : (e.source as GraphNode).id,
          target:
            typeof e.target === 'string'
              ? e.target
              : (e.target as GraphNode).id,
          weight: e.weight,
        }));
```

- [ ] **Step 5: Remove `minEdgeWeight` from layout keys**

In `handleChange`, remove `'minEdgeWeight'` from the `layoutKeys` array.

- [ ] **Step 6: Update `runSimulation` dependencies**

Update the dependency array of `runSimulation` — `edges` is no longer used in the callback, replace with `mstEdges`:
```typescript
[nodes, mstEdges, onPositionsChange],
```

- [ ] **Step 7: Verify it compiles and app runs**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add components/graph/TunerPanel.tsx
git commit -m "feat: use MST edges in TunerPanel simulation, remove minEdgeWeight slider"
```

---

## Chunk 3: Recompute Layout and Verify

### Task 6: Recompute layout and verify

**Files:**
- Modify: `public/data/nodes.json` (recomputed positions)

- [ ] **Step 1: Recompute layout positions**

Run: `node scripts/compute-layout.mjs`
Expected: MST edge count output, valid positions, reasonable bounds

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Start dev server and verify visually**

Run: `npm run dev`

Verify:
1. Graph loads with visible MST edges at low opacity (baseline)
2. Hovering a node shows all its edges (not just MST)
3. Clicking a node shows all connected edges
4. TunerPanel opens, `minEdgeWeight` slider is gone, `linkStrengthDivisor` works
5. Node count badge shows format: "456 occupations · N skill edges (3348 total)"
6. Group coloring debug toggle still works

- [ ] **Step 4: Commit updated positions**

```bash
git add public/data/nodes.json
git commit -m "feat: recompute layout positions using MST edge pruning"
```
