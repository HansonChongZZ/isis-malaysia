"use client"

import { MASCO_GROUPS } from "@/lib/constants"
import { Search, X } from "lucide-react"

interface GraphControlsProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  filterGroup: number | null
  setFilterGroup: (v: number | null) => void
  filterSkill: string
  setFilterSkill: (v: string) => void
  uniqueSkills: string[]
}

export default function GraphControls({
  searchQuery,
  setSearchQuery,
  filterGroup,
  setFilterGroup,
  filterSkill,
  setFilterSkill,
  uniqueSkills,
}: GraphControlsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-card/80 backdrop-blur border-b border-border shrink-0">
      {/* Search — full row on mobile, constrained on desktop */}
      <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
        <input
          type="text"
          placeholder="Search occupation or code…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-input text-foreground text-sm pl-8 pr-8 py-1.5 rounded-md border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter row — wraps below search on mobile */}
      <div className="flex gap-2 flex-1 flex-wrap sm:flex-nowrap items-center min-w-0">
        {/* MASCO Group filter */}
        <select
          value={filterGroup ?? ""}
          onChange={(e) => setFilterGroup(e.target.value ? Number(e.target.value) : null)}
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
        <div className="relative flex-1 sm:w-48 sm:flex-none min-w-0">
          <input
            type="text"
            list="skills-list"
            placeholder="Filter by skill…"
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value)}
            className="w-full bg-input text-foreground text-sm px-3 py-1.5 rounded-md border border-border focus:outline-none focus:border-ring placeholder:text-muted-foreground"
          />
          {filterSkill && (
            <button
              onClick={() => setFilterSkill("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <datalist id="skills-list">
            {uniqueSkills.slice(0, 100).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        {/* Active filters indicator */}
        {(filterGroup !== null || filterSkill) && (
          <button
            onClick={() => {
              setFilterGroup(null)
              setFilterSkill("")
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
