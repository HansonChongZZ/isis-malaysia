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

**Current:** `OccupationPanel` renders one of three branches:
- (a) Comparison mode → `ComparisonGrid` (addressed separately in section 2)
- (b) No transitions → full-width `OccupationDetailPane` (already mobile-friendly, no change needed)
- (c) Has transitions → hard `w-1/2` + `w-1/2` split for detail + transitions (**this is the problem**)

**Change:** Only branch (c) needs modification. Below `md:` breakpoint, stack vertically:
- `OccupationDetailPane` renders full-width at the top with a compact summary layout (AI exposure and median wage side-by-side in one row, skills below)
- `TransitionCards` renders full-width below the detail pane
- Both scroll together in one continuous view

**Desktop (≥ 768px):** No change — keep the existing 50/50 split.

### 2. Comparison View: Improved Side-by-Side

**Current:** `ComparisonGrid` uses `flex` with `flex-1` columns for all sections. Match dots live inside the target role's header column. Tasks are side-by-side.

**Changes (all screen sizes, not just mobile):**

- **Match dots summary bar:** Move match dots out of the target column into a dedicated full-width bar between the occupation names row and the metrics rows. Dots wrap naturally across multiple rows for occupations with many skills. Text below shows exact counts ("7 shared · 11 to develop").

- **Metrics grid (AI Exposure, Wage):** Keep side-by-side at all sizes. Tighten padding and font sizes on mobile. Abbreviate deltas using these rules: values ≥ 1,000 display as "X.Yk" (one decimal, e.g., 1,702 → "1.7k"); values ≥ 1,000,000 display as "X.YM"; values < 1,000 display as-is.

- **Skills section:** Already full-width — no change needed.

- **Tasks section:** Below `md:`, stack vertically (current role tasks, then target role tasks) instead of side-by-side.

### 3. Hero Search: Visible on Mobile

**Current:** The hero search wrapper has `hidden sm:flex`, making it invisible below 640px.

**Change:** Remove `hidden sm:flex`, replace with `flex`. Make the hero search responsive:
- On mobile: full-width with appropriate padding, positioned over the graph
- On desktop: keep existing `max-w-xl` centered layout
- The `kbd` shortcut hint (`Ctrl+F` / `Cmd+F`) should remain hidden on mobile — mobile users don't have physical keyboards. Its existing `hidden sm:inline-flex` is fine.

### 4. Breakpoint: `md:` (768px)

**Current:** The app uses `sm:` (640px) as its only responsive breakpoint.

**Change:** Use `md:` (768px) as the mobile/desktop divider for all panel and comparison layout changes. This ensures tablets also get the mobile-optimized layout. Existing `sm:` breakpoints in `GraphControls` and other components should be audited and shifted to `md:` where they affect the panel experience.

## Component Change Map

### `OccupationPanel.tsx`

The component has three render branches (lines 164-197). Only branch (c) — the transitions split — needs changes:

```
Current (branch c, line 181-196):
  <div className="flex flex-1 min-h-0">
    <div className="w-1/2 border-r border-border min-h-0 overflow-hidden">
      <OccupationDetailPane detail={detail} />
    </div>
    <div className="w-1/2 flex flex-col min-h-0">
      <TransitionCards ... />
    </div>
  </div>

Change to:
  <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
    <div className="w-full md:w-1/2 md:border-r border-border min-h-0 md:overflow-hidden">
      <OccupationDetailPane detail={detail} />
    </div>
    <div className="w-full md:w-1/2 flex flex-col min-h-0">
      <TransitionCards ... />
    </div>
  </div>
```

Branch (a) — comparison mode — is handled by `ComparisonGrid` changes below.
Branch (b) — no transitions — already renders full-width, no change needed.

**DialogContent** (line 138): Change `sm:max-w-6xl` to `max-w-full md:max-w-6xl` to ensure the dialog goes full-width on mobile instead of falling back to shadcn's default constrained width. Consider also changing `h-[90vh]` to `h-[90dvh]` for better mobile browser support (dynamic viewport height handles address bar show/hide).

