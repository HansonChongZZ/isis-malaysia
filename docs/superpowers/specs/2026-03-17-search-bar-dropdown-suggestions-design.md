# Search Bar Dropdown Suggestions

## Overview

When the hero search bar is focused and the input is empty, show a dropdown with the 5 occupations that have the most workers among those with 100% AI exposure. This gives users an immediate entry point into the most impactful occupations.

## Scope

- **Hero search bar only** — the collapsed search in GraphControls is not affected. The hero search is desktop-only (`hidden sm:flex`), so mobile users are unaffected.
- **Focus-triggered** — suggestions appear when input is focused with empty text
- **Replaces on type** — as soon as the user types, suggestions disappear and normal filtered results take over
- **Standard selection** — clicking a suggestion behaves identically to selecting any occupation from search
- **Keyboard navigation of suggestions** — out of scope for v1. Suggestions are click-only. Arrow keys navigate the normal ComboboxList below.

## Data

The top 5 occupations are computed dynamically from `GraphNode[]` by filtering to `aiExposure === 1`, excluding nodes where `workers` is `null`, and sorting by `workers` descending. Take the first 5.

Example with current data:

| Rank | Occupation | Workers |
|------|-----------|---------|
| 1 | Commercial Sales Representatives | 283,625 |
| 2 | Contact Centre Salespersons | 174,588 |
| 3 | Accounting And Book-Keeping Clerks | 172,216 |
| 4 | Accountants And Auditors | 167,528 |
| 5 | Mechanical Engineering Technicians | 128,972 |

Worker counts are displayed with `toLocaleString()` formatting (e.g., "283,625 workers").

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
   - Filter nodes where `aiExposure === 1` and `workers !== null`
   - Sort by `workers` descending
   - Take first 5
   - Guard: if `nodes` is undefined, return empty array (no suggestions rendered)

### Dropdown Behavior

1. Track input text via Base UI's `onInputValueChange` callback on `Combobox` (the `ComboboxPrimitive.Root`). Store in `useState<string>("")`.
2. Configure the Combobox to open on focus by setting `openOnFocus` on `ComboboxPrimitive.Root` (or equivalent Base UI API) so the dropdown appears immediately when the input gains focus — even with empty text.
3. When input is empty and dropdown is open:
   - Render a custom suggestions section **before** `ComboboxList` inside `ComboboxContent`
   - Suggestions are styled `button` elements (not `ComboboxItem`) that call `onOccupationSelect(id)` on click
   - `ComboboxEmpty` is not shown (the suggestions section replaces it visually)
4. When input has text:
   - Hide the suggestions section
   - Normal Combobox filtering renders the standard occupation list
   - `ComboboxEmpty` shows "No occupations found." as usual when no results match

### Component Changes

**`OccupationSearch.tsx`**:
- Add `nodes?: GraphNode[]` prop (optional, only used in hero mode)
- Add `inputValue` state tracking via `onInputValueChange`
- Compute `topExposedOccupations` via `useMemo`
- Render suggestions section conditionally inside `ComboboxContent` when `inputValue` is empty and `hero` is true

**`app/page.tsx`**:
- Pass `nodes` prop to the hero `OccupationSearch` instance

### Files Modified

- `components/graph/OccupationSearch.tsx` — main implementation
- `app/page.tsx` — pass `nodes` prop to hero search

No new files or components needed.
