# Comparison Grid Design

## Problem

In comparison mode, the left and right panes scroll independently. Sections (AI Exposure, Wage, Skills) don't align horizontally, making it hard to compare values across occupations.

## Solution

Replace the two independent `OccupationDetailPane` components in comparison mode with a single `ComparisonGrid` component that uses shared horizontal rows. Each row contains the primary occupation's value on the left and the comparison occupation's value on the right, always aligned.

Cards mode is unchanged.

## Layout

When `isComparing` is true, the two-column body is replaced with a single scrollable grid:

| Row         | Left (Primary)                                      | Right (Comparison)                      |
| ----------- | --------------------------------------------------- | --------------------------------------- |
| Header      | Occupation name + code                              | ← Back to pathways + name + code        |
| AI Exposure | Percentage + progress bar + quartile badge          | Same + delta (▼/▲)                      |
| Wage        | MYR amount                                          | MYR amount + delta                      |
| Skills      | Basic + specific skills (shared highlighted blue ✓) | Same                                    |
| Tasks       | Accordion (independent expand/collapse)             | Accordion (independent expand/collapse) |

Right cells have a `3px` blue left-border (consistent with the panel colouring decision).

## Architecture

| File                                   | Action                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `components/panel/ComparisonGrid.tsx`  | Create — shared-row grid layout                                          |
| `components/panel/OccupationPanel.tsx` | Modify — render `ComparisonGrid` when `isComparing` instead of two panes |

`OccupationDetailPane` stays unchanged (still used for the left pane in cards mode).

## Props: ComparisonGrid

```ts
interface ComparisonGridProps {
  primary: OccupationDetail;
  primaryNodeId: string;
  comparison: OccupationDetail;
  comparisonNodeId: string;
  sharedSkills: Set<string>;
  comparisonDeltas: { aiExposure: number; wage: number | null };
  skillsMatchWeight?: number;
  onBack: () => void;
}
```

## Visual Details

- 50/50 column split within each row
- Row dividers via border-bottom
- Right column cells: `border-left: 3px solid blue-500`
- Shared skills: blue background + ✓ (same styling as current `SkillBadge`)
- Deltas: green for favourable, red for unfavourable
- Single vertical scrollbar for the entire grid
- Match dots + percentage shown in header row (right side)
