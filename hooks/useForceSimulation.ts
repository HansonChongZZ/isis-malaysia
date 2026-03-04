'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { SimNode, SimEdge, GraphEdge } from '@/lib/types';

interface UseForceSimulationProps {
  nodes: SimNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  onTick: () => void;
  nodeSizeMetric: 'aiExposure' | 'wage';
  maxWage: number;
}

export function useForceSimulation({
  nodes,
  width,
  height,
  onTick,
}: UseForceSimulationProps) {
  const simulationRef = useRef<null>(null);

  useEffect(() => {
    if (!nodes.length || !width || !height) return;

    // Scale stored 0-1 positions to viewport
    for (const node of nodes) {
      node.x = node.x * width;
      node.y = node.y * height;
    }

    onTick();
  }, [nodes, width, height, onTick]);

  const reheat = useCallback(() => {
    onTick();
  }, [onTick]);

  return { simulationRef, reheat };
}
