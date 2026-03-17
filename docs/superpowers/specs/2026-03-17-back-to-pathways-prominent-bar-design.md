# Design: Prominent "Back to pathways" bar in ComparisonGrid

## Problem

When users drill into a comparison view by clicking a transition card, the only way back to the card list view is a tiny `text-xs` link (12px arrow + text) buried in the ComparisonGrid's right pane header. Users don't notice it and get stuck in the comparison view.

## Solution

Replace the current text link with a full-width, tinted, sticky bar at the top of the right pane in the ComparisonGrid. This makes the back action immediately discoverable and always accessible regardless of scroll position.

## Design

### Layout

The right pane of the ComparisonGrid currently has this header structure:

```
[Back to pathways (tiny link)] [occupation code]
[Occupation name]
[Skill match dots]
```

The new structure adds a sticky bar above the existing content:

```
┌─────────────────────────────────────┐
│ [←]  Back to pathways               │  ← new: tinted green bar, sticky
│       Return to transition list     │
├─────────────────────────────────────┤
│ 5678-02                             │  ← existing occupation info (unchanged)
│ Data Analyst                        │
│ Match: ●●●○○  3 shared, 2 develop  │
└─────────────────────────────────────┘
```

### Visual treatment

- **Width:** Full width of the right pane
- **Background:** Primary color at ~15% opacity (`bg-primary/15`), gradient optional
- **Bottom border:** 1px solid, primary color at ~30% opacity, to separate from content below
- **Arrow icon:** `ArrowLeftIcon` (lucide-react) inside a small rounded container (`bg-primary/20`, `rounded-md`, ~28px square)
- **Primary text:** "Back to pathways" — `text-sm font-semibold text-primary`
- **Subtext:** "Return to transition list" — `text-xs text-primary/60`
- **Hover state:** Background opacity increases to ~25% (`hover:bg-primary/25`), smooth transition
- **Cursor:** `cursor-pointer` on the entire bar
- **Sticky behavior:** The bar stays pinned to the top of the right pane column as the user scrolls through the comparison grid content

### Sticky implementation

The ComparisonGrid currently uses a single scrollable container (`overflow-y-auto` on the outer wrapper). To make the bar sticky within just the right pane:

- Add `sticky top-0 z-10` to the bar element
- The bar will stick within the nearest scrolling ancestor (the outer `overflow-y-auto` div)
- Since the left pane content scrolls with the same container, the bar only appears sticky within its visual column — the left pane scrolls normally alongside it

### Interaction

- Clicking anywhere on the bar triggers `onBack()` (same callback as current link)
- The `onBack` handler sets `comparisonNodeId` to `null`, returning to the OccupationDetailPane + TransitionCards view

## Changes required

### ComparisonGrid.tsx

1. **Remove** the current inline back button from the right pane header (the `<button>` with `text-xs text-primary` at line ~147-154)
2. **Add** a new sticky tinted bar as the first child of the right pane's `w-1/2` column in the header row
3. No new props needed — reuse existing `onBack` prop

### No other files affected

- `OccupationPanel.tsx` — no changes (passes `onBack` as before)
- `OccupationDetailPane.tsx` — no changes
- `TransitionCards.tsx` — no changes
- No new components or dependencies

## Out of scope

- Changes to the sticky DialogHeader
- Changes to the left pane
- Breadcrumb navigation
- Back navigation from non-comparison panel states
