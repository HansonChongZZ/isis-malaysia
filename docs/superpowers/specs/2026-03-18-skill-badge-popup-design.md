# Skill Badge Popup — Design Spec

**Date:** 2026-03-18
**Branch:** `feat/virtual-cursor-animation`

## Overview

Clicking a skill badge anywhere in the app opens a popover showing the skill name, description, and learning resource links. The popover is powered by Radix Popover, consistent with the existing shadcn/ui component library. Skill data is maintained in two manually-edited JSON files (basic and specific skills).

## User Interaction

- **Click** a skill badge → popover opens below/above (auto-positioned by Radix)
- **Click outside** or **click another badge** → popover closes
- **Only one popover open at a time** — opening a new one closes the previous
- Badges without a matching JSON entry render as plain badges (no cursor change, no click handler)
- Badges with data show `cursor-pointer` to signal interactivity
- Active badge gets a subtle ring highlight (`box-shadow: 0 0 0 2px`) when its popover is open
- Resource links open in a new tab (`target="_blank"`)

## Data Structure

Two JSON files in `public/data/`:

### `basic-skills.json`

```json
{
  "Critical Thinking": {
    "description": "Using logic and reasoning to identify strengths and weaknesses of alternative solutions.",
    "resources": [
      { "title": "Introduction to Logic (Coursera)", "url": "https://example.com" }
    ]
  }
}
```

### `specific-skills.json`

Same structure. Skills are keyed by exact name as they appear in `occupations.json`. Skills without an entry simply don't get a popover — this allows incremental population.

## Component Architecture

### `SkillPopoverProvider` (Context)

- Wraps the app (added to `app/layout.tsx` or `app/page.tsx`)
- Tracks `openSkill: string | null` — the currently open skill name
- Provides `setOpenSkill(name: string | null)` to children
- Opening a new skill automatically closes the previous one

### `SkillBadgePopover` (Component)

Located at `components/SkillBadgePopover.tsx`. Replaces all existing `SkillBadge` inline components.

**Props:**
- `skill: string` — the skill name
- `type: "basic" | "specific"` — which JSON file to look up
- `variant?: "shared" | "to-develop" | "default"` — controls badge color styling
  - `"default"` / `"shared"` — green background (`rgba(34,197,94,0.15)`), green text (`#16a34a`)
  - `"to-develop"` — blue background (`rgba(59,130,246,0.15)`), blue text (`#60a5fa`)
- `suffix?: string` — optional text appended to badge (e.g., `" ✓"` for shared skills)

**Rendering logic:**
1. Look up `skill` in the appropriate JSON data (basic or specific)
2. If no match → render plain `<Badge>` span (current behavior, no popover)
3. If match → render `<Popover.Root>` wrapping:
   - `<Popover.Trigger>` → `<Badge>` with `cursor-pointer` and ring highlight when open
   - `<Popover.Content>` (portaled, max-width 280px, auto-positioned) containing:
     - Skill name as bold header (13px, font-weight 600)
     - Description text (12px, muted color)
     - Divider line
     - "Learning Resources" uppercase label (10px)
     - List of links with external-link icon (12px, blue `#60a5fa`)
   - `<Popover.Arrow>`

### Data Loading

Add to `lib/data.ts`:
- `fetchBasicSkills(): Promise<Record<string, SkillInfo>>` — fetches `/data/basic-skills.json`
- `fetchSpecificSkills(): Promise<Record<string, SkillInfo>>` — fetches `/data/specific-skills.json`

Type in `lib/types.ts`:
```ts
interface SkillResource {
  title: string;
  url: string;
}

interface SkillInfo {
  description: string;
  resources: SkillResource[];
}
```

Data is fetched once at app level and passed down via context or props alongside the popover state.

## Popover Visual Design

- Background: `bg-popover` (theme token)
- Border: `border-border` (theme token)
- Border radius: `rounded-lg` (8px)
- Shadow: `shadow-md`
- Padding: 14px 16px
- Max width: 280px
- Arrow: Radix Popover.Arrow, styled to match border
- Animations: `fade-in-0 zoom-in-95` (matches existing tooltip animations)
- Z-index: `z-50` (matches existing tooltips)

## File Changes

| Action | File | What |
|--------|------|------|
| Add | `public/data/basic-skills.json` | Basic skill definitions (start with a few examples) |
| Add | `public/data/specific-skills.json` | Specific skill definitions (start with a few examples) |
| Add | `components/ui/popover.tsx` | shadcn Radix Popover primitive |
| Add | `components/SkillBadgePopover.tsx` | Shared component + `SkillPopoverProvider` context |
| Edit | `lib/types.ts` | Add `SkillResource` and `SkillInfo` types |
| Edit | `lib/data.ts` | Add fetch functions for skill JSON files |
| Edit | `components/panel/OccupationDetailPane.tsx` | Replace `SkillBadge` with `SkillBadgePopover` |
| Edit | `components/panel/TransitionCard.tsx` | Replace skill badges with `SkillBadgePopover` |
| Edit | `components/panel/ComparisonGrid.tsx` | Replace skill badges with `SkillBadgePopover` |
| Edit | `components/graph/EdgeSkillsTooltip.tsx` | Replace skill badges with `SkillBadgePopover` |
| Edit | `app/page.tsx` or `app/layout.tsx` | Wrap with `SkillPopoverProvider` |

## Implementation Notes

- **TransitionCard nesting:** `TransitionCard` renders as a `<button>`. The popover trigger must use `asChild` with a `<span>` (not a nested `<button>`) and call `e.stopPropagation()` to prevent the card's click handler from firing.
- **Skill type in TransitionCard/EdgeSkillsTooltip:** These components only display specific skills. Hardcode `type="specific"` — no need to pass type dynamically.
- **Blue color normalization:** Use `#60a5fa` for to-develop text and `rgba(59,130,246,0.15)` for to-develop background consistently across all locations (ComparisonGrid currently uses `#3b82f6` — update to match).
- **Zod validation:** Add `SkillResourceSchema` and `SkillInfoSchema` to `lib/types.ts` and validate JSON on fetch, matching existing patterns in `lib/data.ts`.

## Out of Scope

- No admin UI for editing skill JSON — files are edited manually
- No hover preview — click interaction only
- No skill categories, tags, or metadata beyond name/description/resources
- No analytics or tracking on link clicks
