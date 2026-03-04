/**
 * Offline layout computation for occupation graph.
 * Runs D3 force simulation with 5,000 iterations on a large virtual canvas,
 * then normalizes positions to 0-1 range and writes back to nodes.json.
 *
 * Usage: node scripts/compute-layout.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// D3 force modules (ESM)
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

// Layout parameters (tune via LayoutTuner sliders, then update here)
const INTRA_STRENGTH = 0.08;  // link strength for same-group edges
const INTER_STRENGTH = 0.01;  // link strength for cross-group edges
const CHARGE = -1000;

// Virtual canvas
const CANVAS_W = 4000;
const CANVAS_H = 2400;
const ITERATIONS = 5000;
const PADDING = 0.05; // 5% padding on each side for normalization

// Load data
const nodes = JSON.parse(readFileSync(nodesPath, 'utf-8'));
const edges = JSON.parse(readFileSync(edgesPath, 'utf-8'));

console.log(`Loaded ${nodes.length} nodes, ${edges.length} edges`);

// Prepare simulation nodes (strip any existing x/y to start fresh)
const simNodes = nodes.map((n) => ({
  id: n.id,
  aiExposure: n.aiExposure,
  group: n.group,
}));

// Prepare simulation edges
const simEdges = edges.map((e) => ({
  source: e.source,
  target: e.target,
  weight: e.weight,
}));

// Build group lookup for differentiated link strength
const groupOf = new Map(simNodes.map((n) => [n.id, n.group]));

// Build simulation
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
  .force('center', forceCenter(CANVAS_W / 2, CANVAS_H / 2))
  .force(
    'collide',
    forceCollide((d) => {
      const r = NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE;
      return r + NODE_RADIUS_COLLIDE_PADDING;
    }),
  );

// Run simulation
sim.stop();
console.log(`Running ${ITERATIONS} iterations...`);
const startTime = Date.now();
for (let i = 0; i < ITERATIONS; i++) {
  sim.tick();
  if (i % 1000 === 0) {
    console.log(`  iteration ${i}...`);
  }
}
const elapsed = Date.now() - startTime;
console.log(`Simulation complete in ${elapsed}ms`);

// Compute bounds
const xs = simNodes.map((n) => n.x);
const ys = simNodes.map((n) => n.y);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);
const rangeX = maxX - minX || 1;
const rangeY = maxY - minY || 1;

console.log(`Bounds: x=[${minX.toFixed(1)}, ${maxX.toFixed(1)}], y=[${minY.toFixed(1)}, ${maxY.toFixed(1)}]`);

// Normalize to 0-1 with padding
const posMap = new Map();
for (const n of simNodes) {
  const nx = PADDING + ((n.x - minX) / rangeX) * (1 - 2 * PADDING);
  const ny = PADDING + ((n.y - minY) / rangeY) * (1 - 2 * PADDING);
  posMap.set(n.id, { x: parseFloat(nx.toFixed(6)), y: parseFloat(ny.toFixed(6)) });
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
console.log(`Sample: ${sample.label} → x=${sample.x}, y=${sample.y}`);
