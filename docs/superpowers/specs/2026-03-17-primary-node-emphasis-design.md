# Primary Node Emphasis Design

**Date:** 2026-03-17
**Status:** Approved

## Problem

When a node is selected in the occupation graph, it doesn't stand out enough from its neighbor nodes (which remain at full opacity). The current treatment — a slightly thicker stroke (3.5px), foreground stroke color, and a subtle glow filter — is insufficient to make the primary node immediately obvious, especially in dense clusters.

## Solution

Enhance the selected node with three layered visual treatments: **scale increase**, **gradient fill**, and **animated glow aura**. The effect should be confident and prominent — no question which node is selected.

## Design

### 1. Scale — 1.6x Radius

When a node is selected, multiply its computed radius by `1.6` **at the render site only** (the `<circle>` element's `r` attribute). Do NOT modify `getNodeRadius()` itself — this keeps radial layout spacing and other computations unaffected.

- Compute: `const displayR = isSelected ? r * 1.6 : r`
- Apply `displayR` to the `<circle>` `r` attribute
- Add `r` to the existing inline `transition` property (currently covers `fill-opacity`, `stroke`, `stroke-width`, `stroke-opacity`, `filter` — append `r 250ms ease`)
- Tooltip positioning (line ~1425) also needs the multiplier: `const tooltipR = (isSelected ? getNodeRadius(tooltip.node) * 1.6 : getNodeRadius(tooltip.node)) * transformRef.current.k`

### 2. Gradient Fill

Replace the flat `fill={color}` with a `<radialGradient>` for selected nodes.

**Dark mode** (`--background: #142E23`):
- Gradient: `#A7F3D0` (center, 40% offset) → `#34D399` (edge)
- Stroke: `var(--foreground)` / `#EEFFF7`, 3px width

**Light mode** (`--background: #EEFFF7`):
- Gradient: `#6EE7B7` (center, 40% offset) → `#10B981` (edge)
- Stroke: `var(--foreground)` / `#204D39`, 3px width

Implementation approach:
- Define a single `<radialGradient id="selected-node-gradient">` in SVG `<defs>` with stops referencing CSS vars `--node-selected-gradient-start` and `--node-selected-gradient-end`
- SVG gradient `<stop>` elements cannot use CSS vars directly. Instead, define two gradients (`id="selected-node-gradient-light"` and `id="selected-node-gradient-dark"`) in `<defs>` with hardcoded stops, and select the correct one based on the current theme prop/context

### 3. Enhanced Glow + Breathing Animation

**Replace the current `selected-glow` filter** with a stronger two-layer version:
- Layer 1: `feGaussianBlur` stdDeviation=10, full opacity green tint
- Layer 2: `feGaussianBlur` stdDeviation=25, 50% opacity green tint

**Theme-aware glow filters:** Since SVG filters cannot reference CSS custom properties, define two filters:
- `id="selected-glow-light"`: color matrix tuned for visibility on light backgrounds (more saturated green tint)
- `id="selected-glow-dark"`: color matrix with standard green tint for dark backgrounds
- Select the correct filter based on the current theme prop/context

**Add a soft outer aura circle:**
- A separate `<circle>` rendered in a `<g>` layer **before** the nodes group, so it sits behind all nodes
- Only rendered when `selectedNodeId` is set; positioned at the selected node's coordinates
- Fill: `var(--node-selected-aura)` at ~15% opacity
- Radius: ~1.5x the scaled node radius (i.e., `r * 1.6 * 1.5`)
- Animated with inline SVG `<animate>` elements (not CSS `@keyframes` — see animation note below)

**Node breathing:**
- The primary node circle itself oscillates ±1px radius over a 3s cycle
- Achieved via inline SVG `<animate>` element as a child of the selected node's `<circle>`

### Animation Approach

Use inline SVG `<animate>` elements (not CSS `@keyframes`) for all radius animations. CSS animation of the SVG `r` attribute is not reliably supported across browsers (Firefox lacks support). The `<animate>` element is universally supported for SVG attribute animation.

```xml
<!-- On the primary node circle -->
<animate attributeName="r" values="{displayR};{displayR+1};{displayR}" dur="3s" repeatCount="indefinite"/>

<!-- On the aura circle -->
<animate attributeName="r" values="{auraR};{auraR+4};{auraR}" dur="3s" repeatCount="indefinite"/>
<animate attributeName="opacity" values="0.15;0.25;0.15" dur="3s" repeatCount="indefinite"/>
```

The aura opacity animation can use CSS `@keyframes` since `opacity` is well-supported, but for consistency, use `<animate>` throughout.

## What Doesn't Change

- Neighbor nodes remain at full opacity — no change
- Non-neighbor dimming stays the same (0.12 in force mode, 0.06 in radial mode)
- Second selected node (pair mode) styling is unchanged — the primary node will be more prominent than the second node in pair mode, which is intentional (it reinforces which node is "primary")
- Click, hover, and keyboard interaction behavior unchanged
- Edge rendering unchanged
- `getNodeRadius()` function unchanged — scale multiplier applied only at render site
- Radial layout spacing unchanged

## Files Touched

| File | Changes |
|------|---------|
| `components/graph/OccupationGraph.tsx` | Add radial gradient defs (2, one per theme), update selected node `r` and `fill`, add aura `<g>` layer before nodes group, replace glow filter with theme-aware pair, update tooltip radius calculation |
| `app/globals.css` | Add CSS vars for aura color (`--node-selected-aura`), gradient stops (`--node-selected-gradient-start`, `--node-selected-gradient-end`) for future reference |

## Theme-Adaptive CSS Variables

```css
/* Light theme */
:root {
  --node-selected-gradient-start: #6EE7B7;
  --node-selected-gradient-end: #10B981;
  --node-selected-aura: #10B981;
}

/* Dark theme */
.dark {
  --node-selected-gradient-start: #A7F3D0;
  --node-selected-gradient-end: #34D399;
  --node-selected-aura: #34D399;
}
```

## Edge Cases

- **Tight clusters:** The 1.6x scale may cause overlap with nearby neighbors. This is acceptable — the selected node should visually "push forward" and overlap is a natural consequence of emphasis. The glow aura provides additional separation.
- **Very small nodes:** At minimum radius, 1.6x still produces a visible difference. The gradient and glow provide additional differentiation even when size difference is small.
- **Zoom levels:** The glow filter scales with the SVG transform, so it remains proportional at all zoom levels. No special handling needed.
- **Performance:** One additional `<circle>` element and SVG `<animate>` elements are negligible overhead. The simplified glow filter (2 layers vs current 4) may slightly improve performance. The filter bounding box should be tightened from the current 700% to match the reduced blur radii.
- **Pair mode:** The primary node will be visually dominant over the second selected node. This is intentional — it reinforces which is the "anchor" node the user started from.
- **`colourByGroup` mode:** When group coloring is active (debug feature), the gradient fill still overrides the group color for the selected node. This is acceptable since the purpose is to make selection unmistakable regardless of coloring mode.
