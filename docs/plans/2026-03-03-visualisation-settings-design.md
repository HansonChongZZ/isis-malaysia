# Visualization Settings Panel — Design

**Date**: 2026-03-03
**Branch**: feat/visualisation-settings

## Overview

Add a "Visualization Settings" popover panel to the graph controls bar, starting with a **Node Size** threshold control. Users can filter nodes by AI Exposure or Wages — nodes below the threshold fade out, while remaining nodes keep their existing AI-exposure-based sizing.

## User Flow

1. User clicks cog icon (right end of the GraphControls bar)
2. Popover opens with "Visualization Settings" header and close button
3. User selects a metric (AI Exposure or Wages) via segmented toggle
4. User drags threshold slider — nodes below the value dim to 0.06 opacity
5. "Default Settings" button resets threshold to 0 (all visible)

## Components

### Cog Button
- Placed at the rightmost position in `GraphControls` flex container
- Uses `Settings2` icon from lucide-react
- Toggles popover open/closed

### Popover Panel
- Anchored to the cog button, drops down
- Styled consistently with existing UI (bg-popover, rounded, shadow)
- Contents:
  - **Header**: "Visualization Settings" + X close button
  - **Metric toggle**: Segmented control — "AI Exposure" (default) | "Wages"
  - **Threshold slider**: HTML range input, 0 to max
    - AI Exposure: 0–100 (displayed as percentage, maps to 0.0–1.0)
    - Wages: 0 to max wage in dataset
    - Nodes with `null` wage always hidden when wages metric is active
  - **Value label**: "AI Exposure ≥ 35%" or "Wage ≥ RM 2,500"
  - **Reset button**: "Default Settings" — resets to threshold=0

## State Management (Approach A: HomePage state)

```typescript
// In HomePage
const [sizeMetric, setSizeMetric] = useState<'aiExposure' | 'wage'>('aiExposure')
const [sizeThreshold, setSizeThreshold] = useState(0)
```

Passed down as props to:
- `GraphControls` — for the settings popover UI
- `OccupationGraph` — for applying threshold to node opacity

## Behavior

- **Threshold filter**: Nodes with metric value below threshold → opacity 0.06
- **Composable**: Threshold filter composes with existing group/skill filters (node must pass all)
- **Metric switch**: Changing metric resets threshold to 0
- **Default**: Threshold=0 means all nodes visible (no change from current)
- **Wages null handling**: When metric is "wage", nodes with null wage are treated as below threshold

## Files Modified

| File | Changes |
|------|---------|
| `app/page.tsx` | Add `sizeMetric`/`sizeThreshold` state, compute max wage, pass props |
| `components/graph/GraphControls.tsx` | Add cog button, popover with toggle + slider |
| `components/graph/OccupationGraph.tsx` | Integrate threshold into `visibleIds` / `getNodeOpacity` |

## No new files or dependencies required

The popover will be built with native HTML/Tailwind (consistent with existing select/button patterns in GraphControls) rather than adding a shadcn Popover component.
