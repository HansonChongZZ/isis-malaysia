# Design: Pre-computed Graph Layout

## Problem

The force-directed graph (456 nodes, 3,348 edges) collapses into a dense circular ball at runtime. Tuning force parameters helps marginally, but 300 simulation ticks is fundamentally insufficient for a graph this dense to reach a well-spread equilibrium. The reference layout (Harvard's Product Space) uses pre-computed, frozen positions — that's the approach we should follow.

## Goal

A "loose cloud" layout like the Product Space: clusters loosely visible, generous breathing room, filling the full viewport with landscape bias. Identical layout every page load.

## Approach: Offline Layout Script + Stored Positions

### 1. Layout script (`scripts/compute-layout.mjs`)

Node.js script using d3-force:
- Loads `public/data/nodes.json` and `public/data/edges.json`
- Runs force simulation with aggressive parameters:
  - Charge: -800 (massive repulsion)
  - Link strength: 0.05 (very weak — preserves topology without collapsing)
  - Link distance: `40 + (7 - weight) * 12`
  - Centering: forceX strength 0.01, forceY strength 0.03 (landscape bias)
  - Collide: same radius formula as runtime
  - **5,000 iterations** (full stabilization)
- Normalizes final positions to 0-1 range (viewport-independent)
- Writes `x` and `y` back into `nodes.json`
- Run manually: `node scripts/compute-layout.mjs`

### 2. Data format change

`nodes.json` gains `x` and `y` (0-1 normalized):
```json
{ "id": "1111", "label": "Legislators", ..., "x": 0.342, "y": 0.718 }
```

`NodeSchema` in `lib/types.ts` updated:
```typescript
x: z.number().min(0).max(1),
y: z.number().min(0).max(1),
```

### 3. Runtime changes

**`useForceSimulation.ts`** simplified:
- Scale stored 0-1 coordinates to viewport dimensions
- Keep collide force only (prevents overlap)
- Keep drag support (fx/fy)
- Remove link, charge, centering, and bounds forces

### 4. Unchanged
- Canvas edge rendering, SVG node rendering
- Zoom/pan, click/hover interactions
- Node sizing by metric
- Tutorial demo (own mini-simulation)

## Files to modify

| File | Change |
|---|---|
| `scripts/compute-layout.mjs` | **New** — offline layout computation script |
| `public/data/nodes.json` | Add x/y coordinates (via script output) |
| `lib/types.ts` | Add x/y to NodeSchema |
| `hooks/useForceSimulation.ts` | Simplify to position scaling + collide only |
| `lib/constants.ts` | Remove unused force-related constants if any |
