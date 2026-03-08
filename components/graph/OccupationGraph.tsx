'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, SimNode, NodeSizeMetric, OccupationDetail } from '@/lib/types';
import { NODE_RADIUS_BASE, NODE_RADIUS_SCALE } from '@/lib/constants';
import { useForceSimulation } from '@/hooks/useForceSimulation';
import type { LayoutTuning } from '@/hooks/useForceSimulation';
import EdgeSkillsTooltip from './EdgeSkillsTooltip';

interface TooltipState {
  x: number;
  y: number;
  node: SimNode;
}

interface OccupationGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
  filterGroup: number | null;
  filterSkills: string[];
  allSkills: Map<string, Set<string>>; // nodeId -> skills set
  sizeMetric: 'aiExposure' | 'wage';
  sizeThreshold: number;
  nodeSizeMetric: NodeSizeMetric;
  maxWage: number;
  maxWorkers: number;
  secondSelectedNodeId: string | null;
  occupations: Record<string, OccupationDetail>;
  tuning?: LayoutTuning | null;
  exportRef?: MutableRefObject<(() => void) | null>;
}

export default function OccupationGraph({
  nodes,
  edges,
  onNodeSelect,
  selectedNodeId: selectedNodeIdProp,
  filterGroup,
  filterSkills,
  allSkills,
  sizeMetric,
  sizeThreshold,
  nodeSizeMetric,
  maxWage,
  maxWorkers,
  secondSelectedNodeId,
  occupations,
  tuning,
  exportRef,
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
  const [badgePos, setBadgePos] = useState<{ x: number; y: number } | null>(null);
  const [showEdgeTooltip, setShowEdgeTooltip] = useState(false);
  const selectedNodeId = selectedNodeIdProp;
  const selectionMode = !selectedNodeId
    ? 'none'
    : secondSelectedNodeId
      ? 'pair'
      : 'single';
  const nodeById = useRef<Map<string, SimNode>>(new Map());
  const edgeColorRef = useRef('#888');
  const foregroundColorRef = useRef('#000');
  const [mascoColors, setMascoColors] = useState<Record<number, string>>({});

  const selectionModeRef = useRef(selectionMode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const secondSelectedNodeIdRef = useRef(secondSelectedNodeId);
  useEffect(() => {
    selectionModeRef.current = selectionMode;
    selectedNodeIdRef.current = selectedNodeId;
    secondSelectedNodeIdRef.current = secondSelectedNodeId;
  }, [selectionMode, selectedNodeId, secondSelectedNodeId]);

  const simNodes = useMemo<SimNode[]>(
    () => nodes.map((n) => ({ ...n })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes.length],
  );

  useEffect(() => {
    nodeById.current = new Map(simNodes.map((n) => [n.id, n]));
  }, [simNodes]);

  // Read MASCO + edge colors from CSS vars, re-read on theme change
  const readThemeColors = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const colors: Record<number, string> = {};
    for (let i = 1; i <= 9; i++) {
      colors[i] = style.getPropertyValue(`--masco-${i}`).trim() || '#888';
    }
    edgeColorRef.current =
      style.getPropertyValue('--muted-foreground').trim() || '#888';
    foregroundColorRef.current =
      style.getPropertyValue('--foreground').trim() || '#000';
    setMascoColors(colors);
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
    const hasGroupFilter = filterGroup !== null;
    const hasSkillFilter = filterSkills.length > 0;
    const hasThreshold = sizeThreshold > 0;

    if (!hasGroupFilter && !hasSkillFilter && !hasThreshold) return null;

    const result = new Set<string>();
    const skillQueries = filterSkills.map((s) => s.toLowerCase());

    for (const node of simNodes) {
      if (hasGroupFilter && node.group !== filterGroup) continue;
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
  }, [
    simNodes,
    filterGroup,
    filterSkills,
    allSkills,
    sizeMetric,
    sizeThreshold,
  ]);

  // Build adjacency set for selected node
  const connectedIds = useMemo<Set<string> | null>(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>([selectedNodeId]);
    for (const e of edges) {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
      if (src === selectedNodeId) set.add(tgt);
      if (tgt === selectedNodeId) set.add(src);
    }
    return set;
  }, [selectedNodeId, edges]);

  const pairEdge = useMemo(() => {
    if (selectionMode !== 'pair' || !selectedNodeId || !secondSelectedNodeId) return null;
    return edges.find((e) => {
      const src = typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
      const tgt = typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
      return (
        (src === selectedNodeId && tgt === secondSelectedNodeId) ||
        (src === secondSelectedNodeId && tgt === selectedNodeId)
      );
    }) ?? null;
  }, [selectionMode, selectedNodeId, secondSelectedNodeId, edges]);

  const pairSkillsComparison = useMemo(() => {
    if (selectionMode !== 'pair' || !selectedNodeId || !secondSelectedNodeId) return null;
    const detailA = occupations[selectedNodeId];
    const detailB = occupations[secondSelectedNodeId];
    if (!detailA || !detailB) return null;

    const skillsA = new Set([...detailA.basicSkills, ...detailA.specificSkills].map(s => s.toLowerCase()));
    const skillsB = new Set([...detailB.basicSkills, ...detailB.specificSkills].map(s => s.toLowerCase()));

    const shared: string[] = [];
    const onlyA: string[] = [];
    const onlyB: string[] = [];

    const seenShared = new Set<string>();
    const seenA = new Set<string>();
    const seenB = new Set<string>();

    for (const skill of [...detailA.basicSkills, ...detailA.specificSkills]) {
      const lower = skill.toLowerCase();
      if (skillsB.has(lower)) {
        if (!seenShared.has(lower)) { shared.push(skill); seenShared.add(lower); }
      } else {
        if (!seenA.has(lower)) { onlyA.push(skill); seenA.add(lower); }
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
      totalUnique: shared.length + onlyA.length + onlyB.length,
    };
  }, [selectionMode, selectedNodeId, secondSelectedNodeId, occupations]);

  // Build adjacency set for hovered node (suppressed when a node is selected)
  const hoveredNeighborIds = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId || selectedNodeId) return null;
    const set = new Set<string>();
    for (const e of edges) {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
      if (src === hoveredNodeId) set.add(tgt);
      if (tgt === hoveredNodeId) set.add(src);
    }
    return set;
  }, [hoveredNodeId, selectedNodeId, edges]);

  const hoveredEdges = useMemo(() => {
    if (!hoveredNodeId || selectedNodeId || !hoveredNeighborIds) return [];
    return edges.filter((e) => {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
      if (src !== hoveredNodeId && tgt !== hoveredNodeId) return false;
      if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt)))
        return false;
      return true;
    });
  }, [hoveredNodeId, selectedNodeId, hoveredNeighborIds, edges, visibleIds]);

  const getNodeRadius = useCallback(
    (node: SimNode) => {
      if (nodeSizeMetric === 'wage') {
        if (node.wage === null || maxWage === 0) return NODE_RADIUS_BASE;
        return NODE_RADIUS_BASE + (node.wage / maxWage) * NODE_RADIUS_SCALE;
      }
      if (nodeSizeMetric === 'workers') {
        if (node.workers === null || maxWorkers === 0) return NODE_RADIUS_BASE;
        const maxLog = Math.log(maxWorkers);
        return NODE_RADIUS_BASE + (Math.log(node.workers) / maxLog) * NODE_RADIUS_SCALE;
      }
      return NODE_RADIUS_BASE + node.aiExposure * NODE_RADIUS_SCALE;
    },
    [nodeSizeMetric, maxWage, maxWorkers],
  );

  const getNodeOpacity = useCallback(
    (node: SimNode) => {
      if (nodeSizeMetric === 'wage' && node.wage === null) return 0.06;
      if (nodeSizeMetric === 'workers' && node.workers === null) return 0.06;
      if (visibleIds && !visibleIds.has(node.id)) return 0.06;
      // Pair mode: only show the two selected nodes
      if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
        if (node.id !== selectedNodeId && node.id !== secondSelectedNodeId) return 0.05;
        return 1;
      }
      if (selectedNodeId && connectedIds && !connectedIds.has(node.id))
        return 0.12;
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

  const visibleEdges = useMemo(() => {
    if (selectionMode === 'pair') {
      // Only show the edge between the two selected nodes
      return pairEdge ? [pairEdge] : [];
    }
    if (!selectedNodeId || !connectedIds) return [];
    return edges.filter((e) => {
      const src =
        typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
      const tgt =
        typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
      if (src !== selectedNodeId && tgt !== selectedNodeId) return false;
      if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt)))
        return false;
      return true;
    });
  }, [selectionMode, pairEdge, selectedNodeId, connectedIds, edges, visibleIds]);

  const drawEdges = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const { k, x, y } = transformRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.setTransform(k * dpr, 0, 0, k * dpr, x * dpr, y * dpr);

    // Draw selection edges (existing behavior)
    if (visibleEdges.length > 0) {
      ctx.strokeStyle = edgeColorRef.current;
      ctx.lineWidth = 0.5 / k;
      if (selectionMode === 'pair') {
        ctx.lineWidth = 2 / k;
      }

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
              : (edge.source as SimNode).id,
          );
          const tgt = nodeById.current.get(
            typeof edge.target === 'string'
              ? edge.target
              : (edge.target as SimNode).id,
          );
          if (!src || !tgt) continue;
          ctx.moveTo(src.x ?? 0, src.y ?? 0);
          ctx.lineTo(tgt.x ?? 0, tgt.y ?? 0);
        }
        ctx.stroke();
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
            : (edge.source as SimNode).id,
        );
        const tgt = nodeById.current.get(
          typeof edge.target === 'string'
            ? edge.target
            : (edge.target as SimNode).id,
        );
        if (!src || !tgt) continue;
        ctx.moveTo(src.x ?? 0, src.y ?? 0);
        ctx.lineTo(tgt.x ?? 0, tgt.y ?? 0);
      }
      ctx.stroke();
    }

    ctx.restore();
  }, [selectionMode, visibleEdges, hoveredEdges]);

  // Stable ref so zoom/drag handlers always call the latest drawEdges
  const drawEdgesRef = useRef(drawEdges);
  useEffect(() => {
    drawEdgesRef.current = drawEdges;
  }, [drawEdges]);

  const handleTick = useCallback(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, unknown>('circle.node')
      .each(function () {
        const node = nodeById.current.get(this.getAttribute('data-id')!);
        if (node) {
          this.setAttribute('cx', String(node.x ?? 0));
          this.setAttribute('cy', String(node.y ?? 0));
        }
      });
    drawEdgesRef.current();
  }, []);

  useForceSimulation({
    nodes: simNodes,
    edges: tuning ? edges : undefined,
    width: dimensions.width,
    height: dimensions.height,
    onTick: handleTick,
    nodeSizeMetric,
    maxWage,
    maxWorkers,
    tuning,
  });

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

  // Clear badge position when leaving pair mode
  useEffect(() => {
    if (selectionMode !== 'pair') {
      setBadgePos(null);
    }
  }, [selectionMode]);

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

  // Export layout: normalize sim positions back to 0-1 and trigger download
  useEffect(() => {
    if (!exportRef) return;
    exportRef.current = () => {
      if (!simNodes.length) return;

      const xs = simNodes.map((n) => n.x ?? 0);
      const ys = simNodes.map((n) => n.y ?? 0);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;

      const exported = simNodes.map((n) => ({
        id: n.id,
        label: n.label,
        group: n.group,
        aiExposure: n.aiExposure,
        quartile: n.quartile,
        wage: n.wage,
        workers: n.workers,
        x: Math.min(
          1,
          Math.max(0, parseFloat((((n.x ?? 0) - minX) / rangeX).toFixed(6))),
        ),
        y: Math.min(
          1,
          Math.max(0, parseFloat((((n.y ?? 0) - minY) / rangeY).toFixed(6))),
        ),
      }));

      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nodes.json';
      a.click();
      URL.revokeObjectURL(url);
    };
    return () => {
      if (exportRef) exportRef.current = null;
    };
  }, [exportRef, simNodes]);

  // Zoom + pan behavior — restrict pan to node bounds
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const minScale = 0.2;
    const maxScale = 3;
    const padding = 80;

    // Node bounds in simulation/content coordinates (ensure at least viewport size at min zoom)
    const xs = simNodes.map((n) => n.x ?? dimensions.width / 2);
    const ys = simNodes.map((n) => n.y ?? dimensions.height / 2);
    let minX = Math.min(...xs) - padding;
    let minY = Math.min(...ys) - padding;
    let maxX = Math.max(...xs) + padding;
    let maxY = Math.max(...ys) + padding;

    const minExtentW = dimensions.width / minScale;
    const minExtentH = dimensions.height / minScale;
    const extentW = maxX - minX;
    const extentH = maxY - minY;
    if (extentW < minExtentW) {
      const pad = (minExtentW - extentW) / 2;
      minX -= pad;
      maxX += pad;
    }
    if (extentH < minExtentH) {
      const pad = (minExtentH - extentH) / 2;
      minY -= pad;
      maxY += pad;
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([minScale, maxScale])
      .translateExtent([
        [minX, minY],
        [maxX, maxY],
      ])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        g.attr('transform', event.transform.toString());
        setTooltip(null);
        drawEdgesRef.current();

        // Update badge position during zoom
        if (selectionModeRef.current === 'pair' && selectedNodeIdRef.current && secondSelectedNodeIdRef.current) {
          const nodeA = nodeById.current.get(selectedNodeIdRef.current);
          const nodeB = nodeById.current.get(secondSelectedNodeIdRef.current);
          if (nodeA && nodeB) {
            const mx = ((nodeA.x ?? 0) + (nodeB.x ?? 0)) / 2;
            const my = ((nodeA.y ?? 0) + (nodeB.y ?? 0)) / 2;
            setBadgePos({ x: event.transform.applyX(mx), y: event.transform.applyY(my) });
          }
        }
      });

    zoomRef.current = zoom;

    svg.call(zoom);
    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions.width, dimensions.height, simNodes]);

  // Auto-zoom to frame both nodes in pair mode
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;

    if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
      const nodeA = nodeById.current.get(selectedNodeId);
      const nodeB = nodeById.current.get(secondSelectedNodeId);
      if (!nodeA || !nodeB) return;

      // Save current transform for restoring later
      preZoomTransformRef.current = transformRef.current;

      const padding = 120;
      const ax = nodeA.x ?? 0;
      const ay = nodeA.y ?? 0;
      const bx = nodeB.x ?? 0;
      const by = nodeB.y ?? 0;

      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2;
      const dx = Math.abs(bx - ax) + padding * 2;
      const dy = Math.abs(by - ay) + padding * 2;
      const scale = Math.min(
        dimensions.width / dx,
        dimensions.height / dy,
        2, // max zoom
      );
      const tx = dimensions.width / 2 - cx * scale;
      const ty = dimensions.height / 2 - cy * scale;
      const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

      svg.transition()
        .duration(500)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, target);
    } else if (selectionMode !== 'pair' && preZoomTransformRef.current) {
      // Restore previous zoom on deselect
      const prev = preZoomTransformRef.current;
      preZoomTransformRef.current = null;
      svg.transition()
        .duration(400)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, prev);
    }
  }, [selectionMode, selectedNodeId, secondSelectedNodeId, dimensions.width, dimensions.height]);

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
          <g ref={gRef}>
            <g className="nodes">
              {simNodes.map((node) => {
                const r = getNodeRadius(node);
                const color = mascoColors[node.group] || '#888';
                const opacity = getNodeOpacity(node);
                const isSelected = node.id === selectedNodeId;
                const isHovered = node.id === hoveredNodeId;
                const isHoveredNeighbor = !!hoveredNeighborIds?.has(node.id);
                return (
                  <circle
                    key={node.id}
                    className="node"
                    data-id={node.id}
                    cx={node.x ?? 0}
                    cy={node.y ?? 0}
                    r={r}
                    fill={color}
                    fillOpacity={opacity}
                    stroke={
                      isSelected || isHovered || isHoveredNeighbor
                        ? 'var(--foreground)'
                        : 'var(--background)'
                    }
                    strokeWidth={
                      isSelected || isHovered
                        ? 2.5
                        : isHoveredNeighbor
                          ? 2
                          : 0.8
                    }
                    strokeOpacity={opacity}
                    style={{
                      cursor: 'pointer',
                      transition:
                        'fill-opacity 250ms ease, stroke 250ms ease, stroke-width 250ms ease, stroke-opacity 250ms ease',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectionMode === 'pair') {
                        onNodeSelect(node.id);
                      } else {
                        const newId = selectedNodeId === node.id ? null : node.id;
                        onNodeSelect(newId);
                      }
                    }}
                    onMouseEnter={() => {
                      if (selectionMode === 'pair') return;
                      const t = transformRef.current;
                      setHoveredNodeId(node.id);
                      setTooltip({
                        x: t.applyX(node.x ?? 0),
                        y: t.applyY(node.y ?? 0),
                        node,
                      });
                    }}
                    onMouseLeave={() => {
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
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none bg-popover text-popover-foreground text-xs rounded-md px-3 py-2 shadow-lg max-w-[220px]"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            transform:
              tooltip.x > (dimensions.width ?? 0) - 240
                ? 'translateX(-110%)'
                : undefined,
          }}
        >
          <p className="font-semibold leading-tight">{tooltip.node.label}</p>
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
        </div>
      )}

      {/* Edge skills badge + tooltip */}
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
          {showEdgeTooltip && (() => {
            const rect = containerRef.current?.getBoundingClientRect();
            const vx = (rect?.left ?? 0) + badgePos.x;
            const vy = (rect?.top ?? 0) + badgePos.y;
            const showAbove = vy > window.innerHeight / 2;
            return createPortal(
              <div
                className="fixed z-50"
                style={{
                  left: Math.min(Math.max(vx, 250), window.innerWidth - 250),
                  top: showAbove ? undefined : vy + 20,
                  bottom: showAbove ? window.innerHeight - vy + 20 : undefined,
                  transform: 'translateX(-50%)',
                  maxHeight: showAbove ? `${vy - 40}px` : `${window.innerHeight - vy - 40}px`,
                }}
                onMouseEnter={() => setShowEdgeTooltip(true)}
                onMouseLeave={() => setShowEdgeTooltip(false)}
              >
                <EdgeSkillsTooltip
                  labelA={pairSkillsComparison.labelA}
                  labelB={pairSkillsComparison.labelB}
                  shared={pairSkillsComparison.shared}
                  onlyA={pairSkillsComparison.onlyA}
                  onlyB={pairSkillsComparison.onlyB}
                  totalUnique={pairSkillsComparison.totalUnique}
                />
              </div>,
              document.body,
            );
          })()}
        </div>
      )}
    </div>
  );
}
