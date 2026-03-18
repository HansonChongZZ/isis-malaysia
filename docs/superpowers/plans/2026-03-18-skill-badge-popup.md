# Skill Badge Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make skill badges clickable to show a popover with skill description and learning resource links, powered by JSON data files.

**Architecture:** Add a Radix Popover-based `SkillBadgePopover` component that replaces all existing inline skill badge renderings. A React context (`SkillPopoverProvider`) ensures only one popover is open at a time. Skill metadata lives in two static JSON files (`basic-skills.json`, `specific-skills.json`) fetched at app startup alongside existing data.

**Tech Stack:** React 19, Radix UI Popover, Zod, Next.js 16, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-18-skill-badge-popup-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `public/data/basic-skills.json` | Basic skill metadata (description + resource links) |
| Create | `public/data/specific-skills.json` | Specific skill metadata (description + resource links) |
| Create | `components/ui/popover.tsx` | shadcn/ui Radix Popover primitive |
| Create | `components/SkillBadgePopover.tsx` | `SkillPopoverProvider` context + `SkillBadgePopover` component |
| Modify | `lib/types.ts` | Add `SkillResource`, `SkillInfo` types + Zod schemas |
| Modify | `lib/data.ts` | Add `loadBasicSkills()`, `loadSpecificSkills()` fetch functions |
| Modify | `app/page.tsx` | Fetch skill data, wrap tree with `SkillPopoverProvider` |
| Modify | `components/panel/OccupationDetailPane.tsx` | Replace `SkillBadge` with `SkillBadgePopover` |
| Modify | `components/panel/ComparisonGrid.tsx` | Replace `SkillBadge` with `SkillBadgePopover` |
| Modify | `components/panel/TransitionCard.tsx` | Replace inline skill spans with `SkillBadgePopover` |
| Modify | `components/graph/EdgeSkillsTooltip.tsx` | Replace skill badges with `SkillBadgePopover` |

---

### Task 1: Add Zod schemas and types for skill data

**Files:**
- Modify: `lib/types.ts:1-60`

- [ ] **Step 1: Add Zod schemas and TypeScript types**

At the end of `lib/types.ts`, add:

```ts
export const SkillResourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
})

export const SkillInfoSchema = z.object({
  description: z.string(),
  resources: z.array(SkillResourceSchema),
})

export type SkillResource = z.infer<typeof SkillResourceSchema>
export type SkillInfo = z.infer<typeof SkillInfoSchema>
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add SkillInfo and SkillResource Zod schemas"
```

---

### Task 2: Create seed JSON data files

**Files:**
- Create: `public/data/basic-skills.json`
- Create: `public/data/specific-skills.json`

- [ ] **Step 1: Create basic-skills.json with 3 sample entries**

```json
{
  "Critical Thinking": {
    "description": "Using logic and reasoning to identify the strengths and weaknesses of alternative solutions, conclusions, or approaches to problems.",
    "resources": [
      { "title": "Critical Thinking & Problem Solving (Coursera)", "url": "https://www.coursera.org/learn/critical-thinking-problem-solving" }
    ]
  },
  "Active Listening": {
    "description": "Giving full attention to what other people are saying, taking time to understand the points being made, asking questions as appropriate.",
    "resources": []
  },
  "Complex Problem Solving": {
    "description": "Identifying complex problems and reviewing related information to develop and evaluate options and implement solutions.",
    "resources": []
  }
}
```

- [ ] **Step 2: Create specific-skills.json with 3 sample entries**

```json
{
  "Financial Analysis": {
    "description": "Analysing financial data, trends, and metrics to support business decisions and assess financial health.",
    "resources": [
      { "title": "Financial Analysis Foundations (LinkedIn Learning)", "url": "https://www.linkedin.com/learning/financial-analysis-foundations" }
    ]
  },
  "Contract Drafting": {
    "description": "Preparing and reviewing legal contracts, ensuring terms are clear, enforceable, and aligned with organisational requirements.",
    "resources": []
  },
  "Data Analysis": {
    "description": "Inspecting, cleansing, transforming, and modelling data to discover useful information and support decision-making.",
    "resources": []
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add public/data/basic-skills.json public/data/specific-skills.json
git commit -m "feat: add seed basic-skills and specific-skills JSON data"
```

---

### Task 3: Add data loading functions

**Files:**
- Modify: `lib/data.ts:1-23`

- [ ] **Step 1: Add imports and fetch functions**

At the top of `lib/data.ts`, add `SkillInfoSchema` to the import from `./types`. Then append these two functions after `loadOccupations()`:

