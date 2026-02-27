"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { OccupationDetail } from "@/lib/types"
import { MASCO_GROUPS, QUARTILE_COLORS } from "@/lib/constants"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/lib/utils"

interface OccupationPanelProps {
  nodeId: string | null
  detail: OccupationDetail | null
  onClose: () => void
}

export default function OccupationPanel({ nodeId, detail, onClose }: OccupationPanelProps) {
  const isOpen = !!nodeId && !!detail
  const isMobile = useIsMobile()

  const group = nodeId ? parseInt(nodeId[0], 10) : null
  const groupInfo = group ? MASCO_GROUPS[group] : null
  const quartileColor = detail ? QUARTILE_COLORS[detail.quartile] ?? "#888" : "#888"

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }} modal={false}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "bg-card border-border text-foreground overflow-y-auto p-0",
          isMobile
            ? "h-[75vh] w-full rounded-t-2xl"
            : "w-[400px] max-w-[95vw]"
        )}
      >
        {detail && nodeId && (
          <>
            {/* Header */}
            <SheetHeader className="p-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                {groupInfo && (
                  <span
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: groupInfo.color }}
                  />
                )}
                <span className="text-xs text-muted-foreground font-mono">{nodeId}</span>
                {groupInfo && (
                  <span className="text-xs text-muted-foreground">· {groupInfo.label}</span>
                )}
              </div>
              <SheetTitle className="text-foreground text-lg leading-tight font-semibold">
                {detail.occupation}
              </SheetTitle>
            </SheetHeader>

            <div className="p-5 space-y-6">
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
                      style={{ backgroundColor: quartileColor + "33", color: quartileColor, border: `1px solid ${quartileColor}66` }}
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
                        <AccordionTrigger className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:no-underline text-left leading-snug [&[data-state=open]]:text-foreground">
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
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
