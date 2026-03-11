'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const WIDTH = 340;
const HEIGHT = 220;

// Sample nodes with varied sizes to represent different occupations
const DEMO_NODES = [
  { label: 'Manager', r: 12 },
  { label: 'Engineer', r: 16 },
  { label: 'Technician', r: 10 },
  { label: 'Clerk', r: 18 },
  { label: 'Sales Worker', r: 8 },
  { label: 'Farmer', r: 6 },
  { label: 'Operator', r: 14 },
];

function getPosition(index: number, total: number) {
  const spacing = 44;
  const totalWidth = (total - 1) * spacing;
  const startX = WIDTH / 2 - totalWidth / 2;
  return { cx: startX + index * spacing, cy: HEIGHT / 2 };
}

export default function NodeRepresentationDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    const nodes = DEMO_NODES.map((n, i) => ({
      ...n,
      ...getPosition(i, DEMO_NODES.length),
    }));

    // Circles
    const circles = g
      .selectAll('circle.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('cx', (d) => d.cx)
      .attr('cy', (d) => d.cy)
      .attr('r', 0)
      .attr('fill', 'var(--node-color)')
      .attr('opacity', 0);

    circles
      .transition()
      .delay((_, i) => i * 150)
      .duration(400)
      .attr('r', (d) => d.r)
      .attr('opacity', 1);

    // Labels
    const labels = g
      .selectAll('text.label')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', (d) => d.cx)
      .attr('y', (d) => d.cy + d.r + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text((d) => d.label);

    labels
      .transition()
      .delay((_, i) => i * 150 + 200)
      .duration(300)
      .attr('opacity', 1);

    // Pulse on one node after all appear
    const totalDelay = DEMO_NODES.length * 150 + 600;
    const pulseNode = nodes[1]; // Engineer

    const pulseRing = g
      .append('circle')
      .attr('cx', pulseNode.cx)
      .attr('cy', pulseNode.cy)
      .attr('r', pulseNode.r)
      .attr('fill', 'none')
      .attr('stroke', 'var(--node-color)')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    function pulse() {
      pulseRing
        .attr('r', pulseNode.r)
        .attr('opacity', 0.8)
        .attr('stroke-width', 2)
        .transition()
        .duration(1000)
        .attr('r', pulseNode.r + 10)
        .attr('opacity', 0)
        .attr('stroke-width', 0.5)
        .on('end', pulse);
    }

    const pulseTimer = d3.timeout(pulse, totalDelay);

    return () => {
      pulseTimer.stop();
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
      aria-label="Animation showing occupations as circles of different sizes"
    />
  );
}
