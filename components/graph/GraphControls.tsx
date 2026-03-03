'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { MASCO_GROUPS } from '@/lib/constants';
import { Settings2, X } from 'lucide-react';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from '@/components/ui/combobox';

type OccupationOption = { id: string; label: string };

interface GraphControlsProps {
  occupations: OccupationOption[];
  selectedOccupation: string | null;
  onOccupationSelect: (id: string | null) => void;
  filterGroup: number | null;
  setFilterGroup: (v: number | null) => void;
  filterSkills: string[];
  setFilterSkills: (v: string[]) => void;
  uniqueSkills: string[];
  sizeMetric: 'aiExposure' | 'wage';
  onSizeMetricChange: (metric: 'aiExposure' | 'wage') => void;
  sizeThreshold: number;
  onSizeThresholdChange: (value: number) => void;
  maxWage: number;
}

export default function GraphControls({
  occupations,
  selectedOccupation,
  onOccupationSelect,
  filterGroup,
  setFilterGroup,
  filterSkills,
  setFilterSkills,
  uniqueSkills,
  sizeMetric,
  onSizeMetricChange,
  sizeThreshold,
  onSizeThresholdChange,
  maxWage,
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

  const selectedOccupationObj = useMemo(() => {
    if (!selectedOccupation) return null;
    return occupations.find((o) => o.id === selectedOccupation) ?? null;
  }, [occupations, selectedOccupation]);

  const sortedSkills = useMemo(() => {
    const selectedSet = new Set(filterSkills);
    const selected = filterSkills.slice();
    const unselected = uniqueSkills.filter((s) => !selectedSet.has(s));
    return [...selected, ...unselected];
  }, [uniqueSkills, filterSkills]);

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-card/80 backdrop-blur border-b border-border shrink-0">
      {/* Occupation search — full row on mobile, constrained on desktop */}
      <div className="flex-1 min-w-0 w-full sm:w-auto sm:max-w-sm">
        <Combobox
          items={occupations}
          itemToStringValue={(occ) => occ.label}
          value={selectedOccupationObj}
          onValueChange={(occ) => onOccupationSelect(occ?.id ?? null)}
        >
          <ComboboxInput
            placeholder="Search occupation…"
            showClear={!!selectedOccupation}
            className="w-full"
          />
          <ComboboxContent>
            <ComboboxEmpty>No occupations found.</ComboboxEmpty>
            <ComboboxList>
              {(occ) => (
                <ComboboxItem key={occ.id} value={occ}>
                  <span>{occ.label}</span>
                  <span className="text-muted-foreground text-xs ml-1">
                    {occ.id}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {/* Filter row — wraps below search on mobile */}
      <div className="flex gap-2 flex-1 flex-wrap sm:flex-nowrap items-center min-w-0">
        {/* MASCO Group filter */}
        <select
          value={filterGroup ?? ''}
          onChange={(e) =>
            setFilterGroup(e.target.value ? Number(e.target.value) : null)
          }
          className="flex-1 sm:flex-none min-w-0 bg-input text-foreground text-sm px-3 py-1.5 rounded-md border border-border focus:outline-none focus:border-ring cursor-pointer"
        >
          <option value="">All MASCO Groups</option>
          {Object.entries(MASCO_GROUPS).map(([g, { label }]) => (
            <option key={g} value={g}>
              {g} — {label}
            </option>
          ))}
        </select>

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
        {(filterGroup !== null || filterSkills.length > 0) && (
          <button
            onClick={() => {
              setFilterGroup(null);
              setFilterSkills([]);
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}

        {/* Visualization Settings */}
        <div className="relative ml-auto shrink-0" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Visualization settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="text-sm font-semibold">Visualization Settings</span>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Node Size section */}
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Node Size</p>

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
                {sizeThreshold > 0 && (
                  <button
                    onClick={() => onSizeThresholdChange(0)}
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
