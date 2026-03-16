# Centre Screen on Selected Node

## Summary

When a user clicks a node in the graph, the viewport should animate so the **selected node is at the centre of the screen**, with all its neighbours visible around it. This replaces the current behaviour of centering on the bounding-box midpoint of the neighbourhood.

## Current Behaviour

The zoom-on-select effect (`OccupationGraph.tsx`, lines 1054-1180) computes a bounding box around all neighbour positions and centers the viewport on that box's midpoint. The selected node may end up off-centre if the neighbourhood is asymmetric.

## New Behaviour

The viewport always centres on the **selected node's position**, with scale computed to fit all neighbours within the visible area.

### Algorithm

For both radial and ring mode branches:

1. Look up the selected node's position (`selectedPos`)
   - Radial mode: from `radialPositions`
   - Ring mode: from `nodeById` (sim positions)
2. Compute the maximum distance from the selected node to any neighbour:
   ```
   maxDist = max(distance(selectedPos, neighbourPos)) for all neighbours
   ```
3. Add padding (250px in world-space) to `maxDist`
4. Compute scale to fit the circle of radius `maxDist + padding` in the viewport:
   ```
   scale = min(viewportWidth, viewportHeight) / (2 * (maxDist + padding))
   ```
   Capped at max scale of 3 to avoid over-zoom.
5. Compute translate to place selected node at viewport centre:
   ```
   tx = viewportWidth / 2 - selectedPos.x * scale
   ty = viewportHeight / 2 - selectedPos.y * scale
   ```
6. Animate with existing `d3.easeCubicInOut` transition.

### Branches Affected

| Branch | Lines | Change |
|--------|-------|--------|
| Isolated node | 1072-1086 | No change (already centres on node) |
| Radial mode | 1087-1114 | Centre on selected node from `radialPositions` |
| Ring mode | 1115-1141 | Centre on selected node from `nodeById` |
| Deselection | 1143-1170 | No change (fits entire graph) |

### Edge Cases

- **Single neighbour:** `maxDist` is small; scale capped at 3 prevents over-zoom.
- **Very spread neighbourhood:** Scale naturally reduces; all neighbours remain visible.
- **Isolated node:** Existing branch handles this — no neighbours to fit.

## Files Changed

- `components/graph/OccupationGraph.tsx` — zoom-on-select effect (lines 1087-1141)

## Out of Scope

- Two-stage animation (centre then expand)
- Changing the radial/ring layout positioning itself
- Deselection zoom behaviour
