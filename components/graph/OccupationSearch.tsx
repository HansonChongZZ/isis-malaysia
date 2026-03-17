'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { GraphNode } from '@/lib/types';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

type OccupationOption = { id: string; label: string };

export interface OccupationSearchHandle {
  openDropdown: () => void;
}

interface OccupationSearchProps {
  occupations: OccupationOption[];
  selectedOccupation: string | null;
  onOccupationSelect: (id: string | null) => void;
  hero?: boolean;
  onDismiss?: () => void;
  nodes?: GraphNode[];
}

const OccupationSearch = forwardRef<OccupationSearchHandle, OccupationSearchProps>(function OccupationSearch({
  occupations,
  selectedOccupation,
  onOccupationSelect,
  hero = false,
  onDismiss,
  nodes,
}, ref) {
  const selectedOccupationObj = useMemo(() => {
    if (!selectedOccupation) return null;
    return occupations.find((o) => o.id === selectedOccupation) ?? null;
  }, [occupations, selectedOccupation]);

  const heroRef = useRef<HTMLDivElement>(null);
  const [isMac, setIsMac] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    openDropdown: () => setOpen(true),
  }));

  useEffect(() => {
    setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent));
  }, []);

  const topExposedOccupations = useMemo(() => {
    if (!nodes) return [];
    return nodes
      .filter((n) => n.aiExposure === 1 && n.workers !== null)
      .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0))
      .slice(0, 5);
  }, [nodes]);

  if (hero) {
    return (
      <div ref={heroRef} className="search-hero-border rounded-xl shadow-lg shadow-primary/10 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5">
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-xs font-semibold text-muted-foreground bg-muted/80 border border-border select-none shadow-sm">
            {isMac ? '⌘' : 'Ctrl'}+F
          </kbd>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Dismiss search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Combobox
          items={occupations}
          itemToStringValue={(occ) => occ.label}
          filter={(occ, query) => {
            const q = query.toLowerCase();
            return occ.label.toLowerCase().includes(q) || occ.id.toLowerCase().includes(q);
          }}
          value={selectedOccupationObj}
          onValueChange={(occ) => onOccupationSelect(occ?.id ?? null)}
          onInputValueChange={(value) => setInputValue(value)}
          open={open}
          onOpenChange={setOpen}
        >
          <ComboboxInput
            placeholder="Search any occupation in Malaysia…"
            showTrigger={false}
            showClear={!!selectedOccupation}
            className="w-full h-12 text-base rounded-xl bg-card/50 dark:bg-card/90 backdrop-blur-xl border-transparent [&_input]:pl-10 [&_input]:pr-20"
            onFocus={() => setOpen(true)}
          />
          <ComboboxContent anchor={heroRef} className="rounded-xl bg-card/50 dark:bg-card/90 backdrop-blur-xl">
            {inputValue === '' && topExposedOccupations.length > 0 && (
              <div className="p-1">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Highest impact occupations
                </div>
                {topExposedOccupations.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-sm border-l-3 border-destructive py-1.5 pl-3 pr-2 text-sm hover:bg-destructive/10 transition-colors cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onOccupationSelect(node.id);
                    }}
                  >
                    <div className="text-left">
                      <div>{node.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {node.workers?.toLocaleString()} workers
                      </div>
                    </div>
                    <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                      100%
                    </span>
                  </button>
                ))}
              </div>
            )}
            <ComboboxEmpty>No occupations found.</ComboboxEmpty>
            <ComboboxList>
              {(occ) => (
                <ComboboxItem key={occ.id} value={occ} className="px-3">
                  <span>{occ.label}</span>
                  <span className="text-muted-foreground text-xs ml-auto tabular-nums">
                    {occ.id}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    );
  }

  return (
    <Combobox
      items={occupations}
      itemToStringValue={(occ) => occ.label}
      filter={(occ, query) => {
        const q = query.toLowerCase();
        return occ.label.toLowerCase().includes(q) || occ.id.toLowerCase().includes(q);
      }}
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
  );
});

export default OccupationSearch;
