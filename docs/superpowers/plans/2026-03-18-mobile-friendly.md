# Mobile-Friendly Occupation Detail Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the occupation detail panel, comparison view, and hero search usable on mobile and tablet screens (< 768px).

**Architecture:** All changes are responsive CSS/Tailwind additions to existing components. No new components, no structural rewrites. The `md:` (768px) breakpoint replaces `sm:` (640px) as the mobile/desktop divider for panel-related layouts.

**Tech Stack:** Next.js, React, Tailwind CSS v4, shadcn/ui Dialog

**Spec:** `docs/superpowers/specs/2026-03-18-mobile-friendly-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/panel/OccupationPanel.tsx` | Modify | Dialog fullscreen on mobile, stacked panel layout |
| `components/panel/OccupationDetailPane.tsx` | Modify | Compact summary row on mobile |
| `components/panel/ComparisonGrid.tsx` | Modify | Match dots summary bar, stacked tasks, tighter padding |
| `lib/format.ts` | Create | Wage abbreviation utility (`formatCompact`) |
| `app/page.tsx` | Modify | Hero search visibility on mobile |
| `components/graph/GraphControls.tsx` | Modify | Shift `sm:` breakpoints to `md:` |

---

### Task 1: Add `formatCompact` utility

**Files:**
- Create: `lib/format.ts`

This utility is needed by Task 4 (ComparisonGrid) for abbreviating wage deltas.

- [ ] **Step 1: Create the utility**

```ts
// lib/format.ts

/**
 * Format a number compactly for mobile display.
 * - >= 1,000,000 → "X.YM"
 * - >= 1,000     → "X.Yk"
 * - < 1,000      → as-is
 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit lib/format.ts` or check via IDE diagnostics.

- [ ] **Step 3: Commit**

```bash
git add lib/format.ts
git commit -m "feat: add formatCompact utility for mobile wage display"
```

---

### Task 2: Make OccupationPanel mobile-friendly

**Files:**
- Modify: `components/panel/OccupationPanel.tsx:138,181-196`

Two changes: (1) DialogContent goes full-width on mobile, (2) the transitions branch stacks vertically.

- [ ] **Step 1: Update DialogContent classes (line 138)**

Change:
```
className="bg-card border-border text-foreground sm:max-w-6xl h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
```

To:
```
className="bg-card border-border text-foreground max-w-full md:max-w-6xl h-[90dvh] overflow-hidden p-0 flex flex-col gap-0"
```

Changes: `sm:max-w-6xl` → `max-w-full md:max-w-6xl`, `h-[90vh]` → `h-[90dvh]`.

- [ ] **Step 2: Update transitions branch layout (lines 181-196)**

Change:
```tsx
<div className="flex flex-1 min-h-0">
  {/* Left pane — primary occupation details */}
  <div className="w-1/2 border-r border-border min-h-0 overflow-hidden">
    <OccupationDetailPane detail={detail} />
  </div>

  {/* Right pane — transition cards */}
  <div className="w-1/2 flex flex-col min-h-0">
```

To:
```tsx
<div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
  {/* Left pane — primary occupation details */}
  <div className="w-full md:w-1/2 md:border-r border-border min-h-0 md:overflow-hidden">
    <OccupationDetailPane detail={detail} />
  </div>

  {/* Right pane — transition cards */}
  <div className="w-full md:w-1/2 flex flex-col min-h-0">
```

- [ ] **Step 3: Visual check**

Open the app in Chrome DevTools responsive mode at 375px and 810px. At 375px the detail and transitions should stack vertically. At 810px the 50/50 split should be unchanged.

- [ ] **Step 4: Commit**

```bash
git add components/panel/OccupationPanel.tsx
git commit -m "feat: make OccupationPanel stack vertically on mobile"
```

---

### Task 3: Add compact summary to OccupationDetailPane

**Files:**
- Modify: `components/panel/OccupationDetailPane.tsx:47-99`

Add a mobile-only compact row (AI + Wage side-by-side), hide the full sections on mobile.

- [ ] **Step 1: Add compact summary row after the `{header}` slot (after line 49)**

