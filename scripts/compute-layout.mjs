/**
 * Offline layout computation for occupation graph.
 *
 * Two-stage process:
 *   Stage 1: Compute a spread-out base layout (strong charge, moderate link strengths)
 *            on a 4000x2400 virtual canvas.
 *   Stage 2: Apply tuning forces (tight intra-cluster, weak inter/charge) for 300 ticks.
 *
 * Writes raw pixel positions to nodes.json (no 0-1 normalization).
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

// Virtual canvas (landscape)
const CANVAS_W = 4000;
const CANVAS_H = 2400;

// Edge weight max (from EdgeSchema)
const EDGE_WEIGHT_MAX = 7;

// --- Stage 1 params: spread-out base layout ---
const BASE_INTRA_STRENGTH = 0.08;
const BASE_INTER_STRENGTH = 0.01;
const BASE_CHARGE = -1000;
const BASE_ITERATIONS = 5000;

// --- Stage 2 params: tuning pass (matches runtime defaults in app/page.tsx) ---
const TUNING_INTRA_STRENGTH = 0.8;
const TUNING_INTER_STRENGTH = 0.001;
const TUNING_CHARGE = -50;
const TUNING_ITERATIONS = 300;

// Load data
const nodes = JSON.parse(readFileSync(nodesPath, 'utf-8'));
const edges = JSON.parse(readFileSync(edgesPath, 'utf-8'));

console.log(`Loaded ${nodes.length} nodes, ${edges.length} edges`);

// Build group lookup
const groupOf = new Map(nodes.map((n) => [n.id, n.group]));

const cx = CANVAS_W / 2;
const cy = CANVAS_H / 2;

// ─── Stage 1: Base layout (spread-out) ──────────────────────────────────────

const simNodes = nodes.map((n) => ({
  id: n.id,
  aiExposure: n.aiExposure,
  group: n.group,
}));

const simEdges1 = edges.map((e) => ({
  source: e.source,
  target: e.target,
  weight: e.weight,
}));

const sim1 = forceSimulation(simNodes)
  .force(
    'link',
    forceLink(simEdges1)
      .id((d) => d.id)
      .distance((d) => 50 + (EDGE_WEIGHT_MAX - d.weight) * 15)
      .strength((d) => {
        const srcId = typeof d.source === 'string' ? d.source : d.source.id;
        const tgtId = typeof d.target === 'string' ? d.target : d.target.id;
        return groupOf.get(srcId) === groupOf.get(tgtId) ? BASE_INTRA_STRENGTH : BASE_INTER_STRENGTH;
      }),
  )
  .force('charge', forceManyBody().strength(BASE_CHARGE))
  .force('center', forceCenter(cx, cy))
  .force(
    'collide',
    forceCollide((d) => {
      const r = NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE;
      return r + NODE_RADIUS_COLLIDE_PADDING;
    }),
  );

sim1.stop();
console.log(`Stage 1: Running ${BASE_ITERATIONS} iterations (base layout)...`);
const t1 = Date.now();
for (let i = 0; i < BASE_ITERATIONS; i++) {
  sim1.tick();
  if (i % 1000 === 0) console.log(`  iteration ${i}...`);
}
console.log(`Stage 1 complete in ${Date.now() - t1}ms`);

// ─── Stage 2: Tuning pass (tight clusters) ─────────────────────────────────

// Reset velocities before tuning
for (const n of simNodes) {
  n.vx = 0;
  n.vy = 0;
}

// Need fresh edge objects for the new forceLink
const simEdges2 = edges.map((e) => ({
  source: e.source,
  target: e.target,
  weight: e.weight,
}));

const sim2 = forceSimulation(simNodes)
  .force(
    'link',
    forceLink(simEdges2)
      .id((d) => d.id)
      .distance((d) => 50 + (EDGE_WEIGHT_MAX - d.weight) * 15)
      .strength((d) => {
        const srcId = typeof d.source === 'string' ? d.source : d.source.id;
        const tgtId = typeof d.target === 'string' ? d.target : d.target.id;
        return groupOf.get(srcId) === groupOf.get(tgtId) ? TUNING_INTRA_STRENGTH : TUNING_INTER_STRENGTH;
      }),
  )
  .force('charge', forceManyBody().strength(TUNING_CHARGE))
  .force('center', forceCenter(cx, cy))
  .force(
    'collide',
    forceCollide((d) => {
      const r = NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE;
      return r + NODE_RADIUS_COLLIDE_PADDING;
    }),
  );

sim2.stop();
console.log(`Stage 2: Running ${TUNING_ITERATIONS} iterations (tuning pass)...`);
const t2 = Date.now();
for (let i = 0; i < TUNING_ITERATIONS; i++) {
  sim2.tick();
}
console.log(`Stage 2 complete in ${Date.now() - t2}ms`);

// ─── Write raw pixel positions ──────────────────────────────────────────────

const xs = simNodes.map((n) => n.x);
const ys = simNodes.map((n) => n.y);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);

console.log(`Bounds: x=[${minX.toFixed(1)}, ${maxX.toFixed(1)}], y=[${minY.toFixed(1)}, ${maxY.toFixed(1)}]`);

const posMap = new Map();
for (const n of simNodes) {
  posMap.set(n.id, {
    x: parseFloat(n.x.toFixed(1)),
    y: parseFloat(n.y.toFixed(1)),
  });
}

// Write back to nodes.json
const output = nodes.map((n) => {
  const pos = posMap.get(n.id);
  return { ...n, x: pos.x, y: pos.y };
});

writeFileSync(nodesPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Written ${output.length} nodes with x,y to ${nodesPath}`);

// Verify
const sample = output[0];
console.log(`Sample: ${sample.label} (group ${sample.group}) → x=${sample.x}, y=${sample.y}`);

const invalid = output.filter((n) => isNaN(n.x) || isNaN(n.y));
if (invalid.length > 0) {
  console.error(`ERROR: ${invalid.length} nodes have invalid positions!`);
} else {
  console.log('All nodes have valid pixel positions.');
}

// Print group center summary
console.log('\nGroup centers (pixels):');
const groupIds = [...new Set(nodes.map((n) => n.group))].sort((a, b) => a - b);
for (const g of groupIds) {
  const gNodes = output.filter((n) => n.group === g);
  const avgX = gNodes.reduce((s, n) => s + n.x, 0) / gNodes.length;
  const avgY = gNodes.reduce((s, n) => s + n.y, 0) / gNodes.length;
  console.log(`  Group ${g} (n=${gNodes.length}): avg=(${avgX.toFixed(1)}, ${avgY.toFixed(1)})`);
}

// Restore original Math.random
Math.random = _origRandom;
