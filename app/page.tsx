"use client"

import { useEffect, useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { loadNodes, loadEdges, loadOccupations } from "@/lib/data"
import type { GraphNode, GraphEdge, OccupationDetail } from "@/lib/types"
import GraphControls from "@/components/graph/GraphControls"
import GraphLegend from "@/components/graph/GraphLegend"
import OccupationPanel from "@/components/panel/OccupationPanel"

// Dynamic import to avoid SSR issues with D3 and ResizeObserver
const OccupationGraph = dynamic(() => import("@/components/graph/OccupationGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Loading graph…
    </div>
  ),
})

export default function HomePage() {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [occupations, setOccupations] = useState<Record<string, OccupationDetail>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterGroup, setFilterGroup] = useState<number | null>(null)
  const [filterSkills, setFilterSkills] = useState<string[]>([])

  useEffect(() => {
    Promise.all([loadNodes(), loadEdges(), loadOccupations()])
      .then(([n, e, o]) => {
        setNodes(n)
        setEdges(e)
        setOccupations(o)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Build skills map: nodeId -> Set of all skills
  const allSkills = useMemo<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>()
    for (const [id, occ] of Object.entries(occupations)) {
      const skills = new Set([...occ.basicSkills, ...occ.specificSkills])
      map.set(id, skills)
    }
    return map
  }, [occupations])

  // Unique sorted skills list for autocomplete
  const uniqueSkills = useMemo<string[]>(() => {
    const all = new Set<string>()
    for (const occ of Object.values(occupations)) {
      occ.basicSkills.forEach((s) => all.add(s))
      occ.specificSkills.forEach((s) => all.add(s))
    }
    return [...all].sort()
  }, [occupations])

  const selectedDetail = selectedNodeId ? occupations[selectedNodeId] ?? null : null

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background text-foreground overflow-hidden">
      {/* Graph controls */}
      <GraphControls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterGroup={filterGroup}
        setFilterGroup={setFilterGroup}
        filterSkills={filterSkills}
        setFilterSkills={setFilterSkills}
        uniqueSkills={uniqueSkills}
      />

      {/* Main graph area */}
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground text-sm">Loading occupational data…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-destructive/10 border border-destructive rounded-lg p-6 max-w-sm text-center">
              <p className="text-destructive font-semibold mb-1">Failed to load data</p>
              <p className="text-destructive text-sm opacity-80">{error}</p>
            </div>
          </div>
        )}
        {!loading && !error && nodes.length > 0 && (
          <OccupationGraph
            nodes={nodes}
            edges={edges}
            onNodeSelect={setSelectedNodeId}
            filterGroup={filterGroup}
            searchQuery={searchQuery}
            filterSkills={filterSkills}
            allSkills={allSkills}
          />
        )}

        {/* Node count badge */}
        {!loading && !error && (
          <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/70 px-2 py-1 rounded">
            {nodes.length} occupations · {edges.length} skill edges
          </div>
        )}
      </div>

      {/* Legend */}
      <GraphLegend activeGroup={filterGroup} onGroupClick={setFilterGroup} />

      {/* Side panel */}
      <OccupationPanel
        nodeId={selectedNodeId}
        detail={selectedDetail}
        nodes={nodes}
        edges={edges}
        onClose={() => setSelectedNodeId(null)}
        onNodeSelect={setSelectedNodeId}
      />
    </div>
  )
}
