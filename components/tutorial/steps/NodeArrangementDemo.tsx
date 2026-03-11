'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
const WIDTH = 340;
const HEIGHT = 220;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

// ~40 nodes with varied sizes to mimic real graph density
const DEMO_NODES = [
  { id: '1a', r: 10 },
  { id: '1b', r: 7 },
  { id: '1c', r: 13 },
  { id: '1d', r: 5 },
  { id: '2a', r: 12 },
  { id: '2b', r: 8 },
  { id: '2c', r: 14 },
  { id: '2d', r: 6 },
  { id: '2e', r: 10 },
  { id: '2f', r: 9 },
  { id: '3a', r: 11 },
  { id: '3b', r: 7 },
  { id: '3c', r: 13 },
  { id: '3d', r: 8 },
  { id: '3e', r: 5 },
  { id: '4a', r: 9 },
  { id: '4b', r: 12 },
  { id: '4c', r: 6 },
  { id: '5a', r: 8 },
  { id: '5b', r: 11 },
  { id: '5c', r: 6 },
  { id: '5d', r: 10 },
  { id: '6a', r: 7 },
  { id: '6b', r: 5 },
  { id: '7a', r: 9 },
  { id: '7b', r: 6 },
  { id: '7c', r: 11 },
  { id: '8a', r: 10 },
  { id: '8b', r: 7 },
  { id: '8c', r: 13 },
  { id: '8d', r: 8 },
  { id: '8e', r: 5 },
  { id: '9a', r: 7 },
  { id: '9b', r: 10 },
  { id: '9c', r: 5 },
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

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
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
      .attr('fill', 'var(--node-color)')
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
      aria-label="Animation showing nodes clustering by skill connections"
    />
  );
}
