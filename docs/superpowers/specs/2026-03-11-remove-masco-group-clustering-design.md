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
- All nodes use the existing `--node` CSS variable color
- Remove any group-related opacity or filtering logic

### Legend (GraphLegend.tsx)
- Remove the MASCO group legend component

### Controls (GraphControls.tsx)
- Remove group filter dropdown

### Page (app/page.tsx)
- Remove `filterGroup` state and related logic

### Constants (lib/constants.ts)
- Remove `MASCO_GROUPS` record

### Types (lib/types.ts)
- Keep `group` field inert in data (avoid reprocessing nodes.json)
- Remove all UI usage of `group`

## What Stays the Same
- Node sizing by chosen metric (AI exposure, workers, wage)
- Edge connections and weights
- Zoom, pan, selection, hover behavior
- Glow effects on selected nodes

## Node Color
Single uniform color using the existing `--node` CSS variable.
