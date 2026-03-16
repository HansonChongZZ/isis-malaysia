# Centre Screen on Selected Node — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centre the viewport on the selected node (not the bounding-box midpoint) when a node is clicked, while keeping all neighbours visible.

**Architecture:** Replace the bounding-box zoom logic in both the radial and ring branches of the zoom-on-select effect with a max-distance-from-selected-node approach. The selected node becomes the viewport centre; scale is derived from the farthest neighbour's distance.

**Tech Stack:** D3.js zoom transforms, React useEffect

**Spec:** `docs/superpowers/specs/2026-03-16-centre-on-selected-node-design.md`

---

## Chunk 1: Implementation

### Task 1: Update radial mode zoom to centre on selected node

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:1087-1114`

- [ ] **Step 1: Replace radial mode bounding-box zoom with centre-on-node zoom**

Replace lines 1087-1114 (the `} else if (radialPositions) { ... }` block — keep the closing `}` on line 1114):

```tsx
      } else if (radialPositions) {
        // Radial mode: centre on selected node (always at origin in radial layout)
        const padding = 250;
        const positions = Array.from(radialPositions.values());
        const maxDist = Math.max(
          ...positions.map((p) => Math.hypot(p.x, p.y)),
        );
        const scale = Math.min(
          Math.min(dimensions.width, dimensions.height) /
            (2 * (maxDist + padding)),
          3,
        );
        const tx = dimensions.width / 2;
        const ty = dimensions.height / 2;
        const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

        svg
          .transition()
          .duration(800)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, target);
      }
```

Note: In radial layout, the selected node is always at `{x: 0, y: 0}`, so `tx = viewportWidth / 2 - 0 * scale` simplifies to `viewportWidth / 2`.

- [ ] **Step 2: Verify in browser — radial mode**

Run: `npm run dev` (or whatever the dev server command is)
1. Open the app in browser
2. Switch to circular view mode
3. Click a node with multiple neighbours
4. Verify: selected node is at the centre of the viewport, all neighbours visible around it
5. Click an isolated node — verify it still centres correctly (unchanged branch)

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: centre viewport on selected node in radial mode"
```

---

### Task 2: Update ring mode zoom to centre on selected node

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:1115-1142`

- [ ] **Step 1: Replace ring mode bounding-box zoom with centre-on-node zoom**

Replace lines 1115-1142 (the `} else { ... }` block including closing brace):

```tsx
      } else {
        // Ring mode: centre on selected node, scale to fit neighbours
        const padding = 250;
        const node = nodeById.current.get(selectedNodeId);
        if (!node) return;
        const maxDist = Math.max(
          0,
          ...neighbourNodes.map((n) =>
            Math.hypot(n.x - node.x, n.y - node.y),
          ),
        );
        const scale = Math.min(
          Math.min(dimensions.width, dimensions.height) /
            (2 * (maxDist + padding)),
          3,
        );
        const tx = dimensions.width / 2 - node.x * scale;
        const ty = dimensions.height / 2 - node.y * scale;
        const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

        svg
          .transition()
          .duration(500)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, target);
      }
```

Note: `Math.max(0, ...)` guards against empty `neighbourNodes` (returns 0 instead of `-Infinity`). The selected node itself is included in `neighbourNodes` (distance 0), which is harmless.

- [ ] **Step 2: Verify in browser — ring/force mode**

1. Switch to force view mode
2. Click a node with multiple neighbours
3. Verify: selected node is at the centre of the viewport, neighbours visible
4. Click a different node — verify it re-centres smoothly
5. Click empty space to deselect — verify it zooms back to full graph (unchanged)

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: centre viewport on selected node in ring mode"
```
