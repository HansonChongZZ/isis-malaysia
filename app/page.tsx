"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import { loadNodes, loadEdges, loadOccupations } from "@/lib/data"
import type { GraphNode, GraphEdge, OccupationDetail, NodeSizeMetric, LayoutMode, ViewMode } from "@/lib/types"
import { buildSpecificSkillsMap } from "@/lib/skills"
import { computeMaxSpanningTree } from "@/lib/mst"
import GraphControls from "@/components/graph/GraphControls"
import OccupationSearch from '@/components/graph/OccupationSearch'
import OccupationPanel from "@/components/panel/OccupationPanel"
import TutorialOverlay from '@/components/tutorial/TutorialOverlay'
import { useTutorial, type OccupationGraphHandle } from '@/components/tutorial/useTutorial'
import { TUTORIAL_STEPS } from '@/components/tutorial/tutorialConfig'

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
  const [filterSkills, setFilterSkills] = useState<string[]>([])
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('ring')
  const [viewMode, setViewMode] = useState<ViewMode>('force')
  const [colourByGroup, setColourByGroup] = useState(false)
  const heroSearchRef = useRef<HTMLDivElement>(null)
  const pendingFocusRef = useRef(false)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const graphHandleRef = useRef<OccupationGraphHandle | null>(null)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const [graphContainerRect, setGraphContainerRect] = useState<DOMRect | null>(null)
  const [heroSearchRectState, setHeroSearchRectState] = useState<DOMRect | null>(null)

  const tutorial = useTutorial({
    selectedNodeId,
    secondSelectedNodeId,
    hoveredNodeId,
    edges,
    graphContainerRect,
    heroSearchRect: heroSearchRectState,
    graphHandleRef,
  })

  useEffect(() => {
    if (!tutorial.isActive) return
    const measure = () => {
      if (graphContainerRef.current) {
        setGraphContainerRect(graphContainerRef.current.getBoundingClientRect())
      }
      if (heroSearchRef.current) {
        setHeroSearchRectState(heroSearchRef.current.getBoundingClientRect())
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [tutorial.isActive, tutorial.currentStep])

  const handleTutorialSkip = () => {
    tutorial.skip()
    setSelectedNodeId(null)
    setSecondSelectedNodeId(null)
    setPanelNodeId(null)
    setIsPanelOpen(false)
  }

  useEffect(() => {
    if (tutorial.isActive && viewMode !== 'force') {
      setViewMode('force')
      setLayoutMode('ring')
    }
  }, [tutorial.isActive, viewMode])

  // Per-view-mode settings
  type ModeSettings = {
    sizeMetric: 'aiExposure' | 'wage'
    sizeThreshold: number
    nodeSizeMetric: NodeSizeMetric
  }
  const [settingsPerMode, setSettingsPerMode] = useState<Record<ViewMode, ModeSettings>>({
    force: { sizeMetric: 'aiExposure', sizeThreshold: 0, nodeSizeMetric: 'aiExposure' },
    circular: { sizeMetric: 'aiExposure', sizeThreshold: 0, nodeSizeMetric: 'aiExposure' },
  })

  // Active settings derived from current view mode
  const { sizeMetric, sizeThreshold, nodeSizeMetric } = settingsPerMode[viewMode]

  const updateSetting = <K extends keyof ModeSettings>(key: K, value: ModeSettings[K]) => {
    setSettingsPerMode(prev => ({
      ...prev,
      [viewMode]: { ...prev[viewMode], [key]: value },
    }))
  }

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

  const specificSkillsMap = useMemo(
    () => buildSpecificSkillsMap(occupations),
    [occupations],
  )

  const mstEdges = useMemo(() => computeMaxSpanningTree(edges), [edges])

  // Build skills map: nodeId -> Set of all skills
  const allSkills = useMemo<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>()
    for (const [id, occ] of Object.entries(occupations)) {
      const skills = new Set([...occ.basicSkills, ...occ.specificSkills])
      map.set(id, skills)
    }
    return map
  }, [occupations])

  // Nodes that appear in no edge
  const isolateIds = useMemo<Set<string>>(() => {
    const connected = new Set<string>()
    for (const e of edges) {
      connected.add(e.source)
      connected.add(e.target)
    }
    const isolates = new Set<string>()
    for (const n of nodes) {
      if (!connected.has(n.id)) isolates.add(n.id)
    }
    return isolates
  }, [nodes, edges])

  const firstNodeNeighbours = useMemo<Set<string>>(() => {
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

  // Occupation list for combobox (sorted by label)
  const occupationList = useMemo<{ id: string; label: string }[]>(() => {
    return nodes
      .map((n) => ({ id: n.id, label: n.label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [nodes])

  const panelDetail = panelNodeId ? occupations[panelNodeId] ?? null : null

  const handleNodeSelect = (id: string | null) => {
    // Isolated nodes have no neighbours — open detail panel immediately
    if (id && isolateIds.has(id)) {
      setSelectedNodeId(id)
      setSecondSelectedNodeId(null)
      setPanelNodeId(id)
      setIsPanelOpen(true)
      if (viewMode !== 'force') setLayoutMode('radial')
      return
    }

    if (viewMode === 'force') {
      // Force-directed: original click behaviour
      if (id === null) {
        if (secondSelectedNodeId) {
          setSecondSelectedNodeId(null)
          setPanelNodeId(null)
          setIsPanelOpen(false)
        } else {
          setSelectedNodeId(null)
          setSecondSelectedNodeId(null)
          setPanelNodeId(null)
          setIsPanelOpen(false)
        }
        return
      }

      if (secondSelectedNodeId) {
        if (id === selectedNodeId || id === secondSelectedNodeId) {
          setPanelNodeId(id)
          setIsPanelOpen(true)
        } else {
          setSelectedNodeId(id)
          setSecondSelectedNodeId(null)
          setPanelNodeId(null)
          setIsPanelOpen(false)
        }
        return
      }

      if (selectedNodeId) {
        if (id === selectedNodeId) {
          setPanelNodeId(id)
          setIsPanelOpen(true)
        } else if (firstNodeNeighbours.has(id)) {
          setSecondSelectedNodeId(id)
        } else {
          // Clicking outside the node and its neighbours → deselect
          setSelectedNodeId(null)
          setSecondSelectedNodeId(null)
          setPanelNodeId(null)
          setIsPanelOpen(false)
        }
        return
      }

      setSelectedNodeId(id)
      return
    }

    // Circular mode: ring/radial behaviour
    if (id === null) {
      if (secondSelectedNodeId) {
        setSecondSelectedNodeId(null)
        setPanelNodeId(null)
        setIsPanelOpen(false)
      } else if (selectedNodeId) {
        setSelectedNodeId(null)
        setSecondSelectedNodeId(null)
        setPanelNodeId(null)
        setIsPanelOpen(false)
        setLayoutMode('ring')
      }
      return
    }

    if (secondSelectedNodeId) {
      if (id === selectedNodeId || id === secondSelectedNodeId) {
        setPanelNodeId(id)
        setIsPanelOpen(true)
      } else {
        setSelectedNodeId(id)
        setSecondSelectedNodeId(null)
        setPanelNodeId(null)
        setIsPanelOpen(false)
        setLayoutMode('radial')
      }
      return
    }

    if (selectedNodeId) {
      if (id === selectedNodeId) {
        setPanelNodeId(id)
        setIsPanelOpen(true)
      } else if (firstNodeNeighbours.has(id)) {
        setSecondSelectedNodeId(id)
      } else {
        setSelectedNodeId(id)
        setSecondSelectedNodeId(null)
        setLayoutMode('radial')
      }
      return
    }

    setSelectedNodeId(id)
    setLayoutMode('radial')
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPanelOpen) {
        if (secondSelectedNodeId) {
          setSecondSelectedNodeId(null)
          setPanelNodeId(null)
        } else {
          setSelectedNodeId(null)
          setSecondSelectedNodeId(null)
          setPanelNodeId(null)
          if (viewMode === 'circular') setLayoutMode('ring')
        }
      }

      // Ctrl+F / Cmd+F → open and focus hero search
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSelectedNodeId(null)
        setSecondSelectedNodeId(null)
        setPanelNodeId(null)
        setIsPanelOpen(false)
        setHeroDismissed(false)
        if (viewMode === 'circular') setLayoutMode('ring')
        pendingFocusRef.current = true
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPanelOpen, secondSelectedNodeId, viewMode])

  // Focus hero search input after it becomes visible
  useEffect(() => {
    if (!pendingFocusRef.current) return
    pendingFocusRef.current = false
    requestAnimationFrame(() => {
      const input = heroSearchRef.current?.querySelector('input')
      input?.focus()
    })
  })

  const handleSizeMetricChange = (metric: 'aiExposure' | 'wage') => {
    updateSetting('sizeMetric', metric)
    updateSetting('sizeThreshold', 0)
  }

  const handleNodeSizeMetricChange = (metric: NodeSizeMetric) => {
    updateSetting('nodeSizeMetric', metric)
  }

  const handleResetSettings = () => {
    updateSetting('sizeThreshold', 0)
    updateSetting('nodeSizeMetric', 'aiExposure')
  }

  const handleViewModeChange = (mode: ViewMode) => {
    if (tutorial.isActive) return
    setViewMode(mode)
    if (mode === 'circular') {
      // When switching to circular, restore radial if a node is selected
      setLayoutMode(selectedNodeId ? 'radial' : 'ring')
    } else {
      // When switching to force, reset layout so radialPositions clears
      setLayoutMode('ring')
    }
  }

  const handleSearchSelect = (id: string | null) => {
    if (id === null) return;
    // In circular mode with radial active, reset to ring first
    if (viewMode === 'circular' && layoutMode === 'radial') {
      setSelectedNodeId(null);
      setSecondSelectedNodeId(null);
      setPanelNodeId(null);
      setIsPanelOpen(false);
      setLayoutMode('ring');
      // Known fragility: hardcoded delay must match animation duration (600ms).
      setTimeout(() => {
        setSelectedNodeId(id);
        setLayoutMode('radial');
      }, 650);
      return;
    }
    handleNodeSelect(id);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background text-foreground overflow-hidden">
      {/* Graph controls */}
      <GraphControls
        occupations={occupationList}
        selectedOccupation={selectedNodeId}
        onOccupationSelect={handleSearchSelect}
        filterSkills={filterSkills}
        setFilterSkills={setFilterSkills}
        uniqueSkills={uniqueSkills}
        sizeMetric={sizeMetric}
        onSizeMetricChange={handleSizeMetricChange}
        sizeThreshold={sizeThreshold}
        onSizeThresholdChange={(v: number) => updateSetting('sizeThreshold', v)}
        maxWage={maxWage}
        nodeSizeMetric={nodeSizeMetric}
        onNodeSizeMetricChange={handleNodeSizeMetricChange}
        maxWorkers={maxWorkers}
        onResetSettings={handleResetSettings}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        hideSearchOnDesktop={!selectedNodeId}
        onShowHeroSearch={heroDismissed ? () => setHeroDismissed(false) : undefined}
        colourByGroup={colourByGroup}
        onColourByGroupChange={setColourByGroup}
      />

      {/* Main graph area */}
      <div ref={graphContainerRef} className="flex-1 relative min-h-0">
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
            mstEdges={mstEdges}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNodeId}
            secondSelectedNodeId={secondSelectedNodeId}
            occupations={occupations}
            filterSkills={filterSkills}
            allSkills={allSkills}
            sizeMetric={sizeMetric}
            sizeThreshold={sizeThreshold}
            nodeSizeMetric={nodeSizeMetric}
            maxWage={maxWage}
            maxWorkers={maxWorkers}
            viewMode={viewMode}
            layoutMode={layoutMode}
            specificSkillsMap={specificSkillsMap}
            colourByGroup={colourByGroup}
            onNodeHover={setHoveredNodeId}
            onReady={(handle) => { graphHandleRef.current = handle }}
            forceSelectionMode={tutorial.isActive && tutorial.currentStep <= 2 ? 'single' : null}
          />
        )}

        {/* Hero search bar — floating over graph when no occupation selected (desktop only) */}
        {!selectedNodeId && !heroDismissed && (
          <div className="hidden sm:flex absolute inset-x-0 top-[20%] z-10 justify-center px-4 pointer-events-none">
            <div ref={heroSearchRef} className="w-full max-w-xl pointer-events-auto hero-search-enter">
              <OccupationSearch
                occupations={occupationList}
                selectedOccupation={selectedNodeId}
                onOccupationSelect={handleSearchSelect}
                onDismiss={tutorial.isActive && tutorial.currentStep === 1 ? undefined : () => setHeroDismissed(true)}
                hero
              />
            </div>
          </div>
        )}

        {/* Node count badge */}
        {!loading && !error && (
          <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/70 px-2 py-1 rounded">
            {nodes.length} occupations · {edges.length.toLocaleString()} skill edges
          </div>
        )}

        {tutorial.isVisible && tutorial.stepConfig && (
          <TutorialOverlay
            isActive={tutorial.isActive}
            currentStep={tutorial.currentStep}
            totalSteps={TUTORIAL_STEPS.length}
            isConfirming={tutorial.isConfirming}
            prompt={tutorial.stepConfig.prompt}
            spotlight={tutorial.spotlight}
            onAdvance={tutorial.advance}
            onSkip={handleTutorialSkip}
          />
        )}
      </div>

      {/* Side panel */}
      <OccupationPanel
        nodeId={panelNodeId}
        detail={panelDetail}
        nodes={nodes}
        edges={edges}
        occupations={occupations}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false)
          setPanelNodeId(null)
        }}
      />
    </div>
  )
}
