# Fixed Node Positions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate runtime force simulation by storing absolute pixel positions in nodes.json and using d3 zoom to fit them into any viewport.

**Architecture:** Run force simulation once offline via `scripts/compute-layout.mjs`, writing raw pixel coordinates to `nodes.json`. At runtime, nodes render at their baked positions; a zoom-to-fit transform adapts the fixed layout to the current viewport. No force simulation runs in the browser.

**Tech Stack:** d3-force (offline only), d3-zoom (runtime)

---

### Task 1: Update NodeSchema to allow unbounded x/y

**Files:**
- Modify: `lib/types.ts:11-12`

**Step 1: Update the schema**

Change the x/y fields from bounded 0-1 to unbounded numbers:

```typescript
// lib/types.ts lines 11-12, change from:
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
// to:
  x: z.number(),
  y: z.number(),
```

**Step 2: Remove SimNode's optional x/y override**

SimNode currently re-declares `x?: number` and `y?: number` as optional, overriding GraphNode's required `x: number`. Since we no longer need d3 to assign positions, simplify:

```typescript
// lib/types.ts lines 35-42, change from:
export type SimNode = GraphNode & {
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}
// to:
export type SimNode = GraphNode
```

Also remove the `SimEdge` type (lines 44-48) since it was only used by the force simulation.

**Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`

There will be errors from files still referencing `SimEdge` and `useForceSimulation` — that's expected, we fix those next.

**Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "refactor: make NodeSchema x/y unbounded for absolute pixel positions"
```

---

### Task 2: Rewrite compute-layout.mjs to output raw pixel positions

**Files:**
- Modify: `scripts/compute-layout.mjs`

**Step 1: Rewrite the script**

Replace the entire file with a simpler version that runs the two-stage simulation and writes raw pixel coords (no normalization):

```javascript
/**
 * Compute fixed layout positions for the occupation graph.
 *
 * Runs a two-stage d3-force simulation and writes raw pixel
 * coordinates to nodes.json. These positions are used as-is
 * at runtime — the browser uses d3-zoom to fit them into
 * whatever viewport the user has.
 *
 * Usage: node scripts/compute-layout.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodesPath = resolve(__dirname, '../public/data/nodes.json');
const edgesPath = resolve(__dirname, '../public/data/edges.json');

// Deterministic PRNG (LCG) for reproducible layouts
const SEED = 42;
let _seed = SEED;
function deterministicRandom() {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return (_seed >>> 0) / 0xffffffff;
}
const _origRandom = Math.random;
Math.random = deterministicRandom;

// Constants matching lib/constants.ts
const NODE_RADIUS_BASE = 9;
const NODE_RADIUS_SCALE = 27;
const NODE_RADIUS_COLLIDE_PADDING = 4.5;

const CANVAS_W = 4000;
const CANVAS_H = 2400;
const EDGE_WEIGHT_MAX = 7;

// Stage 1: spread-out base layout
const BASE_INTRA = 0.08;
const BASE_INTER = 0.01;
const BASE_CHARGE = -1000;
const BASE_ITERS = 5000;

// Stage 2: tuning pass (tight clusters)
const TUNING_INTRA = 0.8;
const TUNING_INTER = 0.001;
const TUNING_CHARGE = -50;
const TUNING_ITERS = 300;

// Load data
const nodes = JSON.parse(readFileSync(nodesPath, 'utf-8'));
const edges = JSON.parse(readFileSync(edgesPath, 'utf-8'));
console.log(`Loaded ${nodes.length} nodes, ${edges.length} edges`);

const groupOf = new Map(nodes.map((n) => [n.id, n.group]));
const cx = CANVAS_W / 2;
const cy = CANVAS_H / 2;

const collideRadius = (d) => {
  return NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE + NODE_RADIUS_COLLIDE_PADDING;
};

// ─── Stage 1 ────────────────────────────────────────────────────────────────

const simNodes = nodes.map((n) => ({
  id: n.id,
  aiExposure: n.aiExposure,
  group: n.group,
}));

const sim1 = forceSimulation(simNodes)
  .force(
    'link',
    forceLink(edges.map((e) => ({ ...e })))
      .id((d) => d.id)
      .distance((d) => 50 + (EDGE_WEIGHT_MAX - d.weight) * 15)
      .strength((d) => {
        const s = typeof d.source === 'string' ? d.source : d.source.id;
        const t = typeof d.target === 'string' ? d.target : d.target.id;
        return groupOf.get(s) === groupOf.get(t) ? BASE_INTRA : BASE_INTER;
      }),
  )
  .force('charge', forceManyBody().strength(BASE_CHARGE))
  .force('center', forceCenter(cx, cy))
  .force('collide', forceCollide(collideRadius));

sim1.stop();
console.log(`Stage 1: ${BASE_ITERS} iterations...`);
let t = Date.now();
for (let i = 0; i < BASE_ITERS; i++) sim1.tick();
console.log(`  done in ${Date.now() - t}ms`);

// ─── Stage 2 ────────────────────────────────────────────────────────────────

// Reset velocities, keep positions from Stage 1
for (const n of simNodes) { n.vx = 0; n.vy = 0; }

const sim2 = forceSimulation(simNodes)
  .force(
    'link',
    forceLink(edges.map((e) => ({ ...e })))
      .id((d) => d.id)
      .distance((d) => 50 + (EDGE_WEIGHT_MAX - d.weight) * 15)
      .strength((d) => {
        const s = typeof d.source === 'string' ? d.source : d.source.id;
        const t = typeof d.target === 'string' ? d.target : d.target.id;
        return groupOf.get(s) === groupOf.get(t) ? TUNING_INTRA : TUNING_INTER;
      }),
  )
  .force('charge', forceManyBody().strength(TUNING_CHARGE))
  .force('center', forceCenter(cx, cy))
  .force('collide', forceCollide(collideRadius));

sim2.stop();
console.log(`Stage 2: ${TUNING_ITERS} iterations...`);
t = Date.now();
for (let i = 0; i < TUNING_ITERS; i++) sim2.tick();
console.log(`  done in ${Date.now() - t}ms`);

// ─── Write raw pixel positions ──────────────────────────────────────────────

const posMap = new Map(simNodes.map((n) => [n.id, { x: parseFloat(n.x.toFixed(1)), y: parseFloat(n.y.toFixed(1)) }]));

const output = nodes.map((n) => {
  const pos = posMap.get(n.id);
  return { ...n, x: pos.x, y: pos.y };
});

writeFileSync(nodesPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Written ${output.length} nodes to ${nodesPath}`);

