# Transition Card Sorting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sort transition pathway cards by skills in common (desc), skills to develop (asc), AI exposure (asc), wage (desc).

**Architecture:** Move sorting responsibility from `OccupationPanel.tsx` into `TransitionCards.tsx` where skill overlap data (`cardPreviews`) is already computed. Use a `useMemo` that sorts the table's filtered rows using the `cardPreviews` map as a lookup for skill counts. Remove the old weight-based sort from `OccupationPanel.tsx`.

**Tech Stack:** React, TypeScript, TanStack Table

---

### Task 1: Remove old sort from OccupationPanel.tsx

**Files:**
- Modify: `components/panel/OccupationPanel.tsx:71-75`

- [ ] **Step 1: Remove the existing sort block**

Replace lines 71-75 in `OccupationPanel.tsx`:

```typescript
// REMOVE:
rows.sort((a, b) => {
  if (b.weight !== a.weight) return b.weight - a.weight
  if (a.aiExposure !== b.aiExposure) return a.aiExposure - b.aiExposure
  return (b.wage ?? -Infinity) - (a.wage ?? -Infinity)
})
```

The `rows` array will now be unsorted (insertion order from edges), which is fine since `TransitionCards.tsx` will handle sorting.

---

### Task 2: Add multi-criteria sort in TransitionCards.tsx

**Files:**
- Modify: `components/panel/TransitionCards.tsx`

- [ ] **Step 2: Create a sorted rows memo that uses cardPreviews**

After the `cardPreviews` memo (line 83), add a new `sortedTransitions` memo that sorts by:
1. `sharedSpecific` descending (skills in common — most first)
2. `(totalSpecific - sharedSpecific)` ascending (skills to develop — fewest first)
3. `aiExposure` ascending (lowest first)
4. `wage` descending (highest first, nulls last)

```typescript
const sortedTransitions = useMemo(() => {
  return [...transitions].sort((a, b) => {
    const pa = cardPreviews.get(a.id);
    const pb = cardPreviews.get(b.id);
    const sharedA = pa?.sharedSpecific ?? 0;
    const sharedB = pb?.sharedSpecific ?? 0;

    // 1. Skills in common — most to least
    if (sharedB !== sharedA) return sharedB - sharedA;

    // 2. Skills to develop — least to most
    const developA = (pa?.totalSpecific ?? 0) - sharedA;
    const developB = (pb?.totalSpecific ?? 0) - sharedB;
    if (developA !== developB) return developA - developB;

    // 3. AI exposure — lowest to highest
    if (a.aiExposure !== b.aiExposure) return a.aiExposure - b.aiExposure;

    // 4. Wage — largest to smallest (nulls last)
    return (b.wage ?? -Infinity) - (a.wage ?? -Infinity);
  });
}, [transitions, cardPreviews]);
```

- [ ] **Step 3: Feed sortedTransitions into the table instead of transitions**

Change the `useReactTable` call to use `sortedTransitions`:

```typescript
const table = useReactTable({
  data: sortedTransitions,  // was: transitions
  columns,
  ...
});
```

- [ ] **Step 4: Verify the app compiles and renders correctly**

Run: `npm run dev` (or equivalent) and check the panel visually — cards should now appear with most-shared-skills occupations at top.

- [ ] **Step 5: Commit**

```bash
git add components/panel/OccupationPanel.tsx components/panel/TransitionCards.tsx
git commit -m "feat: sort transition cards by skills overlap, AI exposure, and wage"
```
