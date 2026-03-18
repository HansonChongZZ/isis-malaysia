import { Pin } from 'lucide-react';
import SkillBadgePopover from '@/components/SkillBadgePopover';

interface EdgeSkillsTooltipProps {
  labelA: string;
  labelB: string;
  colourA?: string;
  colourB?: string;
  toDevelopSpecific: string[];
  sharedSpecificCount: number;
  toDevelopSpecificCount: number;
  pinned?: boolean;
}

export default function EdgeSkillsTooltip({
  labelA,
  labelB,
  colourA,
  colourB,
  toDevelopSpecific,
  sharedSpecificCount,
  toDevelopSpecificCount,
  pinned,
}: EdgeSkillsTooltipProps) {
  return (
    <div className="relative w-fit max-w-[640px] min-w-[480px] bg-popover text-popover-foreground rounded-lg shadow-xl border border-border p-4 space-y-3">
      {pinned && (
        <Pin size={14} className="absolute top-2 right-2 text-muted-foreground" />
      )}

      {/* Header */}
      <div>
        <p className="font-semibold text-sm leading-tight">
          <span style={{ color: colourA }}>{labelA}</span> <span className="text-muted-foreground mx-1">→</span> <span style={{ color: colourB }}>{labelB}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          <span className="text-green-400 font-semibold">{sharedSpecificCount}</span> specific skills shared, <span className="text-blue-400 font-semibold">{toDevelopSpecificCount}</span> specific skills to develop
        </p>
      </div>

      <hr className="border-border" />

      {/* Specific skills to develop */}
      {toDevelopSpecific.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Skills to Develop
          </p>
          <div className="flex flex-wrap gap-1">
            {toDevelopSpecific.map((skill) => (
              <SkillBadgePopover
                key={skill}
                skill={skill}
                type="specific"
                variant="to-develop"
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
