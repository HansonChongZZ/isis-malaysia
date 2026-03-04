'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MASCO_GROUPS } from '@/lib/constants';

const WIDTH = 340;
const HEIGHT = 220;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

// ~40 nodes across all 9 groups, varied sizes to mimic real graph density
// Distribution roughly matches real data: heavier on groups 2, 3, 8
const DEMO_NODES = [
  // Group 1 — Managers (blue)
  { id: '1a', group: 1, r: 10 },
  { id: '1b', group: 1, r: 7 },
  { id: '1c', group: 1, r: 13 },
  { id: '1d', group: 1, r: 5 },
  // Group 2 — Professionals (orange)
  { id: '2a', group: 2, r: 12 },
  { id: '2b', group: 2, r: 8 },
  { id: '2c', group: 2, r: 14 },
  { id: '2d', group: 2, r: 6 },
  { id: '2e', group: 2, r: 10 },
  { id: '2f', group: 2, r: 9 },
  // Group 3 — Technicians (crimson)
  { id: '3a', group: 3, r: 11 },
  { id: '3b', group: 3, r: 7 },
  { id: '3c', group: 3, r: 13 },
  { id: '3d', group: 3, r: 8 },
  { id: '3e', group: 3, r: 5 },
  // Group 4 — Clerical (teal)
  { id: '4a', group: 4, r: 9 },
  { id: '4b', group: 4, r: 12 },
  { id: '4c', group: 4, r: 6 },
  // Group 5 — Services & Sales (green)
  { id: '5a', group: 5, r: 8 },
  { id: '5b', group: 5, r: 11 },
  { id: '5c', group: 5, r: 6 },
  { id: '5d', group: 5, r: 10 },
  // Group 6 — Skilled Agricultural (gold)
  { id: '6a', group: 6, r: 7 },
  { id: '6b', group: 6, r: 5 },
  // Group 7 — Craft & Trades (purple)
  { id: '7a', group: 7, r: 9 },
  { id: '7b', group: 7, r: 6 },
  { id: '7c', group: 7, r: 11 },
  // Group 8 — Plant & Machine (mauve)
  { id: '8a', group: 8, r: 10 },
  { id: '8b', group: 8, r: 7 },
  { id: '8c', group: 8, r: 13 },
  { id: '8d', group: 8, r: 8 },
  { id: '8e', group: 8, r: 5 },
  // Group 9 — Elementary (brown)
  { id: '9a', group: 9, r: 7 },
  { id: '9b', group: 9, r: 10 },
  { id: '9c', group: 9, r: 5 },
];

// Sparse, long-range edges that cross the graph — like the real app
const DEMO_EDGES = [
  { source: '2c', target: '1c' },
  { source: '3a', target: '8c' },
  { source: '2a', target: '4b' },
  { source: '5b', target: '9b' },
  { source: '1a', target: '3c' },
  { source: '7c', target: '6a' },
  { source: '8a', target: '5d' },
];

// Cluster center targets — arranged like the real graph's CLUSTER_OFFSETS (scaled down)
const GROUP_TARGETS: Record<number, { x: number; y: number }> = {
  1: { x: CX - 45, y: CY - 40 },
  2: { x: CX + 5, y: CY - 50 },
  3: { x: CX + 50, y: CY - 35 },
  4: { x: CX + 58, y: CY + 8 },
  5: { x: CX + 35, y: CY + 48 },
  6: { x: CX - 5, y: CY + 55 },
  7: { x: CX - 35, y: CY + 48 },
  8: { x: CX - 58, y: CY + 8 },
  9: { x: CX - 20, y: CY - 5 },
};

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  r: number;
}

export default function NodeArrangementDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Start all nodes scattered randomly
    const nodes: SimNode[] = DEMO_NODES.map((n) => ({
      ...n,
      x: CX + (Math.random() - 0.5) * 300,
      y: CY + (Math.random() - 0.5) * 200,
    }));

    const edges = DEMO_EDGES.map((e) => ({ source: e.source, target: e.target }));

    // Draw edges first (behind nodes), hidden initially
    const edgeLines = g
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', 'var(--muted-foreground)')
      .attr('stroke-width', 0.8)
      .attr('opacity', 0);

    // Draw nodes
    const circles = g
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => `var(${MASCO_GROUPS[d.group].colorVar})`)
      .attr('cx', (d) => d.x!)
      .attr('cy', (d) => d.y!);

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink(edges)
          .id((d: any) => d.id)
          .distance(60)
          .strength(0.1)
      )
      .force('charge', d3.forceManyBody().strength(-18))
      .force(
        'collide',
        d3.forceCollide<SimNode>((d) => d.r + 2)
      )
      .force(
        'x',
        d3.forceX<SimNode>((d) => GROUP_TARGETS[d.group].x).strength(0.08)
      )
      .force(
        'y',
        d3.forceY<SimNode>((d) => GROUP_TARGETS[d.group].y).strength(0.08)
      )
      .alphaDecay(0.012)
      .on('tick', () => {
        circles.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);

        edgeLines
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
      });

    // Fade edges in after clusters have formed
    d3.timeout(() => {
      edgeLines.transition().duration(800).attr('opacity', 0.3);
    }, 2200);

    return () => {
      simulation.stop();
      svg.selectAll('*').interrupt();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: 320 }}
      role="img"
      aria-label="Animation showing nodes clustering together by occupation group"
    />
  );
}
