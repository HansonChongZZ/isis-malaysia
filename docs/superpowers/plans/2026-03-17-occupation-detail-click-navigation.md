# Occupation Detail Click Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When two occupations are selected and the user clicks the secondary node, open the panel directly in ComparisonGrid mode instead of the default card list view.

**Architecture:** Add `openedViaSecondary` boolean state to HomePage. Split the existing combined click condition into separate primary/secondary branches. Pass `initialComparisonId` prop to OccupationPanel so it can initialize in comparison mode.

**Tech Stack:** React 19, Next.js 16, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-17-occupation-detail-click-navigation-design.md`

---

## Chunk 1: Implementation

### Task 1: Add `openedViaSecondary` state and split click handlers in page.tsx

**Files:**
- Modify: `app/page.tsx:37` (add state)
- Modify: `app/page.tsx:242-253` (force mode branch)
- Modify: `app/page.tsx:291-303` (circular mode branch)

- [ ] **Step 1: Add `openedViaSecondary` state**

After line 37 (`const [panelNodeId, setPanelNodeId] = ...`), add:

```tsx
const [openedViaSecondary, setOpenedViaSecondary] = useState(false)
```

- [ ] **Step 2: Split Force mode branch (lines 242-253)**

Replace:
```tsx
if (secondSelectedNodeId) {
  if (id === selectedNodeId || id === secondSelectedNodeId) {
    setPanelNodeId(id)
    setIsPanelOpen(true)
  } else {
    setSelectedNodeId(id)
    setSecondSelectedNodeId(null)
    setPanelNodeId(null)
    setIsPanelOpen(false)
  }
  return
}
```

With:
```tsx
if (secondSelectedNodeId) {
  if (id === selectedNodeId) {
    setPanelNodeId(id)
    setOpenedViaSecondary(false)
    setIsPanelOpen(true)
  } else if (id === secondSelectedNodeId) {
    setPanelNodeId(selectedNodeId)
    setOpenedViaSecondary(true)
    setIsPanelOpen(true)
  } else {
    setSelectedNodeId(id)
    setSecondSelectedNodeId(null)
    setPanelNodeId(null)
    setOpenedViaSecondary(false)
    setIsPanelOpen(false)
  }
  return
}
```

- [ ] **Step 3: Split Circular mode branch (lines 291-303)**

Replace:
```tsx
if (secondSelectedNodeId) {
  if (id === selectedNodeId || id === secondSelectedNodeId) {
    setPanelNodeId(id)
    setIsPanelOpen(true)
  } else {
    setSelectedNodeId(id)
    setSecondSelectedNodeId(null)
    setPanelNodeId(null)
    setIsPanelOpen(false)
    setLayoutMode('radial')
  }
  return
}
```

With:
```tsx
if (secondSelectedNodeId) {
  if (id === selectedNodeId) {
    setPanelNodeId(id)
    setOpenedViaSecondary(false)
    setIsPanelOpen(true)
  } else if (id === secondSelectedNodeId) {
    setPanelNodeId(selectedNodeId)
    setOpenedViaSecondary(true)
    setIsPanelOpen(true)
  } else {
    setSelectedNodeId(id)
    setSecondSelectedNodeId(null)
    setPanelNodeId(null)
    setOpenedViaSecondary(false)
    setIsPanelOpen(false)
    setLayoutMode('radial')
  }
  return
}
```

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: split click handlers for primary vs secondary node selection"
```

---

### Task 2: Reset `openedViaSecondary` on all close paths in page.tsx

**Files:**
- Modify: `app/page.tsx:87-93` (handleTutorialSkip)
- Modify: `app/page.tsx:338-347` (Ctrl+F handler)
- Modify: `app/page.tsx:392-403` (handleSearchSelect early-return)
- Modify: `app/page.tsx:528-531` (onClose inline lambda)

- [ ] **Step 1: Add reset to `handleTutorialSkip` (line 87-93)**

Add `setOpenedViaSecondary(false)` after `setIsPanelOpen(false)`:

```tsx
const handleTutorialSkip = () => {
  tutorial.skip()
  setSelectedNodeId(null)
  setSecondSelectedNodeId(null)
  setPanelNodeId(null)
  setIsPanelOpen(false)
  setOpenedViaSecondary(false)
}
```

- [ ] **Step 2: Add reset to Ctrl+F handler (line 338-347)**

Add `setOpenedViaSecondary(false)` in the Ctrl+F block:

