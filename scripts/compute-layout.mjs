/**
 * Compute fixed layout positions for the occupation graph.
 *
 * Loads existing 0-1 positions from nodes.json, scales to a reference
 * viewport, runs the tuning force simulation (identical to the runtime),
 * and writes the resulting raw pixel positions back to nodes.json.
 *
 * These positions are used as-is at runtime — d3-zoom fits them
 * into whatever viewport the user has.
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

// Constants matching lib/constants.ts
const NODE_RADIUS_BASE = 9;
const NODE_RADIUS_SCALE = 27;
const NODE_RADIUS_COLLIDE_PADDING = 4.5;

// Reference viewport — matches typical browser dimensions
const VIEWPORT_W = 1400;
const VIEWPORT_H = 900;

// Tuning params (matches the runtime defaults)
const INTRA_STRENGTH = 0.8;
const INTER_STRENGTH = 0.001;
const CHARGE = -50;
const ITERATIONS = 300;

// Load data
const nodes = JSON.parse(readFileSync(nodesPath, 'utf-8'));
const edges = JSON.parse(readFileSync(edgesPath, 'utf-8'));
console.log(`Loaded ${nodes.length} nodes, ${edges.length} edges`);

const groupOf = new Map(nodes.map((n) => [n.id, n.group]));

// Scale existing 0-1 positions to viewport (identical to runtime behavior)
const simNodes = nodes.map((n) => ({
  id: n.id,
  aiExposure: n.aiExposure,
  group: n.group,
  x: n.x * VIEWPORT_W,
  y: n.y * VIEWPORT_H,
  vx: 0,
  vy: 0,
}));

// Run tuning simulation (identical to useForceSimulation runtime code)
const simEdges = edges.map((e) => ({
  source: e.source,
  target: e.target,
  weight: e.weight,
}));

const sim = forceSimulation(simNodes)
  .force(
    'link',
    forceLink(simEdges)
      .id((d) => d.id)
      .distance((d) => 50 + (7 - d.weight) * 15)
      .strength((d) => {
        const srcId = typeof d.source === 'string' ? d.source : d.source.id;
        const tgtId = typeof d.target === 'string' ? d.target : d.target.id;
        return groupOf.get(srcId) === groupOf.get(tgtId) ? INTRA_STRENGTH : INTER_STRENGTH;
      }),
  )
  .force('charge', forceManyBody().strength(CHARGE))
  .force('center', forceCenter(VIEWPORT_W / 2, VIEWPORT_H / 2))
  .force(
    'collide',
    forceCollide((d) => {
      const r = NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE;
      return r + NODE_RADIUS_COLLIDE_PADDING;
    }),
  );

sim.stop();
console.log(`Running ${ITERATIONS} tuning iterations...`);
const t0 = Date.now();
for (let i = 0; i < ITERATIONS; i++) sim.tick();
console.log(`Complete in ${Date.now() - t0}ms`);

// Write raw pixel positions
const posMap = new Map(
  simNodes.map((n) => [n.id, { x: parseFloat(n.x.toFixed(1)), y: parseFloat(n.y.toFixed(1)) }]),
);

const output = nodes.map((n) => {
  const pos = posMap.get(n.id);
  return { ...n, x: pos.x, y: pos.y };
});

writeFileSync(nodesPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Written ${output.length} nodes to ${nodesPath}`);

// Verify
const xs = output.map((n) => n.x);
const ys = output.map((n) => n.y);
console.log(`Bounds: x=[${Math.min(...xs).toFixed(0)}, ${Math.max(...xs).toFixed(0)}], y=[${Math.min(...ys).toFixed(0)}, ${Math.max(...ys).toFixed(0)}]`);

const invalid = output.filter((n) => isNaN(n.x) || isNaN(n.y));
if (invalid.length > 0) {
  console.error(`ERROR: ${invalid.length} nodes have invalid positions!`);
} else {
  console.log('All nodes have valid pixel positions.');
}

console.log('\nGroup centers:');
for (const g of [...new Set(nodes.map((n) => n.group))].sort((a, b) => a - b)) {
  const gn = output.filter((n) => n.group === g);
  const ax = gn.reduce((s, n) => s + n.x, 0) / gn.length;
  const ay = gn.reduce((s, n) => s + n.y, 0) / gn.length;
  const spread = Math.sqrt(gn.reduce((s, n) => s + (n.x - ax) ** 2 + (n.y - ay) ** 2, 0) / gn.length);
  console.log(`  Group ${g} (n=${gn.length}): center=(${ax.toFixed(0)}, ${ay.toFixed(0)}) spread=${spread.toFixed(0)}`);
}