```ts
export async function loadBasicSkills(): Promise<Record<string, SkillInfo>> {
  const res = await fetch("/data/basic-skills.json")
  if (!res.ok) throw new Error("Failed to load basic-skills.json")
  const raw = await res.json()
  return z.record(z.string(), SkillInfoSchema).parse(raw)
}

export async function loadSpecificSkills(): Promise<Record<string, SkillInfo>> {
  const res = await fetch("/data/specific-skills.json")
  if (!res.ok) throw new Error("Failed to load specific-skills.json")
  const raw = await res.json()
  return z.record(z.string(), SkillInfoSchema).parse(raw)
}
```

Also add `SkillInfo` to the type import and `SkillInfoSchema` to the schema import from `./types`.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add lib/data.ts
git commit -m "feat: add loadBasicSkills and loadSpecificSkills data fetchers"
```

---

### Task 4: Create Radix Popover UI primitive

**Files:**
- Create: `components/ui/popover.tsx`

- [ ] **Step 1: Create the shadcn-style Popover component**

Use the same pattern as `components/ui/tooltip.tsx`. Create `components/ui/popover.tsx`:

```tsx
"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit max-w-[280px] origin-(--radix-popover-content-transform-origin) rounded-lg border border-border p-3.5 shadow-md",
          className
        )}
        {...props}
      >
        {children}
        <PopoverPrimitive.Arrow className="fill-popover z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] border border-border" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add components/ui/popover.tsx
git commit -m "feat: add Radix Popover shadcn/ui primitive"
```

---

### Task 5: Create SkillBadgePopover component and context provider

**Files:**
- Create: `components/SkillBadgePopover.tsx`

- [ ] **Step 1: Create the component file**

```tsx
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
  const isOpen = openSkill === skill;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpenSkill(open ? skill : null);
    },
    [skill, setOpenSkill],
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
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add components/SkillBadgePopover.tsx
git commit -m "feat: add SkillBadgePopover component and SkillPopoverProvider context"
```

---

### Task 6: Wire up data fetching and provider in page.tsx

**Files:**
- Modify: `app/page.tsx:1-168`

- [ ] **Step 1: Add imports**

Add to the imports at top of `app/page.tsx`:

```ts
import { loadBasicSkills, loadSpecificSkills } from "@/lib/data"
import type { SkillInfo } from "@/lib/types"
import { SkillPopoverProvider } from "@/components/SkillBadgePopover"
```

- [ ] **Step 2: Add state and fetch skill data**

After the existing state declarations (around line 31), add:

```ts
const [basicSkills, setBasicSkills] = useState<Record<string, SkillInfo>>({})
const [specificSkills, setSpecificSkills] = useState<Record<string, SkillInfo>>({})
```

In the existing `useEffect` that calls `Promise.all([loadNodes(), loadEdges(), loadOccupations()])` (around line 156-168), add `loadBasicSkills()` and `loadSpecificSkills()` to the `Promise.all`:

```ts
useEffect(() => {
  Promise.all([loadNodes(), loadEdges(), loadOccupations(), loadBasicSkills(), loadSpecificSkills()])
    .then(([n, e, o, bs, ss]) => {
      setNodes(n)
      setEdges(e)
      setOccupations(o)
      setBasicSkills(bs)
      setSpecificSkills(ss)
      setLoading(false)
    })
    .catch((err) => {
      setError(err.message)
      setLoading(false)
    })
}, [])
```

- [ ] **Step 3: Wrap JSX return with SkillPopoverProvider**

Wrap the outermost `<div>` in the return statement with the provider:

```tsx
return (
  <SkillPopoverProvider basicSkills={basicSkills} specificSkills={specificSkills}>
    <div className="flex flex-col flex-1 min-h-0 bg-background text-foreground overflow-hidden">
      {/* ... existing content unchanged ... */}
    </div>
  </SkillPopoverProvider>
)
```

- [ ] **Step 4: Verify the app loads without errors**

Run: `npm run dev`
Open browser, confirm app loads and existing badge rendering is unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: fetch skill data and wrap app with SkillPopoverProvider"
```

---

### Task 7: Replace badges in OccupationDetailPane

**Files:**
- Modify: `components/panel/OccupationDetailPane.tsx:1-238`

- [ ] **Step 1: Replace SkillBadge with SkillBadgePopover**

Remove the local `SkillBadge` function (lines 23-37). Add import:

```ts
import SkillBadgePopover from '@/components/SkillBadgePopover';
```

Replace the basic skills rendering (line 178-180):

```tsx
{detail.basicSkills.map((skill) => (
  <SkillBadgePopover key={skill} skill={skill} type="basic" />
))}
```

Replace the specific skills rendering (line 192-194):

```tsx
{detail.specificSkills.map((skill) => (
  <SkillBadgePopover key={skill} skill={skill} type="specific" />
))}
```

- [ ] **Step 2: Verify in browser**

Open the app, select an occupation, open the detail panel. Click a skill badge that has data (e.g. "Critical Thinking"). Verify:
- Popover appears with name, description, resources
- Click outside closes it
- Badges without data remain plain (no cursor change)

- [ ] **Step 3: Commit**

