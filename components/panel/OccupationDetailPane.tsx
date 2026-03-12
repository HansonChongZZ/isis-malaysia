"use client"

import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { OccupationDetail } from "@/lib/types"
import { QUARTILE_COLORS } from "@/lib/constants"

interface OccupationDetailPaneProps {
  detail: OccupationDetail
  sharedSkills?: Set<string>
  comparisonDeltas?: {
    aiExposure: number
    wage: number | null
  }
  skillsMatchWeight?: number
  header?: React.ReactNode
}

function SkillBadge({
  skill,
  variant,
  isShared,
}: {
  skill: string
  variant: "basic" | "specific"
  isShared: boolean
}) {
  if (isShared) {
    return (
      <Badge
        variant="secondary"
        className="text-xs"
        style={{
          backgroundColor: "rgba(59,130,246,0.15)",
          color: "#60a5fa",
          border: "1px solid rgba(59,130,246,0.3)",
        }}
      >
        {skill} ✓
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className={
        variant === "basic"
          ? "text-xs bg-secondary text-secondary-foreground border-border"
          : "text-xs bg-accent text-accent-foreground border-border"
      }
    >
      {skill}
    </Badge>
  )
}

export default function OccupationDetailPane({
  detail,
  sharedSkills,
  comparisonDeltas,
  skillsMatchWeight,
  header,
}: OccupationDetailPaneProps) {
  const quartileColor = QUARTILE_COLORS[detail.quartile] ?? "#888"

  return (
    <div className="h-full overflow-y-auto px-5 pb-5 pt-3 space-y-6">
      {/* Optional header slot (used by comparison pane for back button + name) */}
      {header}

      {/* Skills match indicator (comparison pane only) */}
      {skillsMatchWeight != null && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Skills match:</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    i < skillsMatchWeight
                      ? "var(--primary)"
                      : "rgba(128,128,128,0.2)",
                }}
              />
            ))}
            <span className="ml-1 text-muted-foreground text-xs">
              {Math.round((skillsMatchWeight / 7) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* AI Exposure */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          AI Exposure Index
        </h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold"
                style={{ color: quartileColor }}
              >
                {(detail.aiExposure * 100).toFixed(1)}%
              </span>
              {comparisonDeltas && (
                <span
                  className="text-xs font-medium"
                  style={{
                    color:
                      comparisonDeltas.aiExposure < 0 ? "#22c55e" : "#ef4444",
                  }}
                >
                  {comparisonDeltas.aiExposure < 0 ? "▼" : "▲"}{" "}
                  {Math.abs(comparisonDeltas.aiExposure * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <Badge
              className="text-xs"
              style={{
                backgroundColor: `color-mix(in srgb, ${quartileColor} 20%, transparent)`,
                color: quartileColor,
                border: `1px solid color-mix(in srgb, ${quartileColor} 40%, transparent)`,
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
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-foreground">
              MYR {detail.wage.toLocaleString()}
            </p>
            {comparisonDeltas?.wage != null && (
              <span
                className="text-xs font-medium"
                style={{
                  color: comparisonDeltas.wage > 0 ? "#22c55e" : "#ef4444",
                }}
              >
                {comparisonDeltas.wage > 0 ? "▲" : "▼"} MYR{" "}
                {Math.abs(comparisonDeltas.wage).toLocaleString()}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Data not available
          </p>
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
              <SkillBadge
                key={skill}
                skill={skill}
                variant="basic"
                isShared={sharedSkills?.has(skill.toLowerCase()) ?? false}
              />
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
              <SkillBadge
                key={skill}
                skill={skill}
                variant="specific"
                isShared={sharedSkills?.has(skill.toLowerCase()) ?? false}
              />
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
                    <span className="text-xs text-muted-foreground">
                      AI Score:
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${task.score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-primary font-mono">
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
  )
}
