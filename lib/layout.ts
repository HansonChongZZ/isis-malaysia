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

  // Base radius from factor, plus additive spacing
  const baseRadius = Math.min(viewportWidth, viewportHeight) * ringRadiusFactor;
  const spacingRadius = total > 1 ? (total * nodeSpacing) / (2 * Math.PI) : 0;
  const radius = baseRadius + spacingRadius;

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
 * Compute radial positions for a selected node and its neighbours.
 * Centre node at (0, 0). Neighbours placed radially by skill distance.
 * Sorted by distance ascending (most similar = clockwise first from top).
 */
export function computeRadialPositions(
  centreNodeId: string,
  neighbours: GraphNode[],
  distances: Map<string, SkillComparison>,
  centreNodeRadius: number,
  maxNeighbourRadius: number,
  radialMinDistance: number,
  radialMaxDistance: number,
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();

  // Centre node at origin
  positions.set(centreNodeId, { x: 0, y: 0 });

  if (neighbours.length === 0) return positions;

  // Floor: prevent overlap regardless of slider value
  const minRadius = Math.max(radialMinDistance, centreNodeRadius + maxNeighbourRadius);
  // Guard: ensure maxRadius > minRadius even with low radialMaxDistance slider values
  const maxRadius = Math.max(radialMaxDistance, minRadius + 1);

  // Sort neighbours by distance ascending (closest first)
  const sorted = [...neighbours].sort((a, b) => {
    const da = distances.get(a.id)?.distance ?? 1;
    const db = distances.get(b.id)?.distance ?? 1;
    return da - db;
  });

  // Find min/max distances for normalisation
  const distValues = sorted.map((n) => distances.get(n.id)?.distance ?? 1);
  const minDist = Math.min(...distValues);
  const maxDist = Math.max(...distValues);
  const distRange = maxDist - minDist;

  for (let i = 0; i < sorted.length; i++) {
    const node = sorted[i];
    const dist = distances.get(node.id)?.distance ?? 1;

    // Normalise distance to [minRadius, maxRadius]
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

/** Estimated label dimensions for overlap detection */
export const LABEL_WIDTH = 220;
export const LABEL_HEIGHT = 70;
export const BADGE_WIDTH = 200;
export const BADGE_HEIGHT = 50;
export const GAP = 6;

export interface MirroredPosition {
  left: number;
  top: number;
}

/**
 * Compute label position on the outward side of a node, away from the other node.
 * Falls back to right-side placement if nodes overlap (distance < 1px).
 */
export function computeMirroredPosition(
  nodeAScreen: { x: number; y: number },
  nodeBScreen: { x: number; y: number },
  targetScreen: { x: number; y: number },
  radius: number,
): MirroredPosition {
  const mx = (nodeAScreen.x + nodeBScreen.x) / 2;
  const my = (nodeAScreen.y + nodeBScreen.y) / 2;
  const dx = targetScreen.x - mx;
  const dy = targetScreen.y - my;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Degenerate case: nodes at same position
  if (dist < 1) {
    return {
      left: targetScreen.x + radius + GAP,
      top: targetScreen.y - 10,
    };
  }

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (angleDeg >= -45 && angleDeg < 45) {
    // Right
    return { left: targetScreen.x + radius + GAP, top: targetScreen.y - 10 };
  } else if (angleDeg >= 45 && angleDeg < 135) {
    // Bottom
    return { left: targetScreen.x - LABEL_WIDTH / 2, top: targetScreen.y + radius + GAP };
  } else if (angleDeg >= -135 && angleDeg < -45) {
    // Top
    return { left: targetScreen.x - LABEL_WIDTH / 2, top: targetScreen.y - radius - LABEL_HEIGHT - GAP };
  } else {
    // Left
    return { left: targetScreen.x - radius - LABEL_WIDTH - GAP, top: targetScreen.y - 10 };
  }
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Check if any pair of bounding boxes in the array overlap.
 * Uses conservative estimated sizes (no DOM measurement).
 */
export function checkBoundingBoxOverlap(
  elements: BoundingBox[],
): boolean {
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      if (rectsIntersect(elements[i], elements[j])) return true;
    }
  }
  return false;
}

/** Build bounding box for a label at a mirrored position */
export function labelBounds(pos: MirroredPosition): BoundingBox {
  return { x: pos.left, y: pos.top, width: LABEL_WIDTH, height: LABEL_HEIGHT };
}

/** Build bounding box for the badge at its center position */
export function badgeBounds(centerX: number, centerY: number): BoundingBox {
  return {
    x: centerX - BADGE_WIDTH / 2,
    y: centerY - BADGE_HEIGHT / 2,
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
  };
}

/**
 * If the badge overlaps a label, shift it perpendicular to the edge line
 * toward the side that does not contain a label center.
 * Returns the adjusted badge center position.
 */
export function computeBadgeOffset(
  badgeCenter: { x: number; y: number },
  labelAPos: MirroredPosition,
  labelBPos: MirroredPosition,
  nodeAScreen: { x: number; y: number },
  nodeBScreen: { x: number; y: number },
): { x: number; y: number } {
  const badge = badgeBounds(badgeCenter.x, badgeCenter.y);
  const labelA = labelBounds(labelAPos);
  const labelB = labelBounds(labelBPos);

  const overlapsA = rectsIntersect(badge, labelA);
  const overlapsB = rectsIntersect(badge, labelB);

  if (!overlapsA && !overlapsB) return badgeCenter;

  // Perpendicular to the edge line
  const edgeDx = nodeBScreen.x - nodeAScreen.x;
  const edgeDy = nodeBScreen.y - nodeAScreen.y;
  const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

  if (edgeLen < 1) return badgeCenter;

  // Perpendicular unit vector (rotate edge 90 degrees)
  let perpX = -edgeDy / edgeLen;
  let perpY = edgeDx / edgeLen;

  // Determine which side of the edge line the label centers are on
  // using the cross product sign
  const labelCenterAx = labelAPos.left + LABEL_WIDTH / 2;
  const labelCenterAy = labelAPos.top + LABEL_HEIGHT / 2;
  const labelCenterBx = labelBPos.left + LABEL_WIDTH / 2;
  const labelCenterBy = labelBPos.top + LABEL_HEIGHT / 2;

  const crossA = (labelCenterAx - badgeCenter.x) * perpY - (labelCenterAy - badgeCenter.y) * perpX;
  const crossB = (labelCenterBx - badgeCenter.x) * perpY - (labelCenterBy - badgeCenter.y) * perpX;

  // Shift toward the side without labels (negative cross = flip direction)
  const avgCross = (crossA + crossB) / 2;
  if (avgCross > 0) {
    perpX = -perpX;
    perpY = -perpY;
  }

  const offset = BADGE_HEIGHT / 2 + LABEL_HEIGHT / 2 + 8;
  return {
    x: badgeCenter.x + perpX * offset,
    y: badgeCenter.y + perpY * offset,
  };
}
