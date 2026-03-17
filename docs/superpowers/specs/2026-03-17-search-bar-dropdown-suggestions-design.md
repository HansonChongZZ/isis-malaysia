# Search Bar Dropdown Suggestions

## Overview

When the hero search bar is focused and the input is empty, show a dropdown with the 5 occupations that have the most workers among those with 100% AI exposure. This gives users an immediate entry point into the most impactful occupations.

## Scope

- **Hero search bar only** — the collapsed search in GraphControls is not affected
- **Focus-triggered** — suggestions appear when input is focused with empty text
- **Replaces on type** — as soon as the user types, suggestions disappear and normal filtered results take over
- **Standard selection** — clicking a suggestion behaves identically to selecting any occupation from search

## Data

The top 5 occupations are computed from `GraphNode[]` by filtering to `aiExposure === 1` and sorting by `workers` descending:

| Rank | Occupation | Workers |
|------|-----------|---------|
| 1 | Commercial Sales Representatives | 283,625 |
| 2 | Contact Centre Salespersons | 174,588 |
| 3 | Accounting And Book-Keeping Clerks | 172,216 |
| 4 | Accountants And Auditors | 167,528 |
| 5 | Mechanical Engineering Technicians | 128,972 |

## Visual Treatment

Option B — Left Border Accent + Exposure Pill:

- **Section header**: muted text "Highest impact occupations"
- **Each item**: red left border (`border-l-3 border-destructive`), subtle red background tint on hover
- **Two-line layout**: occupation name + "X workers" in muted smaller text
- **"100%" pill badge**: right-aligned, `bg-destructive/15 text-destructive`, rounded-full

## Implementation

### Data Flow

1. `page.tsx` passes `nodes: GraphNode[]` to `OccupationSearch` (in addition to existing `occupations` prop)
2. `OccupationSearch` computes top 5 via `useMemo`:
   - Filter nodes where `aiExposure === 1`
   - Sort by `workers` descending
   - Take first 5

### Dropdown Behavior

1. Track input text state with `useState<string>("")`
2. When input is empty and dropdown is open:
   - Render a custom suggestions section **before** `ComboboxList` inside `ComboboxContent`
   - Suggestions are styled `div` buttons (not `ComboboxItem`) that call `onOccupationSelect(id)` on click
3. When input has text:
   - Hide the suggestions section
   - Normal Combobox filtering renders the standard occupation list

### Component Changes

**`OccupationSearch.tsx`**:
- Add `nodes?: GraphNode[]` prop (optional, only used in hero mode)
- Add `inputValue` state tracking
- Compute `topExposedOccupations` via `useMemo`
- Render suggestions section conditionally inside `ComboboxContent` when `inputValue` is empty and `hero` is true

**`app/page.tsx`**:
- Pass `nodes` prop to the hero `OccupationSearch` instance

### Files Modified

- `components/graph/OccupationSearch.tsx` — main implementation
- `app/page.tsx` — pass `nodes` prop to hero search

No new files or components needed.
