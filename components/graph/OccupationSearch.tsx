'use client';

import { useMemo } from 'react';
import { Search } from 'lucide-react';
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
}

export default function OccupationSearch({
  occupations,
  selectedOccupation,
  onOccupationSelect,
  hero = false,
}: OccupationSearchProps) {
  const selectedOccupationObj = useMemo(() => {
    if (!selectedOccupation) return null;
    return occupations.find((o) => o.id === selectedOccupation) ?? null;
  }, [occupations, selectedOccupation]);

  if (hero) {
    return (
      <div className="search-hero-border rounded-xl shadow-lg shadow-primary/10 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
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
            className="w-full h-12 text-base rounded-xl bg-card/90 backdrop-blur-md border-transparent [&_input]:pl-10"
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
