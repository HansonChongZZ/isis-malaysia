// lib/layout.ts

import type { GraphNode } from './types';
import type { SkillComparison } from './skills';

export interface LayoutPosition {
  x: number;
  y: number;
}

export const RING_RADIUS_FACTOR = 0.12;

/**
 * Compute ring positions for all nodes, sorted alphabetically by label.
 * Nodes are placed evenly on a circle centered at (0, 0).
 */
export function computeRingPositions(
  nodes: GraphNode[],
  viewportWidth: number,
  viewportHeight: number,
  ringRadiusFactor: number = RING_RADIUS_FACTOR,
  nodeSpacing: number = 0,
): Map<string, LayoutPosition> {
  const sorted = [...nodes].sort((a, b) => a.label.localeCompare(b.label));
  const total = sorted.length;
  const positions = new Map<string, LayoutPosition>();
  if (total === 0) return positions;

  // Base radius from factor
  let radius = Math.min(viewportWidth, viewportHeight) * ringRadiusFactor;

  // If nodeSpacing requires a larger ring, scale up
  if (nodeSpacing > 0 && total > 1) {
    const requiredCircumference = total * nodeSpacing;
    const minRadius = requiredCircumference / (2 * Math.PI);
    radius = Math.max(radius, minRadius);
  }

  for (let i = 0; i < total; i++) {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2; // start from top
    positions.set(sorted[i].id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return positions;
}

/**
 * Compute radial positions for a selected node and its neighbors.
 * Center node at (0, 0). Neighbors placed radially by skill distance.
 * Sorted by distance ascending (most similar = clockwise first from top).
 */
export function computeRadialPositions(
  centerNodeId: string,
  neighbors: GraphNode[],
  distances: Map<string, SkillComparison>,
  centerNodeRadius: number,
  maxNeighborRadius: number,
  radialMinDistance: number,
  radialMaxDistance: number,
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();

  // Center node at origin
  positions.set(centerNodeId, { x: 0, y: 0 });

  if (neighbors.length === 0) return positions;

  // Floor: prevent overlap regardless of slider value
  const minRadius = Math.max(radialMinDistance, centerNodeRadius + maxNeighborRadius);
  // Guard: ensure maxRadius > minRadius even with low radialMaxDistance slider values
  const maxRadius = Math.max(radialMaxDistance, minRadius + 1);

  // Sort neighbors by distance ascending (closest first)
  const sorted = [...neighbors].sort((a, b) => {
    const da = distances.get(a.id)?.distance ?? 1;
    const db = distances.get(b.id)?.distance ?? 1;
    return da - db;
  });

  // Find min/max distances for normalization
  const distValues = sorted.map((n) => distances.get(n.id)?.distance ?? 1);
  const minDist = Math.min(...distValues);
  const maxDist = Math.max(...distValues);
  const distRange = maxDist - minDist;

  for (let i = 0; i < sorted.length; i++) {
    const node = sorted[i];
    const dist = distances.get(node.id)?.distance ?? 1;

    // Normalize distance to [minRadius, maxRadius]
    const normalizedRadius =
      distRange === 0
        ? (minRadius + maxRadius) / 2
        : minRadius + ((dist - minDist) / distRange) * (maxRadius - minRadius);

    // Equal angular spacing, clockwise from top
    const angle = (i / sorted.length) * 2 * Math.PI - Math.PI / 2;

    positions.set(node.id, {
      x: Math.cos(angle) * normalizedRadius,
      y: Math.sin(angle) * normalizedRadius,
    });
  }

  return positions;
}
