'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import type {
  GraphNode,
  GraphEdge,
  NodeSizeMetric,
  OccupationDetail,
  TunerSizingParams,
  LayoutMode,
} from '@/lib/types';
import { computeRingPositions, computeRadialPositions } from '@/lib/layout';
import type { LayoutPosition } from '@/lib/layout';
import { computeNeighborDistances } from '@/lib/skills';
import type { SkillComparison } from '@/lib/skills';
import {
  NODE_RADIUS_BASE,
  NODE_RADIUS_SCALE,
  NODE_RADIUS_EXPONENT,
} from '@/lib/constants';
import EdgeSkillsTooltip from './EdgeSkillsTooltip';
import TunerPanel from './TunerPanel';

// Categorical palette for MASCO groups 1-9 (debug coloring)
const GROUP_COLORS: Record<number, string> = {
  1: '#e6194b',
  2: '#3cb44b',
  3: '#4363d8',
  4: '#f58231',
  5: '#911eb4',
  6: '#42d4f4',
  7: '#f032e6',
  8: '#bfef45',
  9: '#fabed4',
};

interface TooltipState {
  x: number;
  y: number;
  node: GraphNode;
  skillComparison?: SkillComparison;
}

interface OccupationGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
  filterSkills: string[];
  allSkills: Map<string, Set<string>>; // nodeId -> skills set
  sizeMetric: 'aiExposure' | 'wage';
  sizeThreshold: number;
  nodeSizeMetric: NodeSizeMetric;
  maxWage: number;
  maxWorkers: number;
  secondSelectedNodeId: string | null;
  occupations: Record<string, OccupationDetail>;
  layoutMode: LayoutMode;
  specificSkillsMap: Map<string, Set<string>>;
}

