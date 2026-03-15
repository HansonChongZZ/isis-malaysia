# Node Arrangement Demo Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the tutorial Step 2 demo to show real occupation names clustering by skill similarity across 3 groups.

**Architecture:** Single component rewrite. 14 hardcoded nodes across 3 clusters (Finance, Trades, Healthcare) with 16 edges. A live d3-force simulation animates nodes from scattered positions into visible clusters, with edges visible throughout. Cluster labels fade in after settling.

**Tech Stack:** React, d3-force, d3-selection, d3-transition. Imports sizing constants from `lib/constants.ts`.

**Spec:** `docs/superpowers/specs/2026-03-12-node-arrangement-demo-design.md`

---

### Task 1: Rewrite NodeArrangementDemo

**Files:**
- Rewrite: `components/tutorial/steps/NodeArrangementDemo.tsx`

- [ ] **Step 1: Replace node data with real occupations**

Replace the entire `DEMO_NODES` array and add cluster-aware typing. Replace `DEMO_EDGES` with the spec's edge list.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NODE_RADIUS_BASE, NODE_RADIUS_SCALE, NODE_RADIUS_EXPONENT } from '@/lib/constants';

const WIDTH = 340;
const HEIGHT = 220;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const PAD = 20;
const SCALE = 0.09;

function demoRadius(aiExposure: number) {
  return (NODE_RADIUS_BASE + Math.pow(aiExposure, NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE) * SCALE;
}

const CLUSTERS = ['finance', 'trades', 'healthcare'] as const;
type Cluster = (typeof CLUSTERS)[number];

const CLUSTER_LABELS: Record<Cluster, string> = {
  finance: 'Finance',
  trades: 'Trades',
  healthcare: 'Healthcare',
};

const DEMO_NODES = [
  { id: 'accountant', label: 'Accountant', aiExposure: 0.65, cluster: 'finance' as Cluster },
  { id: 'auditor', label: 'Auditor', aiExposure: 0.60, cluster: 'finance' as Cluster },
  { id: 'financial-analyst', label: 'Financial Analyst', aiExposure: 0.72, cluster: 'finance' as Cluster },
  { id: 'tax-consultant', label: 'Tax Consultant', aiExposure: 0.58, cluster: 'finance' as Cluster },
  { id: 'bookkeeper', label: 'Bookkeeper', aiExposure: 0.50, cluster: 'finance' as Cluster },
  { id: 'plumber', label: 'Plumber', aiExposure: 0.15, cluster: 'trades' as Cluster },
  { id: 'electrician', label: 'Electrician', aiExposure: 0.20, cluster: 'trades' as Cluster },
  { id: 'welder', label: 'Welder', aiExposure: 0.12, cluster: 'trades' as Cluster },
  { id: 'carpenter', label: 'Carpenter', aiExposure: 0.18, cluster: 'trades' as Cluster },
  { id: 'nurse', label: 'Nurse', aiExposure: 0.40, cluster: 'healthcare' as Cluster },
  { id: 'pharmacist', label: 'Pharmacist', aiExposure: 0.55, cluster: 'healthcare' as Cluster },
  { id: 'physiotherapist', label: 'Physiotherapist', aiExposure: 0.35, cluster: 'healthcare' as Cluster },
  { id: 'lab-technician', label: 'Lab Technician', aiExposure: 0.45, cluster: 'healthcare' as Cluster },
  { id: 'radiographer', label: 'Radiographer', aiExposure: 0.48, cluster: 'healthcare' as Cluster },
].map((n) => ({ ...n, r: demoRadius(n.aiExposure) }));

const clusterOf = new Map(DEMO_NODES.map((n) => [n.id, n.cluster]));

const DEMO_EDGES = [
  // Finance (chain + closing)
  { source: 'accountant', target: 'auditor' },
  { source: 'auditor', target: 'financial-analyst' },
  { source: 'financial-analyst', target: 'tax-consultant' },
  { source: 'tax-consultant', target: 'bookkeeper' },
  { source: 'bookkeeper', target: 'accountant' },
  // Trades (chain + closing)
  { source: 'plumber', target: 'electrician' },
  { source: 'electrician', target: 'welder' },
  { source: 'welder', target: 'carpenter' },
  { source: 'carpenter', target: 'plumber' },
  // Healthcare (chain + closing)
  { source: 'nurse', target: 'pharmacist' },
  { source: 'pharmacist', target: 'physiotherapist' },
  { source: 'physiotherapist', target: 'lab-technician' },
  { source: 'lab-technician', target: 'radiographer' },
  { source: 'radiographer', target: 'nurse' },
  // Cross-cluster
  { source: 'bookkeeper', target: 'lab-technician' },
  { source: 'electrician', target: 'nurse' },
];

function isCrossCluster(source: string, target: string) {
  return clusterOf.get(source) !== clusterOf.get(target);
}
```

- [ ] **Step 2: Write the component with force simulation, labels, and clamping**

```tsx
interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  r: number;
  cluster: Cluster;
}

