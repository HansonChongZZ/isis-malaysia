'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  loadNodes,
  loadEdges,
  loadOccupations,
  loadBasicSkills,
  loadSpecificSkills,
} from '@/lib/data';
import type {
  GraphNode,
  GraphEdge,
  OccupationDetail,
  NodeSizeMetric,
  LayoutMode,
  ViewMode,
  SkillInfo,
} from '@/lib/types';
import { SkillPopoverProvider } from '@/components/SkillBadgePopover';
import { buildSpecificSkillsMap } from '@/lib/skills';
import { computeMaxSpanningTree } from '@/lib/mst';
import GraphControls from '@/components/graph/GraphControls';
import OccupationSearch, {
  type OccupationSearchHandle,
} from '@/components/graph/OccupationSearch';
import OccupationPanel from '@/components/panel/OccupationPanel';
import TutorialOverlay from '@/components/tutorial/TutorialOverlay';
import TutorialModal from '@/components/tutorial/TutorialModal';
import {
  useTutorial,
  type OccupationGraphHandle,
} from '@/components/tutorial/useTutorial';
import { STEP_REGISTRY, PREVENT_INTERACT_STEPS } from '@/components/tutorial/tutorialConfig';
import { useIsMobile } from '@/hooks/useIsMobile';
import ThemeToggle from '@/components/ThemeToggle';
import { Settings2 } from 'lucide-react';

// Dynamic import to avoid SSR issues with D3 and ResizeObserver
const OccupationGraph = dynamic(
  () => import('@/components/graph/OccupationGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading graph…
      </div>
    ),
  },
);

