'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SAMPLE_NODES, SAMPLE_EDGES } from '../tutorialSteps';

const WIDTH = 340;
const HEIGHT = 200;

// Cluster positions (shifted left to make room for panel)
const POSITIONS = [
  { x: 50, y: 60 },
  { x: 90, y: 45 },
  { x: 130, y: 55 },
  { x: 145, y: 100 },
  { x: 105, y: 120 },
  { x: 45, y: 125 },
  { x: 60, y: 95 },
];

const CLICK_TARGET = 1; // Engineer (index 1)
const PANEL_X = 185;
const PANEL_Y = 8;
const PANEL_W = 148;
const PANEL_H = 184;

export default function ClickBehaviourDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    const nodes = SAMPLE_NODES.map((n, i) => ({
      ...n,
      ...POSITIONS[i],
    }));

    const targetNode = nodes[CLICK_TARGET];
    const connectedIds = new Set<string>();
    SAMPLE_EDGES.forEach((e) => {
      if (e.source === targetNode.id) connectedIds.add(e.target);
      if (e.target === targetNode.id) connectedIds.add(e.source);
    });

    // Draw edges
    const edgeLines = g
      .selectAll('line.edge')
      .data(SAMPLE_EDGES)
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('x1', (d) => nodes.find((n) => n.id === d.source)!.x)
      .attr('y1', (d) => nodes.find((n) => n.id === d.source)!.y)
      .attr('x2', (d) => nodes.find((n) => n.id === d.target)!.x)
      .attr('y2', (d) => nodes.find((n) => n.id === d.target)!.y)
      .attr('stroke', 'var(--muted-foreground)')
      .attr('stroke-width', 1)
      .attr('opacity', 0.3);

    // Draw circles
    const circles = g
      .selectAll('circle.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', 10)
      .attr('fill', 'var(--node-color)');

    // Selection ring (hidden)
    const selRing = g
      .append('circle')
      .attr('cx', targetNode.x)
      .attr('cy', targetNode.y)
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', 'var(--foreground)')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    // Animated cursor
    const cursor = g.append('g').attr('opacity', 0.8);
    cursor.append('circle').attr('r', 4).attr('fill', 'var(--foreground)').attr('opacity', 0.7);
    cursor
      .append('line')
      .attr('x1', 0).attr('y1', -7).attr('x2', 0).attr('y2', 7)
      .attr('stroke', 'var(--foreground)').attr('stroke-width', 1).attr('opacity', 0.5);
    cursor
      .append('line')
      .attr('x1', -7).attr('y1', 0).attr('x2', 7).attr('y2', 0)
      .attr('stroke', 'var(--foreground)').attr('stroke-width', 1).attr('opacity', 0.5);

    // --- Panel: simplified version of the real occupation detail panel ---
    const panel = g
      .append('g')
      .attr('transform', `translate(${WIDTH + 10}, ${PANEL_Y})`)
      .attr('opacity', 0);

    // Panel background
    panel.append('rect')
      .attr('rx', 4).attr('width', PANEL_W).attr('height', PANEL_H)
      .attr('fill', 'var(--card)').attr('stroke', 'var(--border)').attr('stroke-width', 1);

    // Header: colour dot + code + group
    const headerY = 14;
    panel.append('circle')
      .attr('cx', 10).attr('cy', headerY - 3).attr('r', 3)
      .attr('fill', 'var(--node-color)');
    panel.append('text')
      .attr('x', 16).attr('y', headerY).attr('font-size', 5).attr('fill', 'var(--muted-foreground)')
      .text('2421');

    // Occupation title
    panel.append('text')
      .attr('x', 8).attr('y', 26).attr('font-size', 7).attr('font-weight', 700)
      .attr('fill', 'var(--foreground)').text('Data Analyst');

    panel.append('line')
      .attr('x1', 0).attr('y1', 33).attr('x2', PANEL_W).attr('y2', 33)
      .attr('stroke', 'var(--border)').attr('stroke-width', 0.5);

    // AI Exposure section
    panel.append('text')
      .attr('x', 8).attr('y', 44).attr('font-size', 5).attr('fill', 'var(--muted-foreground)')
      .text('AI EXPOSURE INDEX');

    panel.append('text')
      .attr('x', 8).attr('y', 56).attr('font-size', 10).attr('font-weight', 700)
      .attr('fill', 'var(--node-color)').text('72.0%');

    // Exposure badge
    panel.append('rect')
      .attr('x', 52).attr('y', 47).attr('width', 22).attr('height', 10).attr('rx', 3)
      .attr('fill', 'var(--quartile-medium-high)').attr('opacity', 0.15);
    panel.append('text')
      .attr('x', 63).attr('y', 54.5).attr('text-anchor', 'middle')
      .attr('font-size', 5).attr('font-weight', 600).attr('fill', 'var(--quartile-medium-high)')
      .text('High');

    // Exposure bar
    panel.append('rect')
      .attr('x', 8).attr('y', 61).attr('width', PANEL_W - 16).attr('height', 4).attr('rx', 2)
      .attr('fill', 'var(--muted)');
    panel.append('rect')
      .attr('x', 8).attr('y', 61).attr('width', (PANEL_W - 16) * 0.72).attr('height', 4).attr('rx', 2)
      .attr('fill', 'var(--node-color)');

    // Monthly wage
    panel.append('text')
      .attr('x', 8).attr('y', 78).attr('font-size', 5).attr('fill', 'var(--muted-foreground)')
      .text('MONTHLY WAGE');
    panel.append('text')
      .attr('x', 8).attr('y', 88).attr('font-size', 7).attr('font-weight', 700)
      .attr('fill', 'var(--foreground)').text('MYR 5,234');

    // Skills section
    panel.append('text')
      .attr('x', 8).attr('y', 102).attr('font-size', 5).attr('fill', 'var(--muted-foreground)')
      .text('BASIC SKILLS');

    const basicSkills = ['Math', 'Problem Solving', 'Analysis'];
    let tagX = 8;
    basicSkills.forEach((skill) => {
      const bw = skill.length * 3 + 8;
      panel.append('rect')
        .attr('x', tagX).attr('y', 106).attr('width', bw).attr('height', 10).attr('rx', 3)
        .attr('fill', 'var(--accent)');
      panel.append('text')
        .attr('x', tagX + bw / 2).attr('y', 113).attr('text-anchor', 'middle')
        .attr('font-size', 4.5).attr('fill', 'var(--accent-foreground)').text(skill);
      tagX += bw + 3;
    });

    // Transition pathways section
    panel.append('line')
      .attr('x1', 0).attr('y1', 124).attr('x2', PANEL_W).attr('y2', 124)
      .attr('stroke', 'var(--border)').attr('stroke-width', 0.5);

    panel.append('text')
      .attr('x', 8).attr('y', 135).attr('font-size', 5.5).attr('font-weight', 600)
      .attr('fill', 'var(--foreground)').text('Transition Pathways');

    // Mini table rows
    const transitions = [
      { name: 'IT Manager', match: '5/7', ai: '45%' },
      { name: 'Statistician', match: '4/7', ai: '68%' },
      { name: 'Accountant', match: '3/7', ai: '92%' },
    ];
    transitions.forEach((row, i) => {
      const ry = 143 + i * 13;
      panel.append('text')
        .attr('x', 8).attr('y', ry)
        .attr('font-size', 5).attr('fill', 'var(--foreground)').text(row.name);
      panel.append('text')
        .attr('x', 72).attr('y', ry)
        .attr('font-size', 4.5).attr('fill', 'var(--muted-foreground)').text(row.match);
      panel.append('text')
        .attr('x', PANEL_W - 8).attr('y', ry).attr('text-anchor', 'end')
        .attr('font-size', 4.5).attr('fill', 'var(--muted-foreground)').text(row.ai);
    });

    let cancelled = false;

    function resetState() {
      cursor.attr('transform', 'translate(25, 175)').attr('opacity', 0.8);
      circles.attr('opacity', 1);
      edgeLines.attr('opacity', 0.3);
      selRing.attr('opacity', 0).attr('r', 10);
      panel.attr('transform', `translate(${WIDTH + 10}, ${PANEL_Y})`).attr('opacity', 0);
    }

    function runCycle() {
      if (cancelled) return;
      resetState();

      // Phase 1: Cursor moves to node
      d3.timeout(() => {
        if (cancelled) return;
        cursor
          .transition().duration(1000).ease(d3.easeCubicInOut)
          .attr('transform', `translate(${targetNode.x}, ${targetNode.y})`)
          .on('end', () => {
            if (cancelled) return;
            // Click pulse
            cursor.select('circle')
              .transition().duration(100).attr('r', 6)
              .transition().duration(100).attr('r', 4);

            // Dim non-connected
            circles.transition().delay(200).duration(300)
              .attr('opacity', (d) =>
                d.id === targetNode.id || connectedIds.has(d.id) ? 1 : 0.15
              );

            // Selection ring
            selRing.transition().delay(200).duration(300)
              .attr('opacity', 1).attr('r', 14);
          });
      }, 400);

      // Phase 2: Panel slides in
      d3.timeout(() => {
        if (cancelled) return;
        panel.transition().duration(500).ease(d3.easeCubicOut)
          .attr('transform', `translate(${PANEL_X}, ${PANEL_Y})`).attr('opacity', 1);
      }, 1800);

      // Phase 3: Cursor clicks outside to close
      d3.timeout(() => {
        if (cancelled) return;
        // Move cursor to empty area
        cursor.transition().duration(800).ease(d3.easeCubicInOut)
          .attr('transform', 'translate(30, 165)');
      }, 3800);

      d3.timeout(() => {
        if (cancelled) return;
        // Click pulse outside
        cursor.select('circle')
          .transition().duration(100).attr('r', 6)
          .transition().duration(100).attr('r', 4);

        // Panel slides out
        panel.transition().delay(200).duration(400).ease(d3.easeCubicIn)
          .attr('transform', `translate(${WIDTH + 10}, ${PANEL_Y})`).attr('opacity', 0);

        // Restore all nodes
        circles.transition().delay(200).duration(300).attr('opacity', 1);
        selRing.transition().delay(200).duration(300).attr('opacity', 0);
      }, 4800);

      // Restart cycle
      d3.timeout(() => {
        if (!cancelled) runCycle();
      }, 6200);
    }

    runCycle();

    return () => {
      cancelled = true;
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
      aria-label="Animation showing click interaction opening a detail panel"
    />
  );
}
