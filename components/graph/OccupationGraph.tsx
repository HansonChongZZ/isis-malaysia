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
  CircularLayoutParams,
  ForceLayoutParams,
  LayoutMode,
  ViewMode,
} from '@/lib/types';
import {
  computeRingPositions,
  computeRadialPositions,
  computeMirroredPosition,
  computeBadgeOffset,
  checkBoundingBoxOverlap,
  labelBounds,
  badgeBounds,
  LABEL_WIDTH,
} from '@/lib/layout';
import type { LayoutPosition } from '@/lib/layout';
import { computeNeighbourDistances } from '@/lib/skills';
import type { SkillComparison } from '@/lib/skills';
import {
  NODE_RADIUS_BASE,
  NODE_RADIUS_SCALE,
  NODE_RADIUS_EXPONENT,
  SELECTED_NODE_SCALE,
} from '@/lib/constants';
import EdgeSkillsTooltip from './EdgeSkillsTooltip';
import TunerPanel from './TunerPanel';

// Categorical palette for MASCO groups 1-9 (debug colouring)
const GROUP_COLOURS: Record<number, string> = {
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
  mstEdges: GraphEdge[];
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
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  specificSkillsMap: Map<string, Set<string>>;
  colourByGroup: boolean;
  onNodeHover?: (nodeId: string | null) => void;
  onReady?: (handle: { nodeToScreenCoords: (nodeId: string) => { x: number; y: number } | null }) => void;
  forceSelectionMode?: 'single' | null;
  disableInteraction?: boolean; // Disable zoom, pan, click, and hover (pointer-events: none)
  disableZoom?: boolean; // Disable zoom/pan only (hover and click still work)
  disableClick?: boolean; // Disable node click only (hover still works)
  onBadgePosChange?: (pos: { x: number; y: number } | null) => void;
  onBadgeInteract?: () => void;
  simulatedHoverId?: string | null;
}

