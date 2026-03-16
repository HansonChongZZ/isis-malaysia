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
  side,
  isShared,
}: {
  skill: string;
  side: 'left' | 'right';
  isShared: boolean;
}) {
  // Left pane: all green, no ticks
  if (side === 'left') {
    return (
      <Badge
        variant="secondary"
        className="text-xs"
        style={{
          backgroundColor: 'rgba(34,197,94,0.15)',
          color: '#16a34a',
          border: '1px solid rgba(34,197,94,0.3)',
        }}
      >
        {skill}
      </Badge>
    );
  }

  // Right pane: shared = green + tick, non-shared = blue no tick
  if (isShared) {
    return (
      <Badge
        variant="secondary"
        className="text-xs"
        style={{
          backgroundColor: 'rgba(34,197,94,0.15)',
          color: '#16a34a',
          border: '1px solid rgba(34,197,94,0.3)',
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
        backgroundColor: 'rgba(59,130,246,0.15)',
        color: '#60a5fa',
        border: '1px solid rgba(59,130,246,0.3)',
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Header row */}
      <div className="flex border-b border-border">
        <div className="w-1/2 px-5 py-4">
          <div className="text-xs text-muted-foreground font-mono mb-1">
            {primaryNodeId}
          </div>
          <div className="text-base font-semibold text-foreground leading-snug">
            {primary.occupation}
          </div>
        </div>
        <div className="w-1/2 px-5 py-4 border-l-[3px] border-l-blue-500">
          <div className="flex items-center gap-3 mb-1">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowLeftIcon className="size-3" />
              Back to pathways
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              {comparisonNodeId}
            </span>
          </div>
          <div className="text-base font-semibold text-foreground leading-snug">
            {comparison.occupation}
          </div>
          {(() => {
            const sharedCount = comparison.specificSkills.filter((s) =>
              sharedSkills.has(s.toLowerCase()),
            ).length;
            const developCount = comparison.specificSkills.length - sharedCount;
            const total = comparison.specificSkills.length;
            if (total === 0) return null;
            return (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-muted-foreground">Match:</span>
                <div className="flex flex-wrap gap-[3px] bg-muted rounded px-1.5 py-1">
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
                  {sharedCount} specific skills in common, {developCount}{' '}
                  specific skills to develop
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* AI Exposure row */}
      <div className="flex border-b border-border">
        <div className="w-1/2 px-5 py-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            AI Exposure Index
          </h3>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-2xl font-bold"
              style={{ color: primaryColour }}
            >
              {(primary.aiExposure * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${primary.aiExposure * 100}%`,
                backgroundColor: primaryColour,
              }}
            />
          </div>
        </div>
        <div className="w-1/2 px-5 py-4 border-l-[3px] border-l-blue-500">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            AI Exposure Index
          </h3>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold"
                style={{ color: comparisonColour }}
              >
                {(comparison.aiExposure * 100).toFixed(1)}%
              </span>
              <span className="text-xs font-medium">
                {comparisonDeltas.aiExposure < 0 ? '▼' : '▲'}{' '}
                {Math.abs(comparisonDeltas.aiExposure * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
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
        <div className="w-1/2 px-5 py-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Monthly Wage
          </h3>
          {primary.wage !== null ? (
            <p className="text-lg font-semibold text-foreground">
              MYR {primary.wage.toLocaleString()}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Data not available
            </p>
          )}
        </div>
        <div className="w-1/2 px-5 py-4 border-l-[3px] border-l-blue-500">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Monthly Wage
          </h3>
          {comparison.wage !== null ? (
            <div className="flex items-center gap-2">
              <p
                className="text-lg font-semibold"
                style={{ color: comparisonColour }}
              >
                MYR {comparison.wage.toLocaleString()}
              </p>
              {comparisonDeltas.wage != null && (
                <span
                  className="text-xs font-medium"
                  style={{ color: comparisonColour }}
                >
                  {comparisonDeltas.wage > 0 ? '▲' : '▼'} MYR{' '}
                  {Math.abs(comparisonDeltas.wage).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Data not available
            </p>
          )}
        </div>
      </div>

      {/* Skills legend + Basic Skills row */}
      {(primary.basicSkills.length > 0 ||
        comparison.basicSkills.length > 0) && (
        <div className="flex border-b border-border">
          <div className="w-1/2 px-5 py-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Basic Skills
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {primary.basicSkills.map((skill) => (
                <SkillBadge
                  key={skill}
                  skill={skill}
                  side="left"
                  isShared={false}
                />
              ))}
            </div>
          </div>
          <div className="w-1/2 px-5 py-4 border-l-[3px] border-l-blue-500">
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-border">
              <span className="flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor: 'rgba(34,197,94,0.15)',
                    color: '#16a34a',
                    border: '1px solid rgba(34,197,94,0.3)',
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
                    backgroundColor: 'rgba(59,130,246,0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59,130,246,0.3)',
                  }}
                >
                  &bull;
                </Badge>
                <span className="text-xs text-muted-foreground">
                  To develop
                </span>
              </span>
            </div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Basic Skills
            </h3>
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
                    side="right"
                    isShared={sharedSkills.has(skill.toLowerCase())}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Specific Skills row */}
      {(primary.specificSkills.length > 0 ||
        comparison.specificSkills.length > 0) && (
        <div className="flex border-b border-border">
          <div className="w-1/2 px-5 py-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Specific Skills
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {primary.specificSkills.map((skill) => (
                <SkillBadge
                  key={skill}
                  skill={skill}
                  side="left"
                  isShared={false}
                />
              ))}
            </div>
          </div>
          <div className="w-1/2 px-5 py-4 border-l-[3px] border-l-blue-500">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Specific Skills
            </h3>
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
                    side="right"
                    isShared={sharedSkills.has(skill.toLowerCase())}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Tasks row */}
      {(primary.tasks.length > 0 || comparison.tasks.length > 0) && (
        <div className="flex">
          <div className="w-1/2 px-5 py-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Tasks ({primary.tasks.length})
            </h3>
            <TaskAccordion tasks={primary.tasks} prefix="primary" />
          </div>
          <div className="w-1/2 px-5 py-4 border-l-[3px] border-l-blue-500">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Tasks ({comparison.tasks.length})
            </h3>
            <TaskAccordion tasks={comparison.tasks} prefix="comparison" />
          </div>
        </div>
      )}
    </div>
  );
}
