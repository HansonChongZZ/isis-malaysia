'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import type { NodeSizeMetric, ViewMode } from '@/lib/types';
import { Search, Settings2, X } from 'lucide-react';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from '@/components/ui/combobox';
import OccupationSearch from '@/components/graph/OccupationSearch';
import { cn } from '@/lib/utils';

type OccupationOption = { id: string; label: string };

interface GraphControlsProps {
  occupations: OccupationOption[];
  selectedOccupation: string | null;
  onOccupationSelect: (id: string | null) => void;
  filterSkills: string[];
  setFilterSkills: (v: string[]) => void;
  uniqueSkills: string[];
  sizeMetric: 'aiExposure' | 'wage';
  onSizeMetricChange: (metric: 'aiExposure' | 'wage') => void;
  sizeThreshold: number;
  onSizeThresholdChange: (value: number) => void;
  maxWage: number;
  nodeSizeMetric: NodeSizeMetric;
  onNodeSizeMetricChange: (metric: NodeSizeMetric) => void;
  maxWorkers: number;
  onResetSettings: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hideSearchOnDesktop?: boolean;
  onShowHeroSearch?: () => void;
  colourByGroup: boolean;
  onColourByGroupChange: (value: boolean) => void;
}

export default function GraphControls({
  occupations,
  selectedOccupation,
  onOccupationSelect,
  filterSkills,
  setFilterSkills,
  uniqueSkills,
  sizeMetric,
  onSizeMetricChange,
  sizeThreshold,
  onSizeThresholdChange,
  maxWage,
  nodeSizeMetric,
  onNodeSizeMetricChange,
  maxWorkers,
  onResetSettings,
  viewMode,
  onViewModeChange,
  hideSearchOnDesktop,
  onShowHeroSearch,
  colourByGroup,
  onColourByGroupChange,
}: GraphControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settingsOpen]);

  const sortedSkills = useMemo(() => {
    const selectedSet = new Set(filterSkills);
    const selected = filterSkills.slice();
    const unselected = uniqueSkills.filter((s) => !selectedSet.has(s));
    return [...selected, ...unselected];
  }, [uniqueSkills, filterSkills]);

  return (
    <div className="relative z-20 flex flex-wrap gap-2 px-4 py-2.5 bg-card/60 dark:bg-card/80 backdrop-blur-lg border-b border-border shrink-0">
      {/* Occupation search — full row on mobile, constrained on desktop */}
      <div className={cn(
        "flex-1 min-w-0 w-full sm:w-auto sm:max-w-sm",
        hideSearchOnDesktop && "sm:hidden"
      )}>
        <OccupationSearch
          occupations={occupations}
          selectedOccupation={selectedOccupation}
          onOccupationSelect={onOccupationSelect}
        />
      </div>

      {/* Re-open hero search button — visible on desktop when hero was dismissed */}
      {onShowHeroSearch && !selectedOccupation && (
        <button
          onClick={onShowHeroSearch}
          className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
          aria-label="Open search"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
      )}

      {/* Filter row — wraps below search on mobile */}
      <div className="flex gap-2 flex-1 flex-wrap sm:flex-nowrap items-center min-w-0">
        {/* Skill filter */}
        <div className="min-w-0 w-full sm:w-auto sm:max-w-64">
          <Combobox
            items={sortedSkills}
            multiple
            value={filterSkills}
            onValueChange={setFilterSkills}
          >
            <ComboboxChips
              ref={chipsRef}
              className="min-h-8 text-sm flex-nowrap overflow-hidden"
            >
              <ComboboxValue>
                {filterSkills.slice(0, 2).map((skill) => (
                  <ComboboxChip key={skill}>{skill}</ComboboxChip>
                ))}
                {filterSkills.length > 2 && (
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    +{filterSkills.length - 2} more
                  </span>
                )}
              </ComboboxValue>
              <ComboboxChipsInput
                placeholder={
                  filterSkills.length === 0 ? 'Filter by skill…' : ''
                }
                className="min-w-12"
              />
            </ComboboxChips>
            <ComboboxContent anchor={chipsRef}>
              <ComboboxEmpty>No skills found.</ComboboxEmpty>
              <ComboboxList>
                {(item) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        {/* Active filters indicator */}
        {filterSkills.length > 0 && (
          <button
            onClick={() => {
              setFilterSkills([]);
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}

        {/* Visualisation Settings */}
        <div className="relative ml-auto shrink-0" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Visualisation settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="text-sm font-semibold">Visualisation Settings</span>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Layout Mode section */}
              <div className="px-4 py-3 space-y-3 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Layout</p>
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  <button
                    onClick={() => onViewModeChange('force')}
                    aria-pressed={viewMode === 'force'}
                    className={`flex-1 px-3 py-1.5 transition-colors ${
                      viewMode === 'force'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Force
                  </button>
                  <button
                    onClick={() => onViewModeChange('circular')}
                    aria-pressed={viewMode === 'circular'}
                    className={`flex-1 px-3 py-1.5 transition-colors border-l border-border ${
                      viewMode === 'circular'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Circular
                  </button>
                </div>
              </div>

              {/* Node Size section */}
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Node Size</p>
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  <button
                    onClick={() => onNodeSizeMetricChange('aiExposure')}
                    aria-pressed={nodeSizeMetric === 'aiExposure'}
                    className={`flex-1 px-3 py-1.5 transition-colors ${
                      nodeSizeMetric === 'aiExposure'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    AI Exposure
                  </button>
                  <button
                    onClick={() => onNodeSizeMetricChange('wage')}
                    aria-pressed={nodeSizeMetric === 'wage'}
                    disabled={maxWage === 0}
                    className={`flex-1 px-3 py-1.5 transition-colors border-l border-border ${
                      nodeSizeMetric === 'wage'
                        ? 'bg-primary text-primary-foreground'
                        : maxWage === 0
                          ? 'bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Wages
                  </button>
                  <button
                    onClick={() => onNodeSizeMetricChange('workers')}
                    aria-pressed={nodeSizeMetric === 'workers'}
                    disabled={maxWorkers === 0}
                    className={`flex-1 px-3 py-1.5 transition-colors border-l border-border ${
                      nodeSizeMetric === 'workers'
                        ? 'bg-primary text-primary-foreground'
                        : maxWorkers === 0
                          ? 'bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Workers
                  </button>
                </div>
              </div>

              {/* Colour section */}
              <div className="px-4 py-3 border-b border-border">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={colourByGroup}
                    onChange={(e) => onColourByGroupChange(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Colour by MASCO group</span>
                </label>
              </div>

              {/* Node Filter section */}
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Node Filter</p>

                {/* Metric toggle */}
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  <button
                    onClick={() => onSizeMetricChange('aiExposure')}
                    aria-pressed={sizeMetric === 'aiExposure'}
                    className={`flex-1 px-3 py-1.5 transition-colors ${
                      sizeMetric === 'aiExposure'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    AI Exposure
                  </button>
                  <button
                    onClick={() => onSizeMetricChange('wage')}
                    aria-pressed={sizeMetric === 'wage'}
                    disabled={maxWage === 0}
                    className={`flex-1 px-3 py-1.5 transition-colors ${
                      sizeMetric === 'wage'
                        ? 'bg-primary text-primary-foreground'
                        : maxWage === 0
                          ? 'bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Wages
                  </button>
                </div>

                {/* Threshold slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Threshold</span>
                    <span className="font-medium">
                      {sizeMetric === 'aiExposure'
                        ? `≥ ${sizeThreshold}%`
                        : `≥ RM ${sizeThreshold.toLocaleString()}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={sizeMetric === 'aiExposure' ? 'AI Exposure threshold' : 'Wage threshold'}
                    min={0}
                    max={sizeMetric === 'aiExposure' ? 100 : maxWage}
                    step={sizeMetric === 'aiExposure' ? 1 : 100}
                    value={sizeThreshold}
                    onChange={(e) => onSizeThresholdChange(Number(e.target.value))}
                    className="w-full accent-primary h-1.5 cursor-pointer"
                  />
                </div>

                {/* Reset */}
                {(sizeThreshold > 0 || nodeSizeMetric !== 'aiExposure') && (
                  <button
                    onClick={onResetSettings}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Default Settings
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
