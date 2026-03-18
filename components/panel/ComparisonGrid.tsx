'use client';

import { ArrowLeftIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { OccupationDetail } from '@/lib/types';
import { QUARTILE_COLOURS } from '@/lib/constants';
import { formatCompact } from '@/lib/format';

interface ComparisonGridProps {
  primary: OccupationDetail;
  primaryNodeId: string;
  comparison: OccupationDetail;
  comparisonNodeId: string;
  sharedSkills: Set<string>;
  comparisonDeltas: { aiExposure: number; wage: number | null };
  onBack: () => void;
}

function SkillBadge({
  skill,
  isShared,
}: {
  skill: string;
  isShared: boolean;
}) {
  if (isShared) {
    return (
      <Badge
        variant="secondary"
        className="text-xs"
        style={{
          backgroundColor: 'rgba(34,197,94,0.12)',
          color: '#16a34a',
          border: '1px solid rgba(34,197,94,0.25)',
        }}
      >
        {skill} ✓
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="text-xs"
      style={{
        backgroundColor: 'rgba(59,130,246,0.12)',
        color: '#3b82f6',
        border: '1px solid rgba(59,130,246,0.25)',
      }}
    >
      {skill}
    </Badge>
  );
}

function TaskAccordion({
  tasks,
  prefix,
}: {
  tasks: OccupationDetail['tasks'];
  prefix: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <Accordion type="multiple" className="space-y-1">
      {tasks.map((task, i) => (
        <AccordionItem
          key={i}
          value={`${prefix}-task-${i}`}
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
  );
}

export default function ComparisonGrid({
  primary,
  primaryNodeId,
  comparison,
  comparisonNodeId,
  sharedSkills,
  comparisonDeltas,
  onBack,
}: ComparisonGridProps) {
  const primaryColour = QUARTILE_COLOURS[primary.quartile] ?? '#888';
  const comparisonColour = 'var(--primary)';

  const TARGET_TINT = 'rgba(32,77,57,0.015)';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Back to pathways bar — full width */}
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center gap-3 px-5 py-2.5 bg-primary/15 hover:bg-primary/25 border-b border-primary/30 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center justify-center size-7 rounded-md bg-primary/20">
          <ArrowLeftIcon className="size-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold text-primary">Back to pathways</div>
          <div className="text-xs text-primary/60">Return to transition list</div>
        </div>
      </button>

      {/* Occupation names row */}
      <div className="flex border-b border-border" style={{ background: '#fafafa' }}>
        <div className="flex-1 px-3 py-2 md:px-5 md:py-3">
          <div className="text-[10px] text-muted-foreground mb-0.5">Current role</div>
          <div className="text-xs text-muted-foreground font-mono mb-1">
            {primaryNodeId}
          </div>
          <div className="text-[13px] font-semibold text-foreground leading-snug">
            {primary.occupation}
          </div>
        </div>
        <div
          className="flex-1 px-3 py-2 md:px-5 md:py-3 border-l border-border"
          style={{ background: TARGET_TINT }}
        >
          <div className="text-[10px] text-muted-foreground mb-0.5">Target role</div>
          <div className="text-xs text-muted-foreground font-mono mb-1">
            {comparisonNodeId}
          </div>
          <div className="text-[13px] font-semibold leading-snug" style={{ color: comparisonColour }}>
            {comparison.occupation}
          </div>
        </div>
      </div>

      {/* Match dots summary bar — full width */}
      {(() => {
        const sharedCount = comparison.specificSkills.filter((s) =>
          sharedSkills.has(s.toLowerCase()),
        ).length;
        const developCount = comparison.specificSkills.length - sharedCount;
        const total = comparison.specificSkills.length;
        if (total === 0) return null;
        return (
          <div className="px-3 py-2 md:px-5 md:py-3 border-b border-border" style={{ background: 'rgba(106,209,156,0.04)' }}>
            <div className="flex flex-wrap gap-[3px] bg-muted rounded px-1.5 py-1 mb-1.5">
              {[...comparison.specificSkills]
                .sort((a, b) => {
                  const aShared = sharedSkills.has(a.toLowerCase()) ? 0 : 1;
                  const bShared = sharedSkills.has(b.toLowerCase()) ? 0 : 1;
                  return aShared - bShared;
                })
                .map((skill, i) => (
                  <span
                    key={i}
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: sharedSkills.has(skill.toLowerCase())
                        ? '#22c55e'
                        : 'rgba(59,130,246,0.4)',
                    }}
                  />
                ))}
            </div>
            <span className="text-muted-foreground text-xs">
              {sharedCount} shared · {developCount} to develop
            </span>
          </div>
        );
      })()}

      {/* AI Exposure row */}
      <div className="flex border-b border-border">
        <div className="flex-1 px-3 py-2 md:px-5 md:py-3">
          <div className="text-[10px] text-muted-foreground mb-1">AI Exposure</div>
          <div className="text-base font-bold" style={{ color: primaryColour }}>
            {(primary.aiExposure * 100).toFixed(1)}%
          </div>
          <div className="h-[7px] bg-muted rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${primary.aiExposure * 100}%`,
                backgroundColor: primaryColour,
              }}
            />
          </div>
        </div>
        <div
          className="flex-1 px-3 py-2 md:px-5 md:py-3 border-l border-border"
          style={{ background: TARGET_TINT }}
        >
          <div className="text-[10px] text-muted-foreground mb-1">AI Exposure</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold" style={{ color: comparisonColour }}>
              {(comparison.aiExposure * 100).toFixed(1)}%
            </span>
            <span className="text-[11px]" style={{ color: comparisonColour }}>
              {comparisonDeltas.aiExposure < 0 ? '▼' : '▲'}{' '}
              {Math.abs(comparisonDeltas.aiExposure * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-[7px] bg-muted rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${comparison.aiExposure * 100}%`,
                backgroundColor: comparisonColour,
              }}
            />
          </div>
        </div>
      </div>

      {/* Wage row */}
      <div className="flex border-b border-border">
        <div className="flex-1 px-3 py-2 md:px-5 md:py-3">
          <div className="text-[10px] text-muted-foreground mb-1">Median Wage</div>
          {primary.wage !== null ? (
            <div className="text-base font-bold text-foreground">
              MYR {primary.wage.toLocaleString()}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Data not available</div>
          )}
        </div>
        <div
          className="flex-1 px-3 py-2 md:px-5 md:py-3 border-l border-border"
          style={{ background: TARGET_TINT }}
        >
          <div className="text-[10px] text-muted-foreground mb-1">Median Wage</div>
          {comparison.wage !== null ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold" style={{ color: comparisonColour }}>
                MYR {comparison.wage.toLocaleString()}
              </span>
              {comparisonDeltas.wage != null && (
                <span className="text-[11px]" style={{ color: comparisonColour }}>
                  {comparisonDeltas.wage > 0 ? '▲' : '▼'}{' '}
                  {formatCompact(Math.abs(comparisonDeltas.wage))}
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Data not available</div>
          )}
        </div>
      </div>

      {/* Skills section — full width, target occupation's skills */}
      {(comparison.basicSkills.length > 0 ||
        comparison.specificSkills.length > 0) && (
        <div className="px-3 py-2.5 md:px-5 md:py-3.5 border-b border-border">
          <div className="flex items-center gap-3.5 mb-2.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Skills
            </h3>
            <span className="flex items-center gap-1.5 ml-auto">
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: 'rgba(34,197,94,0.12)',
                  color: '#16a34a',
                  border: '1px solid rgba(34,197,94,0.25)',
                }}
              >
                ✓
              </Badge>
              <span className="text-xs text-muted-foreground">Shared</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: 'rgba(59,130,246,0.12)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59,130,246,0.25)',
                }}
              >
                &bull;
              </Badge>
              <span className="text-xs text-muted-foreground">To develop</span>
            </span>
          </div>

          {comparison.basicSkills.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] text-muted-foreground mb-1">Basic</div>
              <div className="flex flex-wrap gap-1.5">
                {[...comparison.basicSkills]
                  .sort((a, b) => {
                    const aShared = sharedSkills.has(a.toLowerCase()) ? 0 : 1;
                    const bShared = sharedSkills.has(b.toLowerCase()) ? 0 : 1;
                    return aShared - bShared;
                  })
                  .map((skill) => (
                    <SkillBadge
                      key={skill}
                      skill={skill}
                      isShared={sharedSkills.has(skill.toLowerCase())}
                    />
                  ))}
              </div>
            </div>
          )}

          {comparison.specificSkills.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Specific</div>
              <div className="flex flex-wrap gap-1.5">
                {[...comparison.specificSkills]
                  .sort((a, b) => {
                    const aShared = sharedSkills.has(a.toLowerCase()) ? 0 : 1;
                    const bShared = sharedSkills.has(b.toLowerCase()) ? 0 : 1;
                    return aShared - bShared;
                  })
                  .map((skill) => (
                    <SkillBadge
                      key={skill}
                      skill={skill}
                      isShared={sharedSkills.has(skill.toLowerCase())}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tasks section — side by side */}
      {(primary.tasks.length > 0 || comparison.tasks.length > 0) && (
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 px-3 py-2.5 md:px-4 md:py-3.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Current Tasks ({primary.tasks.length})
            </h3>
            <TaskAccordion tasks={primary.tasks} prefix="primary" />
          </div>
          <div
            className="flex-1 px-3 py-2.5 md:px-4 md:py-3.5 border-l border-border"
            style={{ background: TARGET_TINT }}
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Target Tasks ({comparison.tasks.length})
            </h3>
            <TaskAccordion tasks={comparison.tasks} prefix="comparison" />
          </div>
        </div>
      )}
    </div>
  );
}
