# Smooth Zoom-Out on Deselect

**Date:** 2026-03-09

## Problem

When deselecting a node, the zoom-out to fit-all is jarring because the 500ms fixed duration with `easeCubicInOut` is too fast for large scale changes (e.g. zoomed to 3x on a neighbourhood, snapping back to 0.5x overview).

## Design

### Adaptive duration based on scale change

Compute duration proportionally to how much the zoom level changes:

```
scaleRatio = Math.abs(Math.log(currentScale / targetScale))
duration = clamp(400 + scaleRatio * 300, 400, 1000)
```

- Small zoom changes (e.g. 1.2x to 1x): ~400ms, stays snappy
- Large zoom changes (e.g. 3x to 0.5x): ~940ms, gentle enough to follow

### Easing change

Switch from `d3.easeCubicInOut` to `d3.easeCubicOut` (fast start, gentle deceleration). The "slow start" of cubicInOut adds to the jarring feeling since the view briefly hangs before moving.

### Apply symmetrically

Apply the same adaptive duration to both zoom-in (node select) and zoom-out (deselect) for consistency.

## Scope

- **File:** `components/graph/OccupationGraph.tsx`
- **Lines affected:** ~592-614 (deselect block), ~565-590 (select block)
- ~10 lines changed, no new dependencies