// Verify
const xs = output.map((n) => n.x);
const ys = output.map((n) => n.y);
console.log(`Bounds: x=[${Math.min(...xs).toFixed(1)}, ${Math.max(...xs).toFixed(1)}], y=[${Math.min(...ys).toFixed(1)}, ${Math.max(...ys).toFixed(1)}]`);

console.log('\nGroup centers:');
for (const g of [...new Set(nodes.map((n) => n.group))].sort((a, b) => a - b)) {
  const gn = output.filter((n) => n.group === g);
  const ax = gn.reduce((s, n) => s + n.x, 0) / gn.length;
  const ay = gn.reduce((s, n) => s + n.y, 0) / gn.length;
  console.log(`  Group ${g} (n=${gn.length}): center=(${ax.toFixed(0)}, ${ay.toFixed(0)})`);
}

Math.random = _origRandom;
```

**Step 2: Run the script**

Run: `node scripts/compute-layout.mjs`

Expected: nodes.json is rewritten with raw pixel coordinates. Bounds should be roughly within 0-4000 range. Group centers should be clearly separated (different x,y values, not all clustered around the same point).

**Step 3: Commit**

```bash
git add scripts/compute-layout.mjs public/data/nodes.json
git commit -m "refactor: compute-layout outputs raw pixel positions"
```

---

### Task 3: Delete useForceSimulation hook

**Files:**
- Delete: `hooks/useForceSimulation.ts`

**Step 1: Delete the file**

```bash
rm hooks/useForceSimulation.ts
```

**Step 2: Commit**

```bash
git add hooks/useForceSimulation.ts
git commit -m "refactor: remove useForceSimulation hook"
```

---

### Task 4: Update OccupationGraph to use fixed positions + auto-zoom

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

This is the main task. We need to:
1. Remove `useForceSimulation` import and call
2. Remove `handleTick` callback (no longer needed — positions are static)
3. Replace the zoom setup effect to auto-zoom-to-fit on mount/resize
4. Fix all `SimNode` references (now just `GraphNode`)
5. Remove `SimEdge` references in edge drawing

**Step 1: Update imports**

```typescript
// Remove this line:
import { useForceSimulation } from '@/hooks/useForceSimulation';