### `OccupationDetailPane.tsx`

On mobile (< 768px), add a compact summary row at the top of the pane:

```
<!-- Mobile compact summary: AI + Wage side-by-side -->
<div className="flex md:hidden items-start justify-between gap-4 mb-4">
  <div className="flex-1">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
      AI Exposure
    </h3>
    <span className="text-2xl font-bold" style={{ color: quartileColour }}>
      {(detail.aiExposure * 100).toFixed(1)}%
    </span>
    <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
      <div className="h-full rounded-full" style={{ width: `${detail.aiExposure * 100}%`, backgroundColor: quartileColour }} />
    </div>
  </div>
  <div className="text-right">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
      Median Wage
    </h3>
    <p className="text-lg font-semibold text-foreground">
      MYR {detail.wage?.toLocaleString() ?? '—'}
    </p>
  </div>
</div>
<!-- Existing sections: hide AI + Wage on mobile since they're in the compact row -->
<section className="hidden md:block">...</section> <!-- AI Exposure full section -->
<section className="hidden md:block">...</section> <!-- Wage full section -->
```

Skills and tasks sections remain unchanged — they already use `flex-wrap` and work at full width.

### `TransitionCards.tsx`

No structural changes needed. Already uses `flex flex-col` internally. When rendered full-width (instead of `w-1/2`), cards naturally take the full width and become more readable.

### `ComparisonGrid.tsx`

1. **Add match dots summary bar** — new full-width row after the occupation names row, before AI Exposure row. Contains the dot visualization + text counts. Remove dots from the target occupation column header (lines 162-188).

2. **Tasks section** — change from side-by-side to stacked on mobile:
   ```
   Current (line 354):  <div className="flex">
   Change:              <div className="flex flex-col md:flex-row">
   ```

3. **Tighten padding** on mobile — use `px-3 py-2 md:px-5 md:py-3` on row containers.

### `OccupationSearch.tsx` (in `app/page.tsx`, lines 507-521)

The hero search wrapper lives in `page.tsx`, not `OccupationSearch.tsx`. Change:
```
Current (line 508):
  <div className="hidden sm:flex absolute inset-x-0 top-[20%] z-10 justify-center px-4 pointer-events-none">

Change to:
  <div className="flex absolute inset-x-0 top-[10%] md:top-[20%] z-10 justify-center px-4 pointer-events-none">
```

All other classes (`absolute`, `inset-x-0`, `z-10`, `justify-center`, `px-4`, `pointer-events-none`) are preserved. Only `hidden sm:flex` → `flex` and `top-[20%]` → `top-[10%] md:top-[20%]`.

### `GraphControls.tsx`

Shift these `sm:` breakpoints to `md:`:
- Line 102: `sm:w-auto sm:max-w-sm` → `md:w-auto md:max-w-sm` (search input width)
- Line 125: `sm:flex-nowrap` → `md:flex-nowrap` (filter row wrapping)
- Line 127: `sm:w-auto sm:max-w-64` → `md:w-auto md:max-w-64` (skill filter width)
- Line 103: `hideSearchOnDesktop` conditional class `sm:hidden` → `md:hidden` (toolbar search visibility when hero is showing)
- Line 117: "Re-open hero search" button `hidden sm:flex` → `hidden md:flex` (match hero search visibility)

## Testing

- Test on iPhone SE (375px), iPhone 14 (390px), iPad Mini (744px), iPad (810px)
- Verify the stacked layout kicks in below 768px
- Verify comparison dots wrap gracefully with high skill counts (15-20+)
- Verify hero search is visible and usable on all sizes
- Verify desktop layout is completely unchanged at ≥ 768px
- Verify dialog goes full-width on mobile (no constrained modal width)
- Verify toolbar search and hero search don't both show/hide unexpectedly in the 640-767px range
