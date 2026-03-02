'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, SimNode } from '@/lib/types';
import { MASCO_GROUPS, NODE_RADIUS_BASE, NODE_RADIUS_SCALE } from '@/lib/constants';
import { useForceSimulation } from '@/hooks/useForceSimulation';

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
}

export default function OccupationGraph({
  nodes,
  edges,
  onNodeSelect,
  selectedNodeId: selectedNodeIdProp,
  filterGroup,
  filterSkills,
  allSkills,
}: OccupationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const selectedNodeId = selectedNodeIdProp;
  const nodeById = useRef<Map<string, SimNode>>(new Map());

  const simNodes = useMemo<SimNode[]>(
    () => nodes.map((n) => ({ ...n })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes.length],
  );

  useEffect(() => {
    nodeById.current = new Map(simNodes.map((n) => [n.id, n]));
  }, [simNodes]);

  // Compute visible IDs based on filters
  const visibleIds = useMemo<Set<string> | null>(() => {
    const hasGroupFilter = filterGroup !== null;
    const hasSkillFilter = filterSkills.length > 0;

    if (!hasGroupFilter && !hasSkillFilter) return null;

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
      result.add(node.id);
    }
    return result;
  }, [simNodes, filterGroup, filterSkills, allSkills]);

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

  // Build adjacency set for hovered node (suppressed when a node is selected)
  const hoveredNeighborIds = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId || selectedNodeId) return null;
    const set = new Set<string>();
    for (const e of edges) {
      const src = typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
      const tgt = typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
      if (src === hoveredNodeId) set.add(tgt);
      if (tgt === hoveredNodeId) set.add(src);
    }
    return set;
  }, [hoveredNodeId, selectedNodeId, edges]);

  const getNodeOpacity = useCallback(
    (node: SimNode) => {
      if (visibleIds && !visibleIds.has(node.id)) return 0.06;
      if (selectedNodeId && connectedIds && !connectedIds.has(node.id))
        return 0.12;
      return 1;
    },
    [visibleIds, selectedNodeId, connectedIds],
  );

  const visibleEdges = useMemo(() => {
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
  }, [selectedNodeId, connectedIds, edges, visibleIds]);

  const drawEdges = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const { k, x, y } = transformRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (visibleEdges.length === 0) return;

    ctx.save();
    ctx.setTransform(k * dpr, 0, 0, k * dpr, x * dpr, y * dpr);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.5 / k;

    // Batch strokes by weight tier — max 7 draw calls regardless of edge count
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

    ctx.restore();
  }, [visibleEdges]);

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

  const { simulationRef } = useForceSimulation({
    nodes: simNodes,
    edges,
    width: dimensions.width,
    height: dimensions.height,
    onTick: handleTick,
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

  // Zoom + pan behavior — restrict pan to node bounds
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const minScale = 0.25;
    const maxScale = 1;
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
      });

    svg.call(zoom);
    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions.width, dimensions.height, simNodes]);

  // Drag behavior
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim || !svgRef.current) return;

    const svg = d3.select(svgRef.current);

    function dragStarted(
      event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>,
    ) {
      event.sourceEvent.stopPropagation();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(
      event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>,
    ) {
      const [gx, gy] = transformRef.current.invert([event.x, event.y]);
      event.subject.x = gx;
      event.subject.y = gy;
      event.subject.fx = gx;
      event.subject.fy = gy;
      handleTick();
    }
    function dragEnded(
      event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>,
    ) {
      event.subject.fx = null;
      event.subject.fy = null;
    }

    svg
      .selectAll<SVGCircleElement, SimNode>('circle.node')
      .call(
        d3
          .drag<SVGCircleElement, SimNode>()
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded),
      );
  });

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
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
                const r = NODE_RADIUS_BASE + node.aiExposure * NODE_RADIUS_SCALE;
                const color = MASCO_GROUPS[node.group]?.color ?? '#888';
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
                      isSelected || isHovered
                        ? 'var(--foreground)'
                        : isHoveredNeighbor
                        ? color
                        : 'var(--background)'
                    }
                    strokeWidth={
                      isSelected || isHovered ? 2.5
                      : isHoveredNeighbor ? 2
                      : 0.8
                    }
                    strokeOpacity={
                      isHoveredNeighbor && !isSelected && !isHovered
                        ? opacity * 0.7
                        : opacity
                    }
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newId = selectedNodeId === node.id ? null : node.id;
                      onNodeSelect(newId);
                    }}
                    onMouseEnter={() => {
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
              <span className="text-muted-foreground text-[11px]">AI Exposure</span>
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
    </div>
  );
}
