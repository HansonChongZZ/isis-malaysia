# Node Size & Layout Tuner Panel

**Date:** 2026-03-11
**Status:** Approved

## Overview

A collapsible bottom-right drawer overlaid on the occupation graph, available only in development mode. Provides live sliders for tuning node sizing and force layout parameters, with export capabilities for persisting changes.

## Parameters

| Parameter | Range | Step | Default | Category |
|-----------|-------|------|---------|----------|
| Base Radius | 2–20 | 1 | 9 | Sizing |
| Scale | 10–150 | 1 | 40 | Sizing |
| Exponent | 0.5–3.0 | 0.1 | 1.5 | Sizing |
| Collision Padding | 0–20 | 0.5 | 8 | Layout |
| Charge Strength | -200–0 | 1 | -60 | Layout |
| Link Distance Base | 20–150 | 1 | 55 | Layout |
| Link Distance Scale | 5–40 | 1 | 16 | Layout |

## Behavior

### Sizing sliders (base, scale, exponent)
Update node radii instantly by overriding the constants used in `getNodeRadius`. No simulation needed — circles re-render with new sizes immediately.

### Layout sliders (charge, link distance, collision padding)
Trigger a debounced (~200ms) d3-force simulation that runs inline. A small spinner indicates computation in progress. When complete, node positions update smoothly. Uses the same force configuration as `compute-layout.mjs` (link force with intra/inter group strengths, many-body charge, center force, collision force).

### Panel UI
- Toggle button (gear icon) in bottom-right corner to collapse/expand.
- Current numeric value displayed next to each slider.
- Two sections: "Node Sizing" and "Layout Forces".
- Dev-only: conditionally rendered when `process.env.NODE_ENV === 'development'`.

## Export

### Download nodes.json
Saves current node positions (with all original node properties) as a JSON file download. User drops the file into `public/data/` to persist.

### Copy Constants
Copies current slider values as TypeScript constant declarations to clipboard. Shows brief "Copied!" confirmation. Format matches `lib/constants.ts` structure:

```typescript
export const NODE_RADIUS_BASE = 9;
export const NODE_RADIUS_SCALE = 40;
export const NODE_RADIUS_EXPONENT = 1.5;
export const NODE_RADIUS_COLLIDE_PADDING = 8;
```

## Architecture

### New file: `components/graph/TunerPanel.tsx`
The drawer component containing sliders, labels, and export buttons. Manages its own collapsed/expanded state.

### Integration with OccupationGraph
- `OccupationGraph` accepts optional tuner override props for base, scale, and exponent.
- When tuner is active, these override the imported constants in `getNodeRadius`.
- When tuner is collapsed or absent, falls back to imported constants.
- Layout changes (charge, link distance, collision) run a force simulation inside the tuner and update node positions via a callback.

### Force simulation
Runs inline using d3-force (not a web worker — simpler, and 456 nodes with 300 iterations completes in ~500ms which is acceptable with debouncing). Uses the same force configuration as `compute-layout.mjs`:
- Link force with intra-group strength 0.8, inter-group strength 0.001
- Many-body charge force
- Center force (at graph centroid)
- Collision force using current sizing parameters

### State flow
1. User drags sizing slider → TunerPanel passes new values up → OccupationGraph re-renders nodes with new radii.
2. User drags layout slider → TunerPanel debounces 200ms → runs simulation with current positions as starting points → passes new positions up → OccupationGraph updates.
3. User clicks "Download nodes.json" → TunerPanel reads current simNodes positions, merges with original node data, triggers browser download.
4. User clicks "Copy Constants" → TunerPanel formats current slider values as TypeScript, copies to clipboard.