Insert after `{header}`:
```tsx
{/* Mobile compact summary: AI + Wage side-by-side */}
<div className="flex md:hidden items-start justify-between gap-4 mb-4">
  <div className="flex-1">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
      AI Exposure
    </h3>
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold" style={{ color: quartileColour }}>
        {(detail.aiExposure * 100).toFixed(1)}%
      </span>
      <Badge
        className="text-xs"
        style={{
          backgroundColor: `color-mix(in srgb, ${quartileColour} 20%, transparent)`,
          color: quartileColour,
          border: `1px solid color-mix(in srgb, ${quartileColour} 40%, transparent)`,
        }}
      >
        {detail.quartile}
      </Badge>
    </div>
    <div className="h-2 bg-muted rounded-full overflow-hidden mt-1.5">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${detail.aiExposure * 100}%`,
          backgroundColor: quartileColour,
        }}
      />
    </div>
  </div>
  <div className="text-right">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
      Median Wage
    </h3>
    <p className="text-lg font-semibold text-foreground">
      {detail.wage !== null ? `MYR ${detail.wage.toLocaleString()}` : '—'}
    </p>
  </div>
</div>
```

- [ ] **Step 2: Hide full AI Exposure and Wage sections on mobile**

Wrap the AI Exposure `<section>` (lines 52-99) with `hidden md:block`:
```tsx
<section className="hidden md:block">
```

Wrap the Wage `<section>` (lines 101-128) with `hidden md:block`:
```tsx
<section className="hidden md:block">
```

- [ ] **Step 3: Visual check**

At 375px: compact row shows AI% and Wage side-by-side, full sections hidden.
At 810px: original layout with full sections visible, compact row hidden.

- [ ] **Step 4: Commit**

```bash
git add components/panel/OccupationDetailPane.tsx
git commit -m "feat: add compact mobile summary to OccupationDetailPane"
```

---

### Task 4: Improve ComparisonGrid for mobile

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx:133-188,193-268,353-371`
- Uses: `lib/format.ts` (from Task 1)

Three changes: (1) extract match dots into summary bar, (2) stacked tasks on mobile, (3) tighter padding + abbreviated deltas.

- [ ] **Step 1: Add import for formatCompact**

At top of file:
```tsx
import { formatCompact } from '@/lib/format';
```

- [ ] **Step 2: Extract match dots into a dedicated full-width summary bar**

After the occupation names row (`</div>` at ~line 190), before the AI Exposure row, insert a new full-width row:

```tsx
{/* Match dots summary bar — full width */}
{(() => {
  const sharedCount = comparison.specificSkills.filter((s) =>
    sharedSkills.has(s.toLowerCase()),
  ).length;
  const developCount = comparison.specificSkills.length - sharedCount;
  const total = comparison.specificSkills.length;
  if (total === 0) return null;
  return (
    <div className="px-3 py-2 md:px-5 md:py-3 border-b border-border" style={{ background: 'rgba(106,209,156,0.04)' }}>
      <div className="flex flex-wrap gap-[3px] bg-muted rounded px-1.5 py-1 mb-1.5">
        {[...comparison.specificSkills]
          .sort((a, b) => {
            const aShared = sharedSkills.has(a.toLowerCase()) ? 0 : 1;
            const bShared = sharedSkills.has(b.toLowerCase()) ? 0 : 1;
            return aShared - bShared;
          })
          .map((skill, i) => (
            <span
              key={i}
              className="inline-block w-2 h-2 rounded-full"
              style={{
                backgroundColor: sharedSkills.has(skill.toLowerCase())
                  ? '#22c55e'
                  : 'rgba(59,130,246,0.4)',
              }}
            />
          ))}
      </div>
      <span className="text-muted-foreground text-xs">
        {sharedCount} shared · {developCount} to develop
      </span>
    </div>
  );
})()}
```

Remove the existing match dots block from the target occupation column header (lines ~154-188 — the IIFE that renders dots inside the target column).

- [ ] **Step 3: Abbreviate wage deltas**

In the wage comparison row (~line 258), change:
```tsx
{comparisonDeltas.wage > 0 ? '▲' : '▼'} MYR{' '}
{Math.abs(comparisonDeltas.wage).toLocaleString()}
```

To:
```tsx
{comparisonDeltas.wage > 0 ? '▲' : '▼'}{' '}
{formatCompact(Math.abs(comparisonDeltas.wage))}
```

- [ ] **Step 4: Tighten padding on mobile**

