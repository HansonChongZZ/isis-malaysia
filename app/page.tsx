"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import { loadNodes, loadEdges, loadOccupations } from "@/lib/data"
import type { GraphNode, GraphEdge, OccupationDetail, NodeSizeMetric } from "@/lib/types"
import GraphControls from "@/components/graph/GraphControls"
import OccupationSearch from '@/components/graph/OccupationSearch'
import GraphLegend from "@/components/graph/GraphLegend"
import OccupationPanel from "@/components/panel/OccupationPanel"
import LayoutTuner from "@/components/graph/LayoutTuner"
import type { LayoutTuning } from "@/hooks/useForceSimulation"

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
  const [heroDismissed, setHeroDismissed] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [secondSelectedNodeId, setSecondSelectedNodeId] = useState<string | null>(null)
  const [panelNodeId, setPanelNodeId] = useState<string | null>(null)
  const [filterGroup, setFilterGroup] = useState<number | null>(null)
  const [filterSkills, setFilterSkills] = useState<string[]>([])
  const [sizeMetric, setSizeMetric] = useState<'aiExposure' | 'wage'>('aiExposure')
  const [sizeThreshold, setSizeThreshold] = useState(0)
  const [nodeSizeMetric, setNodeSizeMetric] = useState<NodeSizeMetric>('aiExposure')
  const [tuningEnabled, setTuningEnabled] = useState(true)
  const [tuning, setTuning] = useState<LayoutTuning>({
    intraStrength: 0.8,
    interStrength: 0.001,
    charge: -50,
  })
  const exportLayoutRef = useRef<(() => void) | null>(null)

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

  const firstNodeNeighbors = useMemo<Set<string>>(() => {
    if (!selectedNodeId) return new Set()
    const set = new Set<string>()
    for (const e of edges) {
      if (e.source === selectedNodeId) set.add(e.target)
      if (e.target === selectedNodeId) set.add(e.source)
    }
    return set
  }, [selectedNodeId, edges])

  // Unique sorted skills list for autocomplete
  const uniqueSkills = useMemo<string[]>(() => {
    const all = new Set<string>()
    for (const occ of Object.values(occupations)) {
      occ.basicSkills.forEach((s) => all.add(s))
      occ.specificSkills.forEach((s) => all.add(s))
    }
    return [...all].sort()
  }, [occupations])

  // Max wage for threshold slider range
  const maxWage = useMemo(() => {
    let max = 0
    for (const n of nodes) {
      if (n.wage !== null && n.wage > max) max = n.wage
    }
    return max
  }, [nodes])

  // Max workers for node sizing
  const maxWorkers = useMemo(() => {
    let max = 0
    for (const n of nodes) {
      if (n.workers !== null && n.workers > max) max = n.workers
    }
    return max
  }, [nodes])

  // Occupation list for combobox (sorted by label, filtered by active MASCO group)
  const occupationList = useMemo<{ id: string; label: string }[]>(() => {
    const filtered = filterGroup !== null
      ? nodes.filter((n) => n.group === filterGroup)
      : nodes
    return filtered
      .map((n) => ({ id: n.id, label: n.label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [nodes, filterGroup])

  const panelDetail = panelNodeId ? occupations[panelNodeId] ?? null : null

  const handleNodeSelect = (id: string | null) => {
    if (id === null) {
      // Click background or deselect
      setSelectedNodeId(null)
      setSecondSelectedNodeId(null)
      setPanelNodeId(null)
      setIsPanelOpen(false)
      return
    }

    if (secondSelectedNodeId) {
      // In pair mode
      if (id === selectedNodeId || id === secondSelectedNodeId) {
        // Click either selected node → open panel
        setPanelNodeId(id)
        setIsPanelOpen(true)
      } else {
        // Click third node → reset to single
        setSelectedNodeId(id)
        setSecondSelectedNodeId(null)
        setPanelNodeId(null)
        setIsPanelOpen(false)
      }
      return
    }

    if (selectedNodeId) {
      // In single mode
      if (id === selectedNodeId) {
        // Click same node → open panel
        setPanelNodeId(id)
        setIsPanelOpen(true)
      } else if (firstNodeNeighbors.has(id)) {
        // Click connected neighbor → pair mode
        setSecondSelectedNodeId(id)
      } else {
        // Click unconnected node → new single selection
        setSelectedNodeId(id)
        setSecondSelectedNodeId(null)
      }
      return
    }

    // No selection → first click
    setSelectedNodeId(id)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null)
        setSecondSelectedNodeId(null)
        setPanelNodeId(null)
        setIsPanelOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSizeMetricChange = (metric: 'aiExposure' | 'wage') => {
    setSizeMetric(metric)
    setSizeThreshold(0)
  }

  const handleNodeSizeMetricChange = (metric: NodeSizeMetric) => {
    setNodeSizeMetric(metric)
  }

  const handleResetSettings = () => {
    setSizeThreshold(0)
    setNodeSizeMetric('aiExposure')
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background text-foreground overflow-hidden">
      {/* Graph controls */}
      <GraphControls
        occupations={occupationList}
        selectedOccupation={selectedNodeId}
        onOccupationSelect={handleNodeSelect}
        filterGroup={filterGroup}
        setFilterGroup={setFilterGroup}
        filterSkills={filterSkills}
        setFilterSkills={setFilterSkills}
        uniqueSkills={uniqueSkills}
        sizeMetric={sizeMetric}
        onSizeMetricChange={handleSizeMetricChange}
        sizeThreshold={sizeThreshold}
        onSizeThresholdChange={setSizeThreshold}
        maxWage={maxWage}
        nodeSizeMetric={nodeSizeMetric}
        onNodeSizeMetricChange={handleNodeSizeMetricChange}
        maxWorkers={maxWorkers}
        onResetSettings={handleResetSettings}
        hideSearchOnDesktop={!selectedNodeId}
        onShowHeroSearch={heroDismissed ? () => setHeroDismissed(false) : undefined}
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
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNodeId}
            secondSelectedNodeId={secondSelectedNodeId}
            occupations={occupations}
            filterGroup={filterGroup}
            filterSkills={filterSkills}
            allSkills={allSkills}
            sizeMetric={sizeMetric}
            sizeThreshold={sizeThreshold}
            nodeSizeMetric={nodeSizeMetric}
            maxWage={maxWage}
            maxWorkers={maxWorkers}
            tuning={tuningEnabled ? tuning : null}
            exportRef={exportLayoutRef}
          />
        )}

        {/* Hero search bar — floating over graph when no occupation selected (desktop only) */}
        {!selectedNodeId && !heroDismissed && (
          <div className="hidden sm:flex absolute inset-x-0 top-[20%] z-10 justify-center px-4 pointer-events-none">
            <div className="w-full max-w-xl pointer-events-auto hero-search-enter">
              <OccupationSearch
                occupations={occupationList}
                selectedOccupation={selectedNodeId}
                onOccupationSelect={handleNodeSelect}
                onDismiss={() => setHeroDismissed(true)}
                hero
              />
            </div>
          </div>
        )}

        {/* Layout tuner (temporary) */}
        <LayoutTuner
          tuning={tuning}
          onChange={setTuning}
          enabled={tuningEnabled}
          onToggle={setTuningEnabled}
          onExport={() => exportLayoutRef.current?.()}
        />

        {/* Node count badge */}
        {!loading && !error && (
          <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/70 px-2 py-1 rounded">
            {nodes.length} occupations · {edges.length} skill edges
          </div>
        )}
      </div>

      {/* Legend */}
      <GraphLegend activeGroup={filterGroup} onGroupClick={setFilterGroup} nodeSizeMetric={nodeSizeMetric} />

      {/* Side panel */}
      <OccupationPanel
        nodeId={panelNodeId}
        detail={panelDetail}
        nodes={nodes}
        edges={edges}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false)
          setPanelNodeId(null)
        }}
        onNodeSelect={handleNodeSelect}
      />
    </div>
  )
}
