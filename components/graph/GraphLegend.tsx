import { MASCO_GROUPS } from "@/lib/constants"

interface GraphLegendProps {
  activeGroup: number | null
  onGroupClick: (group: number | null) => void
}

export default function GraphLegend({ activeGroup, onGroupClick }: GraphLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 bg-gray-900/80 border-t border-gray-700/60 flex-shrink-0">
      {Object.entries(MASCO_GROUPS).map(([g, { label, color }]) => {
        const group = Number(g)
        const isActive = activeGroup === null || activeGroup === group
        return (
          <button
            key={g}
            onClick={() => onGroupClick(activeGroup === group ? null : group)}
            className="flex items-center gap-1.5 text-xs transition-opacity"
            style={{ opacity: isActive ? 1 : 0.4 }}
          >
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-300 whitespace-nowrap">{label}</span>
          </button>
        )
      })}
      <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">
        Node size = AI exposure
      </span>
    </div>
  )
}
