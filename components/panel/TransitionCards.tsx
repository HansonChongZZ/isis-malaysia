"use client"

import { useMemo, useState, useEffect } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  type FilterFn,
} from "@tanstack/react-table"
import type { OccupationDetail } from "@/lib/types"
import TransitionCard from "./TransitionCard"

export type TransitionRow = {
  id: string
  label: string
  weight: number
  aiExposure: number
  quartile: string
  wage: number | null
}

interface TransitionCardsProps {
  transitions: TransitionRow[]
  occupations: Record<string, OccupationDetail>
  primarySkills: Set<string>
  onCardClick: (id: string) => void
}

const fuzzyFilter: FilterFn<TransitionRow> = (
  row,
  _columnId,
  filterValue: string
) => {
  const q = filterValue.toLowerCase()
  return (
    row.original.label.toLowerCase().includes(q) ||
    row.original.id.toLowerCase().includes(q)
  )
}

export default function TransitionCards({
  transitions,
  occupations,
  primarySkills,
  onCardClick,
}: TransitionCardsProps) {
  const [filterQuery, setFilterQuery] = useState("")

  // Reset filter when transitions change (new primary occupation)
  useEffect(() => {
    setFilterQuery("")
  }, [transitions])

  // Compute shared/develop specific skill counts per transition row
  // Compute specific skill preview per transition row, sorted shared-first
  const cardPreviews = useMemo(() => {
    const map = new Map<
      string,
      { preview: string[]; sharedSpecific: number; totalSpecific: number }
    >()
    for (const t of transitions) {
      const occ = occupations[t.id]
      if (!occ) {
        map.set(t.id, { preview: [], sharedSpecific: 0, totalSpecific: 0 })
        continue
      }
      const sharedSpecific = occ.specificSkills.filter((s) =>
        primarySkills.has(s.toLowerCase())
      ).length
      // Sort shared first, then to-develop
      const sorted = [...occ.specificSkills].sort((a, b) => {
        const aShared = primarySkills.has(a.toLowerCase()) ? 0 : 1
        const bShared = primarySkills.has(b.toLowerCase()) ? 0 : 1
        return aShared - bShared
      })
      map.set(t.id, {
        preview: sorted.slice(0, 4),
        sharedSpecific,
        totalSpecific: occ.specificSkills.length,
      })
    }
    return map
  }, [transitions, occupations, primarySkills])

  // Minimal column definition (needed for tanstack table filtering/pagination)
  const columns = useMemo(
    () => [{ accessorKey: "id" as const }],
    []
  )

  const table = useReactTable({
    data: transitions,
    columns,
    globalFilterFn: fuzzyFilter,
    state: { globalFilter: filterQuery },
    onGlobalFilterChange: setFilterQuery,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const filteredCount = table.getFilteredRowModel().rows.length

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Header + search */}
      <div className="px-5 pt-3 pb-3 flex-shrink-0 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Transition Pathways (
          {filterQuery
            ? `${filteredCount} of ${transitions.length}`
            : transitions.length}
          )
        </h3>
        <p className="text-xs text-muted-foreground">
          Sorted by shared skills · AI risk · wage
        </p>
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter by name or code…"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Card grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3 space-y-2">
        {table.getFilteredRowModel().rows.length ? (
          table.getFilteredRowModel().rows.map((row) => {
            const t = row.original
            const preview = cardPreviews.get(t.id)
            return (
              <TransitionCard
                key={t.id}
                id={t.id}
                label={t.label}
                quartile={t.quartile}
                wage={t.wage}
                skillsPreview={preview?.preview ?? []}
                sharedSpecificCount={preview?.sharedSpecific ?? 0}
                totalSpecificCount={preview?.totalSpecific ?? 0}
                primarySkills={primarySkills}
                onClick={() => onCardClick(t.id)}
              />
            )
          })
        ) : (
          <div className="text-center text-muted-foreground py-8 text-sm">
            {filterQuery
              ? "No occupations match your search."
              : "No connected occupations found."}
          </div>
        )}
      </div>

    </div>
  )
}