export default function OccupationGraph({
  nodes,
  edges,
  mstEdges,
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
  viewMode,
  layoutMode,
  specificSkillsMap,
  colourByGroup,
  onNodeHover,
  onReady,
  forceSelectionMode,
  disableInteraction,
  disableZoom,
  disableClick,
  onBadgePosChange,
  onBadgeInteract,
  simulatedHoverId,
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
  useEffect(() => { onBadgePosChange?.(badgePos) }, [badgePos, onBadgePosChange]);
  const [showEdgeTooltip, setShowEdgeTooltip] = useState(false);
  const [pinnedEdgeTooltip, setPinnedEdgeTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const portalTooltipRef = useRef<HTMLDivElement>(null);
  const tooltipLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasOverlap, setHasOverlap] = useState(false);
  const [lastHoveredElement, setLastHoveredElement] = useState<'badge' | 'labelA' | 'labelB'>('badge');
  const [pairLabelPositions, setPairLabelPositions] = useState<{
    a: {
      x: number;
      y: number;
      label: string;
      aiExposure: number;
      mirroredLeft: number;
      mirroredTop: number;
    };
    b: {
      x: number;
      y: number;
      label: string;
      aiExposure: number;
      mirroredLeft: number;
      mirroredTop: number;
    };
  } | null>(null);
  const selectedNodeId = selectedNodeIdProp;
  const [tunerSizingPerMode, setTunerSizingPerMode] = useState<Record<ViewMode, TunerSizingParams | null>>({
    force: null,
    circular: { base: 80, scale: 40, exponent: 1 },
  });
  const tunerSizing = tunerSizingPerMode[viewMode];
  const setTunerSizing = useCallback((params: TunerSizingParams) => {
    setTunerSizingPerMode(prev => ({ ...prev, [viewMode]: params }));
  }, [viewMode]);
  const [showMstEdges, setShowMstEdges] = useState(true);
  const [tunerPositions, setTunerPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [circularLayout, setCircularLayout] = useState<CircularLayoutParams>({
    ringRadiusFactor: 0.12,
    nodeSpacing: 0,
    radialMinDistance: 200,
    radialMaxDistance: 2400,
  });
  const [forceLayout, setForceLayout] = useState<ForceLayoutParams>({
    collidePadding: 250.5,
    charge: -800,
    linkDistanceBase: 600,
    linkDistanceScale: 20,
    linkStrengthDivisor: 7,
  });
  // Bumped in readThemeColors to force re-render so SVG <defs> (gradient stops, aura) pick up new ref values
  const [, setThemeRevision] = useState(0);
  const derivedSelectionMode = !selectedNodeId
    ? 'none'
    : secondSelectedNodeId
      ? 'pair'
      : 'single';
  const selectionMode = forceSelectionMode ?? derivedSelectionMode;
  const nodeById = useRef<Map<string, GraphNode>>(new Map());
  const edgeColorRef = useRef('#888');
  const foregroundColorRef = useRef('#000');
  const nodeColourRef = useRef('#034e37');
  const isolateFillRef = useRef('#d1d5db');
  const isolateStrokeRef = useRef('#000000');
  const selectedGradientStartRef = useRef('#6EE7B7');
  const selectedGradientEndRef = useRef('#10B981');
  const selectedAuraRef = useRef('#10B981');
  const canvasGridRef = useRef('#C8E8D8');
  const graphCenterRef = useRef({ cx: 0, cy: 0, radius: 1 });

  const selectionModeRef = useRef(selectionMode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const secondSelectedNodeIdRef = useRef(secondSelectedNodeId);
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    selectionModeRef.current = selectionMode;
    selectedNodeIdRef.current = selectedNodeId;
    secondSelectedNodeIdRef.current = secondSelectedNodeId;
    viewModeRef.current = viewMode;
  }, [selectionMode, selectedNodeId, secondSelectedNodeId, viewMode]);

  useEffect(() => {
    onReady?.({
      nodeToScreenCoords: (nodeId: string) => {
        const node = nodeById.current.get(nodeId)
        if (!node) return null
        const t = transformRef.current
        return { x: t.applyX(node.x), y: t.applyY(node.y) }
      },
    })
  }, [onReady])

  const simNodes = useMemo<GraphNode[]>(
    () => nodes.map((n) => ({ ...n })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes.length],
  );

  // Save original force-directed positions from nodes.json
  const forcePositions = useMemo(() => {
    const map = new Map<string, LayoutPosition>();
    for (const n of nodes) {
      map.set(n.id, { x: n.x, y: n.y });
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  const ringPositions = useMemo(
    () => computeRingPositions(simNodes, 20000, 20000, circularLayout.ringRadiusFactor, circularLayout.nodeSpacing),
    [simNodes, circularLayout.ringRadiusFactor, circularLayout.nodeSpacing],
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
    nodeColourRef.current =
      style.getPropertyValue('--node-color').trim() || '#034e37';
    isolateFillRef.current =
      style.getPropertyValue('--node-isolate-fill').trim() || '#d1d5db';
    isolateStrokeRef.current =
      style.getPropertyValue('--node-isolate-stroke').trim() || '#000';
    selectedGradientStartRef.current =
      style.getPropertyValue('--node-selected-gradient-start').trim() || '#6EE7B7';
    selectedGradientEndRef.current =
      style.getPropertyValue('--node-selected-gradient-end').trim() || '#10B981';
    selectedAuraRef.current =
      style.getPropertyValue('--node-selected-aura').trim() || '#10B981';
    canvasGridRef.current =
      style.getPropertyValue('--canvas-grid').trim() || '#C8E8D8';
    drawEdgesRef.current();
    setThemeRevision(r => r + 1);
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
      // Directed: only follow source → target
      if (src === selectedNodeId) set.add(tgt);
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

    // Compute specific-skills-only counts and lists for the badge
    const specificA = new Set(detailA.specificSkills.map((s) => s.toLowerCase()));
    const specificB = new Set(detailB.specificSkills.map((s) => s.toLowerCase()));
    let sharedSpecificCount = 0;
    const toDevelopSpecific: string[] = [];
    const seenToDevelop = new Set<string>();
    for (const s of specificA) {
      if (specificB.has(s)) sharedSpecificCount++;
    }
    for (const skill of detailB.specificSkills) {
      const lower = skill.toLowerCase();
      if (!specificA.has(lower) && !seenToDevelop.has(lower)) {
        toDevelopSpecific.push(skill);
        seenToDevelop.add(lower);
      }
    }

    return {
      shared,
      onlyA,
      onlyB,
      toDevelopSpecific,
      labelA: detailA.occupation,
      labelB: detailB.occupation,
      colourA: nodeColourRef.current,
      colourB: nodeColourRef.current,
      totalUnique: shared.length + onlyA.length + onlyB.length,
      sharedSpecificCount,
      toDevelopSpecificCount: toDevelopSpecific.length,
    };
  }, [selectionMode, selectedNodeId, secondSelectedNodeId, occupations]);

  // Build adjacency set for hovered node (suppressed when a node is selected)
  const hoveredNeighbourIds = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId || selectedNodeId) return null;
    const set = new Set<string>();
    for (const e of edges) {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      // Directed: only follow source → target
      if (src === hoveredNodeId) set.add(tgt);
    }
    return set;
  }, [hoveredNodeId, selectedNodeId, edges]);

  const hoveredEdges = useMemo(() => {
    if (!hoveredNodeId || selectedNodeId || !hoveredNeighbourIds) return [];
    return edges.filter((e) => {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
      // Directed: only show edges where hovered node is source
      if (src !== hoveredNodeId) return false;
      if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt)))
        return false;
      return true;
    });
  }, [hoveredNodeId, selectedNodeId, hoveredNeighbourIds, edges, visibleIds]);

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
        return viewMode === 'force' ? 0.12 : 0.06;
      if (
        hoveredNodeId &&
        !selectedNodeId &&
        node.id !== hoveredNodeId &&
        hoveredNeighbourIds &&
        !hoveredNeighbourIds.has(node.id)
      )
        return 0.6;
      return 1;
    },
    [
      viewMode,
      nodeSizeMetric,
      visibleIds,
      selectionMode,
      selectedNodeId,
      secondSelectedNodeId,
      connectedIds,
      hoveredNodeId,
      hoveredNeighbourIds,
    ],
  );

  // --- Radial layout computation (Task 7) ---
  const neighbourDistancesRef = useRef<Map<string, SkillComparison> | null>(null);

  const neighbourDistances = useMemo(() => {
    if (!selectedNodeId || !connectedIds) return null;
    const neighbourIds = simNodes
      .filter((n) => n.id !== selectedNodeId && connectedIds.has(n.id))
      .map((n) => n.id);
    return computeNeighbourDistances(selectedNodeId, neighbourIds, specificSkillsMap);
  }, [selectedNodeId, connectedIds, simNodes, specificSkillsMap]);

  const radialPositions = useMemo(() => {
    if (layoutMode !== 'radial' || !selectedNodeId || !connectedIds || !neighbourDistances) return null;
    const neighbourNodes = simNodes.filter(
      (n) => n.id !== selectedNodeId && connectedIds.has(n.id),
    );
    const centreNode = simNodes.find((n) => n.id === selectedNodeId);
    const centreRadius = centreNode ? getNodeRadius(centreNode) : NODE_RADIUS_BASE;
    const maxNeighbourRadius = neighbourNodes.length > 0
      ? Math.max(...neighbourNodes.map(getNodeRadius))
      : NODE_RADIUS_BASE;
    return computeRadialPositions(
      selectedNodeId, neighbourNodes, neighbourDistances,
      centreRadius, maxNeighbourRadius,
      circularLayout.radialMinDistance,
      circularLayout.radialMaxDistance,
    );
  }, [layoutMode, selectedNodeId, connectedIds, neighbourDistances, simNodes, getNodeRadius,
      circularLayout.radialMinDistance, circularLayout.radialMaxDistance]);

  // Keep ref in sync for canvas drawEdges callback
  useEffect(() => { neighbourDistancesRef.current = neighbourDistances; }, [neighbourDistances]);

  // Simulated hover from tutorial virtual cursor
  useEffect(() => {
    if (!simulatedHoverId) return

    // nodeById is a ref (Map<string, GraphNode>) populated during layout — use it for node lookup
    const node = nodeById.current.get(simulatedHoverId)
    if (!node) return

    setHoveredNodeId(simulatedHoverId)
    onNodeHover?.(simulatedHoverId)

    const t = transformRef.current
    const sc =
      selectedNodeId &&
      simulatedHoverId !== selectedNodeId &&
      neighbourDistancesRef.current?.get(simulatedHoverId)
    setTooltip({
      x: t.applyX(node.x),
      y: t.applyY(node.y),
      node,
      skillComparison: sc || undefined,
    })

    return () => {
      setHoveredNodeId(null)
      onNodeHover?.(null)
      setTooltip(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- imperative effect driven by tutorial;
    // onNodeHover is a stable setState, selectedNodeId is read from ref-like state at effect time
  }, [simulatedHoverId, selectedNodeId, onNodeHover])

  // --- Animation refs (Task 8) ---
  const animatingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const prevLayoutModeRef = useRef<LayoutMode>(layoutMode);
  const prevViewModeRef = useRef<ViewMode>(viewMode);
  const prevCircularLayoutRef = useRef(circularLayout);
  const skipZoomRef = useRef(false);

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

  // --- Position effect with animation ---
  useEffect(() => {
    const prevLayout = prevLayoutModeRef.current;
    const prevView = prevViewModeRef.current;
    const prevCircular = prevCircularLayoutRef.current;
    prevLayoutModeRef.current = layoutMode;
    prevViewModeRef.current = viewMode;
    prevCircularLayoutRef.current = circularLayout;

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

    const applyPositions = (positions: Map<string, LayoutPosition>) => {
      for (const node of simNodes) {
        const pos = positions.get(node.id);
        if (pos) {
          node.x = pos.x;
          node.y = pos.y;
        }
      }
      updateGraphCenter();
      drawEdgesRef.current();
      // Force SVG circle positions to update (React doesn't see simNode mutations)
      const g = gRef.current;
      if (g) {
        d3.select(g).selectAll<SVGCircleElement, null>('.node').each(function () {
          const el = d3.select(this);
          const id = el.attr('data-id');
          const node = nodeById.current.get(id);
          if (node) {
            el.attr('cx', node.x).attr('cy', node.y);
          }
        });
      }
    };

    if (viewMode === 'force') {
      const positions = tunerPositions ?? forcePositions;
      applyPositions(positions);
      return;
    }

    // Circular mode: ring/radial with animation
    const viewChanged = prevView !== viewMode;
    // Detect circular slider change (no mode switch) — apply instantly
    const circularParamsChanged = prevCircular !== circularLayout && prevLayout === layoutMode && !viewChanged;
    if (circularParamsChanged) skipZoomRef.current = true;

    if (layoutMode === 'ring') {
      if (prevLayout === 'radial' && !viewChanged && !circularParamsChanged) {
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
        // Initial render, view mode switch, slider change, or ring → ring: set directly
        applyPositions(ringPositions);
      }
    } else if (layoutMode === 'radial' && radialPositions) {
      // Build combined target: radial positions for centre+neighbours, ring for rest
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
      if (viewChanged || circularParamsChanged) {
        applyPositions(targets);
      } else {
        animateToPositions(targets, 800, () => {
          updateGraphCenter();
          drawEdgesRef.current();
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, layoutMode, simNodes, ringPositions, radialPositions, forcePositions, tunerPositions, circularLayout]);

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
      // Directed: only show edges where selected node is source
      if (src !== selectedNodeId) return false;
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

    // Draw baseline MST edges — toggled from TunerPanel, force mode only
    if (showMstEdges && viewModeRef.current === 'force') {
      const hasFocus = visibleEdges.length > 0 || hoveredEdges.length > 0;
      ctx.strokeStyle = edgeColorRef.current;
      ctx.lineWidth = 0.5 / k;
      ctx.globalAlpha = hasFocus ? 0.04 : 0.15;
      ctx.beginPath();
      for (const edge of mstEdges) {
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
      ctx.globalAlpha = 1;
    }

    // No edges in circular ring mode (no selection) — clean overview
    if (viewModeRef.current === 'circular' && selectionModeRef.current === 'none') {
      ctx.restore();
      return;
    }

    // Draw selection edges
    if (visibleEdges.length > 0) {
      ctx.strokeStyle = edgeColorRef.current;

      if (selectionModeRef.current === 'pair' || viewModeRef.current === 'force') {
        // Force mode + pair mode: straight lines grouped by weight
        ctx.lineWidth = selectionModeRef.current === 'pair' ? 2 / k : 0.5 / k;
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
        // Circular single selection: curved arcs with opacity based on skill distance
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

          // Look up skill distance from neighbourDistancesRef
          const neighbourId = src.id === selectedNodeIdRef.current ? tgt.id : src.id;
          const comparison = neighbourDistancesRef.current?.get(neighbourId);
          const skillDist = comparison?.distance ?? 1;
          // Invert: distance 0 → opacity 0.6, distance 1 → opacity 0.15
          ctx.globalAlpha = 0.6 - skillDist * 0.45;

          // Quadratic bezier with 20% perpendicular offset (clockwise direction)
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const lineLength = Math.hypot(dx, dy);
          if (lineLength === 0) continue;
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
  }, [visibleEdges, hoveredEdges, tunerSizing, showMstEdges, mstEdges]);

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

  const updatePairPositions = useCallback(
    (
      nodeA: { x: number; y: number; label: string; aiExposure: number },
      nodeB: { x: number; y: number; label: string; aiExposure: number },
      t: d3.ZoomTransform,
    ) => {
      const screenA = { x: t.applyX(nodeA.x), y: t.applyY(nodeA.y) };
      const screenB = { x: t.applyX(nodeB.x), y: t.applyY(nodeB.y) };

      const radiusA =
        (NODE_RADIUS_BASE + Math.pow(nodeA.aiExposure, NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE) * t.k;
      const radiusB =
        (NODE_RADIUS_BASE + Math.pow(nodeB.aiExposure, NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE) * t.k;

      const mirroredA = computeMirroredPosition(screenA, screenB, screenA, radiusA);
      const mirroredB = computeMirroredPosition(screenA, screenB, screenB, radiusB);

      const mx = (screenA.x + screenB.x) / 2;
      const my = (screenA.y + screenB.y) / 2;
      const rawBadge = { x: mx, y: my };
      const adjustedBadge = computeBadgeOffset(rawBadge, mirroredA, mirroredB, screenA, screenB);

      setBadgePos(adjustedBadge);
      setPairLabelPositions({
        a: { ...screenA, label: nodeA.label, aiExposure: nodeA.aiExposure, mirroredLeft: mirroredA.left, mirroredTop: mirroredA.top },
        b: { ...screenB, label: nodeB.label, aiExposure: nodeB.aiExposure, mirroredLeft: mirroredB.left, mirroredTop: mirroredB.top },
      });

      const overlap = checkBoundingBoxOverlap([
        labelBounds(mirroredA),
        labelBounds(mirroredB),
        badgeBounds(adjustedBadge.x, adjustedBadge.y),
      ]);
      setHasOverlap(overlap);
    },
    [],
  );

  // Update badge + label positions when entering/leaving pair mode
  useEffect(() => {
    if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
      const nodeA = nodeById.current.get(selectedNodeId);
      const nodeB = nodeById.current.get(secondSelectedNodeId);
      if (nodeA && nodeB) {
        updatePairPositions(nodeA, nodeB, transformRef.current);
      }
    } else {
      setBadgePos(null);
      setPairLabelPositions(null);
      setHasOverlap(false);
    }
  }, [selectionMode, selectedNodeId, secondSelectedNodeId, updatePairPositions]);

  // Reset edge tooltip on selection change
  useEffect(() => {
    setShowEdgeTooltip(false);
    setPinnedEdgeTooltip(false);
  }, [selectedNodeId, secondSelectedNodeId]);

  // Reset pinned state when leaving pair mode
  useEffect(() => {
    if (selectionMode !== 'pair') {
      setPinnedEdgeTooltip(false);
    }
  }, [selectionMode]);

  // Click-outside listener to dismiss pinned tooltip
  // Uses capture phase + stopPropagation so the click only unpins,
  // without triggering canvas interactions (e.g. zoom-out / deselect).
  useEffect(() => {
    if (!pinnedEdgeTooltip) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        badgeRef.current?.contains(target) ||
        portalTooltipRef.current?.contains(target)
      ) return;
      e.stopPropagation();
      e.preventDefault();
      setPinnedEdgeTooltip(false);
      setShowEdgeTooltip(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [pinnedEdgeTooltip]);

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
            updatePairPositions(nodeA, nodeB, event.transform);
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
  }, [dimensions.width, dimensions.height, simNodes, viewMode, layoutMode]);

  // Disable zoom/pan while keeping hover and click functional
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    const svg = d3.select(svgRef.current)
    if (disableZoom) {
      svg.on('.zoom', null)
    } else {
      svg.call(zoomRef.current)
    }
  }, [disableZoom])

  // Auto-zoom to frame selection (single or pair mode)
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return;
    // Skip zoom when only circular layout params changed (slider drag)
    if (skipZoomRef.current) {
      skipZoomRef.current = false;
      return;
    }
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;

    if (selectionMode === 'single' && selectedNodeId && connectedIds) {
      // Save current transform for restoring later
      if (!preZoomTransformRef.current) {
        preZoomTransformRef.current = transformRef.current;
      }

      const neighbourNodes = simNodes.filter((n) => connectedIds.has(n.id));

      if (neighbourNodes.length <= 1) {
        // Isolated node (only itself in connectedIds) — gently centre on node
        const node = nodeById.current.get(selectedNodeId);
        if (!node) return;
        // Zoom to max allowed scale, centred on the node
        const scale = zoomRef.current!.scaleExtent()[1];
        const tx = dimensions.width / 2 - node.x * scale;
        const ty = dimensions.height / 2 - node.y * scale;
        const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

        svg
          .transition()
          .duration(600)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, target);
      } else if (radialPositions) {
        // Radial mode: centre on selected node (always at origin in radial layout)
        const padding = 250;
        const positions = Array.from(radialPositions.values());
        const maxDist = Math.max(
          ...positions.map((p) => Math.hypot(p.x, p.y)),
        );
        const scale = Math.min(
          Math.min(dimensions.width, dimensions.height) /
            (2 * (maxDist + padding)),
          3,
        );
        const tx = dimensions.width / 2;
        const ty = dimensions.height / 2;
        const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

        svg
          .transition()
          .duration(800)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, target);
      } else {
        // Ring mode: centre on selected node, scale to fit neighbours
        const padding = 250;
        const node = nodeById.current.get(selectedNodeId);
        if (!node) return;
        const maxDist = Math.max(
          0,
          ...neighbourNodes.map((n) =>
            Math.hypot(n.x - node.x, n.y - node.y),
          ),
        );
        const scale = Math.min(
          Math.min(dimensions.width, dimensions.height) /
            (2 * (maxDist + padding)),
          3,
        );
        const tx = dimensions.width / 2 - node.x * scale;
        const ty = dimensions.height / 2 - node.y * scale;
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
    // Re-disable zoom handlers after any zoom transition if disableZoom is active.
    // D3's zoom.transform re-attaches handlers as a side effect.
    if (disableZoom) {
      svg.on('.zoom', null)
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
    disableZoom,
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
          style={{ position: 'absolute', top: 0, left: 0, cursor: disableInteraction ? 'default' : 'grab', pointerEvents: disableInteraction ? 'none' : undefined }}
          onClick={() => {
            if (disableClick) return;
            onNodeSelect(null);
          }}
        >
          <defs>
            {/* Radial gradient for selected node — colors from CSS vars via refs */}
            <radialGradient id="selected-node-gradient" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor={selectedGradientStartRef.current} />
              <stop offset="100%" stopColor={selectedGradientEndRef.current} />
            </radialGradient>

            {/* Enhanced 2-layer glow for selected node.
                Color matrix uses a universal green tint (~#33D499) that works
                in both themes — SVG filters can't reference CSS vars. */}
            <filter
              id="selected-glow"
              x="-200%"
              y="-200%"
              width="500%"
              height="500%"
            >
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="10"
                result="blur1"
              />
              <feColorMatrix
                in="blur1"
                type="matrix"
                values="0 0 0 0 0.2  0 0 0 0 0.83  0 0 0 0 0.6  0 0 0 1 0"
                result="glow1"
              />
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="25"
                result="blur2"
              />
              <feColorMatrix
                in="blur2"
                type="matrix"
                values="0 0 0 0 0.2  0 0 0 0 0.83  0 0 0 0 0.6  0 0 0 0.5 0"
                result="glow2"
              />
              <feMerge>
                <feMergeNode in="glow2" />
                <feMergeNode in="glow1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g ref={gRef}>
            {/* Aura circle behind selected node */}
            {selectedNodeId && (() => {
              const selectedNode = simNodes.find(n => n.id === selectedNodeId);
              if (!selectedNode) return null;
              const auraBaseR = getNodeRadius(selectedNode) * SELECTED_NODE_SCALE * 1.5;
              return (
                <circle
                  cx={selectedNode.x}
                  cy={selectedNode.y}
                  r={auraBaseR}
                  fill={selectedAuraRef.current}
                  opacity={0.15}
                  style={{ pointerEvents: 'none' }}
                >
                  <animate attributeName="r" values={`${auraBaseR};${auraBaseR + 4};${auraBaseR}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0.25;0.15" dur="3s" repeatCount="indefinite" />
                </circle>
              );
            })()}
            <g className="nodes">
              {(layoutMode === 'radial' && selectedNodeId && connectedIds
                ? [...simNodes].sort((a, b) => {
                    // Render neighbourhood last so it sits on top of ring nodes
                    const aInNeighbourhood = a.id === selectedNodeId || connectedIds.has(a.id) ? 1 : 0;
                    const bInNeighbourhood = b.id === selectedNodeId || connectedIds.has(b.id) ? 1 : 0;
                    return aInNeighbourhood - bInNeighbourhood;
                  })
                : simNodes
              ).map((node) => {
                const isIsolate = isolateIds.has(node.id);
                const r = getNodeRadius(node);
                const color = colourByGroup
                  ? (GROUP_COLOURS[node.group] ?? nodeColourRef.current)
                  : isIsolate
                    ? isolateFillRef.current
                    : nodeColourRef.current;
                const opacity = getNodeOpacity(node);
                const isSelected = node.id === selectedNodeId;
                const displayR = isSelected ? r * SELECTED_NODE_SCALE : r;
                const isHovered = node.id === hoveredNodeId;
                const isHoveredNeighbour = !!hoveredNeighbourIds?.has(node.id);
                return isSelected ? (
                  <circle
                    key={node.id}
                    className="node"
                    data-id={node.id}
                    cx={node.x}
                    cy={node.y}
                    r={displayR}
                    fill="url(#selected-node-gradient)"
                    fillOpacity={opacity}
                    stroke="var(--foreground)"
                    strokeWidth={3}
                    strokeOpacity={opacity}
                    filter="url(#selected-glow)"
                    style={{
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      transition:
                        'r 250ms ease, fill-opacity 250ms ease, fill 250ms ease, stroke 250ms ease, stroke-width 250ms ease, stroke-opacity 250ms ease, filter 250ms ease',
                    }}
                    onClick={(e) => {
                      if (disableClick) return;
                      e.stopPropagation();
                      onNodeSelect(node.id);
                    }}
                    onMouseEnter={() => {
                      if (tooltipLeaveTimer.current) clearTimeout(tooltipLeaveTimer.current);
                      if (visibleIds && !visibleIds.has(node.id)) return;
                      if (selectionMode === 'pair') return;
                      const t = transformRef.current;
                      setHoveredNodeId(node.id);
                      onNodeHover?.(node.id);
                      setTooltip({
                        x: t.applyX(node.x),
                        y: t.applyY(node.y),
                        node,
                        skillComparison: undefined,
                      });
                    }}
                    onMouseLeave={() => {
                      tooltipLeaveTimer.current = setTimeout(() => {
                        setHoveredNodeId(null);
                        onNodeHover?.(null);
                        setTooltip(null);
                      }, 150);
                    }}
                  >
                    <animate attributeName="r" values={`${displayR};${displayR + 1};${displayR}`} dur="3s" repeatCount="indefinite" />
                  </circle>
                ) : (
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
                      isHovered || isHoveredNeighbour
                        ? 'var(--foreground)'
                        : isIsolate
                          ? isolateStrokeRef.current
                          : 'var(--background)'
                    }
                    strokeWidth={
                      isHovered
                        ? 2.5
                        : isHoveredNeighbour
                          ? 2
                          : 0.8
                    }
                    strokeOpacity={opacity}
                    style={{
                      pointerEvents: (visibleIds && !visibleIds.has(node.id)) ? 'none' : 'auto',
                      cursor: isIsolate ? 'default'
                        : (selectedNodeId && !connectedIds?.has(node.id) && node.id !== selectedNodeId) ? 'default'
                        : 'pointer',
                      transition:
                        'r 250ms ease, fill-opacity 250ms ease, fill 250ms ease, stroke 250ms ease, stroke-width 250ms ease, stroke-opacity 250ms ease, filter 250ms ease',
                    }}
                    onClick={(e) => {
                      if (disableClick) return;
                      if (isIsolate) return;
                      if (visibleIds && !visibleIds.has(node.id)) return;
                      e.stopPropagation();
                      // In radial mode, clicking outside the neighbourhood deselects
                      if (layoutMode === 'radial' && selectedNodeId && !connectedIds?.has(node.id) && node.id !== selectedNodeId) {
                        onNodeSelect(null);
                        return;
                      }
                      onNodeSelect(node.id);
                    }}
                    onMouseEnter={() => {
                      if (tooltipLeaveTimer.current) clearTimeout(tooltipLeaveTimer.current);
                      if (visibleIds && !visibleIds.has(node.id)) return;
                      if (selectionMode === 'pair') return;
                      // Disable hover on nodes outside the neighbourhood when a node is selected
                      if (selectedNodeId && !connectedIds?.has(node.id) && node.id !== selectedNodeId) return;
                      const t = transformRef.current;
                      setHoveredNodeId(node.id);
                      onNodeHover?.(node.id);
                      // Show skill comparison for neighbour nodes when a node is selected
                      const sc =
                        selectedNodeId &&
                        node.id !== selectedNodeId &&
                        neighbourDistancesRef.current?.get(node.id);
                      setTooltip({
                        x: t.applyX(node.x),
                        y: t.applyY(node.y),
                        node,
                        skillComparison: sc || undefined,
                      });
                    }}
                    onMouseLeave={() => {
                      tooltipLeaveTimer.current = setTimeout(() => {
                        setHoveredNodeId(null);
                        onNodeHover?.(null);
                        setTooltip(null);
                      }, 150);
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
          const isTooltipSelected = tooltip.node.id === selectedNodeId;
          const tooltipR = getNodeRadius(tooltip.node) * (isTooltipSelected ? SELECTED_NODE_SCALE : 1) * transformRef.current.k;
          const isTooltipIsolate = isolateIds.has(tooltip.node.id);
          return (
            <div
              className={`absolute z-20 bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg max-w-[220px] ${isTooltipIsolate ? 'cursor-default' : 'cursor-pointer'}`}
              onClick={() => {
                if (isTooltipIsolate) return;
                if (tooltipLeaveTimer.current) clearTimeout(tooltipLeaveTimer.current);
                const id = tooltip.node.id;
                setTooltip(null);
                setHoveredNodeId(null);
                onNodeSelect(id);
              }}
              onMouseEnter={() => {
                if (tooltipLeaveTimer.current) clearTimeout(tooltipLeaveTimer.current);
              }}
              onMouseLeave={() => {
                setTooltip(null);
                setHoveredNodeId(null);
              }}
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
              className="absolute z-20 bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg max-w-[220px] border cursor-pointer"
              onClick={() => {
                const id = i === 0 ? selectedNodeId : secondSelectedNodeId;
                if (id) onNodeSelect(id);
              }}
              style={{
                left: pos.x + pairR + 6,
                top: pos.y - 10,
                borderColor: nodeColourRef.current,
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
            ref={badgeRef}
            className="cursor-pointer select-none"
            onMouseEnter={() => { setShowEdgeTooltip(true); onBadgeInteract?.() }}
            onMouseLeave={() => { if (!pinnedEdgeTooltip) setShowEdgeTooltip(false); }}
            onClick={() => {
              if (pinnedEdgeTooltip) {
                setPinnedEdgeTooltip(false);
                setShowEdgeTooltip(false);
              } else {
                setPinnedEdgeTooltip(true);
                setShowEdgeTooltip(true);
                onBadgeInteract?.();
              }
            }}
          >
            <div className="bg-popover text-popover-foreground text-xs font-medium px-3.5 py-1.5 rounded-xl shadow-md border border-border whitespace-nowrap flex flex-col items-center gap-0.5 leading-snug">
              <span><span className="text-green-400 font-semibold">{pairSkillsComparison.sharedSpecificCount}</span> specific skills shared</span>
              <span><span className="text-blue-400 font-semibold">{pairSkillsComparison.toDevelopSpecificCount}</span> specific skills to develop</span>
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
              ref={portalTooltipRef}
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
              onMouseLeave={() => { if (!pinnedEdgeTooltip) setShowEdgeTooltip(false); }}
            >
              <div className="overflow-y-auto" style={{ maxHeight: 'inherit' }}>
                <EdgeSkillsTooltip
                  labelA={pairSkillsComparison.labelA}
                  labelB={pairSkillsComparison.labelB}
                  colourA={pairSkillsComparison.colourA}
                  colourB={pairSkillsComparison.colourB}
                  toDevelopSpecific={pairSkillsComparison.toDevelopSpecific}
                  sharedSpecificCount={pairSkillsComparison.sharedSpecificCount}
                  toDevelopSpecificCount={pairSkillsComparison.toDevelopSpecificCount}
                  pinned={pinnedEdgeTooltip}
                />
              </div>
            </div>,
            document.body,
          );
        })()}

      <TunerPanel
        key={viewMode}
        viewMode={viewMode}
        nodes={simNodes}
        edges={edges}
        mstEdges={mstEdges}
        onSizingChange={setTunerSizing}
        onPositionsChange={setTunerPositions}
        onCircularLayoutChange={setCircularLayout}
        onForceLayoutChange={setForceLayout}
        showMstEdges={showMstEdges}
        onShowMstEdgesChange={setShowMstEdges}
        initialSizing={tunerSizing ?? undefined}
        initialCircularLayout={circularLayout}
        initialForceLayout={forceLayout}
      />
    </div>
  );
}
