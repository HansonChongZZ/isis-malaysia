# Primary Node Emphasis Design

**Date:** 2026-03-17
**Status:** Approved

## Problem

When a node is selected in the occupation graph, it doesn't stand out enough from its neighbor nodes (which remain at full opacity). The current treatment — a slightly thicker stroke (3.5px), foreground stroke color, and a subtle glow filter — is insufficient to make the primary node immediately obvious, especially in dense clusters.

## Solution

Enhance the selected node with three layered visual treatments: **scale increase**, **gradient fill**, and **animated glow aura**. The effect should be confident and prominent — no question which node is selected.

## Design

### 1. Scale — 1.6x Radius

When a node is selected, multiply its computed radius (from `getNodeRadius()`) by `1.6`.

- Applied via the existing `r` attribute on the `<circle>` element
- Smooth transition using the existing CSS `transition` property already on nodes (250ms ease)
- Tooltip positioning must account for the larger radius (uses `getNodeRadius()` already, so the multiplier should be applied there or passed through)

### 2. Gradient Fill

Replace the flat `fill={color}` with a `<radialGradient>` for selected nodes.

**Dark mode** (`--background: #142E23`):
- Gradient: `#A7F3D0` (center, 40% offset) → `#34D399` (edge)
- Stroke: `var(--primary-foreground)` / `#EEFFF7`, 3px width

**Light mode** (`--background: #EEFFF7`):
- Gradient: `#6EE7B7` (center, 40% offset) → `#10B981` (edge)
- Stroke: `var(--foreground)` / `#204D39`, 3px width

Implementation approach:
- Define two `<radialGradient>` elements in SVG `<defs>` (one per theme), or use CSS custom properties to set gradient stops dynamically
- Preferred: use CSS vars `--node-selected-gradient-start` and `--node-selected-gradient-end` defined in `globals.css` for each theme, referenced by a single gradient def

### 3. Enhanced Glow + Breathing Animation

**Replace the current `selected-glow` filter** with a stronger two-layer version:
- Layer 1: `feGaussianBlur` stdDeviation=10, full opacity green tint
- Layer 2: `feGaussianBlur` stdDeviation=25, 50% opacity green tint
- Color matrix values tuned per theme (darker glow tint in light mode for visibility)

**Add a soft outer aura circle:**
- A separate `<circle>` rendered behind the selected node
- Fill: `#34D399` (dark) / `#10B981` (light) at ~15% opacity
- Radius: ~1.5x the scaled node radius
- Animated with a `@keyframes` breathing cycle:
  - Radius oscillates ±4px over 3s
  - Opacity oscillates between 0.15 and 0.25

**Node breathing:**
- The primary node circle itself oscillates ±1px radius over the same 3s cycle
- Achieved via CSS animation on the SVG circle

### Animation CSS (in `globals.css`)

```css
@keyframes node-selected-breathe {
  0%, 100% { r: var(--node-selected-r); opacity: 1; }
  50% { r: calc(var(--node-selected-r) + 1px); opacity: 1; }
}

@keyframes node-selected-aura {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.25; }
}
```

Note: SVG `r` attribute animation via CSS may require using `<animate>` SVG elements instead if CSS `r` animation isn't supported across target browsers. Fallback to inline SVG `<animate>` elements.

## What Doesn't Change

- Neighbor nodes remain at full opacity — no change
- Non-neighbor dimming (0.15 opacity) stays the same
- Second selected node (pair mode) styling is unchanged
- Click, hover, and keyboard interaction behavior unchanged
- Edge rendering unchanged

## Files Touched

| File | Changes |
|------|---------|
| `components/graph/OccupationGraph.tsx` | Add radial gradient defs, update selected node `r` and `fill`, add aura circle behind selected node, update glow filter |
| `app/globals.css` | Add CSS vars for gradient stops (`--node-selected-gradient-start`, `--node-selected-gradient-end`), add `@keyframes` for breathing animation |

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
- **Performance:** One additional `<circle>` element and a CSS animation is negligible overhead. The simplified glow filter (2 layers vs current 4) may slightly improve performance.