export default function NodeArrangementDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    const nodes: SimNode[] = DEMO_NODES.map((n) => ({
      ...n,
      x: CX + (Math.random() - 0.5) * 200,
      y: CY + (Math.random() - 0.5) * 140,
    }));

    const edges = DEMO_EDGES.map((e) => ({ ...e }));

    // Edges drawn first (behind nodes), visible from start
    const edgeLines = g
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', 'var(--muted-foreground)')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.15);

    // Node circles
    const circles = g
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', 'var(--node-color)')
      .attr('cx', (d) => d.x!)
      .attr('cy', (d) => d.y!);

    // Node labels
    const labels = g
      .selectAll('text.node-label')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text((d) => d.label);

    // Fade node labels in after a short delay
    labels.transition().delay(600).duration(400).attr('opacity', 1);

    // Cluster labels (hidden initially)
    const clusterLabels = g
      .selectAll('text.cluster-label')
      .data(CLUSTERS)
      .enter()
      .append('text')
      .attr('class', 'cluster-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text((c) => CLUSTER_LABELS[c]);

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink(edges)
          .id((d: any) => d.id)
          .distance((d: any) =>
            isCrossCluster(d.source.id, d.target.id) ? 120 : 35
          )
          .strength((d: any) =>
            isCrossCluster(d.source.id, d.target.id) ? 0.05 : 0.3
          )
      )
      .force('charge', d3.forceManyBody().strength(-25))
      .force('center', d3.forceCenter(CX, CY).strength(0.15))
      .force(
        'collide',
        d3.forceCollide<SimNode>((d) => d.r + 2)
      )
      .alphaDecay(0.012)
      .on('tick', () => {
        // Clamp positions
        for (const d of nodes) {
          d.x = Math.max(PAD + d.r, Math.min(WIDTH - PAD - d.r, d.x!));
          d.y = Math.max(PAD + d.r, Math.min(HEIGHT - PAD - d.r, d.y!));
        }

        circles.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
        labels
          .attr('x', (d) => d.x!)
          .attr('y', (d) => d.y! + d.r + 10);

        edgeLines
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
      });

    // After settling: increase edge opacity and show cluster labels
    d3.timeout(() => {
      edgeLines.transition().duration(600).attr('opacity', 0.3);

      // Compute cluster centroids
      for (const c of CLUSTERS) {
        const members = nodes.filter((n) => n.cluster === c);
        const cx = members.reduce((s, n) => s + n.x!, 0) / members.length;
        const cy = members.reduce((s, n) => s + n.y!, 0) / members.length;
        clusterLabels
          .filter((d) => d === c)
          .attr('x', cx)
          .attr('y', cy - 20)
          .transition()
          .duration(400)
          .attr('opacity', 1);
      }
    }, 2500);

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
      aria-label="Animation showing occupations clustering by shared skills"
    />
  );
}
```

- [ ] **Step 3: Verify the component compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Visual verification**

Run: `npm run dev`
Open the tutorial modal, navigate to Step 2. Verify:
- All 14 nodes are visible with labels
- 3 distinct clusters form (Finance, Trades, Healthcare)
- Edges are visible throughout the animation
- Cluster labels fade in after settling
- No nodes escape the viewport

- [ ] **Step 5: Commit**

```bash
git add components/tutorial/steps/NodeArrangementDemo.tsx
git commit -m "feat: redesign tutorial Step 2 with real occupation clusters"
```