export default function HomePage() {
  const isMobile = useIsMobile();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [occupations, setOccupations] = useState<
    Record<string, OccupationDetail>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [secondSelectedNodeId, setSecondSelectedNodeId] = useState<
    string | null
  >(null);
  const [panelNodeId, setPanelNodeId] = useState<string | null>(null);
  const [openedViaSecondary, setOpenedViaSecondary] = useState(false);
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('ring');
  const [viewMode, setViewMode] = useState<ViewMode>('force');
  const [colourByGroup, setColourByGroup] = useState(false);
  const heroSearchRef = useRef<HTMLDivElement>(null);
  const occupationSearchRef = useRef<OccupationSearchHandle>(null);
  const pendingFocusRef = useRef(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const graphHandleRef = useRef<OccupationGraphHandle | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphContainerRect, setGraphContainerRect] = useState<DOMRect | null>(
    null,
  );
  const [heroSearchRectState, setHeroSearchRectState] =
    useState<DOMRect | null>(null);
  const [badgePos, setBadgePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [badgeInteracted, setBadgeInteracted] = useState(false);
  const [zoomTick, setZoomTick] = useState(0);
  const [tutorialPhase, setTutorialPhase] = useState<
    'modal' | 'spotlight' | 'done'
  >('modal');
  const [isComparing, setIsComparing] = useState(false);
  const [cardClicked, setCardClicked] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [attributionHover, setAttributionHover] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const attributionRef = useRef<HTMLDivElement>(null);
  const [basicSkills, setBasicSkills] = useState<Record<string, SkillInfo>>({});
  const [specificSkills, setSpecificSkills] = useState<
    Record<string, SkillInfo>
  >({});

  const showTutorial = !isMobile;

  const handleTutorialComplete = useCallback(() => {
    setTutorialPhase('done');
    setSelectedNodeId(null);
    setSecondSelectedNodeId(null);
    setPanelNodeId(null);
    setIsPanelOpen(false);
    setOpenedViaSecondary(false);
    setIsComparing(false);
    setCardClicked(false);
    setViewMode('force');
    setLayoutMode('ring');
  }, []);

  const tutorial = useTutorial({
    startActive: showTutorial && tutorialPhase === 'spotlight',
    selectedNodeId,
    secondSelectedNodeId,
    hoveredNodeId,
    edges,
    graphContainerRect,
    heroSearchRect: heroSearchRectState,
    graphHandleRef,
    badgePos,
    badgeInteracted,
    isPanelOpen,
    isComparing,
    cardClicked,
    zoomTick,
    onComplete: handleTutorialComplete,
  });

  // Open search dropdown when spotlight starts at the search step
  useEffect(() => {
    if (!attributionOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        attributionRef.current &&
        !attributionRef.current.contains(e.target as Node)
      ) {
        setAttributionOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [attributionOpen]);

  useEffect(() => {
    if (
      tutorialPhase === 'spotlight' &&
      tutorial.isActive &&
      tutorial.stepConfig?.id === 'search'
    ) {
      requestAnimationFrame(() => {
        occupationSearchRef.current?.openDropdown();
      });
    }
  }, [tutorialPhase, tutorial.isActive, tutorial.stepConfig?.id]);

  useEffect(() => {
    if (tutorialPhase !== 'spotlight' || !tutorial.isActive) return;
    const measure = () => {
      if (graphContainerRef.current) {
        setGraphContainerRect(
          graphContainerRef.current.getBoundingClientRect(),
        );
      }
      if (heroSearchRef.current) {
        setHeroSearchRectState(heroSearchRef.current.getBoundingClientRect());
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tutorialPhase, tutorial.isActive, tutorial.currentStepId]);

  const handleGraphReady = useCallback((handle: OccupationGraphHandle) => {
    graphHandleRef.current = handle;
  }, []);

  const handleTutorialSkip = () => {
    tutorial.skip();
  };

  // Per-view-mode settings
  type ModeSettings = {
    sizeMetric: 'aiExposure' | 'wage';
    sizeThreshold: number;
    nodeSizeMetric: NodeSizeMetric;
  };
  const [settingsPerMode, setSettingsPerMode] = useState<
    Record<ViewMode, ModeSettings>
  >({
    force: {
      sizeMetric: 'aiExposure',
      sizeThreshold: 0,
      nodeSizeMetric: 'aiExposure',
    },
    circular: {
      sizeMetric: 'aiExposure',
      sizeThreshold: 0,
      nodeSizeMetric: 'aiExposure',
    },
  });

  // Active settings derived from current view mode
  const { sizeMetric, sizeThreshold, nodeSizeMetric } =
    settingsPerMode[viewMode];

  const updateSetting = <K extends keyof ModeSettings>(
    key: K,
    value: ModeSettings[K],
  ) => {
    setSettingsPerMode((prev) => ({
      ...prev,
      [viewMode]: { ...prev[viewMode], [key]: value },
    }));
  };

  useEffect(() => {
    Promise.all([
      loadNodes(),
      loadEdges(),
      loadOccupations(),
      loadBasicSkills(),
      loadSpecificSkills(),
    ])
      .then(([n, e, o, bs, ss]) => {
        setNodes(n);
        setEdges(e);
        setOccupations(o);
        setBasicSkills(bs);
        setSpecificSkills(ss);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const specificSkillsMap = useMemo(
    () => buildSpecificSkillsMap(occupations),
    [occupations],
  );

  const mstEdges = useMemo(() => computeMaxSpanningTree(edges), [edges]);

  // Nodes that appear in no edge
  const isolateIds = useMemo<Set<string>>(() => {
    const connected = new Set<string>();
    for (const e of edges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    const isolates = new Set<string>();
    for (const n of nodes) {
      if (!connected.has(n.id)) isolates.add(n.id);
    }
    return isolates;
  }, [nodes, edges]);

  const firstNodeNeighbours = useMemo<Set<string>>(() => {
    if (!selectedNodeId) return new Set();
    const set = new Set<string>();
    for (const e of edges) {
      // Directed: only follow source → target
      if (e.source === selectedNodeId) set.add(e.target);
    }
    return set;
  }, [selectedNodeId, edges]);

  // Unique sorted specific skills list for autocomplete
  const uniqueSkills = useMemo<string[]>(() => {
    const all = new Set<string>();
    for (const occ of Object.values(occupations)) {
      occ.specificSkills.forEach((s) => all.add(s));
    }
    return [...all].sort();
  }, [occupations]);

  // Max wage for threshold slider range
  const maxWage = useMemo(() => {
    let max = 0;
    for (const n of nodes) {
      if (n.wage !== null && n.wage > max) max = n.wage;
    }
    return max;
  }, [nodes]);

  // Max workers for node sizing
  const maxWorkers = useMemo(() => {
    let max = 0;
    for (const n of nodes) {
      if (n.workers !== null && n.workers > max) max = n.workers;
    }
    return max;
  }, [nodes]);

  // Occupation list for combobox (sorted by label)
  const occupationList = useMemo<{ id: string; label: string }[]>(() => {
    return nodes
      .map((n) => ({ id: n.id, label: n.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [nodes]);

  const panelDetail = panelNodeId ? (occupations[panelNodeId] ?? null) : null;

  const handleNodeSelect = (id: string | null) => {
    // Isolated nodes have no neighbours — open detail panel immediately
    if (id && isolateIds.has(id)) {
      setSelectedNodeId(id);
      setSecondSelectedNodeId(null);
      setPanelNodeId(id);
      setIsPanelOpen(true);
      if (viewMode !== 'force') setLayoutMode('radial');
      return;
    }

    if (viewMode === 'force') {
      // Force-directed: original click behaviour
      if (id === null) {
        if (secondSelectedNodeId) {
          setSecondSelectedNodeId(null);
          setPanelNodeId(null);
          setIsPanelOpen(false);
          setOpenedViaSecondary(false);
        } else {
          setSelectedNodeId(null);
          setSecondSelectedNodeId(null);
          setPanelNodeId(null);
          setIsPanelOpen(false);
          setOpenedViaSecondary(false);
        }
        return;
      }

      if (secondSelectedNodeId) {
        if (id === selectedNodeId) {
          setPanelNodeId(id);
          setOpenedViaSecondary(false);
          setIsPanelOpen(true);
        } else if (id === secondSelectedNodeId) {
          setPanelNodeId(selectedNodeId);
          setOpenedViaSecondary(true);
          setIsPanelOpen(true);
        } else {
          setSelectedNodeId(id);
          setSecondSelectedNodeId(null);
          setPanelNodeId(null);
          setOpenedViaSecondary(false);
          setIsPanelOpen(false);
        }
        return;
      }

      if (selectedNodeId) {
        if (id === selectedNodeId) {
          setPanelNodeId(id);
          setIsPanelOpen(true);
        } else if (firstNodeNeighbours.has(id)) {
          setSecondSelectedNodeId(id);
        } else {
          // Clicking outside the node and its neighbours → deselect
          setSelectedNodeId(null);
          setSecondSelectedNodeId(null);
          setPanelNodeId(null);
          setIsPanelOpen(false);
          setOpenedViaSecondary(false);
        }
        return;
      }

      setSelectedNodeId(id);
      return;
    }

    // Circular mode: ring/radial behaviour
    if (id === null) {
      if (secondSelectedNodeId) {
        setSecondSelectedNodeId(null);
        setPanelNodeId(null);
        setIsPanelOpen(false);
        setOpenedViaSecondary(false);
      } else if (selectedNodeId) {
        setSelectedNodeId(null);
        setSecondSelectedNodeId(null);
        setPanelNodeId(null);
        setIsPanelOpen(false);
        setOpenedViaSecondary(false);
        setLayoutMode('ring');
      }
      return;
    }

    if (secondSelectedNodeId) {
      if (id === selectedNodeId) {
        setPanelNodeId(id);
        setOpenedViaSecondary(false);
        setIsPanelOpen(true);
      } else if (id === secondSelectedNodeId) {
        setPanelNodeId(selectedNodeId);
        setOpenedViaSecondary(true);
        setIsPanelOpen(true);
      } else {
        setSelectedNodeId(id);
        setSecondSelectedNodeId(null);
        setPanelNodeId(null);
        setOpenedViaSecondary(false);
        setIsPanelOpen(false);
        setLayoutMode('radial');
      }
      return;
    }

    if (selectedNodeId) {
      if (id === selectedNodeId) {
        setPanelNodeId(id);
        setIsPanelOpen(true);
      } else if (firstNodeNeighbours.has(id)) {
        setSecondSelectedNodeId(id);
      } else {
        setSelectedNodeId(id);
        setSecondSelectedNodeId(null);
        setLayoutMode('radial');
      }
      return;
    }

    setSelectedNodeId(id);
    setLayoutMode('radial');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPanelOpen) {
        if (secondSelectedNodeId) {
          setSecondSelectedNodeId(null);
          setPanelNodeId(null);
        } else {
          setSelectedNodeId(null);
          setSecondSelectedNodeId(null);
          setPanelNodeId(null);
          if (viewMode === 'circular') setLayoutMode('ring');
        }
      }

      // Ctrl+F / Cmd+F → focus hero search (open it first if needed)
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // If hero search is already visible, just focus the input
        const heroInput = heroSearchRef.current?.querySelector('input');
        if (heroInput) {
          heroInput.focus();
          heroInput.select();
          occupationSearchRef.current?.openDropdown();
          return;
        }
        // Otherwise, reset state to show the hero search
        setSelectedNodeId(null);
        setSecondSelectedNodeId(null);
        setPanelNodeId(null);
        setIsPanelOpen(false);
        setOpenedViaSecondary(false);
        setHeroDismissed(false);
        if (viewMode === 'circular') setLayoutMode('ring');
        pendingFocusRef.current = true;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, secondSelectedNodeId, viewMode]);

  // Focus hero search input and open dropdown after it becomes visible
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    requestAnimationFrame(() => {
      const input = heroSearchRef.current?.querySelector('input');
      input?.focus();
      occupationSearchRef.current?.openDropdown();
    });
  });

  const handleSizeMetricChange = (metric: 'aiExposure' | 'wage') => {
    updateSetting('sizeMetric', metric);
    updateSetting('sizeThreshold', 0);
  };

  const handleNodeSizeMetricChange = (metric: NodeSizeMetric) => {
    updateSetting('nodeSizeMetric', metric);
  };

  const handleResetSettings = () => {
    updateSetting('sizeThreshold', 0);
    updateSetting('nodeSizeMetric', 'aiExposure');
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (tutorialPhase === 'spotlight' && tutorial.isActive) return;
    setViewMode(mode);
    if (mode === 'circular') {
      // When switching to circular, restore radial if a node is selected
      setLayoutMode(selectedNodeId ? 'radial' : 'ring');
    } else {
      // When switching to force, reset layout so radialPositions clears
      setLayoutMode('ring');
    }
  };

  const handleSearchSelect = (id: string | null) => {
    if (id === null) return;
    // In circular mode with radial active, reset to ring first
    if (viewMode === 'circular' && layoutMode === 'radial') {
      setSelectedNodeId(null);
      setSecondSelectedNodeId(null);
      setPanelNodeId(null);
      setIsPanelOpen(false);
      setOpenedViaSecondary(false);
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
    <SkillPopoverProvider
      basicSkills={basicSkills}
      specificSkills={specificSkills}
    >
      <div className="flex flex-col flex-1 min-h-0 bg-background text-foreground overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3 bg-card/60 dark:bg-card/80 backdrop-blur-lg border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
              IS
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                Malaysia Occupational Space
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">
                ISIS Malaysia · MASCO Research
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSettingsOpen(o => !o)}
              className="sm:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Visualisation settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <ThemeToggle />
          </div>
        </header>

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
          onSizeThresholdChange={(v: number) =>
            updateSetting('sizeThreshold', v)
          }
          maxWage={maxWage}
          nodeSizeMetric={nodeSizeMetric}
          onNodeSizeMetricChange={handleNodeSizeMetricChange}
          maxWorkers={maxWorkers}
          onResetSettings={handleResetSettings}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          hideSearchOnDesktop={!selectedNodeId}
          onShowHeroSearch={
            heroDismissed ? () => setHeroDismissed(false) : undefined
          }
          colourByGroup={colourByGroup}
          onColourByGroupChange={setColourByGroup}
          onRestartTutorial={
            showTutorial ? () => setTutorialPhase('modal') : undefined
          }
          settingsOpen={settingsOpen}
          onSettingsToggle={() => setSettingsOpen(o => !o)}
          onSettingsClose={() => setSettingsOpen(false)}
        />

        {/* Main graph area */}
        <div ref={graphContainerRef} className="flex-1 relative min-h-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground text-sm">
                  Loading occupational data…
                </p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-destructive/10 border border-destructive rounded-lg p-6 max-w-sm text-center">
                <p className="text-destructive font-semibold mb-1">
                  Failed to load data
                </p>
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
              allSkills={specificSkillsMap}
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
              onReady={handleGraphReady}
              forceSelectionMode={
                tutorialPhase === 'spotlight' &&
                tutorial.isActive &&
                (tutorial.currentStepId === 'search' || tutorial.currentStepId === 'hover')
                  ? 'single'
                  : null
              }
              disableInteraction={false}
              disableClick={false}
              allowedClickNodeIds={null}
              onBadgePosChange={setBadgePos}
              onBadgeInteract={() => setBadgeInteracted(true)}
              onZoomChange={() => setZoomTick(t => t + 1)}
              disableZoom={false}
              simulatedHoverId={tutorial.simulatedHoverId}
            />
          )}

          {/* Hero search bar — floating over graph when no occupation selected (desktop only) */}
          {!selectedNodeId && !heroDismissed && (
            <div className="flex absolute inset-x-0 top-[10%] md:top-[20%] z-10 justify-center px-4 pointer-events-none">
              <div
                ref={heroSearchRef}
                className="w-full max-w-xl pointer-events-auto hero-search-enter"
              >
                <OccupationSearch
                  ref={occupationSearchRef}
                  occupations={occupationList}
                  selectedOccupation={selectedNodeId}
                  onOccupationSelect={handleSearchSelect}
                  onDismiss={
                    tutorialPhase === 'spotlight' &&
                    tutorial.isActive &&
                    tutorial.stepConfig?.id === 'search'
                      ? undefined
                      : () => setHeroDismissed(true)
                  }
                  hero
                  nodes={nodes}
                />
              </div>
            </div>
          )}

          {/* Attribution badge */}
          {!loading && !error && (
            <div
              ref={attributionRef}
              className={`absolute bottom-4 left-4 text-xs text-muted-foreground px-2 py-1 rounded leading-relaxed z-10 cursor-pointer group sm:whitespace-nowrap max-w-[calc(100vw-2rem)] transition-colors duration-200 hover:bg-card/70 ${attributionOpen ? 'bg-card/70' : ''}`}
              role="button"
              tabIndex={0}
              aria-expanded={attributionOpen}
              onClick={() => setAttributionOpen((prev) => !prev)}
              onMouseEnter={() => setAttributionHover(true)}
              onMouseLeave={() => setAttributionHover(false)}
              onFocus={() => setAttributionHover(true)}
              onBlur={() => setAttributionHover(false)}
            >
              <p>© 2026 CERT · ISIS Malaysia</p>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out whitespace-normal max-w-sm"
                style={{
                  maxHeight:
                    attributionOpen || attributionHover ? '12rem' : '0',
                  opacity: attributionOpen || attributionHover ? 1 : 0,
                }}
              >
                <p className="mt-1">
                  Malaysian Network Explorer visualises occupations and maps how
                  they are connected through shared skills. Occupation titles
                  are based on the Malaysian Standard Classification of
                  Occupations (MASCO) 2020 at the 4&#x2011;digit level. This
                  explorer is developed as part of the research project{' '}
                  {'\u201C'}Skill Pathways for Technology-Induced Employment
                  Transitions{'\u201D'}, funded by the Centre for Responsible
                  Technology (CERT). Platform development was supported by
                  Shortcut Asia.
                </p>
              </div>
            </div>
          )}

          {showTutorial && (
            <TutorialModal
              open={tutorialPhase === 'modal'}
              onComplete={() => {
                setTutorialPhase('spotlight');
                setViewMode('force');
                setLayoutMode('ring');
              }}
              onSkip={() => setTutorialPhase('done')}
            />
          )}

          {showTutorial && tutorial.isVisible && tutorial.stepConfig && (
            <TutorialOverlay
              isActive={tutorial.isActive}
              currentStepIndex={tutorial.currentStepIndex}
              totalSteps={tutorial.totalSteps}
              isConfirming={tutorial.isConfirming}
              prompt={tutorial.stepConfig.prompt}
              spotlight={tutorial.spotlight}
              onAdvance={tutorial.advance}
              onSkip={handleTutorialSkip}
              cursorAnimProps={tutorial.cursorAnimProps}
              onCursorArrive={tutorial.onCursorArrive}
              onCursorComplete={tutorial.onCursorComplete}
              isLastStep={tutorial.currentStepIndex === tutorial.totalSteps - 1}
              tooltipPosition={tutorial.tooltipPosition}
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
            setIsPanelOpen(false);
            setPanelNodeId(null);
            setOpenedViaSecondary(false);
            setIsComparing(false);
          }}
          initialComparisonId={openedViaSecondary ? secondSelectedNodeId : null}
          onComparisonChange={setIsComparing}
          onCardClick={() => setCardClicked(true)}
          preventInteractOutside={
            tutorialPhase === 'spotlight' &&
            tutorial.isActive &&
            PREVENT_INTERACT_STEPS.has(tutorial.stepConfig?.id ?? '')
          }
        />
      </div>
    </SkillPopoverProvider>
  );
}
