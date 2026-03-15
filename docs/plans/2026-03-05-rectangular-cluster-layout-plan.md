# Rectangular Cluster Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-pass force layout with a two-phase approach that produces strongly separated MASCO group clusters spread across a rectangular canvas.

**Architecture:** Phase 1 positions 9 group "super-nodes" via force simulation with aggregated cross-group edges. Phase 2 packs each group's nodes around its super-node center with a bounding-box constraint. Only the offline script and data file change — no runtime modifications.

**Tech Stack:** d3-force (already installed), Node.js script

---

### Task 1: Rewrite compute-layout.mjs with two-phase approach

**Files:**
- Modify: `scripts/compute-layout.mjs` (full rewrite)

**Step 1: Replace the script contents**

```javascript
/**
 * Two-phase offline layout for occupation graph.
 *
 * Phase 1: Position 9 MASCO group "super-nodes" on a rectangular canvas
 *          using aggregated cross-group edges.
 * Phase 2: Pack each group's nodes around its super-node center with
 *          intra-group edges and a bounding-box force.
 *
 * Normalizes to 0-1 and writes back to nodes.json.
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
  forceX,
  forceY,
} from 'd3-force';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodesPath = resolve(__dirname, '../public/data/nodes.json');
const edgesPath = resolve(__dirname, '../public/data/edges.json');

// Constants matching lib/constants.ts
const NODE_RADIUS_BASE = 9;
const NODE_RADIUS_SCALE = 27;
const NODE_RADIUS_COLLIDE_PADDING = 4.5;

// Virtual canvas (landscape)
const CANVAS_W = 4000;
const CANVAS_H = 2400;
const PADDING = 0.05;

// --- Phase 1 params ---
const P1_CHARGE = -2000;
const P1_LINK_STRENGTH = 0.05;
const P1_LINK_DISTANCE = 300;
const P1_COLLIDE_SCALE = 35; // sqrt(memberCount) * this
const P1_X_STRENGTH = 0.3;
const P1_Y_STRENGTH = 0.5;
const P1_ITERATIONS = 1000;

// --- Phase 2 params ---
const P2_CHARGE = -200;
const P2_LINK_STRENGTH = 0.1;
const P2_LINK_DISTANCE_BASE = 30;
const P2_BOUNDING_STRENGTH = 0.15;
const P2_BOUNDING_SCALE = 30; // sqrt(memberCount) * this = max radius
const P2_ITERATIONS = 2000;

// ─── Load data ──────────────────────────────────────────────────
const nodes = JSON.parse(readFileSync(nodesPath, 'utf-8'));
const edges = JSON.parse(readFileSync(edgesPath, 'utf-8'));
console.log(`Loaded ${nodes.length} nodes, ${edges.length} edges`);

const groupOf = new Map(nodes.map((n) => [n.id, n.group]));

// ─── Phase 1: Group-level layout ───────────────────────────────
// Build super-nodes
const groupMembers = new Map(); // group -> [node, ...]
for (const n of nodes) {
  if (!groupMembers.has(n.group)) groupMembers.set(n.group, []);
  groupMembers.get(n.group).push(n);
}

const superNodes = [];
for (const [group, members] of groupMembers) {
  superNodes.push({
    id: `g${group}`,
    group,
    memberCount: members.length,
  });
}

// Aggregate cross-group edges
const interEdgeMap = new Map(); // "gA-gB" -> total weight
for (const e of edges) {
  const gSrc = groupOf.get(e.source);
  const gTgt = groupOf.get(e.target);
  if (gSrc === gTgt) continue;
  const key = gSrc < gTgt ? `g${gSrc}-g${gTgt}` : `g${gTgt}-g${gSrc}`;
  interEdgeMap.set(key, (interEdgeMap.get(key) || 0) + e.weight);
}

const superEdges = [];
for (const [key, totalWeight] of interEdgeMap) {
  const [src, tgt] = key.split('-');
  superEdges.push({ source: src, target: tgt, weight: totalWeight });
}

console.log(`Phase 1: ${superNodes.length} super-nodes, ${superEdges.length} super-edges`);

const cx = CANVAS_W / 2;
const cy = CANVAS_H / 2;

const sim1 = forceSimulation(superNodes)
  .force(
    'link',
    forceLink(superEdges)
      .id((d) => d.id)
      .distance(P1_LINK_DISTANCE)
      .strength(P1_LINK_STRENGTH),
  )
  .force('charge', forceManyBody().strength(P1_CHARGE))
  .force('center', forceCenter(cx, cy))
  .force(
    'collide',
    forceCollide((d) => Math.sqrt(d.memberCount) * P1_COLLIDE_SCALE),
  )
  .force('x', forceX(cx).strength(P1_X_STRENGTH))
  .force('y', forceY(cy).strength(P1_Y_STRENGTH));

sim1.stop();
console.log(`Phase 1: running ${P1_ITERATIONS} iterations...`);
for (let i = 0; i < P1_ITERATIONS; i++) sim1.tick();

const groupCenters = new Map();
for (const sn of superNodes) {
  groupCenters.set(sn.group, { x: sn.x, y: sn.y, memberCount: sn.memberCount });
  console.log(`  Group ${sn.group} (n=${sn.memberCount}): (${sn.x.toFixed(0)}, ${sn.y.toFixed(0)})`);
}

// ─── Phase 2: Intra-group packing ──────────────────────────────
const finalPositions = new Map(); // nodeId -> { x, y }

for (const [group, members] of groupMembers) {
  const center = groupCenters.get(group);
  const boundingRadius = Math.sqrt(center.memberCount) * P2_BOUNDING_SCALE;

  // Prepare group nodes — start near group center with jitter
  const groupNodes = members.map((n) => ({
    id: n.id,
    aiExposure: n.aiExposure,
    group: n.group,
    x: center.x + (Math.random() - 0.5) * boundingRadius * 0.5,
    y: center.y + (Math.random() - 0.5) * boundingRadius * 0.5,
  }));

  const groupNodeIds = new Set(groupNodes.map((n) => n.id));

  // Intra-group edges only
  const groupEdges = edges
    .filter((e) => groupNodeIds.has(e.source) && groupNodeIds.has(e.target))
    .map((e) => ({ source: e.source, target: e.target, weight: e.weight }));

  // Custom bounding-box force: nudge nodes back toward group center
  function boundingForce() {
    for (const node of groupNodes) {
      const dx = node.x - center.x;
      const dy = node.y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > boundingRadius) {
        const overshoot = dist - boundingRadius;
        const strength = P2_BOUNDING_STRENGTH * (overshoot / dist);
        node.vx -= dx * strength;
        node.vy -= dy * strength;
      }
    }
  }

  const sim2 = forceSimulation(groupNodes)
    .force(
      'link',
      forceLink(groupEdges)
        .id((d) => d.id)
        .distance((d) => P2_LINK_DISTANCE_BASE + (7 - d.weight) * 10)
        .strength(P2_LINK_STRENGTH),
    )
    .force('charge', forceManyBody().strength(P2_CHARGE))
    .force(
      'collide',
      forceCollide((d) => {
        const r = NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE;
        return r + NODE_RADIUS_COLLIDE_PADDING;
      }),
    )
    .force('bounding', boundingForce);

  sim2.stop();
  for (let i = 0; i < P2_ITERATIONS; i++) sim2.tick();

  for (const gn of groupNodes) {
    finalPositions.set(gn.id, { x: gn.x, y: gn.y });
  }

  console.log(`  Group ${group}: packed ${groupNodes.length} nodes (bounding r=${boundingRadius.toFixed(0)})`);
}

// ─── Normalize to 0-1 ──────────────────────────────────────────
const allX = [...finalPositions.values()].map((p) => p.x);
const allY = [...finalPositions.values()].map((p) => p.y);
const minX = Math.min(...allX);
const maxX = Math.max(...allX);
const minY = Math.min(...allY);
const maxY = Math.max(...allY);
const rangeX = maxX - minX || 1;
const rangeY = maxY - minY || 1;

console.log(`Bounds: x=[${minX.toFixed(1)}, ${maxX.toFixed(1)}], y=[${minY.toFixed(1)}, ${maxY.toFixed(1)}]`);

const posMap = new Map();
for (const [id, pos] of finalPositions) {
  const nx = PADDING + ((pos.x - minX) / rangeX) * (1 - 2 * PADDING);
  const ny = PADDING + ((pos.y - minY) / rangeY) * (1 - 2 * PADDING);
  posMap.set(id, { x: parseFloat(nx.toFixed(6)), y: parseFloat(ny.toFixed(6)) });
}

// Write back
const output = nodes.map((n) => {
  const pos = posMap.get(n.id);
  return { ...n, x: pos.x, y: pos.y };
});

writeFileSync(nodesPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Written ${output.length} nodes with x,y to ${nodesPath}`);

