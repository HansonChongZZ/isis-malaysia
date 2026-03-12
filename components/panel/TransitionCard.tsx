"use client"

import { Badge } from "@/components/ui/badge"
import { QUARTILE_COLORS } from "@/lib/constants"

interface TransitionCardProps {
  id: string
  label: string
  weight: number
  aiExposure: number
  quartile: string
  wage: number | null
  sharedSkillsPreview: string[]
  totalSharedSkills: number
  onClick: () => void
}

export default function TransitionCard({
  id,
  label,
  weight,
  aiExposure,
  quartile,
  wage,
  sharedSkillsPreview,
  totalSharedSkills,
  onClick,
}: TransitionCardProps) {
  const color = QUARTILE_COLORS[quartile] ?? "#888"
  const remaining = totalSharedSkills - sharedSkillsPreview.length

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border border-border rounded-lg p-3 hover:border-foreground/30 hover:bg-muted/30 transition-colors cursor-pointer"
    >
      {/* Top row: name + quartile badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground text-sm leading-snug">
            {label}
          </div>
          <div className="text-muted-foreground font-mono text-xs mt-0.5">
            {id}
          </div>
        </div>
        <Badge
          className="text-xs px-1.5 py-0 shrink-0"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
            color,
            border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
          }}
        >
          {quartile}
        </Badge>
      </div>

      {/* Middle row: match dots + wage */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs text-muted-foreground mr-0.5">Match:</span>
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className="inline-block w-[7px] h-[7px] rounded-full"
            style={{
              backgroundColor:
                i < weight ? "var(--primary)" : "rgba(128,128,128,0.2)",
            }}
          />
        ))}
        <span className="text-muted-foreground text-xs ml-0.5">
          {Math.round((weight / 7) * 100)}%
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {wage !== null
            ? `MYR ${wage.toLocaleString()}`
            : "—"}
        </span>
      </div>

      {/* Bottom row: shared skills preview */}
      {totalSharedSkills > 0 && (
        <div className="flex flex-wrap gap-1">
          {sharedSkillsPreview.map((skill) => (
            <span
              key={skill}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "rgba(59,130,246,0.15)",
                color: "#60a5fa",
                border: "1px solid rgba(59,130,246,0.25)",
              }}
            >
              {skill}
            </span>
          ))}
          {remaining > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              +{remaining} more shared
            </span>
          )}
        </div>
      )}
    </button>
  )
}
