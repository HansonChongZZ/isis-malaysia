# Design: Two-Phase Rectangular Cluster Layout

## Problem

The current force-directed layout produces a circular/organic blob. The desired layout is similar to the Harvard Atlas "Product Space" — groups form strongly separated, loose clusters spread across a rectangular canvas. No group labels on canvas needed; groups identified by color legend.

## Approach: Two-Phase Force Simulation (Offline)

Only the offline layout script changes. Runtime code stays the same — it already scales precomputed 0–1 coordinates and runs a lightweight collide pass.

### Phase 1: Group-level positioning

- Create 9 "super-nodes", one per MASCO group, sized proportional to member count.
- Run a force simulation on super-nodes with:
  - `forceX` (strength ~0.3) and `forceY` (strength ~0.5) toward center — landscape bias via stronger Y to prevent tall layouts.
  - `forceManyBody` with strong charge (−2000) to push groups apart.
  - `forceCollide` with radius derived from member count (`sqrt(memberCount) * scaleFactor`) to guarantee non-overlapping group regions.
  - Cross-group edge aggregation: sum edge weights between groups to create super-edges with `forceLink`, so connected groups stay closer.
- Run 1,000 iterations. Output: 9 group center positions.

### Phase 2: Intra-group packing

For each group independently:
- Take only the nodes belonging to that group and intra-group edges.
- Run a force simulation centered on the group's super-node position from Phase 1.
- Forces:
  - `forceLink` on intra-group edges (moderate strength ~0.1)
  - `forceManyBody` (charge −200 for local spread)
  - `forceCollide` (same radius formula as current)
  - Bounding box force: custom force that nudges nodes back toward group center if they drift too far (radius proportional to `sqrt(memberCount)`). Prevents groups bleeding into each other.
- Run 2,000 iterations per group.

### Normalization

After both phases, normalize all positions to 0–1 range with 5% padding. Write back to `nodes.json`.

## What stays the same

- Runtime rendering, zoom/pan, tooltip, selection, edges
- Node sizing by metric
- `useForceSimulation.ts` (scales 0–1 coords + collide pass)
- LayoutTuner (tuning mode)

## Files touched

| File | Change |
|---|---|
| `scripts/compute-layout.mjs` | Rewrite to two-phase approach |
| `public/data/nodes.json` | New x/y values (via script output) |
