# Design: Node Size by Number of Workers

**Date:** 2026-03-05
**Status:** Approved

## Overview

Add "Number of Workers" as a third node size metric in the graph visualization settings, alongside the existing "AI Exposure" and "Wages" options. This lets users visually see which occupations employ the most people.

## Data Layer

- Add `workers: number | null` field to `GraphNode` type
- Parse `no_of_workers` from `nodelist.csv` during data preprocessing ("NA" → `null`)
- Include in `nodes.json` output

## Sizing Logic

- Extend `nodeSizeMetric` type: `'aiExposure' | 'wage' | 'workers'`
- Use **logarithmic scaling** because worker counts range from ~192 to ~850,000. Linear scaling would make most nodes tiny.
- Compute `maxLogWorkers = Math.log(maxWorkers)` once
- Formula: `NODE_RADIUS_BASE + (Math.log(workers) / maxLogWorkers) * NODE_RADIUS_SCALE`
- Null workers: return `NODE_RADIUS_BASE` (9px)

## Missing Data Handling

- Nodes with null workers get minimum radius (9px) and opacity 0.06 when workers metric is active
- Same pattern already used for null wages

## UI Changes

- Convert the Node Size toggle in `GraphControls` Visualization Settings popover from a 2-option toggle to a 3-option radio group
- Options: "AI Exposure", "Wages", "No. of Workers"

## Collision Detection

- No changes needed — `useForceSimulation` already calls `getNodeRadius()` for collision radii
