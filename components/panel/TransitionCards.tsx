"use client"

import { useMemo, useState, useEffect } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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

  // Compute shared skills preview per transition row
  const cardPreviews = useMemo(() => {
    const map = new Map<string, { preview: string[]; total: number }>()
    for (const t of transitions) {
      const occ = occupations[t.id]
      if (!occ) {
        map.set(t.id, { preview: [], total: 0 })
        continue
      }
      const skills = [...occ.basicSkills, ...occ.specificSkills]
      const shared = skills.filter((s) =>
        primarySkills.has(s.toLowerCase())
      )
      map.set(t.id, {
        preview: shared.slice(0, 3),
        total: shared.length,
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
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: 10 } },
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
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const t = row.original
            const preview = cardPreviews.get(t.id)
            return (
              <TransitionCard
                key={t.id}
                id={t.id}
                label={t.label}
                weight={t.weight}
                aiExposure={t.aiExposure}
                quartile={t.quartile}
                wage={t.wage}
                sharedSkillsPreview={preview?.preview ?? []}
                totalSharedSkills={preview?.total ?? 0}
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

      {/* Pagination */}
      {transitions.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="bg-background border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>
              {(() => {
                const { pageIndex, pageSize } = table.getState().pagination
                const total = filteredCount
                if (total === 0) return "0 results"
                const from = pageIndex * pageSize + 1
                const to = Math.min((pageIndex + 1) * pageSize, total)
                return `${from}–${to} of ${total}`
              })()}
            </span>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-0.5 rounded border border-border disabled:opacity-30 hover:bg-muted/50 transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2 py-0.5 rounded border border-border disabled:opacity-30 hover:bg-muted/50 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
