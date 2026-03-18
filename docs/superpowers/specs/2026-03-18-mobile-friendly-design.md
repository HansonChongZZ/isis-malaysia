# Mobile-Friendly Occupation Detail — Design Spec

**Date:** 2026-03-18
**Status:** Draft

## Problem

The occupation detail panel and comparison view use fixed side-by-side layouts that don't adapt to mobile screens. The hero search is completely hidden on mobile. Tablets (< 768px) also suffer from cramped layouts.

## Goals

- Make the occupation detail panel readable and usable on mobile devices
- Make the comparison view functional on narrow screens
- Expose the hero search on all screen sizes
- Use `md:` (768px) as the mobile/desktop breakpoint

## Non-Goals

- Redesigning graph touch interactions or mobile graph UX (graph is secondary on mobile)
- Adding new navigation patterns (tabs, bottom sheets, swipeable views)
- Creating new components — all changes are responsive breakpoint additions

## Design Decisions

### 1. Panel Layout: Stacked Single Scroll (< 768px)

**Current:** `OccupationPanel` uses a hard `w-1/2` + `w-1/2` split for `OccupationDetailPane` (left) and `TransitionCards` (right).

**Change:** Below `md:` breakpoint, stack vertically:
- `OccupationDetailPane` renders full-width at the top with a compact summary layout (AI exposure and median wage side-by-side in one row, skills below)
- `TransitionCards` renders full-width below the detail pane
- Both scroll together in one continuous view

**Desktop (≥ 768px):** No change — keep the existing 50/50 split.

### 2. Comparison View: Improved Side-by-Side

**Current:** `ComparisonGrid` uses `flex` with `flex-1` columns for all sections. Match dots live inside the target role's header column. Tasks are side-by-side.

**Changes (all screen sizes, not just mobile):**

- **Match dots summary bar:** Move match dots out of the target column into a dedicated full-width bar between the occupation names row and the metrics rows. Dots wrap naturally across multiple rows for occupations with many skills. Text below shows exact counts ("7 shared · 11 to develop").

- **Metrics grid (AI Exposure, Wage):** Keep side-by-side at all sizes. Tighten padding and font sizes on mobile. Abbreviate deltas (e.g., "▲1.7k" instead of "▲ MYR 1,702").

- **Skills section:** Already full-width — no change needed.

- **Tasks section:** Below `md:`, stack vertically (current role tasks, then target role tasks) instead of side-by-side.

### 3. Hero Search: Visible on Mobile

**Current:** The hero search wrapper has `hidden sm:flex`, making it invisible below 640px.

**Change:** Remove `hidden sm:flex`. Make the hero search responsive:
- On mobile: full-width with appropriate padding, positioned over the graph
- On desktop: keep existing `max-w-xl` centered layout

### 4. Breakpoint: `md:` (768px)

**Current:** The app uses `sm:` (640px) as its only responsive breakpoint.

**Change:** Use `md:` (768px) as the mobile/desktop divider for all panel and comparison layout changes. This ensures tablets also get the mobile-optimized layout. Existing `sm:` breakpoints in `GraphControls` and other components should be audited and shifted to `md:` where they affect the panel experience.

## Component Change Map

### `OccupationPanel.tsx`

```
Current:
  <div className="flex flex-1 min-h-0">
    <div className="w-1/2 border-r ...">
      <OccupationDetailPane />
    </div>
    <div className="w-1/2 ...">
      <TransitionCards />
    </div>
  </div>

Change to:
  <div className="flex flex-col md:flex-row flex-1 min-h-0">
    <div className="w-full md:w-1/2 md:border-r ...">
      <OccupationDetailPane />
    </div>
    <div className="w-full md:w-1/2 ...">
      <TransitionCards />
    </div>
  </div>
```

On mobile, the panel becomes a single scrollable column. The `h-[90vh]` on `DialogContent` stays — the scroll just flows vertically through both sections.

### `OccupationDetailPane.tsx`

On mobile (< 768px), add a compact summary row:
- AI Exposure value + progress bar and Median Wage side-by-side in one flex row
- Reduces vertical space so transition cards are visible sooner when scrolling

No structural changes to skills or tasks sections — they already use `flex-wrap` and work at full width.

### `TransitionCards.tsx`

No structural changes needed. Already uses `flex flex-col` internally. When rendered full-width (instead of `w-1/2`), cards naturally take the full width and become more readable.

### `ComparisonGrid.tsx`

1. **Add match dots summary bar** — new full-width row after the occupation names row, before AI Exposure row. Contains the dot visualization + text counts. Remove dots from the target occupation column header.

2. **Tasks section** — change from side-by-side to stacked on mobile:
   ```
   Current:  <div className="flex">
   Change:   <div className="flex flex-col md:flex-row">
   ```

3. **Tighten padding** on mobile — reduce `px-5 py-3` to `px-3 py-2` below `md:`.

### `OccupationSearch.tsx`

Change hero search visibility:
```
Current:  <div className="hidden sm:flex absolute inset-x-0 top-[20%] ...">
Change:   <div className="flex absolute inset-x-0 top-[20%] ...">
```

Adjust mobile sizing: the hero search should use smaller padding and font sizes below `md:`, and `top-[20%]` may need adjustment to `top-[10%]` on mobile to avoid overlap with controls.

### `GraphControls.tsx`

Audit existing `sm:` breakpoints and shift to `md:` where they relate to the search/filter toolbar layout:
- `sm:flex-nowrap` → `md:flex-nowrap`
- `sm:max-w-sm` → `md:max-w-sm`
- Other `sm:` utilities in this component should be reviewed

## Testing

- Test on iPhone SE (375px), iPhone 14 (390px), iPad Mini (744px), iPad (810px)
- Verify the stacked layout kicks in below 768px
- Verify comparison dots wrap gracefully with high skill counts (15-20+)
- Verify hero search is visible and usable on all sizes
- Verify desktop layout is completely unchanged at ≥ 768px
