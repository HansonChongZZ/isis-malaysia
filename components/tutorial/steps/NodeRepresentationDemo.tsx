'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MASCO_GROUPS } from '@/lib/constants';

const WIDTH = 340;
const HEIGHT = 220;

// All 9 MASCO groups laid out in two rows
const ALL_GROUPS = Object.entries(MASCO_GROUPS).map(([key, val]) => ({
  group: Number(key),
  label: val.label,
  colorVar: val.colorVar,
}));

// Short labels that fit under small circles
const SHORT_LABELS: Record<number, string> = {
  1: 'Managers',
  2: 'Professionals',
  3: 'Technicians',
  4: 'Clerical',
  5: 'Services & Sales',
  6: 'Skilled Agricultural',
  7: 'Craft & Trades',
  8: 'Plant & Machine Operators',
  9: 'Elementary',
};

// 2 rows: 5 on top, 4 on bottom (centered)
function getPosition(index: number) {
  if (index < 5) {
    return { cx: 35 + index * 70, cy: 72 };
  }
  const bottomIdx = index - 5;
  return { cx: 70 + bottomIdx * 70, cy: 152 };
}

export default function NodeRepresentationDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    const nodes = ALL_GROUPS.map((n, i) => ({
      ...n,
      ...getPosition(i),
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
      .attr('fill', (d) => `var(${d.colorVar})`)
      .attr('opacity', 0);

    circles
      .transition()
      .delay((_, i) => i * 150)
      .duration(400)
      .attr('r', 11)
      .attr('opacity', 1);

    // Labels
    const labels = g
      .selectAll('text.label')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', (d) => d.cx)
      .attr('y', (d) => d.cy + 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('fill', (d) => `var(${d.colorVar})`)
      .attr('opacity', 0)
      .text((d) => SHORT_LABELS[d.group]);

    labels
      .transition()
      .delay((_, i) => i * 150 + 200)
      .duration(300)
      .attr('opacity', 1);

    // After all appear, pulse highlight on one node
    const totalDelay = ALL_GROUPS.length * 150 + 600;
    const pulseNode = nodes[1]; // Professionals

    const pulseRing = g
      .append('circle')
      .attr('cx', pulseNode.cx)
      .attr('cy', pulseNode.cy)
      .attr('r', 11)
      .attr('fill', 'none')
      .attr('stroke', `var(${pulseNode.colorVar})`)
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    function pulse() {
      pulseRing
        .attr('r', 11)
        .attr('opacity', 0.8)
        .attr('stroke-width', 2)
        .transition()
        .duration(1000)
        .attr('r', 21)
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
      aria-label="Animation showing all 9 MASCO classification groups as colored circles"
    />
  );
}
