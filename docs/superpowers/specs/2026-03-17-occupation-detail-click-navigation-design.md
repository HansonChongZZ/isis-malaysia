# Occupation Detail Click Navigation

**Date:** 2026-03-17

## Summary

Change the panel behavior when two occupations are selected in the graph so that clicking the secondary node opens the ComparisonGrid directly, rather than the default detail pane + transition cards view.

## Current Behavior

When two occupations are selected (`selectedNodeId` and `secondSelectedNodeId`):
- Clicking either node sets `panelNodeId` to that node's id and opens the panel
- The panel always opens in card list mode (OccupationDetailPane + TransitionCards)
- User must then manually click a transition card to reach the ComparisonGrid

## Desired Behavior

When two occupations are selected:
- **Click primary node** → opens panel with detail pane + transition cards (unchanged)
- **Click secondary node** → opens panel directly in ComparisonGrid, with primary node on the left and secondary node on the right

This applies to both Force and Circular view modes.

## Design

### Changes

**`page.tsx` — new state:**

Add `openedViaSecondary` boolean state (default `false`).

**`page.tsx` — `handleNodeSelect`:**

In both Force and Circular mode branches, when `secondSelectedNodeId` is set and the user clicks either node (lines 242-253 and 291-303), split the condition:

```tsx
// Before (both branches):
if (id === selectedNodeId || id === secondSelectedNodeId) {
  setPanelNodeId(id)
  setIsPanelOpen(true)
}

// After (both branches):
if (id === selectedNodeId) {
  setPanelNodeId(id)
  setOpenedViaSecondary(false)
  setIsPanelOpen(true)
} else if (id === secondSelectedNodeId) {
  setPanelNodeId(selectedNodeId)   // primary, so header + transitions use primary
  setOpenedViaSecondary(true)
  setIsPanelOpen(true)
}
```

**`page.tsx` — `onClose` handler and all other panel-close paths:**

Reset `openedViaSecondary` to `false` wherever the panel is closed. All close paths:
- The `onClose` callback passed to OccupationPanel (line ~528)
- Deselection paths in `handleNodeSelect` (clicking null / clicking outside)
- Escape key handler (note: Escape when panel is open is handled by Dialog's `onOpenChange`, not `handleKeyDown` — so the `onClose` callback covers this)
- `handleTutorialSkip` (line ~87, closes panel and clears node IDs)
- `handleSearchSelect` circular/radial early-return path (line ~397, closes panel)
- `handleKeyDown` Ctrl+F/Cmd+F branch (line ~338, closes panel to focus search)

Reset `openedViaSecondary` in the same state batch as `setIsPanelOpen(false)` to avoid brief prop inconsistency during React batched updates.

**`page.tsx` — isolated-node early-return (line 217-224):**

No changes needed. Isolated nodes clear `secondSelectedNodeId` and open the panel directly — `openedViaSecondary` is irrelevant since there's no second selection.

**`page.tsx` — OccupationPanel call site:**

```tsx
<OccupationPanel
  nodeId={panelNodeId}
  detail={panelDetail}
  nodes={nodes}
  edges={edges}
  occupations={occupations}
  isOpen={isPanelOpen}
  onClose={handlePanelClose}
  initialComparisonId={openedViaSecondary ? secondSelectedNodeId : null}
/>
```

**`OccupationPanel.tsx`:**

- Add `initialComparisonId: string | null` prop to interface
- Update the existing `useEffect` reset (line 39-41):
  ```tsx
  useEffect(() => {
    if (isOpen) {
      setComparisonNodeId(initialComparisonId)
    }
  }, [nodeId, isOpen, initialComparisonId])
  ```
  The `isOpen` guard prevents the effect from firing during close transitions or mid-session prop changes.

### Back Button Behavior

When the panel opens in comparison mode (via secondary click) and the user clicks "Back":
- `comparisonNodeId` is set to `null` by `onBack`, showing the card list view
- The `useEffect` won't re-trigger as long as its dependencies (`nodeId`, `isOpen`, `initialComparisonId`) remain unchanged. If any dependency changes (e.g., panel close+reopen cycling `isOpen`), the effect will re-fire and restore comparison mode. This is acceptable because a close+reopen is a new panel session. Within a single open session, Back is stable. Note: `initialComparisonId` cannot change while the panel is open because `openedViaSecondary` and `secondSelectedNodeId` are only modified through `handleNodeSelect`, which doesn't run while the panel dialog is open (clicks go to the dialog, not the graph).
- The user sees the primary occupation's detail + transition cards and can freely browse or click another card to compare
- This is intentional: after "Back", the user is in the primary occupation's context

### UX Note: Panel Header

When opened via secondary click, the panel header shows the **primary** occupation's name (not the secondary). This is correct because the ComparisonGrid shows both occupations in its own header row, and the panel's transitions are computed from the primary occupation.

### Files Changed

1. `app/page.tsx` — add `openedViaSecondary` state, split click conditions in both Force/Circular branches, reset flag on all close paths, pass `initialComparisonId` prop
2. `components/panel/OccupationPanel.tsx` — add `initialComparisonId` prop, update useEffect with `isOpen` guard

### Estimated Scope

~25 lines of code across 2 files.
