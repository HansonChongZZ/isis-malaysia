import { Badge } from '@/components/ui/badge';

interface EdgeSkillsTooltipProps {
  labelA: string;
  labelB: string;
  shared: string[];
  onlyA: string[];
  onlyB: string[];
  totalUnique: number;
}

export default function EdgeSkillsTooltip({
  labelA,
  labelB,
  shared,
  onlyA,
  onlyB,
  totalUnique,
}: EdgeSkillsTooltipProps) {
  return (
    <div className="w-fit max-w-[640px] min-w-[480px] bg-popover text-popover-foreground rounded-lg shadow-xl border border-border p-4 space-y-3">
      {/* Header */}
      <div>
        <p className="font-semibold text-sm leading-tight">
          {labelA} <span className="text-muted-foreground mx-1">↔</span> {labelB}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {shared.length} of {totalUnique} skills in common
        </p>
      </div>

      <hr className="border-border" />

      {/* Shared skills */}
      {shared.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Shared Skills
          </p>
          <div className="flex flex-wrap gap-1">
            {shared.map((skill) => (
              <Badge
                key={skill}
                className="text-xs bg-primary/15 text-primary border-primary/30"
              >
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Unique skills columns */}
      {(onlyA.length > 0 || onlyB.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {onlyA.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5" title={labelA}>
                Only {labelA}
              </p>
              <div className="flex flex-wrap gap-1">
                {onlyA.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-xs opacity-70"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {onlyB.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5" title={labelB}>
                Only {labelB}
              </p>
              <div className="flex flex-wrap gap-1">
                {onlyB.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-xs opacity-70"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
