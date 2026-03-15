# Zoom-to-Neighbourhood on First Click

**Date:** 2026-03-09
**Branch:** feat/two-click-mechanism

## Summary

When a user clicks a node (entering single selection mode), the camera zooms to frame the selected node and its first-degree neighbours. If the node has no neighbours, zoom to scale 2 centered on the node. On deselect, zoom back to fit the entire graph.

## Design Decisions

- **Animation:** 500ms with `d3.easeCubicInOut` (matches existing pair-mode zoom)
- **Padding:** 200px on all sides for neighbourhood framing
- **Isolated node zoom:** Scale 2, centered on node
- **Deselect behaviour:** Auto-fit entire graph (80px padding, same animation)
- **Approach:** Extend existing pair-mode zoom logic in `OccupationGraph.tsx`

## Behaviour

### With neighbours
1. Collect selected node + all first-degree neighbours (already computed as `neighbourNodeIds`)
2. Calculate bounding box of these nodes' positions
3. Add 200px padding
4. Compute scale and translation to fit bounding box in viewport
5. Animate zoom transform over 500ms

### Without neighbours (isolated node)
1. Center on selected node's position
2. Zoom to scale 2
3. Same 500ms animation

### On deselect (background click / Escape)
1. Re-run existing auto-fit-all logic (zoom to fit entire graph, 80px padding)
2. Same 500ms animation

## Scope

### Changes needed
- `OccupationGraph.tsx`: Add single-mode zoom logic alongside existing pair-mode zoom effect

### No changes needed
- Data structures
- State machine logic in `page.tsx`
- Click handlers
- Node/edge rendering
