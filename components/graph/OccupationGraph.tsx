"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import * as d3 from "d3"
import type { GraphNode, GraphEdge, SimNode, SimEdge } from "@/lib/types"
import { MASCO_GROUPS } from "@/lib/constants"
import { useForceSimulation } from "@/hooks/useForceSimulation"
import { useGraphInteraction } from "@/hooks/useGraphInteraction"

interface TooltipState {
  x: number
  y: number
  node: SimNode
}

interface OccupationGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeSelect: (nodeId: string | null) => void
  filterGroup: number | null
  searchQuery: string
  filterSkill: string
  allSkills: Map<string, Set<string>> // nodeId -> skills set
}

export default function OccupationGraph({
  nodes,
  edges,
  onNodeSelect,
  filterGroup,
  searchQuery,
  filterSkill,
  allSkills,
}: OccupationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const simNodes = useMemo<SimNode[]>(
    () => nodes.map((n) => ({ ...n })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes.length]
  )

  // Compute visible IDs based on filters
  const visibleIds = useMemo<Set<string> | null>(() => {
    const hasGroupFilter = filterGroup !== null
    const hasSearch = searchQuery.trim().length > 0
    const hasSkillFilter = filterSkill.trim().length > 0

    if (!hasGroupFilter && !hasSearch && !hasSkillFilter) return null

    const result = new Set<string>()
    const q = searchQuery.toLowerCase()
    const skillQ = filterSkill.toLowerCase()

    for (const node of simNodes) {
      if (hasGroupFilter && node.group !== filterGroup) continue
      if (hasSearch && !node.label.toLowerCase().includes(q) && !node.id.includes(q)) continue
      if (hasSkillFilter) {
        const nodeSkills = allSkills.get(node.id)
        if (!nodeSkills) continue
        const match = [...nodeSkills].some((s) => s.toLowerCase().includes(skillQ))
        if (!match) continue
      }
      result.add(node.id)
    }
    return result
  }, [simNodes, filterGroup, searchQuery, filterSkill, allSkills])

  // Build adjacency set for selected node
  const connectedIds = useMemo<Set<string> | null>(() => {
    if (!selectedNodeId) return null
    const set = new Set<string>([selectedNodeId])
    for (const e of edges) {
      const src = typeof e.source === "string" ? e.source : (e.source as SimNode).id
      const tgt = typeof e.target === "string" ? e.target : (e.target as SimNode).id
      if (src === selectedNodeId) set.add(tgt)
      if (tgt === selectedNodeId) set.add(src)
    }
    return set
  }, [selectedNodeId, edges])

  const getNodeOpacity = useCallback(
    (node: SimNode) => {
      if (visibleIds && !visibleIds.has(node.id)) return 0.06
      if (selectedNodeId && connectedIds && !connectedIds.has(node.id)) return 0.12
      return 1
    },
    [visibleIds, selectedNodeId, connectedIds]
  )

  const getEdgeOpacity = useCallback(
    (edge: SimEdge) => {
      const src = typeof edge.source === "object" ? (edge.source as SimNode).id : edge.source
      const tgt = typeof edge.target === "object" ? (edge.target as SimNode).id : edge.target

      if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt))) return 0

      const baseOpacity = 0.05 + (edge.weight / 7) * 0.3
      if (selectedNodeId && connectedIds) {
        if (connectedIds.has(src) && connectedIds.has(tgt)) return Math.min(baseOpacity + 0.25, 0.8)
        return 0.01
      }
      return baseOpacity
    },
    [visibleIds, selectedNodeId, connectedIds]
  )

  const handleTick = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  const { simulationRef } = useForceSimulation({
    nodes: simNodes,
    edges,
    width: dimensions.width,
    height: dimensions.height,
    onTick: handleTick,
  })

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  // Drag behavior
  useEffect(() => {
    const sim = simulationRef.current
    if (!sim || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    const simRef = sim

    function dragStarted(event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>) {
      if (!event.active) simRef.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }
    function dragged(event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }
    function dragEnded(event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>) {
      if (!event.active) simRef.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }

    svg
      .selectAll<SVGCircleElement, SimNode>("circle.node")
      .call(
        d3
          .drag<SVGCircleElement, SimNode>()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
      )
  })

  // Render SVG
  const simEdges = useMemo<SimEdge[]>(
    () => edges.map((e) => ({ ...e })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edges.length]
  )

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {dimensions.width > 0 && (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
          onClick={() => {
            setSelectedNodeId(null)
            onNodeSelect(null)
          }}
        >
          <g className="edges">
            {simEdges.map((edge, i) => {
              const src = edge.source as SimNode
              const tgt = edge.target as SimNode
              if (!src.x || !src.y || !tgt.x || !tgt.y) return null
              return (
                <line
                  key={i}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke="#888"
                  strokeWidth={0.5}
                  strokeOpacity={getEdgeOpacity(edge)}
                />
              )
            })}
          </g>
          <g className="nodes">
            {simNodes.map((node) => {
              const r = 4 + node.aiExposure * 12
              const color = MASCO_GROUPS[node.group]?.color ?? "#888"
              const opacity = getNodeOpacity(node)
              const isSelected = node.id === selectedNodeId
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
                  stroke={isSelected ? "#ffffff" : "#ffffff"}
                  strokeWidth={isSelected ? 2.5 : 0.8}
                  strokeOpacity={opacity}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    const newId = selectedNodeId === node.id ? null : node.id
                    setSelectedNodeId(newId)
                    onNodeSelect(newId)
                  }}
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect()
                    if (!rect) return
                    setTooltip({
                      x: (node.x ?? 0),
                      y: (node.y ?? 0),
                      node,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </g>
        </svg>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none bg-gray-900 text-white text-xs rounded-md px-3 py-2 shadow-lg max-w-[220px]"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            transform:
              tooltip.x > (dimensions.width ?? 0) - 240 ? "translateX(-110%)" : undefined,
          }}
        >
          <p className="font-semibold leading-tight">{tooltip.node.label}</p>
          <p className="text-gray-300 mt-0.5">Code: {tooltip.node.id}</p>
          <p className="text-gray-300">
            AI Exposure:{" "}
            <span className="text-white font-medium">
              {(tooltip.node.aiExposure * 100).toFixed(1)}%
            </span>
          </p>
          <p className="text-gray-300">
            Quartile:{" "}
            <span className="text-white">{tooltip.node.quartile}</span>
          </p>
        </div>
      )}
    </div>
  )
}