Update all row containers that use `px-5 py-3` to `px-3 py-2 md:px-5 md:py-3`. Affected elements:
- Occupation names row columns (lines 134, 146): `px-5 py-3` → `px-3 py-2 md:px-5 md:py-3`
- AI Exposure row columns (lines 194, 209): same change
- Wage row columns (lines 237, 249): same change
- Skills section container (line 273): `px-5 py-3.5` → `px-3 py-2.5 md:px-5 md:py-3.5`
- Tasks section columns (lines 355, 362): `px-4 py-3.5` → `px-3 py-2.5 md:px-4 md:py-3.5`

- [ ] **Step 5: Stack tasks on mobile**

Change line 354:
```tsx
<div className="flex">
```
To:
```tsx
<div className="flex flex-col md:flex-row">
```

- [ ] **Step 6: Visual check**

Open comparison view at 375px. Verify:
- Match dots appear as full-width bar between names and metrics
- Dots wrap across rows for many skills
- Tasks stack vertically
- Padding is tighter
- Wage delta shows abbreviated format

At 810px, verify desktop layout is unchanged (except dots moved to summary bar, which is an all-screen change).

- [ ] **Step 7: Commit**

```bash
git add components/panel/ComparisonGrid.tsx lib/format.ts
git commit -m "feat: improve ComparisonGrid mobile layout with dots bar and stacked tasks"
```

---

### Task 5: Show hero search on mobile

**Files:**
- Modify: `app/page.tsx:508`

- [ ] **Step 1: Update hero search wrapper class**

Change line 508:
```tsx
<div className="hidden sm:flex absolute inset-x-0 top-[20%] z-10 justify-center px-4 pointer-events-none">
```

To:
```tsx
<div className="flex absolute inset-x-0 top-[10%] md:top-[20%] z-10 justify-center px-4 pointer-events-none">
```

- [ ] **Step 2: Visual check**

At 375px: hero search should be visible, positioned at 10% from top.
At 810px: hero search at 20% from top, same as before.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: show hero search on mobile"
```

---

### Task 6: Shift GraphControls breakpoints to md:

**Files:**
- Modify: `components/graph/GraphControls.tsx:101-103,116,125,127`

- [ ] **Step 1: Update search input breakpoints (lines 101-103)**

Change:
```tsx
"flex-1 min-w-0 w-full sm:w-auto sm:max-w-sm",
hideSearchOnDesktop && "sm:hidden"
```

To:
```tsx
"flex-1 min-w-0 w-full md:w-auto md:max-w-sm",
hideSearchOnDesktop && "md:hidden"
```

- [ ] **Step 2: Update re-open hero button (line 116)**

Change:
```tsx
className="hidden sm:flex items-center gap-1.5 ...
```

To:
```tsx
className="hidden md:flex items-center gap-1.5 ...
```

- [ ] **Step 3: Update filter row wrapping (line 125)**

Change:
```tsx
<div className="flex gap-2 flex-1 flex-wrap sm:flex-nowrap items-center min-w-0">
```

To:
```tsx
<div className="flex gap-2 flex-1 flex-wrap md:flex-nowrap items-center min-w-0">
```

- [ ] **Step 4: Update skill filter width (line 127)**

Change:
```tsx
<div className="min-w-0 w-full sm:w-auto sm:max-w-64">
```

To:
```tsx
<div className="min-w-0 w-full md:w-auto md:max-w-64">
```

- [ ] **Step 5: Visual check**

At 744px (iPad Mini): controls should wrap like mobile. At 810px: desktop inline layout.

- [ ] **Step 6: Commit**

```bash
git add components/graph/GraphControls.tsx
git commit -m "feat: shift GraphControls breakpoints from sm: to md:"
```

---

### Task 7: Final integration check

**Files:** None (testing only)

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test all breakpoints in Chrome DevTools responsive mode**

Walk through these scenarios at 375px, 744px, and 810px:

1. **Home page** — hero search visible at all sizes
2. **Select an occupation** — panel opens, stacks on mobile, splits on desktop
3. **Click a transition card** — comparison view shows dots bar, tighter padding on mobile
4. **Comparison tasks** — stacked on mobile, side-by-side on desktop
5. **Dismiss hero search** — re-open button visible on desktop (≥ 768px) only
6. **GraphControls filters** — wrap on mobile, inline on desktop

- [ ] **Step 3: Commit any fixes**

If any issues found, fix and commit with descriptive message.
