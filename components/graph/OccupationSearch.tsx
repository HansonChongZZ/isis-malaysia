'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

type OccupationOption = { id: string; label: string };

interface OccupationSearchProps {
  occupations: OccupationOption[];
  selectedOccupation: string | null;
  onOccupationSelect: (id: string | null) => void;
  hero?: boolean;
  onDismiss?: () => void;
}

export default function OccupationSearch({
  occupations,
  selectedOccupation,
  onOccupationSelect,
  hero = false,
  onDismiss,
}: OccupationSearchProps) {
  const selectedOccupationObj = useMemo(() => {
    if (!selectedOccupation) return null;
    return occupations.find((o) => o.id === selectedOccupation) ?? null;
  }, [occupations, selectedOccupation]);

  const heroRef = useRef<HTMLDivElement>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent));
  }, []);

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
          value={selectedOccupationObj}
          onValueChange={(occ) => onOccupationSelect(occ?.id ?? null)}
        >
          <ComboboxInput
            placeholder="Search any occupation in Malaysia…"
            showTrigger={false}
            showClear={!!selectedOccupation}
            className="w-full h-12 text-base rounded-xl bg-card/50 dark:bg-card/90 backdrop-blur-xl border-transparent [&_input]:pl-10 [&_input]:pr-20"
          />
          <ComboboxContent anchor={heroRef} className="rounded-xl bg-card/50 dark:bg-card/90 backdrop-blur-xl">
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
}
