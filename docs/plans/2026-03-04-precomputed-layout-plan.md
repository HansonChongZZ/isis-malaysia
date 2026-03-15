# Pre-computed Graph Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace runtime force simulation with pre-computed, stored node positions so the graph fills the viewport in a loose-cloud layout like Harvard's Product Space.

**Architecture:** An offline Node.js script runs d3-force with aggressive parameters and 5,000 iterations, normalizes positions to 0-1, and writes them into `nodes.json`. At runtime, the app scales stored coordinates to viewport dimensions — no force simulation needed.

**Tech Stack:** d3-force (offline script via tsx), Next.js + React (runtime rendering)

---

### Task 1: Create the layout computation script

**Files:**
- Create: `scripts/compute-layout.mjs`

**Step 1: Create the script**

```javascript
// scripts/compute-layout.mjs
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');

// Dynamic import for d3 (ESM)
const d3 = await import('d3');

const nodes = JSON.parse(readFileSync(join(DATA_DIR, 'nodes.json'), 'utf-8'));
const edges = JSON.parse(readFileSync(join(DATA_DIR, 'edges.json'), 'utf-8'));

// Use a large virtual canvas so forces have room to spread
const W = 4000;
const H = 2400;
const cx = W / 2;
const cy = H / 2;

// Node radius formula (matches runtime)
const NODE_RADIUS_BASE = 9;
const NODE_RADIUS_SCALE = 27;
const NODE_RADIUS_COLLIDE_PADDING = 4.5;

const simEdges = edges.map((e) => ({ ...e }));

const simulation = d3
  .forceSimulation(nodes)
  .force(
    'link',
    d3
      .forceLink(simEdges)
      .id((d) => d.id)
      .distance((d) => 40 + (7 - d.weight) * 12)
      .strength(0.05),
  )
  .force('charge', d3.forceManyBody().strength(-800))
  .force(
    'collide',
    d3.forceCollide((d) => NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE + NODE_RADIUS_COLLIDE_PADDING),
  )
  .force('x', d3.forceX(cx).strength(0.01))
  .force('y', d3.forceY(cy).strength(0.03))
  .stop();

// Run 5000 iterations for full stabilization
const TICKS = 5000;
console.log(`Running ${TICKS} simulation ticks for ${nodes.length} nodes, ${edges.length} edges...`);
for (let i = 0; i < TICKS; i++) {
  simulation.tick();
  if (i % 1000 === 0) console.log(`  tick ${i}...`);
}
console.log('Simulation complete.');

// Find bounds
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const n of nodes) {
  if (n.x < minX) minX = n.x;
  if (n.x > maxX) maxX = n.x;
  if (n.y < minY) minY = n.y;
  if (n.y > maxY) maxY = n.y;
}

// Normalize to 0-1 with small padding
const pad = 0.02;
const rangeX = maxX - minX;
const rangeY = maxY - minY;

for (const n of nodes) {
  n.x = pad + ((n.x - minX) / rangeX) * (1 - 2 * pad);
  n.y = pad + ((n.y - minY) / rangeY) * (1 - 2 * pad);
  // Round to 6 decimal places
  n.x = Math.round(n.x * 1000000) / 1000000;
  n.y = Math.round(n.y * 1000000) / 1000000;
  // Remove d3 simulation properties
  delete n.vx;
  delete n.vy;
  delete n.fx;
  delete n.fy;
  delete n.index;
}

writeFileSync(join(DATA_DIR, 'nodes.json'), JSON.stringify(nodes, null, 2) + '\n');
console.log(`Wrote ${nodes.length} nodes with positions to nodes.json`);
```

**Step 2: Run the script**

Run: `node scripts/compute-layout.mjs`
Expected: Output showing tick progress, final message "Wrote 456 nodes with positions to nodes.json"

**Step 3: Verify the output**

Check `public/data/nodes.json` — each node should now have `x` and `y` fields between 0 and 1.

**Step 4: Commit**

```bash
git add scripts/compute-layout.mjs public/data/nodes.json
git commit -m "feat: add layout computation script and pre-compute node positions"
```

---

### Task 2: Update the data schema

**Files:**
- Modify: `lib/types.ts:3-10` (NodeSchema)
- Modify: `lib/types.ts:32-39` (SimNode type)

**Step 1: Add x/y to NodeSchema**

In `lib/types.ts`, add `x` and `y` to `NodeSchema`:

