'use client';

import { Badge } from '@/components/ui/badge';
import { QUARTILE_COLOURS } from '@/lib/constants';

interface TransitionCardProps {
  id: string;
  label: string;
  quartile: string;
  wage: number | null;
  skillsPreview: string[];
  sharedSpecificCount: number;
  totalSpecificCount: number;
  primarySkills: Set<string>;
  onClick: () => void;
}

export default function TransitionCard({
  id,
  label,
  quartile,
  wage,
  skillsPreview,
  sharedSpecificCount,
  totalSpecificCount,
  primarySkills,
  onClick,
}: TransitionCardProps) {
  const color = QUARTILE_COLOURS[quartile] ?? '#888';
  const remaining = totalSpecificCount - skillsPreview.length;

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
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">
              Match:
            </span>
            <div className="flex flex-wrap gap-[3px] bg-muted rounded px-1.5 py-1">
              {Array.from({ length: sharedSpecificCount }, (_, i) => (
                <span
                  key={`s-${i}`}
                  className="inline-block w-[7px] h-[7px] rounded-full"
                  style={{ backgroundColor: '#22c55e' }}
                />
              ))}
              {Array.from(
                { length: totalSpecificCount - sharedSpecificCount },
                (_, i) => (
                  <span
                    key={`d-${i}`}
                    className="inline-block w-[7px] h-[7px] rounded-full"
                    style={{ backgroundColor: 'rgba(59,130,246,0.4)' }}
                  />
                ),
              )}
            </div>
          </div>
          <span className="text-muted-foreground text-xs">
            {sharedSpecificCount} specific skills in common,{' '}
            {totalSpecificCount - sharedSpecificCount} specific skills to
            develop
          </span>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <span className="text-xs text-muted-foreground">
            {wage !== null ? `MYR ${wage.toLocaleString()}` : '—'}
          </span>
        </div>
      </div>

      {/* Bottom row: skills preview (shared first, then to develop) */}
      {skillsPreview.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skillsPreview.map((skill) => {
            const isShared = primarySkills.has(skill.toLowerCase());
            return (
              <span
                key={skill}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={
                  isShared
                    ? {
                        backgroundColor: 'rgba(34,197,94,0.15)',
                        color: '#16a34a',
                        border: '1px solid rgba(34,197,94,0.25)',
                      }
                    : {
                        backgroundColor: 'rgba(59,130,246,0.15)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59,130,246,0.25)',
                      }
                }
              >
                {skill}
                {isShared ? ' \u2713' : ''}
              </span>
            );
          })}
          {remaining > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(59,130,246,0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.25)',
              }}
            >
              +{remaining} more
            </span>
          )}
        </div>
      )}
    </button>
  );
}
