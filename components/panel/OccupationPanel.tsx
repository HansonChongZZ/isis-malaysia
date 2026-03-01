"use client"

import { useMemo, useState, useEffect } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type FilterFn,
} from "@tanstack/react-table"
import { XIcon } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OccupationDetail, GraphNode, GraphEdge } from "@/lib/types"
import { MASCO_GROUPS, QUARTILE_COLORS } from "@/lib/constants"

interface OccupationPanelProps {
  nodeId: string | null
  detail: OccupationDetail | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  onClose: () => void
  onNodeSelect: (id: string) => void
}

type TransitionRow = {
  id: string
  label: string
  weight: number
  aiExposure: number
  quartile: string
  wage: number | null
}

const fuzzyFilter: FilterFn<TransitionRow> = (row, _columnId, filterValue: string) => {
  const q = filterValue.toLowerCase()
  return (
    row.original.label.toLowerCase().includes(q) ||
    row.original.id.toLowerCase().includes(q)
  )
}

const transitionColumns: ColumnDef<TransitionRow>[] = [
  {
    id: "occupation",
    accessorKey: "label",
    header: "Occupation",
    cell: ({ row }) => (
      <div className="whitespace-normal">
        <div className="font-medium text-foreground leading-snug">{row.original.label}</div>
        <div className="text-muted-foreground font-mono text-xs mt-0.5">{row.original.id}</div>
      </div>
    ),
  },
  {
    accessorKey: "weight",
    header: "Skills Match",
    cell: ({ row }) => {
      const { weight, quartile } = row.original
      const color = QUARTILE_COLORS[quartile] ?? "#888"
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: i < weight ? color : "rgba(128,128,128,0.2)" }}
            />
          ))}
          <span className="ml-1 text-muted-foreground text-xs">({weight}/7)</span>
        </div>
      )
    },
  },
  {
    accessorKey: "aiExposure",
    header: "AI Exposure",
    cell: ({ row }) => {
      const { aiExposure, quartile } = row.original
      const color = QUARTILE_COLORS[quartile] ?? "#888"
      return (
        <div className="flex items-center gap-1.5">
          <Badge
            className="text-xs px-1.5 py-0"
            style={{ backgroundColor: color + "33", color, border: `1px solid ${color}66` }}
          >
            {quartile}
          </Badge>
          <span className="text-muted-foreground text-xs">{(aiExposure * 100).toFixed(1)}%</span>
        </div>
      )
    },
  },
  {
    accessorKey: "wage",
    header: () => <div className="text-right">Monthly Wage</div>,
    cell: ({ row }) => (
      <div className="text-right">
        {row.original.wage !== null
          ? `MYR ${row.original.wage.toLocaleString()}`
          : <span className="text-muted-foreground">—</span>}
      </div>
    ),
  },
]