// In the type import, remove SimNode (it's now just GraphNode):
// Change from:
import type { GraphNode, GraphEdge, SimNode, NodeSizeMetric, OccupationDetail } from '@/lib/types';
// To:
import type { GraphNode, GraphEdge, NodeSizeMetric, OccupationDetail } from '@/lib/types';
```

**Step 2: Update type aliases throughout the file**

Replace all usages of `SimNode` with `GraphNode`:
- `TooltipState.node: SimNode` → `node: GraphNode`
- `nodeById` ref: `Map<string, SimNode>` → `Map<string, GraphNode>`
- `simNodes` type: `SimNode[]` → `GraphNode[]`
- All cast expressions like `(e.source as SimNode).id` → `(e.source as GraphNode).id`
- `getNodeRadius(node: SimNode)` → `getNodeRadius(node: GraphNode)`
- `getNodeOpacity(node: SimNode)` → `getNodeOpacity(node: GraphNode)`

**Step 3: Remove handleTick and useForceSimulation call**

Delete the `handleTick` callback (lines ~414-426) and the `useForceSimulation({...})` call (lines ~428-437).

**Step 4: Replace the zoom setup effect with auto-zoom-to-fit**

Replace the existing "Zoom + pan behavior" effect (lines ~480-544) with a version that computes an initial zoom transform to fit all nodes:

```typescript
  // Zoom + pan with auto-fit
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !dimensions.width || !dimensions.height) return;
    if (!simNodes.length) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const padding = 80;

    // Compute node bounds
    const xs = simNodes.map((n) => n.x);
    const ys = simNodes.map((n) => n.y);
    const boundsMinX = Math.min(...xs) - padding;
    const boundsMinY = Math.min(...ys) - padding;
    const boundsMaxX = Math.max(...xs) + padding;
    const boundsMaxY = Math.max(...ys) + padding;
    const boundsW = boundsMaxX - boundsMinX;
    const boundsH = boundsMaxY - boundsMinY;

    // Compute fit transform
    const scale = Math.min(dimensions.width / boundsW, dimensions.height / boundsH, 2);
    const tx = (dimensions.width - boundsW * scale) / 2 - boundsMinX * scale;
    const ty = (dimensions.height - boundsH * scale) / 2 - boundsMinY * scale;
    const fitTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);

    const minScale = 0.2;
    const maxScale = 3;

    // Expand translate extent so user can pan beyond initial fit
    const minExtentW = dimensions.width / minScale;
    const minExtentH = dimensions.height / minScale;
    let extMinX = boundsMinX;
    let extMaxX = boundsMaxX;
    let extMinY = boundsMinY;
    let extMaxY = boundsMaxY;
    const extentW = extMaxX - extMinX;
    const extentH = extMaxY - extMinY;
    if (extentW < minExtentW) {
      const pad = (minExtentW - extentW) / 2;
      extMinX -= pad;
      extMaxX += pad;
    }
    if (extentH < minExtentH) {
      const pad = (minExtentH - extentH) / 2;
      extMinY -= pad;
      extMaxY += pad;
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([minScale, maxScale])
      .translateExtent([
        [extMinX, extMinY],
        [extMaxX, extMaxY],
      ])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        g.attr('transform', event.transform.toString());
        setTooltip(null);
        drawEdgesRef.current();

        // Update badge position during zoom
        if (selectionModeRef.current === 'pair' && selectedNodeIdRef.current && secondSelectedNodeIdRef.current) {
          const nodeA = nodeById.current.get(selectedNodeIdRef.current);
          const nodeB = nodeById.current.get(secondSelectedNodeIdRef.current);
          if (nodeA && nodeB) {
            const mx = (nodeA.x + nodeB.x) / 2;
            const my = (nodeA.y + nodeB.y) / 2;
            setBadgePos({ x: event.transform.applyX(mx), y: event.transform.applyY(my) });
          }
        }
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Apply initial fit transform (no animation on mount)
    svg.call(zoom.transform, fitTransform);

    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions.width, dimensions.height, simNodes]);
```

**Step 5: Remove `(node.x ?? 0)` fallbacks**

Since `x` and `y` are now required numbers on `GraphNode`, remove all `?? 0` fallbacks for node positions throughout the file. For example:
- `node.x ?? 0` → `node.x`
- `node.y ?? 0` → `node.y`
- `src.x ?? 0` → `src.x`

**Step 6: Remove edges prop from useForceSimulation references**

The `edges` prop is still used by OccupationGraph for drawing edges, building adjacency, etc. — that all stays. Just the `useForceSimulation` call and `handleTick` are removed.

**Step 7: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 8: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "refactor: use fixed positions with auto-zoom-to-fit, remove force simulation"
```

---

### Task 5: Clean up unused exports and dead code

**Files:**
- Modify: `lib/types.ts` (if SimEdge removal caused issues)
- Delete: `scripts/bake-tuning.mjs` (if it exists)

**Step 1: Search for remaining references to deleted code**

```bash
grep -r "useForceSimulation\|SimEdge\|SimNode\|normalizedPositions" --include="*.ts" --include="*.tsx" .
```

Fix any remaining references.

**Step 2: Full type check**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Manual verification**

Run the dev server and verify:
- Graph loads with clustered layout (no simulation delay)
- Zoom and pan work
- Node selection, pair mode, edge tooltips all work
- Resize the window — layout re-fits correctly

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up dead code from force simulation removal"
```
