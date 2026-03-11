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
const NODE_RADIUS_BASE = 46;
const NODE_RADIUS_SCALE = 30;
const NODE_RADIUS_EXPONENT = 1;
const NODE_RADIUS_COLLIDE_PADDING = 57;

// Reference viewport — scaled up to give larger nodes room to spread
const VIEWPORT_W = 5000;
const VIEWPORT_H = 3200;

// Tuning params (matches the runtime defaults)
const CHARGE = -800;
const ITERATIONS = 300;

// Load data
const nodes = JSON.parse(readFileSync(nodesPath, 'utf-8'));
const edges = JSON.parse(readFileSync(edgesPath, 'utf-8'));
console.log(`Loaded ${nodes.length} nodes, ${edges.length} edges`);

// Use existing pixel positions as starting points
const simNodes = nodes.map((n) => ({
  id: n.id,
  aiExposure: n.aiExposure,
  x: n.x,
  y: n.y,
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
  .alpha(0.3)
  .alphaDecay(0.01)
  .velocityDecay(0.6)
  .force(
    'link',
    forceLink(simEdges)
      .id((d) => d.id)
      .distance((d) => 600 + (7 - d.weight) * 20)
      .strength(0.3),
  )
  .force('charge', forceManyBody().strength(CHARGE))
  .force('center', forceCenter(
    simNodes.reduce((s, n) => s + n.x, 0) / simNodes.length,
    simNodes.reduce((s, n) => s + n.y, 0) / simNodes.length,
  ))
  .force(
    'collide',
    forceCollide((d) => {
      const r = NODE_RADIUS_BASE + Math.pow(d.aiExposure, NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE;
      return r + NODE_RADIUS_COLLIDE_PADDING;
    }).strength(0.7),
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

