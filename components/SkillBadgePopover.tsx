'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import type { SkillInfo } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Context — one popover open at a time                              */
/* ------------------------------------------------------------------ */

interface SkillPopoverCtx {
  openSkill: string | null;
  setOpenSkill: (name: string | null) => void;
  basicSkills: Record<string, SkillInfo>;
  specificSkills: Record<string, SkillInfo>;
}

const SkillPopoverContext = createContext<SkillPopoverCtx>({
  openSkill: null,
  setOpenSkill: () => {},
  basicSkills: {},
  specificSkills: {},
});

export function SkillPopoverProvider({
  basicSkills,
  specificSkills,
  children,
}: {
  basicSkills: Record<string, SkillInfo>;
  specificSkills: Record<string, SkillInfo>;
  children: ReactNode;
}) {
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  return (
    <SkillPopoverContext.Provider
      value={{ openSkill, setOpenSkill, basicSkills, specificSkills }}
    >
      {children}
    </SkillPopoverContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge styles                                                       */
/* ------------------------------------------------------------------ */

const BADGE_STYLES = {
  default: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    color: '#16a34a',
    border: '1px solid rgba(34,197,94,0.3)',
  },
  shared: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    color: '#16a34a',
    border: '1px solid rgba(34,197,94,0.3)',
  },
  'to-develop': {
    backgroundColor: 'rgba(59,130,246,0.15)',
    color: '#60a5fa',
    border: '1px solid rgba(59,130,246,0.25)',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SkillBadgePopoverProps {
  skill: string;
  type: 'basic' | 'specific';
  variant?: 'default' | 'shared' | 'to-develop';
  suffix?: string;
  className?: string;
}

export default function SkillBadgePopover({
  skill,
  type,
  variant = 'default',
  suffix,
  className,
}: SkillBadgePopoverProps) {
  const { openSkill, setOpenSkill, basicSkills, specificSkills } =
    useContext(SkillPopoverContext);

  const pool = type === 'basic' ? basicSkills : specificSkills;
  const info = pool[skill];
  const style = BADGE_STYLES[variant];
  const skillKey = `${type}:${skill}`;
  const isOpen = openSkill === skillKey;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpenSkill(open ? skillKey : null);
    },
    [skillKey, setOpenSkill],
  );

  /* No data → plain badge (current behaviour) */
  if (!info) {
    return (
      <Badge variant="secondary" className={className ?? 'text-xs'} style={style}>
        {skill}
        {suffix}
      </Badge>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className={className ?? 'text-xs'}
          style={{
            ...style,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '9999px',
            padding: '2px 8px',
            fontSize: '0.75rem',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            transition: 'box-shadow 0.15s',
            boxShadow: isOpen
              ? `0 0 0 2px ${variant === 'to-develop' ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)'}`
              : 'none',
          }}
        >
          {skill}
          {suffix}
        </span>
      </PopoverTrigger>

      <PopoverContent onClick={(e) => e.stopPropagation()}>
        {/* Skill name */}
        <p className="text-[13px] font-semibold text-foreground mb-1.5">
          {skill}
        </p>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {info.description}
        </p>

        {/* Resources */}
        {info.resources.length > 0 && (
          <>
            <hr className="border-border mb-2.5" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Learning Resources
            </p>
            <div className="flex flex-col gap-1.5">
              {info.resources.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink size={12} className="shrink-0" />
                  {r.title}
                </a>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
