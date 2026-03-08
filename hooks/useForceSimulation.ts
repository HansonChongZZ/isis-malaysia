'use client';

import { useEffect } from 'react';
import * as d3 from 'd3';
import type { SimNode, SimEdge, GraphEdge, NodeSizeMetric } from '@/lib/types';
import { NODE_RADIUS_BASE, NODE_RADIUS_SCALE, NODE_RADIUS_COLLIDE_PADDING } from '@/lib/constants';

// Force layout parameters
const INTRA_STRENGTH = 0.8;
const INTER_STRENGTH = 0.001;
const CHARGE = -50;
const ITERATIONS = 300;

interface UseForceSimulationProps {
  nodes: SimNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  onTick: () => void;
  nodeSizeMetric: NodeSizeMetric;
  maxWage: number;
  maxWorkers: number;
}

// Store original normalized positions so we can re-scale on resize
const normalizedPositions = new WeakMap<SimNode, { nx: number; ny: number }>();

function ensureNormalized(node: SimNode) {
  if (!normalizedPositions.has(node)) {
    normalizedPositions.set(node, {
      nx: node.x ?? 0.5,
      ny: node.y ?? 0.5,
    });
  }
  return normalizedPositions.get(node)!;
}

export function useForceSimulation({
  nodes,
  edges,
  width,
  height,
  onTick,
  nodeSizeMetric,
  maxWage,
  maxWorkers,
}: UseForceSimulationProps) {
  useEffect(() => {
    if (!nodes.length || !width || !height) return;

    const getCollideRadius = (d: SimNode) => {
      let r: number;
      if (nodeSizeMetric === 'wage' && d.wage !== null && maxWage > 0) {
        r = NODE_RADIUS_BASE + (d.wage / maxWage) * NODE_RADIUS_SCALE;
      } else if (nodeSizeMetric === 'workers' && d.workers !== null && maxWorkers > 0) {
        const maxLog = Math.log(maxWorkers);
        r = NODE_RADIUS_BASE + (Math.log(d.workers) / maxLog) * NODE_RADIUS_SCALE;
      } else {
        r = NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE;
      }
      return r + NODE_RADIUS_COLLIDE_PADDING;
    };

    // Reset positions from normalized values
    for (const node of nodes) {
      const { nx, ny } = ensureNormalized(node);
      node.x = nx * width;
      node.y = ny * height;
      node.vx = 0;
      node.vy = 0;
    }

    const groupOf = new Map(nodes.map((n) => [n.id, n.group]));
    const simEdges: SimEdge[] = edges.map((e) => ({ ...e }));

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((d) => 50 + (7 - (d as SimEdge).weight) * 15)
          .strength((d) => {
            const srcId = typeof d.source === 'string' ? d.source : (d.source as SimNode).id;
            const tgtId = typeof d.target === 'string' ? d.target : (d.target as SimNode).id;
            const sameGroup = groupOf.get(srcId) === groupOf.get(tgtId);
            return sameGroup ? INTRA_STRENGTH : INTER_STRENGTH;
          }),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(CHARGE))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3.forceCollide<SimNode>(getCollideRadius),
      );

    sim.stop();
    for (let i = 0; i < ITERATIONS; i++) sim.tick();
    onTick();

    return () => {
      sim.stop();
    };
  }, [nodes, edges, width, height, onTick, nodeSizeMetric, maxWage, maxWorkers]);
}