```tsx
if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
  e.preventDefault()
  setSelectedNodeId(null)
  setSecondSelectedNodeId(null)
  setPanelNodeId(null)
  setIsPanelOpen(false)
  setOpenedViaSecondary(false)
  setHeroDismissed(false)
  if (viewMode === 'circular') setLayoutMode('ring')
  pendingFocusRef.current = true
}
```

- [ ] **Step 3: Add reset to `handleSearchSelect` early-return (line 392-403)**

Add `setOpenedViaSecondary(false)` in the early-return block:

```tsx
if (viewMode === 'circular' && layoutMode === 'radial') {
  setSelectedNodeId(null);
  setSecondSelectedNodeId(null);
  setPanelNodeId(null);
  setIsPanelOpen(false);
  setOpenedViaSecondary(false);
  setLayoutMode('ring');
  setTimeout(() => {
    setSelectedNodeId(id);
    setLayoutMode('radial');
  }, 650);
  return;
}
```

- [ ] **Step 4: Add reset to `onClose` handler (line 528-531)**

Replace the inline lambda:

```tsx
onClose={() => {
  setIsPanelOpen(false)
  setPanelNodeId(null)
}}
```

With:

```tsx
onClose={() => {
  setIsPanelOpen(false)
  setPanelNodeId(null)
  setOpenedViaSecondary(false)
}}
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "fix: reset openedViaSecondary on all panel-close paths"
```

---

### Task 3: Add `initialComparisonId` prop to OccupationPanel and pass it from page.tsx

**Files:**
- Modify: `components/panel/OccupationPanel.tsx:17-25` (interface)
- Modify: `components/panel/OccupationPanel.tsx:27-35` (destructuring)
- Modify: `components/panel/OccupationPanel.tsx:39-41` (useEffect)
- Modify: `app/page.tsx:521-532` (OccupationPanel call site)

- [ ] **Step 1: Add prop to OccupationPanel interface**

In `components/panel/OccupationPanel.tsx`, add to `OccupationPanelProps`:

```tsx
interface OccupationPanelProps {
  nodeId: string | null
  detail: OccupationDetail | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  occupations: Record<string, OccupationDetail>
  isOpen: boolean
  onClose: () => void
  initialComparisonId: string | null
}
```

- [ ] **Step 2: Destructure the new prop**

Update the function signature:

```tsx
export default function OccupationPanel({
  nodeId,
  detail,
  nodes,
  edges,
  occupations,
  isOpen,
  onClose,
  initialComparisonId,
}: OccupationPanelProps) {
```

- [ ] **Step 3: Update the useEffect reset logic (line 39-41)**

Replace:

```tsx
useEffect(() => {
  setComparisonNodeId(null)
}, [nodeId, isOpen])
```

With:

```tsx
useEffect(() => {
  if (isOpen) {
    setComparisonNodeId(initialComparisonId)
  }
}, [nodeId, isOpen, initialComparisonId])
```

- [ ] **Step 4: Pass prop from page.tsx call site (line 521-532)**

Add the `initialComparisonId` prop:

```tsx
<OccupationPanel
  nodeId={panelNodeId}
  detail={panelDetail}
  nodes={nodes}
  edges={edges}
  occupations={occupations}
  isOpen={isPanelOpen}
  onClose={() => {
    setIsPanelOpen(false)
    setPanelNodeId(null)
    setOpenedViaSecondary(false)
  }}
  initialComparisonId={openedViaSecondary ? secondSelectedNodeId : null}
/>
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/panel/OccupationPanel.tsx
git commit -m "feat: open ComparisonGrid directly when clicking secondary node"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test primary click behavior (unchanged)**

1. Click any occupation node (first selection)
2. Click a connected neighbor (second selection)
3. Click the **primary** node again
4. Verify: panel opens with detail pane + transition cards (not comparator)

- [ ] **Step 3: Test secondary click → comparison mode**

1. Click any occupation node (first selection)
2. Click a connected neighbor (second selection)
3. Click the **secondary** node
4. Verify: panel opens directly in ComparisonGrid with primary on left, secondary on right

- [ ] **Step 4: Test Back button after comparison mode**

1. From the ComparisonGrid opened in step 3, click "Back"
2. Verify: returns to card list view showing primary occupation's transitions
3. Click a different transition card
4. Verify: ComparisonGrid shows comparison with the newly selected card

- [ ] **Step 5: Test in both view modes**

Repeat steps 2-4 in both Force mode and Circular mode.

- [ ] **Step 6: Test close paths**

1. Open panel via secondary click (comparison mode), then close via X button → reopen via primary click → verify card list view (not comparison)
2. Open panel via secondary click, press Ctrl+F → verify search opens, no stale state
3. If tutorial is accessible, verify skip doesn't leave stale state
