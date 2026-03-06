# Prominent Search Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the occupation search bar a floating hero element over the graph that collapses into the control bar on selection.

**Architecture:** Extract the occupation search combobox from `GraphControls` into a standalone `OccupationSearch` component with hero/collapsed variants. The hero variant floats absolutely over the graph area in `page.tsx`. State is driven by existing `selectedNodeId` — null = hero, set = collapsed.

**Tech Stack:** React, Tailwind CSS 4, Base UI Combobox, CSS transitions

---

### Task 1: Extract OccupationSearch component from GraphControls

**Files:**
- Create: `components/graph/OccupationSearch.tsx`
- Modify: `components/graph/GraphControls.tsx:96-124`

**Step 1: Create OccupationSearch component**

Extract the occupation combobox into its own component with the same props interface:

```tsx
'use client';

import { useMemo } from 'react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

type OccupationOption = { id: string; label: string };

interface OccupationSearchProps {
  occupations: OccupationOption[];
  selectedOccupation: string | null;
  onOccupationSelect: (id: string | null) => void;
}

export default function OccupationSearch({
  occupations,
  selectedOccupation,
  onOccupationSelect,
}: OccupationSearchProps) {
  const selectedOccupationObj = useMemo(() => {
    if (!selectedOccupation) return null;
    return occupations.find((o) => o.id === selectedOccupation) ?? null;
  }, [occupations, selectedOccupation]);

  return (
    <Combobox
      items={occupations}
      itemToStringValue={(occ) => occ.label}
      value={selectedOccupationObj}
      onValueChange={(occ) => onOccupationSelect(occ?.id ?? null)}
    >
      <ComboboxInput
        placeholder="Search occupation…"
        showClear={!!selectedOccupation}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>No occupations found.</ComboboxEmpty>
        <ComboboxList>
          {(occ) => (
            <ComboboxItem key={occ.id} value={occ}>
              <span>{occ.label}</span>
              <span className="text-muted-foreground text-xs ml-1">
                {occ.id}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
```

**Step 2: Update GraphControls to use OccupationSearch**

Remove the `selectedOccupationObj` memo and the combobox JSX from `GraphControls`. Replace lines 96-124 with:

```tsx
import OccupationSearch from './OccupationSearch';

// In the return, replace the occupation search div (lines 97-124) with:
<div className="flex-1 min-w-0 w-full sm:w-auto sm:max-w-sm">
  <OccupationSearch
    occupations={occupations}
    selectedOccupation={selectedOccupation}
    onOccupationSelect={onOccupationSelect}
  />
</div>
```

Also remove `selectedOccupationObj` memo (lines 83-86) since it moves into OccupationSearch.

**Step 3: Verify the app renders correctly**

Run: `npm run dev`
Expected: App works identically to before — search, selection, clearing all function.

**Step 4: Commit**

```bash
git add components/graph/OccupationSearch.tsx components/graph/GraphControls.tsx
git commit -m "refactor: extract OccupationSearch component from GraphControls"
```

---

### Task 2: Add hero variant styling and gradient border CSS

**Files:**
- Modify: `components/graph/OccupationSearch.tsx`
- Modify: `app/globals.css`

**Step 1: Add gradient border keyframes and utility class to globals.css**

Add at the end of `globals.css`:

```css
/* Prominent search bar gradient border */
.search-hero-border {
  position: relative;
  border: none;
}

.search-hero-border::before {
  content: '';
  position: absolute;
  inset: -1.5px;
  border-radius: calc(var(--radius) + 4px);
  padding: 1.5px;
  background: linear-gradient(
    135deg,
    oklch(0.445 0.085 240),
    oklch(0.55 0.12 280),
    oklch(0.445 0.085 240)
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

**Step 2: Add `hero` prop to OccupationSearch**

Update the component to accept a `hero` prop that switches between hero and collapsed styles:

```tsx
import { Search } from 'lucide-react';

interface OccupationSearchProps {
  occupations: OccupationOption[];
  selectedOccupation: string | null;
  onOccupationSelect: (id: string | null) => void;
  hero?: boolean;
}

