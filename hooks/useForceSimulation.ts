'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { SimNode, SimEdge, GraphEdge } from '@/lib/types';
import { CLUSTER_OFFSETS, NODE_RADIUS_BASE, NODE_RADIUS_SCALE, NODE_RADIUS_COLLIDE_PADDING } from '@/lib/constants';

interface UseForceSimulationProps {
  nodes: SimNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  onTick: () => void;
}

export function useForceSimulation({
  nodes,
  edges,
  width,
  height,
  onTick,
}: UseForceSimulationProps) {
  const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);

  useEffect(() => {
    if (!nodes.length || !width || !height) return;

    const simEdges: SimEdge[] = edges.map((e) => ({ ...e }));

    const cx = width / 2;
    const cy = height / 2;

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((d) => 15 + (7 - (d as SimEdge).weight) * 5)
          .strength(0.3),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-80))
      .force('center', d3.forceCenter(cx, cy))
      .force(
        'collide',
        d3.forceCollide<SimNode>((d) => NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE + NODE_RADIUS_COLLIDE_PADDING),
      )
      .force(
        'x',
        d3
          .forceX<SimNode>((d) => {
            const offset = CLUSTER_OFFSETS[d.group];
            return cx + (offset?.x ?? 0);
          })
          .strength(0.05),
      )
      .force(
        'y',
        d3
          .forceY<SimNode>((d) => {
            const offset = CLUSTER_OFFSETS[d.group];
            return cy + (offset?.y ?? 0);
          })
          .strength(0.05),
      );

    simulation.stop();
    for (let i = 0; i < 300; i++) simulation.tick();
    onTick();

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height, onTick]);

  const reheat = useCallback(() => {
    const sim = simulationRef.current;
    if (sim) {
      for (let i = 0; i < 300; i++) sim.tick();
      onTick();
    }
  }, [onTick]);

  return { simulationRef, reheat };
}
