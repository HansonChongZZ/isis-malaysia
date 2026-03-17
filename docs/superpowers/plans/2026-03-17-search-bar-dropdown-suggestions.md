# Search Bar Dropdown Suggestions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the 5 occupations with most workers at 100% AI exposure as suggestions in the hero search dropdown on focus.

**Architecture:** Extend `OccupationSearch` to accept `GraphNode[]`, compute top-5 suggestions via `useMemo`, and render a styled suggestion section inside the existing `ComboboxContent` when input is empty. Pass `nodes` from `page.tsx`.

**Tech Stack:** React, Base UI Combobox, Tailwind CSS, Next.js

**Spec:** `docs/superpowers/specs/2026-03-17-search-bar-dropdown-suggestions-design.md`

---

## Chunk 1: Implementation

### Task 1: Add nodes prop and compute top 5 suggestions

**Files:**
- Modify: `components/graph/OccupationSearch.tsx`

- [ ] **Step 1: Add `nodes` prop and import `GraphNode` type**

Add import and extend the props interface:

```tsx
import type { GraphNode } from '@/lib/types';

// Add to OccupationSearchProps:
nodes?: GraphNode[];
```

Add `nodes` to the destructured props.

- [ ] **Step 2: Add `inputValue` state and `topExposedOccupations` memo**

Inside `OccupationSearch`, add:

```tsx
const [inputValue, setInputValue] = useState('');

const topExposedOccupations = useMemo(() => {
  if (!nodes) return [];
  return nodes
    .filter((n) => n.aiExposure === 1 && n.workers !== null)
    .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0))
    .slice(0, 5);
}, [nodes]);
```

Add `useState` to the existing React import.

- [ ] **Step 3: Wire `onInputValueChange` and controlled open-on-focus on the hero Combobox**

Base UI Combobox does not have an `openOnFocus` prop. Use controlled `open` state with an `onFocus` handler instead. Add state and handler:

```tsx
const [open, setOpen] = useState(false);
```

In the hero branch (`if (hero)`), update the `<Combobox>` element:

```tsx
<Combobox
  items={occupations}
  itemToStringValue={(occ) => occ.label}
  value={selectedOccupationObj}
  onValueChange={(occ) => onOccupationSelect(occ?.id ?? null)}
  onInputValueChange={(value) => setInputValue(value)}
  open={open}
  onOpenChange={setOpen}
>
```

Then add an `onFocus` handler to `ComboboxInput` to open the dropdown on focus:

```tsx
<ComboboxInput
  placeholder="Search any occupation in Malaysia…"
  showTrigger={false}
  showClear={!!selectedOccupation}
  className="w-full h-12 text-base rounded-xl bg-card/50 dark:bg-card/90 backdrop-blur-xl border-transparent [&_input]:pl-10"
  onFocus={() => setOpen(true)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add components/graph/OccupationSearch.tsx
git commit -m "feat: add nodes prop and compute top-5 exposure suggestions"
```

### Task 2: Render suggestions section in hero dropdown

**Files:**
- Modify: `components/graph/OccupationSearch.tsx`

- [ ] **Step 1: Add the suggestions section inside `ComboboxContent`**

In the hero branch, replace the current `ComboboxContent` children with:

```tsx
<ComboboxContent anchor={heroRef} className="rounded-xl bg-card/50 dark:bg-card/90 backdrop-blur-xl">
  {hero && inputValue === '' && topExposedOccupations.length > 0 && (
    <div className="p-1">
      <div className="px-2 py-1.5 text-xs text-muted-foreground">
        Highest impact occupations
      </div>
      {topExposedOccupations.map((node) => (
        <button
          key={node.id}
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-sm border-l-3 border-destructive py-1.5 pl-3 pr-2 text-sm hover:bg-destructive/10 transition-colors cursor-pointer"
          onMouseDown={(e) => {
            e.preventDefault();
            onOccupationSelect(node.id);
          }}
        >
          <div className="text-left">
            <div>{node.label}</div>
            <div className="text-xs text-muted-foreground">
              {node.workers?.toLocaleString()} workers
            </div>
          </div>
          <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
            100%
          </span>
        </button>
      ))}
    </div>
  )}
  <ComboboxEmpty>No occupations found.</ComboboxEmpty>
  <ComboboxList>
    {(occ) => (
      <ComboboxItem key={occ.id} value={occ} className="px-3">
        <span>{occ.label}</span>
        <span className="text-muted-foreground text-xs ml-auto tabular-nums">
          {occ.id}
        </span>
      </ComboboxItem>
    )}
  </ComboboxList>
</ComboboxContent>
```

Note: Use `onMouseDown` with `e.preventDefault()` instead of `onClick` to prevent the combobox input from losing focus before the click registers (which would close the dropdown before the handler fires).

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`

1. Open the app with no occupation selected — hero search should be visible
2. Click into the search bar — dropdown should open showing 5 suggestions with red left border and "100%" pills
3. Type any character — suggestions should disappear, normal filtered results appear
4. Clear input — suggestions should reappear
5. Click a suggestion — occupation should be selected on the graph

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationSearch.tsx
git commit -m "feat: render top-5 exposure suggestions in hero search dropdown"
```

### Task 3: Pass nodes to hero OccupationSearch from page.tsx

**Files:**
- Modify: `app/page.tsx:499`

- [ ] **Step 1: Add `nodes` prop to the hero OccupationSearch**

Find the hero `<OccupationSearch>` instance (around line 499) and add the `nodes` prop:

```tsx
<OccupationSearch
  occupations={occupationList}
  selectedOccupation={selectedNodeId}
  onOccupationSelect={handleSearchSelect}
  onDismiss={tutorial.isActive && tutorial.currentStep === 1 ? undefined : () => setHeroDismissed(true)}
  hero
  nodes={nodes}
/>
```

- [ ] **Step 2: Verify end-to-end in browser**

Run: `npm run dev`

Same verification as Task 2 Step 2, now with real data flowing through.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: pass nodes to hero search for dropdown suggestions"
```
