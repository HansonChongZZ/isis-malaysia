'use client';

import { useRef, useMemo } from 'react';
import { MASCO_GROUPS } from '@/lib/constants';
import { X } from 'lucide-react';
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
}: GraphControlsProps) {
  const chipsRef = useRef<HTMLDivElement>(null);

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
      </div>
    </div>
  );
}
