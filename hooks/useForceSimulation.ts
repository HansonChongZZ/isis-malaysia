'use client';

import { useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import type { SimNode, SimEdge, GraphEdge, NodeSizeMetric } from '@/lib/types';
import { NODE_RADIUS_BASE, NODE_RADIUS_SCALE, NODE_RADIUS_COLLIDE_PADDING } from '@/lib/constants';

export interface LayoutTuning {
  intraStrength: number;
  interStrength: number;
  charge: number;
}

interface UseForceSimulationProps {
  nodes: SimNode[];
  edges?: GraphEdge[];
  width: number;
  height: number;
  onTick: () => void;
  nodeSizeMetric: NodeSizeMetric;
  maxWage: number;
  maxWorkers: number;
  tuning?: LayoutTuning | null;
}

// Store original normalized positions so we can re-scale on resize
const normalizedPositions = new WeakMap<SimNode, { nx: number; ny: number }>();

function ensureNormalized(node: SimNode) {
  if (!normalizedPositions.has(node)) {
    // First time: x/y are the 0-1 values from nodes.json
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
  tuning,
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

    // --- Tuning mode: run full force simulation in browser ---
    if (tuning && edges) {
      // Reset positions from normalized values before each tuning run
      for (const node of nodes) {
        const { nx, ny } = ensureNormalized(node);
        node.x = nx * width;
        node.y = ny * height;
        node.vx = 0;
        node.vy = 0;
      }

      // Build a group lookup
      const groupOf = new Map(nodes.map((n) => [n.id, n.group]));

      const simEdges: SimEdge[] = edges.map((e) => ({ ...e }));

      const cx = width / 2;
      const cy = height / 2;

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
              return sameGroup ? tuning.intraStrength : tuning.interStrength;
            }),
        )
        .force('charge', d3.forceManyBody<SimNode>().strength(tuning.charge))
        .force('center', d3.forceCenter(cx, cy))
        .force(
          'collide',
          d3.forceCollide<SimNode>(getCollideRadius),
        );

      sim.stop();
      for (let i = 0; i < 300; i++) sim.tick();
      onTick();

      return () => {
        sim.stop();
      };
    }

    // --- Normal mode: scale pre-computed positions ---
    for (const node of nodes) {
      const { nx, ny } = ensureNormalized(node);
      node.x = nx * width;
      node.y = ny * height;
    }

    // Lightweight collide-only simulation to prevent overlap at this viewport size
    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'collide',
        d3.forceCollide<SimNode>(getCollideRadius),
      )
      .velocityDecay(0.6);

    sim.stop();
    for (let i = 0; i < 50; i++) sim.tick();
    onTick();

    return () => {
      sim.stop();
    };
  }, [nodes, edges, width, height, onTick, nodeSizeMetric, maxWage, maxWorkers, tuning]);

  const reheat = useCallback(() => {
    // No-op: layout is pre-computed
  }, []);

  return { reheat };
}
