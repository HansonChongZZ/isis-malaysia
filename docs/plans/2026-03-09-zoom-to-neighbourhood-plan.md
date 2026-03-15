# Zoom-to-Neighbourhood Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a node is first-clicked (single selection), zoom the camera to frame the selected node and its first-degree neighbours. Zoom back out on deselect.

**Architecture:** Extend the existing auto-zoom `useEffect` in `OccupationGraph.tsx` (lines 533-579) to handle `selectionMode === 'single'` alongside the existing `'pair'` logic. Reuse the same bounding-box + animate pattern.

**Tech Stack:** D3.js zoom, React useEffect

---

### Task 1: Add single-mode zoom-to-neighbourhood

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:533-579`

**Step 1: Add single-mode zoom logic to the existing auto-zoom useEffect**

In `components/graph/OccupationGraph.tsx`, replace the auto-zoom `useEffect` (lines 533-579) with the following expanded version that handles both single and pair modes:

```tsx
// Auto-zoom to frame selection (single or pair mode)
useEffect(() => {
  if (!svgRef.current || !zoomRef.current) return;
  const svg = d3.select(svgRef.current);
  const zoom = zoomRef.current;

  if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
    const nodeA = nodeById.current.get(selectedNodeId);
    const nodeB = nodeById.current.get(secondSelectedNodeId);
    if (!nodeA || !nodeB) return;

    // Save current transform for restoring later
    preZoomTransformRef.current = transformRef.current;

    const padding = 120;
    const ax = nodeA.x;
    const ay = nodeA.y;
    const bx = nodeB.x;
    const by = nodeB.y;

    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    const dx = Math.abs(bx - ax) + padding * 2;
    const dy = Math.abs(by - ay) + padding * 2;
    const scale = Math.min(
      dimensions.width / dx,
      dimensions.height / dy,
      2,
    );
    const tx = dimensions.width / 2 - cx * scale;
    const ty = dimensions.height / 2 - cy * scale;
    const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

    svg.transition()
      .duration(500)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, target);
  } else if (selectionMode === 'single' && selectedNodeId && connectedIds) {
    // Save current transform for restoring later
    if (!preZoomTransformRef.current) {
      preZoomTransformRef.current = transformRef.current;
    }

    const neighbourNodes = simNodes.filter((n) => connectedIds.has(n.id));

    if (neighbourNodes.length <= 1) {
      // Isolated node (only itself in connectedIds) — zoom to scale 2 centered on node
      const node = nodeById.current.get(selectedNodeId);
      if (!node) return;
      const scale = 2;
      const tx = dimensions.width / 2 - node.x * scale;
      const ty = dimensions.height / 2 - node.y * scale;
      const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

      svg.transition()
        .duration(500)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, target);
    } else {
      // Zoom to fit selected node + neighbours with 200px padding
      const padding = 200;
      const xs = neighbourNodes.map((n) => n.x);
      const ys = neighbourNodes.map((n) => n.y);
      const minX = Math.min(...xs) - padding;
      const minY = Math.min(...ys) - padding;
      const maxX = Math.max(...xs) + padding;
      const maxY = Math.max(...ys) + padding;
      const dx = maxX - minX;
      const dy = maxY - minY;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const scale = Math.min(dimensions.width / dx, dimensions.height / dy, 3);
      const tx = dimensions.width / 2 - cx * scale;
      const ty = dimensions.height / 2 - cy * scale;
      const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

      svg.transition()
        .duration(500)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, target);
    }
  } else if (selectionMode === 'none' && preZoomTransformRef.current) {
    // Deselect — zoom back to fit entire graph
    preZoomTransformRef.current = null;

    const padding = 80;
    const xs = simNodes.map((n) => n.x);
    const ys = simNodes.map((n) => n.y);
    const boundsMinX = Math.min(...xs) - padding;
    const boundsMinY = Math.min(...ys) - padding;
    const boundsMaxX = Math.max(...xs) + padding;
    const boundsMaxY = Math.max(...ys) + padding;
    const boundsW = boundsMaxX - boundsMinX;
    const boundsH = boundsMaxY - boundsMinY;
    const scale = Math.min(dimensions.width / boundsW, dimensions.height / boundsH, 2);
    const tx = (dimensions.width - boundsW * scale) / 2 - boundsMinX * scale;
    const ty = (dimensions.height - boundsH * scale) / 2 - boundsMinY * scale;
    const fitTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);

    svg.transition()
      .duration(500)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, fitTransform);
  }
}, [selectionMode, selectedNodeId, secondSelectedNodeId, connectedIds, simNodes, dimensions.width, dimensions.height]);
```

Key changes from the original:
1. Added `selectionMode === 'single'` branch that computes bounding box of connected nodes with 200px padding
2. Added isolated-node case (only self in `connectedIds`) that centers at scale 2
3. Changed deselect branch from restoring previous transform to auto-fitting entire graph
4. Added `connectedIds` and `simNodes` to the dependency array

**Step 2: Verify the app compiles**

Run: `npm run build` or `npx next build`
Expected: No compilation errors

**Step 3: Manual test**

1. Click a node with neighbours → camera should animate to frame the neighbourhood
2. Click an isolated node (if any) → camera should zoom to scale 2 centered on that node
3. Press Escape or click background → camera should animate back to fit all nodes
4. Click a node, then click its neighbour (pair mode) → existing pair zoom should still work
5. Deselect from pair mode → should zoom back to fit all

**Step 4: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: zoom to neighbourhood on single node selection"
```
