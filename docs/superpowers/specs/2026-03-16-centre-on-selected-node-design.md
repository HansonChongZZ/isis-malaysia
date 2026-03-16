# Centre Screen on Selected Node

## Summary

When a user clicks a node in the graph, the viewport should animate so the **selected node is at the centre of the screen**, with all its neighbours visible around it. This replaces the current behaviour of centering on the bounding-box midpoint of the neighbourhood.

## Current Behaviour

The zoom-on-select effect (`OccupationGraph.tsx`, lines 1054-1180) computes a bounding box around all neighbour positions and centers the viewport on that box's midpoint. The selected node may end up off-centre if the neighbourhood is asymmetric.

## New Behaviour

The viewport always centres on the **selected node's position**, with scale computed to fit all neighbours within the visible area.

### Algorithm

#### Radial mode (800ms transition)

In radial layout, `computeRadialPositions` always places the selected node at the origin `{x: 0, y: 0}`. Therefore the translate simplifies:

1. Compute `maxDist` = max distance from origin to any position in `radialPositions.values()`. The selected node (distance 0) is included but benign.
2. `scale = min(viewportWidth, viewportHeight) / (2 * (maxDist + 250))`, capped at 3.
3. `tx = viewportWidth / 2`, `ty = viewportHeight / 2` (since selected node is at origin).
4. Animate with `d3.easeCubicInOut`, duration 800ms.

#### Ring mode (500ms transition)

1. Look up the selected node's position from `nodeById.current.get(selectedNodeId)`.
2. `neighbourNodes` (from `connectedIds`) includes the selected node itself — its distance-to-self is 0, which is harmless.
3. Compute `maxDist` = max distance from selected node to any node in `neighbourNodes`.
4. `scale = min(viewportWidth, viewportHeight) / (2 * (maxDist + 250))`, capped at 3.
5. `tx = viewportWidth / 2 - selectedNode.x * scale`, `ty = viewportHeight / 2 - selectedNode.y * scale`.
6. Animate with `d3.easeCubicInOut`, duration 500ms.

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
- **`maxDist === 0`** (degenerate layout / simulation settling): Padding of 250 ensures a finite scale of `min(w, h) / 500`.

## Files Changed

- `components/graph/OccupationGraph.tsx` — zoom-on-select effect (lines 1087-1141)

## Out of Scope

- Two-stage animation (centre then expand)
- Changing the radial/ring layout positioning itself
- Deselection zoom behaviour