```bash
git add components/panel/OccupationDetailPane.tsx
git commit -m "feat: use SkillBadgePopover in OccupationDetailPane"
```

---

### Task 8: Replace badges in ComparisonGrid

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx:1-377`

- [ ] **Step 1: Replace SkillBadge with SkillBadgePopover**

Remove the local `SkillBadge` function (lines 25-61). Add import:

```ts
import SkillBadgePopover from '@/components/SkillBadgePopover';
```

Replace the basic skills `.map()` (around line 322):

```tsx
<SkillBadgePopover
  key={skill}
  skill={skill}
  type="basic"
  variant={sharedSkills.has(skill.toLowerCase()) ? 'shared' : 'to-develop'}
  suffix={sharedSkills.has(skill.toLowerCase()) ? ' ✓' : undefined}
/>
```

Replace the specific skills `.map()` (around line 342):

```tsx
<SkillBadgePopover
  key={skill}
  skill={skill}
  type="specific"
  variant={sharedSkills.has(skill.toLowerCase()) ? 'shared' : 'to-develop'}
  suffix={sharedSkills.has(skill.toLowerCase()) ? ' ✓' : undefined}
/>
```

Also normalize the legend badges in the header (lines 282-308) to use `#60a5fa` for the to-develop color instead of `#3b82f6`:

```tsx
style={{
  backgroundColor: 'rgba(59,130,246,0.12)',
  color: '#60a5fa',
  border: '1px solid rgba(59,130,246,0.25)',
}}
```

- [ ] **Step 2: Verify in browser**

Open comparison view, confirm badges are clickable with correct shared/to-develop colors.

- [ ] **Step 3: Commit**

```bash
git add components/panel/ComparisonGrid.tsx
git commit -m "feat: use SkillBadgePopover in ComparisonGrid, normalize blue color"
```

---

### Task 9: Replace badges in TransitionCard

**Files:**
- Modify: `components/panel/TransitionCard.tsx:1-144`

- [ ] **Step 1: Replace inline skill spans with SkillBadgePopover**

Add import:

```ts
import SkillBadgePopover from '@/components/SkillBadgePopover';
```

Replace the `skillsPreview.map()` block (lines 103-127) with:

```tsx
{skillsPreview.map((skill) => {
  const isShared = primarySkills.has(skill.toLowerCase());
  return (
    <SkillBadgePopover
      key={skill}
      skill={skill}
      type="specific"
      variant={isShared ? 'shared' : 'to-develop'}
      suffix={isShared ? ' \u2713' : undefined}
      className="text-[10px]"
    />
  );
})}
```

Note: The `SkillBadgePopover` trigger uses `<span>` with `asChild` (not a `<button>`), so it won't create invalid nested `<button>` HTML. The `e.stopPropagation()` in the component prevents the card's `onClick` from firing.

- [ ] **Step 2: Verify in browser**

Open an occupation panel, go to pathways/transitions view. Click a skill badge on a transition card. Verify:
- Popover opens without also triggering the card's click (navigation)
- Click outside closes popover

- [ ] **Step 3: Commit**

```bash
git add components/panel/TransitionCard.tsx
git commit -m "feat: use SkillBadgePopover in TransitionCard"
```

---

### Task 10: Replace badges in EdgeSkillsTooltip

**Files:**
- Modify: `components/graph/EdgeSkillsTooltip.tsx:1-65`

- [ ] **Step 1: Replace Badge with SkillBadgePopover**

Add import:

```ts
import SkillBadgePopover from '@/components/SkillBadgePopover';
```

Replace the badge `.map()` (lines 50-56):

```tsx
{toDevelopSpecific.map((skill) => (
  <SkillBadgePopover
    key={skill}
    skill={skill}
    type="specific"
    variant="to-develop"
  />
))}
```

Remove the unused `Badge` import from line 1.

- [ ] **Step 2: Verify in browser**

Select two connected occupations to trigger the edge tooltip. Click a "to develop" skill badge. Verify popover appears.

- [ ] **Step 3: Commit**

```bash
git add components/graph/EdgeSkillsTooltip.tsx
git commit -m "feat: use SkillBadgePopover in EdgeSkillsTooltip"
```

---

### Task 11: Manual smoke test

- [ ] **Step 1: Full interaction test**

Run: `npm run dev`

Test checklist:
1. Open detail panel → click a basic skill with data → popover shows
2. Click a specific skill with data → previous popover closes, new one opens
3. Click outside → popover closes
4. Click a skill without JSON data → nothing happens (plain badge)
5. Open comparison view → click shared skill → popover with green ring
6. Click to-develop skill → popover with blue ring
7. Open transition card skills → click badge → popover opens, card does NOT navigate
8. Hover edge between two nodes → click to-develop skill in tooltip → popover opens
9. Resource links open in new tab

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit any fixes if needed**
