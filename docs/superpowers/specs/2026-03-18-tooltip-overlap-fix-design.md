# Tooltip Overlap Fix — Pair Mode Labels & Badge

**Date:** 2026-03-18
**Status:** Draft
**Scope:** `components/graph/OccupationGraph.tsx` — pair mode rendering (lines ~1636-1715)

## Problem

When two occupation nodes are selected for comparison (pair mode), three absolutely-positioned elements can overlap:

1. **Label A** — occupation name + AI Exposure for the first selected node
2. **Label B** — occupation name + AI Exposure for the second selected node
3. **Edge skills badge** — "X specific skills shared / Y specific skills to develop" at the edge midpoint

All three currently use `z-20` with no collision awareness. Labels always anchor to the right of their node (`left: pos.x + pairR + 6, top: pos.y - 10`), and the badge sits at the midpoint between the nodes. When nodes are close together, these positions converge and elements stack on top of each other, making content unreadable.

## Solution

A two-layered approach: **smart positioning** to prevent most overlaps, with a **hover-to-foreground stacking fallback** for cases where overlap is unavoidable.

### Layer 1: Smart Label Mirroring

Instead of always placing labels to the right of their node, place each label on the **outward side** — away from the other node.

**Algorithm:**

1. Compute the midpoint between the two selected nodes.
2. For each node, compute the angle from the midpoint to that node.
3. Place the label on the far side of the node relative to the midpoint:
   - Use the angle to determine a quadrant (top-left, top-right, bottom-left, bottom-right).
   - Offset the label position accordingly (instead of always `left: pos.x + pairR + 6`).
4. Retain the existing right-edge flip logic (`translateX(-110%)` when near the viewport edge) as a final bounds check.

This causes labels to fan outward from the pair's center regardless of whether the nodes are arranged horizontally, vertically, or diagonally.

### Layer 1b: Badge Perpendicular Offset

If the badge (at the edge midpoint) still overlaps a label after mirroring:

1. Compute the perpendicular direction to the edge line (the line connecting the two nodes).
2. Shift the badge along that perpendicular toward the side with more empty space.
3. Offset distance: `badgeHeight/2 + labelHeight/2 + 8px` — just enough to clear the overlap.

### Layer 2: Hover-to-Foreground Stacking Fallback

When nodes are extremely close, mirroring and badge offset may not fully eliminate overlap. In that case, activate a stacking interaction:

**Overlap Detection:**

1. After computing mirrored positions, check bounding box intersections for all three element pairs (Label A ↔ Badge, Label B ↔ Badge, Label A ↔ Label B).
2. Use estimated bounding box sizes (no DOM measurement): labels ~220×70px, badge ~200×50px.
3. If any pair intersects, set `hasOverlap = true`.

**Stacking Behavior (only when `hasOverlap` is true):**

- **Default state:** Last-hovered element gets `z-index: 30` and `opacity: 1.0`. All other overlapping elements get `z-index: 20` and `opacity: 0.75`.
- **On hover:** Hovered element promoted to `z-index: 30`, `opacity: 1.0`. Others demoted to `z-index: 20`, `opacity: 0.75`.
- **On mouse leave (all elements):** Last-touched element remains on top.
- **Transitions:** `opacity` and `z-index` changes use `150ms ease` for smooth feel.

**When `hasOverlap` is false:** All elements stay at `z-index: 20`, `opacity: 1.0`. No hover interaction changes needed.

### Performance

- Overlap detection runs only when pair label positions are recomputed: node selection change or zoom/pan events.
- Uses estimated bounding boxes — simple rect-intersection math, zero DOM reads, no layout thrashing.
- No per-frame cost.

## Affected Code

All changes are in `components/graph/OccupationGraph.tsx`:

- **Lines ~1636-1681:** Pair mode node labels — update positioning logic from always-right to angle-based mirroring.
- **Lines ~1683-1715:** Edge skills badge — add perpendicular offset when overlapping a label.
- **New state:** `hasOverlap` boolean and `lastHoveredElement` ref to track stacking.
- **New utility:** `computeMirroredPosition(nodeA, nodeB, targetNode, radius, dimensions)` — returns `{left, top, transform}` for a label.
- **New utility:** `checkBoundingBoxOverlap(elements: Array<{x, y, width, height}>)` — returns boolean.

## Out of Scope

- Changes to the edge skills tooltip (the portaled `EdgeSkillsTooltip` component at lines ~1717-1758) — this already uses `createPortal` with `z-50` and viewport-aware positioning.
- Changes to the single-node hover tooltip (lines ~1559-1634) — only visible when a single node is hovered, not in pair mode.
- Panel/dialog tooltip positioning — separate system, not affected.