const sample = output[0];
console.log(`Sample: ${sample.label} → x=${sample.x}, y=${sample.y}`);
```

**Step 2: Run the script and verify output**

Run: `node scripts/compute-layout.mjs`

Expected:
- Phase 1 prints 9 group centers spread across the 4000×2400 canvas
- Phase 2 prints packing info for each group
- Final bounds should span a reasonable range
- All 456 nodes get new x/y values in 0-1 range

**Step 3: Visual verification**

Run: `npm run dev`

Open the app in browser. Verify:
- Groups are visibly separated into distinct clusters
- Layout fills the viewport rectangularly (landscape bias)
- Node sizing, colors, hover, selection, edges all still work
- Zoom/pan works correctly

**Step 4: Tune if needed**

If groups overlap too much: increase `P1_CHARGE` (more negative) or `P1_COLLIDE_SCALE`.
If groups are too far apart: decrease `P1_CHARGE` or increase `P1_X_STRENGTH`/`P1_Y_STRENGTH`.
If intra-group packing is too tight: increase `P2_CHARGE` (more negative).
If nodes escape their group bounds: increase `P2_BOUNDING_STRENGTH`.

Re-run `node scripts/compute-layout.mjs` and refresh browser after each tweak.

**Step 5: Commit**

```bash
git add scripts/compute-layout.mjs public/data/nodes.json
git commit -m "feat: two-phase rectangular cluster layout for occupation graph"
```