export default function OccupationPanel({
  nodeId,
  detail,
  nodes,
  edges,
  onClose,
  onNodeSelect,
}: OccupationPanelProps) {
  const group = nodeId ? parseInt(nodeId[0], 10) : null
  const groupInfo = group ? MASCO_GROUPS[group] : null
  const quartileColor = detail ? QUARTILE_COLORS[detail.quartile] ?? "#888" : "#888"

  const transitions = useMemo<TransitionRow[]>(() => {
    if (!nodeId || !nodes.length || !edges.length) return []
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const seen = new Set<string>()
    const rows: TransitionRow[] = []

    for (const e of edges) {
      const otherId =
        e.source === nodeId ? e.target : e.target === nodeId ? e.source : null
      if (!otherId || seen.has(otherId)) continue
      seen.add(otherId)
      const node = nodeMap.get(otherId)
      if (!node) continue
      rows.push({
        id: otherId,
        label: node.label,
        weight: e.weight,
        aiExposure: node.aiExposure,
        quartile: node.quartile,
        wage: node.wage,
      })
    }

    rows.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight
      if (a.aiExposure !== b.aiExposure) return a.aiExposure - b.aiExposure
      return (b.wage ?? -Infinity) - (a.wage ?? -Infinity)
    })
    return rows
  }, [nodeId, nodes, edges])

  const [filterQuery, setFilterQuery] = useState("")

  useEffect(() => { setFilterQuery("") }, [nodeId])

  const table = useReactTable({
    data: transitions,
    columns: transitionColumns,
    globalFilterFn: fuzzyFilter,
    state: { globalFilter: filterQuery },
    onGlobalFilterChange: setFilterQuery,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <Dialog open={!!nodeId && !!detail} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-6xl max-h-[90vh] overflow-hidden p-0 flex flex-col" showCloseButton={false}>
        {detail && nodeId && (
          <>
            {/* Full-width sticky header */}
            <DialogHeader className="p-5 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {groupInfo && (
                      <span
                        className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: groupInfo.color }}
                      />
                    )}
                    <span className="text-xs text-muted-foreground font-mono">{nodeId}</span>
                    {groupInfo && (
                      <span className="text-xs text-muted-foreground">· {groupInfo.label}</span>
                    )}
                  </div>
                  <DialogTitle className="text-foreground text-lg leading-tight font-semibold">
                    {detail.occupation}
                  </DialogTitle>
                </div>
                <DialogClose className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mt-0.5">
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </DialogHeader>

            {/* Two-column body */}
            <div className="flex flex-1 min-h-0">
              {/* Left column — occupation details */}
              <div className="w-2/5 overflow-y-auto p-5 space-y-6 border-r border-border">
                {/* AI Exposure */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    AI Exposure Index
                  </h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold" style={{ color: quartileColor }}>
                        {(detail.aiExposure * 100).toFixed(1)}%
                      </span>
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: quartileColor + "33",
                          color: quartileColor,
                          border: `1px solid ${quartileColor}66`,
                        }}
                      >
                        {detail.quartile}
                      </Badge>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${detail.aiExposure * 100}%`,
                          backgroundColor: quartileColor,
                        }}
                      />
                    </div>
                  </div>
                </section>

                {/* Wage */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Monthly Wage
                  </h3>
                  {detail.wage !== null ? (
                    <p className="text-lg font-semibold text-foreground">
                      MYR {detail.wage.toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Data not available</p>
                  )}
                </section>

                {/* Basic Skills */}
                {detail.basicSkills.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Basic Skills
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.basicSkills.map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-xs bg-secondary text-secondary-foreground border-border"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {/* Specific Skills */}
                {detail.specificSkills.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Specific Skills
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.specificSkills.map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-xs bg-accent text-accent-foreground border-border"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {/* Tasks */}
                {detail.tasks.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Tasks ({detail.tasks.length})
                    </h3>
                    <Accordion type="multiple" className="space-y-1">
                      {detail.tasks.map((task, i) => (
                        <AccordionItem
                          key={i}
                          value={`task-${i}`}
                          className="border border-border rounded-md overflow-hidden"
                        >
                          <AccordionTrigger className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:no-underline text-left leading-snug data-[state=open]:text-foreground">
                            <span className="pr-2 line-clamp-2">{task.description}</span>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-2 pt-0">
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">AI Score:</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full">
                                <div
                                  className="h-full rounded-full bg-orange-400"
                                  style={{ width: `${task.score * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-orange-300 font-mono">
                                {(task.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </section>
                )}
              </div>

              {/* Right column — transition pathways */}
              <div className="w-3/5 flex flex-col min-h-0 overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex-shrink-0 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Transition Pathways (
                    {filterQuery
                      ? `${table.getFilteredRowModel().rows.length} of ${transitions.length}`
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

                <div className="flex-1 min-h-0 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      {table.getHeaderGroups().map((hg) => (
                        <TableRow key={hg.id} className="border-b border-border hover:bg-transparent">
                          {hg.headers.map((h) => (
                            <TableHead key={h.id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider first:pl-5 last:pr-5">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer hover:bg-muted/50 border-b border-border"
                            onClick={() => onNodeSelect(row.original.id)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id} className="first:pl-5 last:pr-5">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            {filterQuery ? "No occupations match your search." : "No connected occupations found."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination controls */}
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
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>
                        {(() => {
                          const { pageIndex, pageSize } = table.getState().pagination
                          const total = table.getFilteredRowModel().rows.length
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
