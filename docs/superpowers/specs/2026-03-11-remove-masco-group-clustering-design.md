# Remove MASCO Group Clustering

## Goal

Remove MASCO 1-digit category grouping from the occupation graph. Nodes arrange purely by skill connections (edge weights). All nodes use a single uniform color.

## Context

Currently, nodes cluster by MASCO 1-digit group through:
- Pre-computed positions that spatially separate groups
- Force simulation with differential intra-group (0.8) vs inter-group (0.001) edge strength
- Group-colored nodes and a color-coded legend
- Group-based filtering in controls

The research does not consider MASCO 1-digit groups important. Removing them lets the layout reveal skill-based relationships between occupations instead.

## Changes

### Force Simulation (TunerPanel.tsx)
- Remove `groupOf` map construction
- Remove differential `INTRA_STRENGTH` / `INTER_STRENGTH` constants
- All edges use uniform strength (weight-based or constant)

### Pre-computed Layout (scripts/)
- Re-run layout generation without group-aware forces
- Nodes position purely by skill similarity

### Rendering (OccupationGraph.tsx)
- Remove group-based color lookup
- All nodes use the existing `--node-color` CSS variable
- Remove any group-related opacity or filtering logic
- Remove `filterGroup` from props interface and `visibleIds` computation
- Clean up `pairLabelPositions` group field if present

### Legend (GraphLegend.tsx)
- Remove the MASCO group legend component

### Controls (GraphControls.tsx)
- Remove group filter dropdown

### Page (app/page.tsx)
- Remove `filterGroup` state and related logic
- Remove group-based filtering of `occupationList`

### OccupationPanel (components/panel/OccupationPanel.tsx)
- Remove `MASCO_GROUPS` import and group-colored dot/label from panel header

### Tutorial Components
- Remove MASCO group color references from all tutorial steps:
  - `NodeSizingDemo.tsx` — remove `MASCO_GROUPS` import, use uniform color
  - `NodeArrangementDemo.tsx` — remove group-aware force targets (`GROUP_TARGETS`), use uniform color
  - `NodeRepresentationDemo.tsx` — rewrite to not center on 9 MASCO groups
  - `HoverBehaviorDemo.tsx` — remove `MASCO_GROUPS` import, use uniform color
  - `ClickBehaviorDemo.tsx` — remove `MASCO_GROUPS` import, use uniform color
  - `TutorialModal.tsx` — remove "Colors indicate the MASCO classification group" text

### Interaction Hook (hooks/useGraphInteraction.ts)
- Remove `filterGroup` and `setFilterGroup` state and exports
- Update all call sites (GraphControls.tsx, app/page.tsx, OccupationGraph.tsx)

### Constants (lib/constants.ts)
- Remove `MASCO_GROUPS` record

### CSS (app/globals.css)
- Remove `--color-masco-1` through `--color-masco-9` Tailwind alias declarations

### Types (lib/types.ts)
- Keep `group` field inert in data (avoid reprocessing nodes.json)
- Remove all UI usage of `group`

### Layout Script (scripts/compute-layout.mjs)
- Remove group-aware forces
- Reconcile radius constants with `lib/constants.ts` (currently mismatched)

## What Stays the Same
- Node sizing by chosen metric (AI exposure, workers, wage)
- Edge connections and weights
- Zoom, pan, selection, hover behavior
- Glow effects on selected nodes

## Node Color
Single uniform color using the existing `--node-color` CSS variable.

## Legend
The "Node size = ..." indicator currently lives in `GraphLegend.tsx`. Relocate this indicator to `GraphControls.tsx` before removing the legend component.