export default function OccupationGraph({
  nodes,
  edges,
  onNodeSelect,
  selectedNodeId: selectedNodeIdProp,
  filterSkills,
  allSkills,
  sizeMetric,
  sizeThreshold,
  nodeSizeMetric,
  maxWage,
  maxWorkers,
  secondSelectedNodeId,
  occupations,
  layoutMode,
  specificSkillsMap,
}: OccupationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const preZoomTransformRef = useRef<d3.ZoomTransform | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [badgePos, setBadgePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [showEdgeTooltip, setShowEdgeTooltip] = useState(false);
  const [pairLabelPositions, setPairLabelPositions] = useState<{
    a: {
      x: number;
      y: number;
      label: string;
      aiExposure: number;
    };
    b: {
      x: number;
      y: number;
      label: string;
      aiExposure: number;
    };
  } | null>(null);
  const selectedNodeId = selectedNodeIdProp;
  const [tunerSizing, setTunerSizing] = useState<TunerSizingParams | null>(
    null,
  );
  const [colorByGroup, setColorByGroup] = useState(false);
  const selectionMode = !selectedNodeId
    ? 'none'
    : secondSelectedNodeId
      ? 'pair'
      : 'single';
  const nodeById = useRef<Map<string, GraphNode>>(new Map());
  const edgeColorRef = useRef('#888');
  const foregroundColorRef = useRef('#000');
  const nodeColorRef = useRef('#034e37');
  const isolateFillRef = useRef('#d1d5db');
  const isolateStrokeRef = useRef('#000000');
  const canvasGridRef = useRef('#C8E8D8');
  const graphCenterRef = useRef({ cx: 0, cy: 0, radius: 1 });

  const selectionModeRef = useRef(selectionMode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const secondSelectedNodeIdRef = useRef(secondSelectedNodeId);
  useEffect(() => {
    selectionModeRef.current = selectionMode;
    selectedNodeIdRef.current = selectedNodeId;
    secondSelectedNodeIdRef.current = secondSelectedNodeId;
  }, [selectionMode, selectedNodeId, secondSelectedNodeId]);

  const simNodes = useMemo<GraphNode[]>(
    () => nodes.map((n) => ({ ...n })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes.length],
  );

  const ringPositions = useMemo(
    () => computeRingPositions(simNodes, 20000, 20000),
    [simNodes],
  );

  useEffect(() => {
    nodeById.current = new Map(simNodes.map((n) => [n.id, n]));
  }, [simNodes]);

  // Compute isolate set (nodes with no edges)
  const isolateIds = useMemo<Set<string>>(() => {
    const connected = new Set<string>();
    for (const e of edges) {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      connected.add(src);
      connected.add(tgt);
    }
    const isolates = new Set<string>();
    for (const n of nodes) {
      if (!connected.has(n.id)) isolates.add(n.id);
    }
    return isolates;
  }, [nodes, edges]);

  // Read node + edge colors from CSS vars, re-read on theme change
  const readThemeColors = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    edgeColorRef.current =
      style.getPropertyValue('--muted-foreground').trim() || '#888';
    foregroundColorRef.current =
      style.getPropertyValue('--foreground').trim() || '#000';
    nodeColorRef.current =
      style.getPropertyValue('--node-color').trim() || '#034e37';
    isolateFillRef.current =
      style.getPropertyValue('--node-isolate-fill').trim() || '#d1d5db';
    isolateStrokeRef.current =
      style.getPropertyValue('--node-isolate-stroke').trim() || '#000';
    canvasGridRef.current =
      style.getPropertyValue('--canvas-grid').trim() || '#C8E8D8';
    drawEdgesRef.current();
  }, []);

  useEffect(() => {
    readThemeColors();
    const observer = new MutationObserver(readThemeColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [readThemeColors]);

  // Compute visible IDs based on filters
  const visibleIds = useMemo<Set<string> | null>(() => {
    const hasSkillFilter = filterSkills.length > 0;
    const hasThreshold = sizeThreshold > 0;

    if (!hasSkillFilter && !hasThreshold) return null;

    const result = new Set<string>();
    const skillQueries = filterSkills.map((s) => s.toLowerCase());

    for (const node of simNodes) {
      if (hasSkillFilter) {
        const nodeSkills = allSkills.get(node.id);
        if (!nodeSkills) continue;
        const match = skillQueries.some((fq) =>
          [...nodeSkills].some((s) => s.toLowerCase().includes(fq)),
        );
        if (!match) continue;
      }
      if (hasThreshold) {
        if (sizeMetric === 'aiExposure') {
          if (node.aiExposure * 100 < sizeThreshold) continue;
        } else {
          if (node.wage === null || node.wage < sizeThreshold) continue;
        }
      }
      result.add(node.id);
    }
    return result;
  }, [simNodes, filterSkills, allSkills, sizeMetric, sizeThreshold]);

  // Build adjacency set for selected node
  const connectedIds = useMemo<Set<string> | null>(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>([selectedNodeId]);
    for (const e of edges) {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      if (src === selectedNodeId) set.add(tgt);
      if (tgt === selectedNodeId) set.add(src);
    }
    return set;
  }, [selectedNodeId, edges]);

  const pairEdge = useMemo(() => {
    if (selectionMode !== 'pair' || !selectedNodeId || !secondSelectedNodeId)
      return null;
    return (
      edges.find((e) => {
        const src =
          typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
        const tgt =
          typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
        return (
          (src === selectedNodeId && tgt === secondSelectedNodeId) ||
          (src === secondSelectedNodeId && tgt === selectedNodeId)
        );
      }) ?? null
    );
  }, [selectionMode, selectedNodeId, secondSelectedNodeId, edges]);

  const pairSkillsComparison = useMemo(() => {
    if (selectionMode !== 'pair' || !selectedNodeId || !secondSelectedNodeId)
      return null;
    const detailA = occupations[selectedNodeId];
    const detailB = occupations[secondSelectedNodeId];
    if (!detailA || !detailB) return null;

    const skillsA = new Set(
      [...detailA.basicSkills, ...detailA.specificSkills].map((s) =>
        s.toLowerCase(),
      ),
    );
    const skillsB = new Set(
      [...detailB.basicSkills, ...detailB.specificSkills].map((s) =>
        s.toLowerCase(),
      ),
    );

    const shared: string[] = [];
    const onlyA: string[] = [];
    const onlyB: string[] = [];

    const seenShared = new Set<string>();
    const seenA = new Set<string>();
    const seenB = new Set<string>();

    for (const skill of [...detailA.basicSkills, ...detailA.specificSkills]) {
      const lower = skill.toLowerCase();
      if (skillsB.has(lower)) {
        if (!seenShared.has(lower)) {
          shared.push(skill);
          seenShared.add(lower);
        }
      } else {
        if (!seenA.has(lower)) {
          onlyA.push(skill);
          seenA.add(lower);
        }
      }
    }
    for (const skill of [...detailB.basicSkills, ...detailB.specificSkills]) {
      const lower = skill.toLowerCase();
      if (!skillsA.has(lower) && !seenB.has(lower)) {
        onlyB.push(skill);
        seenB.add(lower);
      }
    }

    return {
      shared,
      onlyA,
      onlyB,
      labelA: detailA.occupation,
      labelB: detailB.occupation,
      colorA: nodeColorRef.current,
      colorB: nodeColorRef.current,
      totalUnique: shared.length + onlyA.length + onlyB.length,
    };
  }, [selectionMode, selectedNodeId, secondSelectedNodeId, occupations]);

  // Build adjacency set for hovered node (suppressed when a node is selected)
  const hoveredNeighborIds = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId || selectedNodeId) return null;
    const set = new Set<string>();
    for (const e of edges) {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      if (src === hoveredNodeId) set.add(tgt);
      if (tgt === hoveredNodeId) set.add(src);
    }
    return set;
  }, [hoveredNodeId, selectedNodeId, edges]);

  const hoveredEdges = useMemo(() => {
    if (!hoveredNodeId || selectedNodeId || !hoveredNeighborIds) return [];
    return edges.filter((e) => {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      if (src !== hoveredNodeId && tgt !== hoveredNodeId) return false;
      if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt)))
        return false;
      return true;
    });
  }, [hoveredNodeId, selectedNodeId, hoveredNeighborIds, edges, visibleIds]);

  const getNodeRadius = useCallback(
    (node: GraphNode) => {
      const base = tunerSizing?.base ?? NODE_RADIUS_BASE;
      const scale = tunerSizing?.scale ?? NODE_RADIUS_SCALE;
      const exp = tunerSizing?.exponent ?? NODE_RADIUS_EXPONENT;

      if (nodeSizeMetric === 'wage') {
        if (node.wage === null || maxWage === 0) return base;
        return base + Math.pow(node.wage / maxWage, exp) * scale;
      }
      if (nodeSizeMetric === 'workers') {
        if (node.workers === null || maxWorkers === 0) return base;
        const maxLog = Math.log(maxWorkers);
        return base + Math.pow(Math.log(node.workers) / maxLog, exp) * scale;
      }
      return base + Math.pow(node.aiExposure, exp) * scale;
    },
    [nodeSizeMetric, maxWage, maxWorkers, tunerSizing],
  );

  const getNodeOpacity = useCallback(
    (node: GraphNode) => {
      if (nodeSizeMetric === 'wage' && node.wage === null) return 0.06;
      if (nodeSizeMetric === 'workers' && node.workers === null) return 0.06;
      if (visibleIds && !visibleIds.has(node.id)) return 0.06;
      // Pair mode: only show the two selected nodes
      if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
        if (node.id !== selectedNodeId && node.id !== secondSelectedNodeId)
          return 0.05;
        return 1;
      }
      if (selectedNodeId && connectedIds && !connectedIds.has(node.id))
        return 0.06;
      if (
        hoveredNodeId &&
        !selectedNodeId &&
        node.id !== hoveredNodeId &&
        hoveredNeighborIds &&
        !hoveredNeighborIds.has(node.id)
      )
        return 0.6;
      return 1;
    },
    [
      nodeSizeMetric,
      visibleIds,
      selectionMode,
      selectedNodeId,
      secondSelectedNodeId,
      connectedIds,
      hoveredNodeId,
      hoveredNeighborIds,
    ],
  );

  // --- Radial layout computation (Task 7) ---
  const radialPositions = useMemo(() => {
    if (layoutMode !== 'radial' || !selectedNodeId || !connectedIds) return null;
    const neighborNodes = simNodes.filter(
      (n) => n.id !== selectedNodeId && connectedIds.has(n.id),
    );
    const neighborIds = neighborNodes.map((n) => n.id);
    const distances = computeNeighborDistances(selectedNodeId, neighborIds, specificSkillsMap);
    const centerNode = simNodes.find((n) => n.id === selectedNodeId);
    const centerRadius = centerNode ? getNodeRadius(centerNode) : NODE_RADIUS_BASE;
    return computeRadialPositions(selectedNodeId, neighborNodes, distances, centerRadius, 20000, 20000);
  }, [layoutMode, selectedNodeId, connectedIds, simNodes, specificSkillsMap, getNodeRadius]);

  const neighborDistancesRef = useRef<Map<string, SkillComparison> | null>(null);

  const neighborDistances = useMemo(() => {
    if (layoutMode !== 'radial' || !selectedNodeId || !connectedIds) return null;
    const neighborIds = simNodes
      .filter((n) => n.id !== selectedNodeId && connectedIds.has(n.id))
      .map((n) => n.id);
    return computeNeighborDistances(selectedNodeId, neighborIds, specificSkillsMap);
  }, [layoutMode, selectedNodeId, connectedIds, simNodes, specificSkillsMap]);

  // Keep ref in sync for canvas drawEdges callback
  useEffect(() => { neighborDistancesRef.current = neighborDistances; }, [neighborDistances]);

  // --- Animation refs (Task 8) ---
  const animatingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const prevLayoutModeRef = useRef<LayoutMode>(layoutMode);

  const animateToPositions = useCallback(
    (
      targets: Map<string, LayoutPosition>,
      duration: number,
      onComplete?: () => void,
    ) => {
      // Capture start positions
      const startPositions = new Map<string, LayoutPosition>();
      for (const node of simNodes) {
        startPositions.set(node.id, { x: node.x, y: node.y });
      }

      animatingRef.current = true;
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const rawT = Math.min(elapsed / duration, 1);
        // Cubic ease-in-out
        const t =
          rawT < 0.5
            ? 4 * rawT * rawT * rawT
            : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        for (const node of simNodes) {
          const start = startPositions.get(node.id);
          const target = targets.get(node.id);
          if (start && target) {
            node.x = start.x + (target.x - start.x) * t;
            node.y = start.y + (target.y - start.y) * t;
          }
        }

        // Update SVG node positions
        if (gRef.current) {
          d3.select(gRef.current)
            .selectAll<SVGCircleElement, unknown>('.node')
            .each(function () {
              const el = d3.select(this);
              const id = el.attr('data-id');
              const n = nodeById.current.get(id);
              if (n) {
                el.attr('cx', n.x).attr('cy', n.y);
              }
            });
        }

        drawEdgesRef.current();

        if (rawT < 1) {
          animationFrameRef.current = requestAnimationFrame(tick);
        } else {
          animatingRef.current = false;
          animationFrameRef.current = null;
          onComplete?.();
        }
      };

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [simNodes],
  );

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // --- Position effect with animation (replaces static position assignment) ---
  useEffect(() => {
    const prevMode = prevLayoutModeRef.current;
    prevLayoutModeRef.current = layoutMode;

    const updateGraphCenter = () => {
      if (simNodes.length) {
        const xs = simNodes.map((n) => n.x);
        const ys = simNodes.map((n) => n.y);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        let maxDist = 0;
        for (const n of simNodes) {
          const d = Math.hypot(n.x - cx, n.y - cy);
          if (d > maxDist) maxDist = d;
        }
        graphCenterRef.current = { cx, cy, radius: maxDist + 80 };
      }
    };

    if (layoutMode === 'ring') {
      if (prevMode === 'radial') {
        // Animate radial → ring
        const targets = new Map<string, LayoutPosition>();
        for (const node of simNodes) {
          const pos = ringPositions.get(node.id);
          if (pos) targets.set(node.id, pos);
        }
        animateToPositions(targets, 600, () => {
          updateGraphCenter();
          drawEdgesRef.current();
        });
      } else {
        // Initial render or ring → ring: set directly
        for (const node of simNodes) {
          const pos = ringPositions.get(node.id);
          if (pos) {
            node.x = pos.x;
            node.y = pos.y;
          }
        }
        updateGraphCenter();
        drawEdgesRef.current();
      }
    } else if (layoutMode === 'radial' && radialPositions) {
      // Build combined target: radial positions for center+neighbors, ring for rest
      const targets = new Map<string, LayoutPosition>();
      for (const node of simNodes) {
        const radialPos = radialPositions.get(node.id);
        if (radialPos) {
          targets.set(node.id, radialPos);
        } else {
          const ringPos = ringPositions.get(node.id);
          if (ringPos) targets.set(node.id, ringPos);
        }
      }
      animateToPositions(targets, 800, () => {
        updateGraphCenter();
        drawEdgesRef.current();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode, simNodes, ringPositions, radialPositions]);

  const visibleEdges = useMemo(() => {
    if (selectionMode === 'pair') {
      // Only show the edge between the two selected nodes
      return pairEdge ? [pairEdge] : [];
    }
    if (!selectedNodeId || !connectedIds) return [];
    return edges.filter((e) => {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      if (src !== selectedNodeId && tgt !== selectedNodeId) return false;
      if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt)))
        return false;
      return true;
    });
  }, [
    selectionMode,
    pairEdge,
    selectedNodeId,
    connectedIds,
    edges,
    visibleIds,
  ]);

  const drawEdges = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const { k, x, y } = transformRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.setTransform(k * dpr, 0, 0, k * dpr, x * dpr, y * dpr);

    // Draw background grid — each square is ~50% of the largest node's diameter
    const base = tunerSizing?.base ?? NODE_RADIUS_BASE;
    const scale = tunerSizing?.scale ?? NODE_RADIUS_SCALE;
    const gridSize = base + scale;
    const vl = -x / k;
    const vt = -y / k;
    const vr = vl + canvas.width / (k * dpr);
    const vb = vt + canvas.height / (k * dpr);
    const startX = Math.floor(vl / gridSize) * gridSize;
    const startY = Math.floor(vt / gridSize) * gridSize;

    ctx.strokeStyle = canvasGridRef.current;
    ctx.lineWidth = 1 / k;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (let gx = startX; gx <= vr; gx += gridSize) {
      ctx.moveTo(gx, vt);
      ctx.lineTo(gx, vb);
    }
    for (let gy = startY; gy <= vb; gy += gridSize) {
      ctx.moveTo(vl, gy);
      ctx.lineTo(vr, gy);
    }
    ctx.stroke();

    // Apply circular radial fade to the grid
    const { cx: gcx, cy: gcy, radius: gRadius } = graphCenterRef.current;
    const fadeRadius = gRadius * 1.2;
    const grad = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, fadeRadius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.5, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = grad;
    ctx.fillRect(vl, vt, vr - vl, vb - vt);
    ctx.globalCompositeOperation = 'source-over';

    // No edges in ring mode — clean overview
    if (selectionModeRef.current === 'none') {
      ctx.restore();
      return;
    }

    // Draw selection edges
    if (visibleEdges.length > 0) {
      ctx.strokeStyle = edgeColorRef.current;

      if (selectionModeRef.current === 'pair') {
        // Pair mode: straight lines grouped by weight
        ctx.lineWidth = 2 / k;
        const byWeight = new Map<number, typeof visibleEdges>();
        for (const edge of visibleEdges) {
          const w = edge.weight;
          if (!byWeight.has(w)) byWeight.set(w, []);
          byWeight.get(w)!.push(edge);
        }
        for (const [weight, group] of byWeight) {
          ctx.globalAlpha = Math.min(0.05 + (weight / 7) * 0.3 + 0.25, 0.8);
          ctx.beginPath();
          for (const edge of group) {
            const src = nodeById.current.get(
              typeof edge.source === 'string'
                ? edge.source
                : (edge.source as GraphNode).id,
            );
            const tgt = nodeById.current.get(
              typeof edge.target === 'string'
                ? edge.target
                : (edge.target as GraphNode).id,
            );
            if (!src || !tgt) continue;
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(tgt.x, tgt.y);
          }
          ctx.stroke();
        }
      } else {
        // Single selection: curved arcs with opacity based on skill distance
        ctx.lineWidth = 0.5 / k;
        for (const edge of visibleEdges) {
          const src = nodeById.current.get(
            typeof edge.source === 'string'
              ? edge.source
              : (edge.source as GraphNode).id,
          );
          const tgt = nodeById.current.get(
            typeof edge.target === 'string'
              ? edge.target
              : (edge.target as GraphNode).id,
          );
          if (!src || !tgt) continue;

          // Look up skill distance from neighborDistancesRef
          const neighborId = src.id === selectedNodeIdRef.current ? tgt.id : src.id;
          const comparison = neighborDistancesRef.current?.get(neighborId);
          const skillDist = comparison?.distance ?? 1;
          // Invert: distance 0 → opacity 0.6, distance 1 → opacity 0.15
          ctx.globalAlpha = 0.6 - skillDist * 0.45;

          // Quadratic bezier with 20% perpendicular offset (clockwise direction)
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const lineLength = Math.hypot(dx, dy);
          const offset = lineLength * 0.2;
          const px = -dy / lineLength * offset;
          const py = dx / lineLength * offset;
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.quadraticCurveTo(mx + px, my + py, tgt.x, tgt.y);
          ctx.stroke();
        }
      }
    }

    // Draw hover edges
    if (hoveredEdges.length > 0) {
      ctx.strokeStyle = foregroundColorRef.current;
      ctx.lineWidth = 1.5 / k;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (const edge of hoveredEdges) {
        const src = nodeById.current.get(
          typeof edge.source === 'string'
            ? edge.source
            : (edge.source as GraphNode).id,
        );
        const tgt = nodeById.current.get(
          typeof edge.target === 'string'
            ? edge.target
            : (edge.target as GraphNode).id,
        );
        if (!src || !tgt) continue;
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }, [selectionMode, visibleEdges, hoveredEdges, tunerSizing]);

  // Stable ref so zoom/drag handlers always call the latest drawEdges
  const drawEdgesRef = useRef(drawEdges);
  useEffect(() => {
    drawEdgesRef.current = drawEdges;
  }, [drawEdges]);

  // Resize canvas to match container with HiDPI support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions.width || !dimensions.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    drawEdgesRef.current();
  }, [dimensions]);

  // Redraw edges whenever selection changes
  useEffect(() => {
    drawEdges();
  }, [drawEdges]);

  // Update badge + label positions when entering/leaving pair mode
  useEffect(() => {
    if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
      const nodeA = nodeById.current.get(selectedNodeId);
      const nodeB = nodeById.current.get(secondSelectedNodeId);
      if (nodeA && nodeB) {
        const mx = (nodeA.x + nodeB.x) / 2;
        const my = (nodeA.y + nodeB.y) / 2;
        const t = transformRef.current;
        setBadgePos({ x: t.applyX(mx), y: t.applyY(my) });
        setPairLabelPositions({
          a: {
            x: t.applyX(nodeA.x),
            y: t.applyY(nodeA.y),
            label: nodeA.label,
            aiExposure: nodeA.aiExposure,
          },
          b: {
            x: t.applyX(nodeB.x),
            y: t.applyY(nodeB.y),
            label: nodeB.label,
            aiExposure: nodeB.aiExposure,
          },
        });
      }
    } else {
      setBadgePos(null);
      setPairLabelPositions(null);
    }
  }, [selectionMode, selectedNodeId, secondSelectedNodeId]);

  // Reset edge tooltip on selection change
  useEffect(() => {
    setShowEdgeTooltip(false);
  }, [selectedNodeId, secondSelectedNodeId]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  // Zoom + pan with auto-fit
  useEffect(() => {
    if (
      !svgRef.current ||
      !gRef.current ||
      !dimensions.width ||
      !dimensions.height
    )
      return;
    if (!simNodes.length) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const padding = 120;
    const xs = simNodes.map((n) => n.x);
    const ys = simNodes.map((n) => n.y);
    const boundsMinX = Math.min(...xs) - padding;
    const boundsMinY = Math.min(...ys) - padding;
    const boundsMaxX = Math.max(...xs) + padding;
    const boundsMaxY = Math.max(...ys) + padding;
    const boundsW = boundsMaxX - boundsMinX;
    const boundsH = boundsMaxY - boundsMinY;

    // Fit all nodes into viewport
    const scale = Math.min(
      dimensions.width / boundsW,
      dimensions.height / boundsH,
      2,
    );
    const tx = (dimensions.width - boundsW * scale) / 2 - boundsMinX * scale;
    const ty = (dimensions.height - boundsH * scale) / 2 - boundsMinY * scale;
    const fitTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);

    const minScale = 0.01;
    const maxScale = 0.1;

    // Expand translate extent for panning
    let extMinX = boundsMinX;
    let extMaxX = boundsMaxX;
    let extMinY = boundsMinY;
    let extMaxY = boundsMaxY;
    const minExtentW = dimensions.width / minScale;
    const minExtentH = dimensions.height / minScale;
    if (boundsW < minExtentW) {
      const pad = (minExtentW - boundsW) / 2;
      extMinX -= pad;
      extMaxX += pad;
    }
    if (boundsH < minExtentH) {
      const pad = (minExtentH - boundsH) / 2;
      extMinY -= pad;
      extMaxY += pad;
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([minScale, maxScale])
      .translateExtent([
        [extMinX, extMinY],
        [extMaxX, extMaxY],
      ])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        g.attr('transform', event.transform.toString());
        setTooltip((prev) => (prev === null ? prev : null));
        drawEdgesRef.current();

        if (
          selectionModeRef.current === 'pair' &&
          selectedNodeIdRef.current &&
          secondSelectedNodeIdRef.current
        ) {
          const nodeA = nodeById.current.get(selectedNodeIdRef.current);
          const nodeB = nodeById.current.get(secondSelectedNodeIdRef.current);
          if (nodeA && nodeB) {
            const mx = (nodeA.x + nodeB.x) / 2;
            const my = (nodeA.y + nodeB.y) / 2;
            setBadgePos({
              x: event.transform.applyX(mx),
              y: event.transform.applyY(my),
            });
            setPairLabelPositions({
              a: {
                x: event.transform.applyX(nodeA.x),
                y: event.transform.applyY(nodeA.y),
                label: nodeA.label,
                aiExposure: nodeA.aiExposure,
              },
              b: {
                x: event.transform.applyX(nodeB.x),
                y: event.transform.applyY(nodeB.y),
                label: nodeB.label,
                aiExposure: nodeB.aiExposure,
              },
            });
          }
        }
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Apply fit transform immediately (no animation on mount/resize)
    svg.call(zoom.transform, fitTransform);

    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions.width, dimensions.height, simNodes]);

  // Auto-zoom to frame selection (single or pair mode)
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;

    if (selectionMode === 'single' && selectedNodeId && connectedIds) {
      // Save current transform for restoring later
      if (!preZoomTransformRef.current) {
        preZoomTransformRef.current = transformRef.current;
      }

      const neighbourNodes = simNodes.filter((n) => connectedIds.has(n.id));

      if (neighbourNodes.length <= 1) {
        // Isolated node (only itself in connectedIds) — zoom to scale 2 centered on node
        const node = nodeById.current.get(selectedNodeId);
        if (!node) return;
        const scale = 2;
        const tx = dimensions.width / 2 - node.x * scale;
        const ty = dimensions.height / 2 - node.y * scale;
        const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

        svg
          .transition()
          .duration(1000)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, target);
      } else if (radialPositions) {
        // Radial mode: zoom to fit all radial positions with 250px padding
        const padding = 250;
        const positions = Array.from(radialPositions.values());
        const xs = positions.map((p) => p.x);
        const ys = positions.map((p) => p.y);
        const minX = Math.min(...xs) - padding;
        const minY = Math.min(...ys) - padding;
        const maxX = Math.max(...xs) + padding;
        const maxY = Math.max(...ys) + padding;
        const dx = maxX - minX;
        const dy = maxY - minY;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const scale = Math.min(
          dimensions.width / dx,
          dimensions.height / dy,
          3,
        );
        const tx = dimensions.width / 2 - cx * scale;
        const ty = dimensions.height / 2 - cy * scale;
        const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

        svg
          .transition()
          .duration(800)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, target);
      } else {
        // Ring mode: zoom to fit selected node + neighbours with 250px padding
        const padding = 250;
        const xs = neighbourNodes.map((n) => n.x);
        const ys = neighbourNodes.map((n) => n.y);
        const minX = Math.min(...xs) - padding;
        const minY = Math.min(...ys) - padding;
        const maxX = Math.max(...xs) + padding;
        const maxY = Math.max(...ys) + padding;
        const dx = maxX - minX;
        const dy = maxY - minY;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const scale = Math.min(
          dimensions.width / dx,
          dimensions.height / dy,
          3,
        );
        const tx = dimensions.width / 2 - cx * scale;
        const ty = dimensions.height / 2 - cy * scale;
        const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

        svg
          .transition()
          .duration(500)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, target);
      }
    } else if (selectionMode === 'none' && preZoomTransformRef.current) {
      // Deselect — zoom back to fit entire graph
      preZoomTransformRef.current = null;

      const padding = 120;
      const xs = simNodes.map((n) => n.x);
      const ys = simNodes.map((n) => n.y);
      const boundsMinX = Math.min(...xs) - padding;
      const boundsMinY = Math.min(...ys) - padding;
      const boundsMaxX = Math.max(...xs) + padding;
      const boundsMaxY = Math.max(...ys) + padding;
      const boundsW = boundsMaxX - boundsMinX;
      const boundsH = boundsMaxY - boundsMinY;
      const scale = Math.min(
        dimensions.width / boundsW,
        dimensions.height / boundsH,
        2,
      );
      const tx = (dimensions.width - boundsW * scale) / 2 - boundsMinX * scale;
      const ty = (dimensions.height - boundsH * scale) / 2 - boundsMinY * scale;
      const fitTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);

      svg
        .transition()
        .duration(500)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, fitTransform);
    }
  }, [
    selectionMode,
    selectedNodeId,
    secondSelectedNodeId,
    connectedIds,
    simNodes,
    radialPositions,
    dimensions.width,
    dimensions.height,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ backgroundColor: 'var(--canvas-background)' }}
    >
      {/* Canvas renders edges — behind SVG, no pointer events */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
      {dimensions.width > 0 && (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{ position: 'absolute', top: 0, left: 0, cursor: 'grab' }}
          onClick={() => {
            onNodeSelect(null);
          }}
        >
          <defs>
            <filter
              id="selected-glow"
              x="-300%"
              y="-300%"
              width="700%"
              height="700%"
            >
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="5"
                result="blur1"
              />
              <feColorMatrix
                in="blur1"
                type="matrix"
                values="0 0 0 0 0.3  0 0 0 0 1  0 0 0 0 0.5  0 0 0 1 0"
                result="glow1"
              />
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="18"
                result="blur2"
              />
              <feColorMatrix
                in="blur2"
                type="matrix"
                values="0 0 0 0 0.3  0 0 0 0 1  0 0 0 0 0.5  0 0 0 1 0"
                result="glow2"
              />
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="40"
                result="blur3"
              />
              <feColorMatrix
                in="blur3"
                type="matrix"
                values="0 0 0 0 0.3  0 0 0 0 1  0 0 0 0 0.5  0 0 0 0.8 0"
                result="glow3"
              />
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="80"
                result="blur4"
              />
              <feColorMatrix
                in="blur4"
                type="matrix"
                values="0 0 0 0 0.3  0 0 0 0 1  0 0 0 0 0.5  0 0 0 0.5 0"
                result="glow4"
              />
              <feMerge>
                <feMergeNode in="glow4" />
                <feMergeNode in="glow3" />
                <feMergeNode in="glow2" />
                <feMergeNode in="glow1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g ref={gRef}>
            <g className="nodes">
              {simNodes.map((node) => {
                const isIsolate = isolateIds.has(node.id);
                const r = getNodeRadius(node);
                const color = colorByGroup
                  ? (GROUP_COLORS[node.group] ?? nodeColorRef.current)
                  : isIsolate
                    ? isolateFillRef.current
                    : nodeColorRef.current;
                const opacity = getNodeOpacity(node);
                const isSelected = node.id === selectedNodeId;
                const isHovered = node.id === hoveredNodeId;
                const isHoveredNeighbor = !!hoveredNeighborIds?.has(node.id);
                return (
                  <circle
                    key={node.id}
                    className="node"
                    data-id={node.id}
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={color}
                    fillOpacity={opacity}
                    stroke={
                      isIsolate
                        ? isolateStrokeRef.current
                        : isSelected || isHovered || isHoveredNeighbor
                          ? 'var(--foreground)'
                          : 'var(--background)'
                    }
                    strokeWidth={
                      isIsolate
                        ? 0.8
                        : isSelected
                          ? 3.5
                          : isHovered
                            ? 2.5
                            : isHoveredNeighbor
                              ? 2
                              : 0.8
                    }
                    strokeOpacity={opacity}
                    filter={isSelected ? 'url(#selected-glow)' : undefined}
                    style={{
                      cursor: isIsolate ? 'default' : 'pointer',
                      transition:
                        'fill-opacity 250ms ease, stroke 250ms ease, stroke-width 250ms ease, stroke-opacity 250ms ease, filter 250ms ease',
                    }}
                    onClick={(e) => {
                      if (isIsolate) return;
                      e.stopPropagation();
                      onNodeSelect(node.id);
                    }}
                    onMouseEnter={() => {
                      if (isIsolate) return;
                      if (selectionMode === 'pair') return;
                      const t = transformRef.current;
                      setHoveredNodeId(node.id);
                      // In radial mode, show skill comparison for neighbor nodes
                      const sc =
                        layoutMode === 'radial' &&
                        selectedNodeId &&
                        node.id !== selectedNodeId &&
                        neighborDistancesRef.current?.get(node.id);
                      setTooltip({
                        x: t.applyX(node.x),
                        y: t.applyY(node.y),
                        node,
                        skillComparison: sc || undefined,
                      });
                    }}
                    onMouseLeave={() => {
                      if (isIsolate) return;
                      setHoveredNodeId(null);
                      setTooltip(null);
                    }}
                  />
                );
              })}
            </g>
          </g>
        </svg>
      )}

      {/* Hover tooltip */}
      {tooltip &&
        (() => {
          const tooltipR = getNodeRadius(tooltip.node) * transformRef.current.k;
          return (
            <div
              className="absolute z-20 pointer-events-none bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg max-w-[220px]"
              style={{
                left: tooltip.x + tooltipR + 6,
                top: tooltip.y - 10,
                transform:
                  tooltip.x > (dimensions.width ?? 0) - 240
                    ? 'translateX(-110%)'
                    : undefined,
              }}
            >
              <p className="font-semibold leading-tight">
                {tooltip.node.label}
              </p>
              {tooltip.skillComparison ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      Shared skills
                    </span>
                    <span className="font-medium text-[11px]">
                      {tooltip.skillComparison.shared.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      Skills to develop
                    </span>
                    <span className="font-medium text-[11px]">
                      {tooltip.skillComparison.toDevelop.length}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground text-[11px]">
                      AI Exposure
                    </span>
                    <span className="font-medium text-[11px]">
                      {(tooltip.node.aiExposure * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${tooltip.node.aiExposure * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* Pair mode node labels — float independently when tooltip closed */}
      {pairLabelPositions &&
        [pairLabelPositions.a, pairLabelPositions.b].map((pos, i) => {
          const pairR =
            (NODE_RADIUS_BASE +
              Math.pow(pos.aiExposure, NODE_RADIUS_EXPONENT) *
                NODE_RADIUS_SCALE) *
            transformRef.current.k;
          return (
            <div
              key={i}
              className="absolute z-20 pointer-events-none bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg max-w-[220px] border"
              style={{
                left: pos.x + pairR + 6,
                top: pos.y - 10,
                borderColor: nodeColorRef.current,
                transform:
                  pos.x > (dimensions.width ?? 0) - 240
                    ? 'translateX(-110%)'
                    : undefined,
              }}
            >
              <p className="font-semibold leading-tight">{pos.label}</p>
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground text-[11px]">
                    AI Exposure
                  </span>
                  <span className="font-medium text-[11px]">
                    {(pos.aiExposure * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${pos.aiExposure * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

      {/* Edge skills badge (always visible in pair mode) */}
      {badgePos && pairSkillsComparison && (
        <div
          className="absolute z-20"
          style={{
            left: badgePos.x,
            top: badgePos.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="cursor-pointer select-none"
            onMouseEnter={() => setShowEdgeTooltip(true)}
            onMouseLeave={() => setShowEdgeTooltip(false)}
          >
            <div className="bg-popover text-popover-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-md border border-border whitespace-nowrap">
              {pairSkillsComparison.shared.length} shared skills
            </div>
          </div>
        </div>
      )}

      {/* Shared skills tooltip (portaled when tooltip open) */}
      {showEdgeTooltip &&
        badgePos &&
        pairSkillsComparison &&
        (() => {
          const rect = containerRef.current?.getBoundingClientRect();
          const vy = (rect?.top ?? 0) + badgePos.y;
          const showAbove = vy > window.innerHeight / 2;

          return createPortal(
            <div
              className="fixed z-50"
              style={{
                left: '50%',
                transform: 'translateX(-50%)',
                top: showAbove ? undefined : vy + 20,
                bottom: showAbove ? window.innerHeight - vy + 20 : undefined,
                maxHeight: showAbove
                  ? `${vy - 40}px`
                  : `${window.innerHeight - vy - 40}px`,
                maxWidth: '95vw',
              }}
              onMouseEnter={() => setShowEdgeTooltip(true)}
              onMouseLeave={() => setShowEdgeTooltip(false)}
            >
              <div className="overflow-y-auto" style={{ maxHeight: 'inherit' }}>
                <EdgeSkillsTooltip
                  labelA={pairSkillsComparison.labelA}
                  labelB={pairSkillsComparison.labelB}
                  colorA={pairSkillsComparison.colorA}
                  colorB={pairSkillsComparison.colorB}
                  shared={pairSkillsComparison.shared}
                  onlyA={pairSkillsComparison.onlyA}
                  onlyB={pairSkillsComparison.onlyB}
                  totalUnique={pairSkillsComparison.totalUnique}
                />
              </div>
            </div>,
            document.body,
          );
        })()}

      <TunerPanel
        nodes={simNodes}
        edges={edges}
        onSizingChange={setTunerSizing}
        colorByGroup={colorByGroup}
        onColorByGroupChange={setColorByGroup}
      />
    </div>
  );
}
