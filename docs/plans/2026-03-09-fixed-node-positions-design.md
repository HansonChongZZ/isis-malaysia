# Fixed Node Positions Design

**Date:** 2026-03-09

## Problem

The force simulation runs 300 ticks on every mount/resize (~500ms). Previous attempts to bake positions offline failed because normalizing to 0-1 compressed clusters — outlier nodes stretched the range.

## Solution: Store absolute pixel positions + auto-zoom

Run the force simulation once offline at a reference viewport (1400x900). Store raw pixel coordinates in `nodes.json` (not normalized). At runtime, use d3 zoom to auto-fit the baked layout into whatever viewport the user has. Zero simulation overhead.

## Changes

| File | Change |
|------|--------|
| `hooks/useForceSimulation.ts` | Delete entirely |
| `components/graph/OccupationGraph.tsx` | Remove `useForceSimulation` call. Add auto-zoom-to-fit on mount/resize. Assign baked pixel coords directly to simNodes. |
| `lib/types.ts` | Change NodeSchema x/y from `z.number().min(0).max(1)` to `z.number()` |
| `scripts/compute-layout.mjs` | Simplify to run tuning sim once at 1400x900, write raw pixel coords |
| `public/data/nodes.json` | Re-generated with raw pixel positions |

## How auto-zoom works

On mount and resize, compute a zoom transform that frames all node positions (with padding) inside the current viewport:

1. Find bounding box of all node positions (minX, maxX, minY, maxY)
2. Compute scale = min(viewportWidth / boundsWidth, viewportHeight / boundsHeight)
3. Compute translate to center the bounds in the viewport
4. Apply as initial zoom transform

Node positions never change — only the zoom transform adapts to the viewport.

## Trade-offs

- **Pro:** Zero runtime simulation, deterministic identical layout on every load
- **Pro:** Simplest mental model — positions are just data, zoom handles viewport adaptation
- **Con:** Changing the layout requires re-running the bake script
- **Con:** Node pixel sizes are fixed regardless of zoom (already the case)
