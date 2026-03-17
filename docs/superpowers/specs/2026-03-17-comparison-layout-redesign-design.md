# Comparison Layout Redesign

**Date:** 2026-03-17
**Status:** Approved

## Problem

When a transition is selected in the occupation panel, the `ComparisonGrid` component uses a two-pane row-aligned layout that creates several UX issues:

1. **Header area wastes vertical space** — left pane repeats the occupation title from the dialog header with dead whitespace below, while the right pane is denser (back button + occupation info + skill dots)
2. **Row heights are unbalanced** — each row stretches to the tallest side, creating whitespace gaps on the shorter side
3. **Sections feel disconnected** — horizontal border lines between every row create a "stacked cards" look rather than a cohesive comparison
4. **Repeated section labels** — labels like "AI Exposure Index", "Monthly Wage", "Basic Skills" appear on both sides

## Solution

Replace the current two-pane `ComparisonGrid` with a unified single-column scrollable layout that uses inline comparison cells for metrics, a merged skills section with badges, and side-by-side task columns.

## Layout Structure

Top to bottom within the existing dialog shell:

### 1. Dialog Header (unchanged)
- Occupation title + close button
- Sticky at top, `p-5 pb-4 border-b`

### 2. Back to Pathways Bar (moved to full-width)
- Previously nested inside the right pane header; now promoted to a full-width bar spanning the entire dialog width
- Full-width green-tinted bar with arrow icon
- `bg-primary/15`, border-bottom

### 3. Occupation Names Row
- Two-cell flex row with `background: #fafafa`
- **Left cell:** "Current role" label (small, muted), occupation code (monospace), occupation name (semibold)
- **Right cell:** "Target role" label, occupation code, occupation name (semibold, primary color), skill match dots + summary text (dots computed from `comparison.specificSkills` only, matching current behavior)
- Right cell has subtle green tint: `rgba(32,77,57,0.015)`
- Cells separated by `border-left: 1px solid border-color`

### 4. AI Exposure Row
- Two-cell flex row
- **Left cell:** "AI Exposure" label (small, muted), value (large, quartile-colored), progress bar
- **Right cell:** "AI Exposure" label, value (primary color) + delta indicator (e.g., "▼ 88.9%"), progress bar
- Right cell has subtle green tint

### 5. Monthly Wage Row
- Two-cell flex row, same pattern as AI Exposure
- **Left cell:** "Monthly Wage" label, value
- **Right cell:** "Monthly Wage" label, value (primary color) + delta (e.g., "▲ MYR 25,383")
- Right cell has subtle green tint

### 6. Skills Section (full-width)
- Single full-width section displaying the **target occupation's** skills
- "Shared" means the skill exists in both the current and target occupation (determined via the existing `sharedSkills` Set, which is a lowercase intersection of both occupations' basic + specific skills)
- "To develop" means the skill exists in the target occupation but NOT in the current occupation
- **Header row:** "SKILLS" label on left, legend on right: green badge with ✓ = "Shared", blue badge with • = "To develop"
- **Basic sub-section:** "Basic" sub-label, then wrapped badges from `comparison.basicSkills`:
  - Shared skills: green background (`rgba(34,197,94,0.12)`), green text, shows "Skill Name ✓"
  - To-develop skills: blue background (`rgba(59,130,246,0.12)`), blue text, shows "Skill Name"
  - Sorted: shared skills first, then to-develop
- **Specific sub-section:** "Specific" sub-label, same badge pattern using `comparison.specificSkills`

### 7. Tasks Section (side-by-side)
- Two-column flex layout
- **Left column:** "Current Tasks (N)" label, accordion task items with AI score bars
- **Right column:** "Target Tasks (N)" label, accordion task items with AI score bars
- Right column has subtle green tint
- Each column scrolls with the page (no independent scroll)

## Visual Design Details

### Colors
- Target/right cell tint: `rgba(32,77,57,0.015)` (very subtle green)
- Primary comparison values: `var(--primary)` (#204D39)
- Shared skill badges: `rgba(34,197,94,0.12)` bg, `#16a34a` text, `rgba(34,197,94,0.25)` border
- To-develop skill badges: `rgba(59,130,246,0.12)` bg, `#3b82f6` text, `rgba(59,130,246,0.25)` border
- Cell labels: `text-muted-foreground`, ~10px

### Spacing
- Comparison cells: `padding: 12px 20px`
- Skills section: `padding: 14px 20px`
- Task columns: `padding: 14px 16px`
- Row borders: `border-bottom: 1px solid var(--border)`
- Badge gap: `gap: 2px` (via margin on inline-block)

### Typography
- Cell labels ("Current role", "AI Exposure"): 10px, muted color
- Occupation names: 13px, font-weight 600
- Metric values: 16px, font-weight 700
- Delta indicators: 11px, primary color
- Skill badges: 11px, font-weight 500
- Sub-labels ("Basic", "Specific"): 10px, muted

## Component Changes

### Modified: `ComparisonGrid.tsx`
- Replace the current row-by-row two-pane layout with the unified layout described above
- Remove per-row `w-1/2` splits for metrics
- Remove the `border-l-[3px] border-l-blue-500` left border on right-side cells (replaced by subtle green tint + standard 1px border)
- Move the "Back to pathways" button from inside the right pane header to a full-width bar at the top
- Add full-width skills section with badge display (showing target occupation's skills)
- Add side-by-side task columns at the bottom
- Keep existing `SkillBadge` and `TaskAccordion` sub-components (adapt as needed)
- Badge colors updated: background opacity from 0.15→0.12, border opacity from 0.3→0.25, to-develop text from `#60a5fa`→`#3b82f6` (slightly darker blue for better contrast)

### No changes needed:
- `OccupationPanel.tsx` — still renders `ComparisonGrid` when comparing
- `OccupationDetailPane.tsx` — only used in non-comparison mode
- `TransitionCards.tsx` — only used in non-comparison mode

## Scope Boundaries

- This redesign only affects the comparison view (when a transition is selected)
- The transition card list view and single-occupation detail view are unchanged
- No new data requirements — all data already available via existing props