```typescript
export const NodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.number().int().min(1).max(9),
  aiExposure: z.number().min(0).max(1),
  quartile: z.enum(["Low", "Medium low", "Medium high", "High"]),
  wage: z.number().nullable(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})
```

**Step 2: Update SimNode type**

`SimNode` currently has `x?: number` and `y?: number` as optional. Since `GraphNode` now has `x` and `y` (required, 0-1), the SimNode intersection means `x` and `y` become `number` (not optional). But d3 also writes to these. The simplest fix: remove `x?` and `y?` from SimNode since they come from GraphNode now:

```typescript
export type SimNode = GraphNode & {
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}
```

This is actually identical to the current definition minus the `x?` and `y?` lines — those are now inherited from `GraphNode`.

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: Clean output (no errors)

**Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add x/y position fields to NodeSchema"
```

---

### Task 3: Simplify useForceSimulation to use stored positions

**Files:**
- Modify: `hooks/useForceSimulation.ts` (full rewrite)

**Step 1: Rewrite the hook**

Replace the entire file content with:

```typescript
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { SimNode, SimEdge, GraphEdge } from '@/lib/types';

interface UseForceSimulationProps {
  nodes: SimNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  onTick: () => void;
  nodeSizeMetric: 'aiExposure' | 'wage';
  maxWage: number;
}

export function useForceSimulation({
  nodes,
  width,
  height,
  onTick,
}: UseForceSimulationProps) {
  const simulationRef = useRef<null>(null);

  useEffect(() => {
    if (!nodes.length || !width || !height) return;

    // Scale stored 0-1 positions to viewport
    for (const node of nodes) {
      node.x = node.x * width;
      node.y = node.y * height;
    }

    onTick();
  }, [nodes, width, height, onTick]);

  const reheat = useCallback(() => {
    onTick();
  }, [onTick]);

  return { simulationRef, reheat };
}
```

Key changes:
- Removed all d3 imports and force simulation
- Removed `forceBounds` custom force
- Removed `NODE_RADIUS_*` constant imports
- Scales stored 0-1 coordinates to actual viewport dimensions
- `simulationRef` is kept as `null` (drag handler in OccupationGraph checks `if (!sim)` — it will skip since sim is null, which is correct since we don't need simulation-driven drag anymore)
- `edges`, `nodeSizeMetric`, `maxWage` kept in the interface for API compatibility but unused

**Step 2: Check that drag still works**

The drag handler in `OccupationGraph.tsx` does `const sim = simulationRef.current; if (!sim) return;` — this means drag will be disabled. This is fine for now because with pre-computed positions, dragging doesn't make semantic sense (there's no simulation to settle back into). If we want drag later, we can add it back.

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: Clean output

**Step 4: Verify the app renders**

Run: `npm run dev`, open browser
Expected: Graph renders with nodes spread across viewport in a loose cloud pattern. No force simulation running.

**Step 5: Commit**

```bash
git add hooks/useForceSimulation.ts
git commit -m "feat: replace force simulation with pre-computed position scaling"
```

---

### Task 4: Clean up unused constants and re-run layout if needed

**Files:**
- Modify: `lib/constants.ts` (remove unused exports if any)
- Possibly re-run: `scripts/compute-layout.mjs` (tweak params if spread isn't right)

**Step 1: Check for unused imports**

Run: `npx tsc --noEmit`
Fix any unused import warnings.

Check if `NODE_RADIUS_BASE`, `NODE_RADIUS_SCALE`, `NODE_RADIUS_COLLIDE_PADDING` are still used (they should be — `OccupationGraph.tsx` uses them for rendering node circles). Only remove constants that have zero imports.

**Step 2: Visual verification**

Open the app and verify:
- Nodes fill the viewport horizontally
- Clusters are loosely visible but spread out
- No dense circular blob
- Edges render correctly between connected nodes
- Click/hover interactions work
- Zoom/pan works
- Node sizing by metric works

**Step 3: Tune if needed**

If the spread isn't right, adjust params in `scripts/compute-layout.mjs`:
- More spread: increase charge to -1200, decrease link strength to 0.03
- Less spread: decrease charge to -500, increase link strength to 0.08
- More horizontal: decrease forceY strength to 0.02
- Then re-run: `node scripts/compute-layout.mjs`

**Step 4: Add npm script**

In `package.json`, add to `"scripts"`:
```json
"compute-layout": "node scripts/compute-layout.mjs"
```

**Step 5: Commit**

```bash
git add lib/constants.ts package.json public/data/nodes.json
git commit -m "chore: clean up unused constants, add compute-layout script"
```