export default function OccupationSearch({
  occupations,
  selectedOccupation,
  onOccupationSelect,
  hero = false,
}: OccupationSearchProps) {
  // ...existing memo...

  if (hero) {
    return (
      <div className="search-hero-border rounded-xl shadow-lg shadow-primary/10">
        <Combobox
          items={occupations}
          itemToStringValue={(occ) => occ.label}
          value={selectedOccupationObj}
          onValueChange={(occ) => onOccupationSelect(occ?.id ?? null)}
        >
          <ComboboxInput
            placeholder="Search any occupation in Malaysia…"
            showClear={!!selectedOccupation}
            showTrigger={false}
            className="w-full h-12 text-base rounded-xl bg-card/90 backdrop-blur-md border-none [&_input]:text-base [&_input]:pl-10"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <ComboboxContent>
            <ComboboxEmpty>No occupations found.</ComboboxEmpty>
            <ComboboxList>
              {(occ) => (
                <ComboboxItem key={occ.id} value={occ}>
                  <span>{occ.label}</span>
                  <span className="text-muted-foreground text-xs ml-1">
                    {occ.id}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    );
  }

  return (
    // ...existing collapsed combobox (unchanged)...
  );
}
```

**Step 3: Verify hero variant renders**

Temporarily pass `hero` to OccupationSearch in GraphControls and check visually.

Run: `npm run dev`
Expected: Search bar appears with gradient border, larger size, search icon, rounded-xl.

**Step 4: Revert temporary change and commit**

```bash
git add components/graph/OccupationSearch.tsx app/globals.css
git commit -m "feat: add hero variant styling with gradient border to OccupationSearch"
```

---

### Task 3: Wire up hero/collapsed states in page layout

**Files:**
- Modify: `app/page.tsx:125-200`
- Modify: `components/graph/GraphControls.tsx`

**Step 1: Conditionally render hero search bar in page.tsx**

Import `OccupationSearch` and render it floating over the graph when no occupation is selected. On desktop only (use `hidden sm:flex` / `sm:hidden` for breakpoint control).

In the main graph area div (line 149), add the floating hero search:

```tsx
import OccupationSearch from '@/components/graph/OccupationSearch';

// Inside the "Main graph area" div, after the graph but before LayoutTuner:
{!selectedNodeId && (
  <div className="hidden sm:flex absolute inset-x-0 top-[20%] z-10 justify-center px-4 pointer-events-none">
    <div className="w-full max-w-xl pointer-events-auto">
      <OccupationSearch
        occupations={occupationList}
        selectedOccupation={selectedNodeId}
        onOccupationSelect={handleNodeSelect}
        hero
      />
    </div>
  </div>
)}
```

**Step 2: Hide search from GraphControls on desktop when in hero state**

In `GraphControls`, conditionally hide the occupation search wrapper on desktop when no occupation is selected. Add a `hideSearchOnDesktop` prop:

```tsx
// In GraphControls props:
hideSearchOnDesktop?: boolean;

// Wrap the occupation search div:
<div className={cn(
  "flex-1 min-w-0 w-full sm:w-auto sm:max-w-sm",
  hideSearchOnDesktop && "sm:hidden"
)}>
```

Pass `hideSearchOnDesktop={!selectedNodeId}` from page.tsx.

**Step 3: Verify hero/collapsed switching**

Run: `npm run dev`
Expected:
- No selection → hero search floats over graph (desktop), normal search in control bar (mobile)
- Select occupation → hero disappears, search appears in control bar with selected value
- Clear selection → hero reappears

**Step 4: Commit**

```bash
git add app/page.tsx components/graph/GraphControls.tsx
git commit -m "feat: wire up hero/collapsed search bar states"
```

---

### Task 4: Add collapse/expand transition animation

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Step 1: Add entry/exit animation CSS**

Add to `globals.css`:

```css
/* Hero search bar animations */
@keyframes hero-search-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.hero-search-enter {
  animation: hero-search-in 300ms ease-out;
}
```

**Step 2: Apply animation class to hero container**

In `page.tsx`, add the animation class to the hero wrapper div:

```tsx
<div className="w-full max-w-xl pointer-events-auto hero-search-enter">
```

**Step 3: Verify animation plays**

Run: `npm run dev`
Expected: Hero search bar fades in with a subtle upward slide when clearing selection. Selecting an occupation makes it disappear instantly (unmounts).

**Step 4: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat: add entry animation for hero search bar"
```

---

### Task 5: Polish and verify

**Files:**
- Possibly adjust: `components/graph/OccupationSearch.tsx`, `app/globals.css`

**Step 1: Visual check in light and dark modes**

Run: `npm run dev`
Verify:
- Gradient border looks good in both themes
- Glow shadow is subtle, not overpowering
- Backdrop blur works with graph behind it
- Input text and placeholder are readable
- Dropdown positions correctly below hero bar
- Z-index layering: graph < hero search < LayoutTuner < modals

**Step 2: Check that the search icon position is correct**

The `Search` icon needs to sit inside the `InputGroup` wrapper. If the absolute positioning doesn't work with the combobox structure, wrap the hero combobox in a `relative` container and adjust.

**Step 3: Verify "Clear filters" button in GraphControls also triggers hero state**

In `GraphControls`, the "Clear filters" button resets `filterGroup` and `filterSkills`. It does NOT clear the occupation. Verify that clearing occupation (via the X button or via `onOccupationSelect(null)`) properly returns to hero state.

**Step 4: Adjust any spacing/sizing issues found during visual review**

Fine-tune padding, shadow intensity, gradient colors as needed.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: polish prominent search bar styling and interactions"
```

---

### Task 6: Build check

**Step 1: Run production build**

Run: `npm run build`
Expected: No TypeScript errors, no build warnings related to changed files.

**Step 2: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: resolve build issues for prominent search bar"
```
