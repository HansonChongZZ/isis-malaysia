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

**`OccupationPanel.tsx`:**
- Add `secondNodeId: string | null` prop
- When `secondNodeId` is provided and `nodeId !== secondNodeId` (i.e., the panel was opened by clicking the secondary node from the graph context), initialize `comparisonNodeId` to `secondNodeId`
- Update the `useEffect` reset logic: when `nodeId` or `isOpen` changes, set `comparisonNodeId` to `secondNodeId` if provided, otherwise `null`

**`page.tsx`:**
- Pass `secondSelectedNodeId` to `OccupationPanel` as `secondNodeId`
- When panel is opened by clicking the secondary node, set `panelNodeId` to `selectedNodeId` (the primary) so the panel header and detail pane show the primary occupation, while `secondNodeId` triggers comparison mode
- No changes to `handleNodeSelect` click logic beyond ensuring `panelNodeId` is set to the primary node when secondary is clicked

### Key Detail

The distinction is driven by comparing `panelNodeId` with `secondSelectedNodeId` at the `page.tsx` level:
- If the clicked node is the secondary, set `panelNodeId = selectedNodeId` (primary) and pass `secondNodeId = secondSelectedNodeId` to the panel
- If the clicked node is the primary, set `panelNodeId = selectedNodeId` and pass `secondNodeId = null`

This keeps the panel's primary occupation consistent (always the first-selected) while the `secondNodeId` prop controls whether to start in comparison mode.

### Files Changed

1. `components/panel/OccupationPanel.tsx` — add `secondNodeId` prop, update state initialization
2. `app/page.tsx` — pass `secondSelectedNodeId` conditionally, adjust `panelNodeId` assignment

### Estimated Scope

~15 lines of code across 2 files.
