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

// Strip existing positions so re-runs start from d3's default initialization
for (const n of nodes) {
  delete n.x;
  delete n.y;
}

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
