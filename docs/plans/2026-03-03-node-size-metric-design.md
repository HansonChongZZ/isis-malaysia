# Node Size Metric Toggle — Design

**Date**: 2026-03-03
**Feature**: Independent node size control in visualization settings

## Summary

Add a "Node Size" segmented toggle to the visualization settings popover that controls what metric drives node radius — AI Exposure or Wage. This is independent from the existing "Node Filter" toggle which controls the threshold filter.

## State & Data Flow

- New state in `app/page.tsx`: `nodeSizeMetric: 'aiExposure' | 'wage'` (default: `'aiExposure'`)
- Passed to `GraphControls` for the toggle UI
- Passed to `OccupationGraph` for radius calculation and visibility

## Node Radius Calculation

Current (always AI exposure):
```
r = NODE_RADIUS_BASE + node.aiExposure * NODE_RADIUS_SCALE
```

New (metric-dependent):
```
if nodeSizeMetric === 'aiExposure':
  r = NODE_RADIUS_BASE + node.aiExposure * NODE_RADIUS_SCALE
else:
  r = NODE_RADIUS_BASE + (node.wage / maxWage) * NODE_RADIUS_SCALE
```

## Missing Wage Data Handling

When `nodeSizeMetric === 'wage'` and a node has `wage === null`, the node is dimmed to near-invisible (opacity 0.06), matching the existing behavior for filtered-out nodes.

## UI Layout (Settings Popover)

```
┌─ Visualization Settings ──────── [x] ┐
│                                        │
│ NODE SIZE                              │
│ ┌─────────────┬──────────────┐         │
│ │ AI Exposure │    Wages     │         │
│ └─────────────┴──────────────┘         │
│                                        │
│ NODE FILTER                            │
│ ┌─────────────┬──────────────┐         │
│ │ AI Exposure │    Wages     │         │
│ └─────────────┴──────────────┘         │
│ Threshold            ≥ 35%             │
│ ═══════════●═══════════════            │
│                                        │
│ Default Settings                       │
└────────────────────────────────────────┘
```

- "Wages" button in Node Size toggle disabled when `maxWage === 0`
- "Default Settings" resets both threshold AND node size metric to defaults

## Files Modified

1. `app/page.tsx` — new state + handler + prop passing
2. `components/graph/GraphControls.tsx` — new Node Size toggle section in popover
3. `components/graph/OccupationGraph.tsx` — dynamic radius calculation + wage-null dimming
4. `hooks/useForceSimulation.ts` — pass maxWage for normalization, update collision radius
