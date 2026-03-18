'use client';

import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { OccupationDetail } from '@/lib/types';
import { QUARTILE_COLOURS } from '@/lib/constants';
import SkillBadgePopover from '@/components/SkillBadgePopover';


interface OccupationDetailPaneProps {
  detail: OccupationDetail;
  comparisonDeltas?: {
    aiExposure: number;
    wage: number | null;
  };
  header?: React.ReactNode;
}

export default function OccupationDetailPane({
  detail,
  comparisonDeltas,
  header,
}: OccupationDetailPaneProps) {
  const quartileColour = QUARTILE_COLOURS[detail.quartile] ?? '#888';

  return (
    <div className="md:h-full md:overflow-y-auto px-5 pb-5 pt-3 space-y-6">
      {/* Optional header slot (used by comparison pane for back button + name) */}
      {header}

      {/* Mobile compact summary: AI + Wage side-by-side */}
      <div className="flex md:hidden items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            AI Exposure
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: quartileColour }}>
              {(detail.aiExposure * 100).toFixed(1)}%
            </span>
            <Badge
              className="text-xs"
              style={{
                backgroundColor: `color-mix(in srgb, ${quartileColour} 20%, transparent)`,
                color: quartileColour,
                border: `1px solid color-mix(in srgb, ${quartileColour} 40%, transparent)`,
              }}
            >
              {detail.quartile}
            </Badge>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${detail.aiExposure * 100}%`,
                backgroundColor: quartileColour,
              }}
            />
          </div>
        </div>
        <div className="text-right">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Median Wage
          </h3>
          <p className="text-lg font-semibold text-foreground">
            {detail.wage !== null ? `MYR ${detail.wage.toLocaleString()}` : '—'}
          </p>
        </div>
      </div>

      {/* AI Exposure */}
      <section className="hidden md:block">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          AI Exposure Index
        </h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold"
                style={{ color: quartileColour }}
              >
                {(detail.aiExposure * 100).toFixed(1)}%
              </span>
              {comparisonDeltas && (
                <span
                  className="text-xs font-medium"
                  style={{
                    color:
                      comparisonDeltas.aiExposure < 0 ? '#22c55e' : '#ef4444',
                  }}
                >
                  {comparisonDeltas.aiExposure < 0 ? '▼' : '▲'}{' '}
                  {Math.abs(comparisonDeltas.aiExposure * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <Badge
              className="text-xs"
              style={{
                backgroundColor: `color-mix(in srgb, ${quartileColour} 20%, transparent)`,
                color: quartileColour,
                border: `1px solid color-mix(in srgb, ${quartileColour} 40%, transparent)`,
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
                backgroundColor: quartileColour,
              }}
            />
          </div>
        </div>
      </section>

      {/* Wage */}
      <section className="hidden md:block">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Median Wage
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
                  color: comparisonDeltas.wage > 0 ? '#22c55e' : '#ef4444',
                }}
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
      </section>

      {/* Basic Skills */}
      {detail.basicSkills.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Basic Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.basicSkills.map((skill) => (
              <SkillBadgePopover key={skill} skill={skill} type="basic" />
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
              <SkillBadgePopover key={skill} skill={skill} type="specific" />
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
  );
}
