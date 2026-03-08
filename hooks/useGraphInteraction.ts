"use client"

import { useState, useCallback, useMemo } from "react"
import type { GraphNode, GraphEdge } from "@/lib/types"

interface UseGraphInteractionProps {
  edges: GraphEdge[]
}

export function useGraphInteraction({ edges }: UseGraphInteractionProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [filterGroup, setFilterGroup] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterSkill, setFilterSkill] = useState("")

  // Build adjacency set for the selected node
  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return null
    const set = new Set<string>([selectedNodeId])
    for (const e of edges) {
      const src = typeof e.source === "string" ? e.source : (e.source as GraphNode).id
      const tgt = typeof e.target === "string" ? e.target : (e.target as GraphNode).id
      if (src === selectedNodeId) set.add(tgt)
      if (tgt === selectedNodeId) set.add(src)
    }
    return set
  }, [selectedNodeId, edges])

  const getNodeOpacity = useCallback(
    (node: GraphNode, visibleIds: Set<string> | null) => {
      // If there's a visibility filter (search/group/skill), apply it
      if (visibleIds && !visibleIds.has(node.id)) return 0.08

      // If there's a selected node, dim non-connected nodes
      if (selectedNodeId && connectedIds && !connectedIds.has(node.id)) return 0.15

      return 1
    },
    [selectedNodeId, connectedIds]
  )

  const getEdgeOpacity = useCallback(
    (edge: GraphEdge, visibleIds: Set<string> | null) => {
      const src = typeof edge.source === "string" ? edge.source : (edge.source as GraphNode).id
      const tgt = typeof edge.target === "string" ? edge.target : (edge.target as GraphNode).id

      if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt))) return 0

      const baseOpacity = 0.05 + (edge.weight / 7) * 0.3
      if (selectedNodeId && connectedIds) {
        if (connectedIds.has(src) && connectedIds.has(tgt)) return baseOpacity + 0.3
        return 0.02
      }

      return baseOpacity
    },
    [selectedNodeId, connectedIds]
  )

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))
    },
    []
  )

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  return {
    selectedNodeId,
    hoveredNodeId,
    connectedIds,
    filterGroup,
    setFilterGroup,
    searchQuery,
    setSearchQuery,
    filterSkill,
    setFilterSkill,
    getNodeOpacity,
    getEdgeOpacity,
    handleNodeClick,
    handleNodeHover,
    clearSelection,
  }
}
