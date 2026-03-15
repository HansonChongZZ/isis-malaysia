# Hover Clarity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make first-degree neighbours instantly identifiable on node hover by dimming non-neighbours, highlighting connecting edges, and adding smooth transitions.

**Architecture:** All changes are in `OccupationGraph.tsx`. We modify `getNodeOpacity` to dim non-neighbours on hover, add a `hoveredEdges` memo + canvas drawing logic, upgrade neighbour stroke to `foreground` color, and add CSS transitions to SVG circles.

**Tech Stack:** React, D3, Canvas 2D, CSS transitions

---

### Task 1: Dim non-neighbours on hover

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:131-139`

**Step 1: Update `getNodeOpacity` to handle hover dimming**

Replace the `getNodeOpacity` callback (lines 131-139) with:

```tsx
const getNodeOpacity = useCallback(
  (node: SimNode) => {
    if (visibleIds && !visibleIds.has(node.id)) return 0.06;
    if (selectedNodeId && connectedIds && !connectedIds.has(node.id))
      return 0.12;
    if (
      hoveredNodeId &&
      !selectedNodeId &&
      node.id !== hoveredNodeId &&
      hoveredNeighborIds &&
      !hoveredNeighborIds.has(node.id)
    )
      return 0.15;
    return 1;
  },
  [visibleIds, selectedNodeId, connectedIds, hoveredNodeId, hoveredNeighborIds],
);
```

**Step 2: Verify visually**

Run `npm run dev`, hover a node, confirm non-neighbours fade to ~15% opacity.

**Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: dim non-neighbour nodes on hover"
```

---

### Task 2: Upgrade neighbour stroke to foreground color

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:390-406`

**Step 1: Change neighbour stroke from MASCO color to foreground**

Replace the stroke prop (lines 390-396) with:

```tsx
stroke={
  isSelected || isHovered
    ? 'var(--foreground)'
    : isHoveredNeighbor
    ? 'var(--foreground)'
    : 'var(--background)'
}
```

And simplify the strokeOpacity (lines 402-406) — neighbours should be fully opaque:

```tsx
strokeOpacity={opacity}
```

**Step 2: Verify visually**

Hover a node, confirm neighbours show foreground-colored strokes uniformly.

**Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: use foreground stroke for hovered neighbours"
```

---

### Task 3: Highlight connecting edges on hover

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:141-200`

**Step 1: Create `hoveredEdges` memo**

Add this memo after `hoveredNeighborIds` (after line 129):

```tsx
const hoveredEdges = useMemo(() => {
  if (!hoveredNodeId || selectedNodeId || !hoveredNeighborIds) return [];
  return edges.filter((e) => {
    const src =
      typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
    const tgt =
      typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
    if (src !== hoveredNodeId && tgt !== hoveredNodeId) return false;
    if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt)))
      return false;
    return true;
  });
}, [hoveredNodeId, selectedNodeId, hoveredNeighborIds, edges, visibleIds]);
```

**Step 2: Update `drawEdges` to also draw hover edges**

Replace the `drawEdges` callback (lines 155-200) with a version that draws both `visibleEdges` (selection) and `hoveredEdges` (hover). The hover edges use foreground color and 1.5px width:

```tsx
const drawEdges = useCallback(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const { k, x, y } = transformRef.current;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.setTransform(k * dpr, 0, 0, k * dpr, x * dpr, y * dpr);

  // Draw selection edges (existing behavior)
  if (visibleEdges.length > 0) {
    ctx.strokeStyle = edgeColorRef.current;
    ctx.lineWidth = 0.5 / k;

    const byWeight = new Map<number, typeof visibleEdges>();
    for (const edge of visibleEdges) {
      const w = edge.weight;
      if (!byWeight.has(w)) byWeight.set(w, []);
      byWeight.get(w)!.push(edge);
    }

    for (const [weight, group] of byWeight) {
      ctx.globalAlpha = Math.min(0.05 + (weight / 7) * 0.3 + 0.25, 0.8);
      ctx.beginPath();
      for (const edge of group) {
        const src = nodeById.current.get(
          typeof edge.source === 'string'
            ? edge.source
            : (edge.source as SimNode).id,
        );
        const tgt = nodeById.current.get(
          typeof edge.target === 'string'
            ? edge.target
            : (edge.target as SimNode).id,
        );
        if (!src || !tgt) continue;
        ctx.moveTo(src.x ?? 0, src.y ?? 0);
        ctx.lineTo(tgt.x ?? 0, tgt.y ?? 0);
      }
      ctx.stroke();
    }
  }

  // Draw hover edges (new behavior)
  if (hoveredEdges.length > 0) {
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--foreground').trim() || edgeColorRef.current;
    ctx.lineWidth = 1.5 / k;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (const edge of hoveredEdges) {
      const src = nodeById.current.get(
        typeof edge.source === 'string'
          ? edge.source
          : (edge.source as SimNode).id,
      );
      const tgt = nodeById.current.get(
        typeof edge.target === 'string'
          ? edge.target
          : (edge.target as SimNode).id,
      );
      if (!src || !tgt) continue;
      ctx.moveTo(src.x ?? 0, src.y ?? 0);
      ctx.lineTo(tgt.x ?? 0, tgt.y ?? 0);
    }
    ctx.stroke();
  }

  ctx.restore();
}, [visibleEdges, hoveredEdges]);
```

**Step 3: Verify visually**

Hover a node, confirm edges appear connecting hovered node to its neighbours.

**Step 4: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: highlight connecting edges on hover"
```

---

### Task 4: Add CSS transitions to SVG circles

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:407`

**Step 1: Add transition to circle style prop**

Replace the style prop on the circle element (line 407):

```tsx
style={{
  cursor: 'pointer',
  transition: 'fill-opacity 150ms ease, stroke 150ms ease, stroke-width 150ms ease, stroke-opacity 150ms ease',
}}
```

**Step 2: Verify visually**

Hover in/out of nodes. Confirm smooth 150ms transitions for opacity and stroke changes. No jarring flicker.

**Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: add smooth CSS transitions for hover effects"
```

---

### Task 5: Final verification and combined commit

**Step 1: Full integration test**

1. Run `npm run dev`
2. Hover a node → neighbours stay bright, non-neighbours fade, edges appear
3. Move off node → everything smoothly returns to normal
4. Click a node (select) → hover effects suppressed, selection highlighting works as before
5. Apply a filter → hover still respects filtered-out nodes (0.06 opacity)
6. Toggle light/dark theme → hover effects work in both themes

**Step 2: Squash if desired, or leave as incremental commits**
