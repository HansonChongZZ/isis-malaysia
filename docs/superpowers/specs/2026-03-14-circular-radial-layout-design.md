# Circular Ring & Radial Tree Layout Design

## Overview

Replace the current force-directed layout with two new layout modes for the occupation graph:

1. **Circular Ring** (default) — all nodes arranged on a single ring, alphabetically ordered
2. **Radial Tree** (on node click) — selected node at center, first-degree neighbors positioned radially by skill distance

The transition between modes is animated. All existing interaction modes (single select, pair mode, hover, search, filters, detail panel) are preserved.

## Motivation

The force-directed layout produces a dense, hard-to-parse cloud of nodes. A circular ring provides a clean, scannable default view where every occupation is equally visible and findable. The radial tree provides a focused exploration view that communicates skill similarity through spatial distance — occupations requiring fewer new skills to transition into appear closer to the center.

## Architecture

### New Modules

```
lib/layout.ts   — position computation for ring and radial modes
lib/skills.ts   — specific skill comparison and distance calculation
lib/types.ts    — new types (extended)
```

### Data Flow

1. App boots → `layout.computeRingPositions(nodes, viewport)` → alphabetical ring positions
2. User clicks node → `skills.computeNeighborDistances(selectedNode, neighbors, skillsMap)` → distance per neighbor → `layout.computeRadialPositions(selectedNode, neighbors, distances, viewport)` → radial positions
3. OccupationGraph animates nodes from current positions to new positions via D3 transitions
4. Background click → animate back to ring positions

## Module Specifications

### `lib/layout.ts`

#### `computeRingPositions(nodes: GraphNode[], viewportWidth: number, viewportHeight: number): Map<string, {x: number, y: number}>`

- Sort nodes alphabetically by `label`
- Ring radius = `min(viewportWidth, viewportHeight) * 0.4`
- Each node placed at: `angle = (index / total) * 2π`, starting from top (−π/2)
- Center of ring at `(0, 0)` in graph-space coordinates
- Returns `Map<nodeId, {x, y}>`

#### `computeRadialPositions(centerNode: GraphNode, neighbors: GraphNode[], distances: Map<string, SkillComparison>, viewportWidth: number, viewportHeight: number): Map<string, {x: number, y: number}>`

- Center node at `(0, 0)`
- Max radius = `min(viewportWidth, viewportHeight) * 0.4`
- Min radius = `maxNodeRadius * 3` (prevents overlap with center node)
- Normalize skill distances to `[minRadius, maxRadius]` range
- Sort neighbors by distance ascending (most similar first)
- Place clockwise starting from top (−π/2) with equal angular spacing: `angle = (index / neighborCount) * 2π - π/2`
- Returns `Map<nodeId, {x, y}>` — includes center node at (0,0) and all neighbors

### `lib/skills.ts`

#### Data Source

Reuse the existing `occupations` data already loaded in `app/page.tsx` (from `public/data/occupations/*.json`). Each `OccupationDetail` already contains a `specificSkills: string[]` array. No CSV parsing needed — build the skills map from the `occupations` record:

```typescript
// In app/page.tsx or lib/skills.ts
const specificSkillsMap = new Map<string, Set<string>>();
for (const [id, occ] of Object.entries(occupations)) {
  specificSkillsMap.set(id, new Set(occ.specificSkills));
}
```

This avoids introducing a second data source and stays consistent with the existing data pipeline.

#### `computeSkillDistance(sourceId: string, targetId: string, skillsMap: Map<string, Set<string>>): SkillComparison`

- `shared` = intersection of source and target specific skills
- `toDevelop` = target skills minus source skills (skills the source would need to develop)
- `distance = toDevelop.length / (shared.length + toDevelop.length)`
  - Range: 0 (identical skill sets, closest) to 1 (no overlap, farthest)
  - Represents "effort to transition" — more skills to develop = farther away

Returns:
```typescript
interface SkillComparison {
  shared: string[];
  toDevelop: string[];
  distance: number;
}
```

#### `computeNeighborDistances(sourceId: string, neighborIds: string[], skillsMap: Map<string, Set<string>>): Map<string, SkillComparison>`

- Calls `computeSkillDistance` for each neighbor
- Returns map keyed by neighbor node ID

### `lib/types.ts` — New Types

```typescript
type LayoutMode = 'ring' | 'radial';

interface LayoutPosition {
  x: number;
  y: number;
}

interface SkillComparison {
  shared: string[];
  toDevelop: string[];
  distance: number;
}
```

## Rendering

### Ring Mode (Default)

- All nodes rendered on the ring, sized by current metric (aiExposure/wage/workers)
- **No edges drawn** — clean overview
- Node styling: same as current (color by group optional, isolate styling for zero-edge nodes)
- Hover: tooltip with occupation name + metric value
- Grid background: centered on ring center

### Radial Mode (Node Selected)

- Selected node at center, full opacity
- First-degree neighbor nodes at radial positions, full opacity
- Non-neighbor nodes remain dimmed (opacity 0.06) at their ring positions
- Curved arc edges from center to each neighbor — quadratic bezier with control point offset perpendicular to the midpoint of the straight line between nodes. Offset magnitude = `0.2 * lineLength` (20% of the straight-line distance). All arcs curve in the same clockwise direction for visual consistency.
- Edge opacity based on skill distance: closer neighbors get higher opacity (0.6), farther neighbors get lower opacity (0.15)
- Hover on neighbor: tooltip showing shared skills count + skills to develop count

### Node Sizing

Both layouts use the same metric-based sizing as current:
```
radius = NODE_RADIUS_BASE + (metricValue ^ NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE
```

## State Machine

The system has two orthogonal state dimensions: `layoutMode` and `selectionMode`.

```
layoutMode: 'ring' | 'radial'
selectionMode: 'none' | 'single' | 'pair'  (derived from selectedNodeId / secondSelectedNodeId)
```

**Valid combinations and transitions:**

| From | Action | To |
|------|--------|----|
| ring + none | Click node | radial + single |
| radial + single | Click neighbor | radial + pair |
| radial + single | Click center node | Opens OccupationPanel (existing component, layoutMode stays radial) |
| radial + single | Click background / Escape | ring + none |
| radial + pair | Click either node | Opens OccupationPanel (layoutMode stays radial) |
| radial + pair | Click background | radial + single (back to first-selected node as center) |
| radial + pair | Click third node (non-pair) | Not possible — other nodes are dimmed and not interactive |
| Any mode | Search submitted | ring + none (transition back to ring, highlight matches) |

**Invalid combinations:** `ring + single`, `ring + pair` — selecting a node always transitions to radial mode.

`layoutMode` is added to `useGraphInteraction` alongside the existing `selectedNodeId` and `secondSelectedNodeId`. When `layoutMode` changes, it triggers position recomputation and animation in OccupationGraph.

## Interaction Model

### Ring Mode (layoutMode: 'ring', selectionMode: 'none')

| Action | Result |
|--------|--------|
| Hover node | Tooltip: occupation name + metric value |
| Click node | Transition to radial mode centered on that node |
| Search | Highlight matching nodes on ring (glow) |
| Skill filter / size threshold | Non-matching nodes dim to 0.06 |

### Radial Mode — Single (layoutMode: 'radial', selectionMode: 'single')

| Action | Result |
|--------|--------|
| Hover neighbor | Tooltip: shared skills count + skills to develop count |
| Click neighbor | Enter pair mode (same as current force-directed behavior) |
| Click center node | Open OccupationPanel (existing `components/panel/OccupationPanel.tsx`) |
| Click background | Animate back to ring mode, clear selection |
| Escape key | Animate back to ring mode, clear selection |
| Search | Transition back to ring first, then highlight matches |
| Skill filter / size threshold | Applied to visible nodes — non-matching neighbors dim, non-matching non-neighbors remain at 0.06 |

### Radial Mode — Pair (layoutMode: 'radial', selectionMode: 'pair')

Same behavior as current pair mode implementation:
- Shows only the 2 selected nodes + edge between them
- Skill badge at midpoint with shared skill count
- Hover badge shows skill comparison tooltip
- Click either node opens OccupationPanel
- Click background exits pair mode → back to radial single (first-selected node remains center)

## Animation

### Ring → Radial (~800ms)

| Timing | Action |
|--------|--------|
| 0ms | Compute radial positions from skill distances |
| 0–400ms | Non-neighbor nodes fade to dim opacity (0.06) |
| 0–800ms | Selected node moves from ring position → center (0,0) |
| 200–800ms | Neighbor nodes move from ring positions → radial positions (staggered start) |
| 400–800ms | Curved edges draw in from center to neighbors (opacity 0→target) |
| 800ms | Zoom fits center node + all neighbors with padding |

Easing: `d3.easeCubicInOut`

### Radial → Ring (~600ms)

| Timing | Action |
|--------|--------|
| 0–600ms | All nodes animate back to ring positions |
| 0–400ms | Dimmed nodes fade back to full opacity |
| 0–400ms | Edges fade out (opacity→0) |
| 600ms | Zoom fits entire ring |

### Implementation Approach

- Node positions animated via D3 transitions on SVG `<circle>` and `<text>` elements (interpolate `cx`, `cy`, `opacity`)
- Canvas edges redrawn each frame via `requestAnimationFrame` during transition, interpolating control points and opacity
- Zoom adjustment at end of transition using existing D3 zoom behavior

## Data Requirements

### Skills Data

- Source: existing `occupations` data (already loaded in `app/page.tsx` from `public/data/occupations/*.json`)
- Each `OccupationDetail` has `specificSkills: string[]`
- Build `Map<string, Set<string>>` from existing data — no new data loading needed

### Existing Data (Unchanged)

- `nodes.json` — node metadata (x, y fields from pre-computed force layout are ignored in favor of computed ring/radial positions, but `id`, `label`, `group`, `aiExposure`, `wage`, `workers` fields still used)
- `edges.json` — edge weights (used to determine first-degree neighbors)
- `occupations/*.json` — detail data (unchanged, used by detail panel and as source for specific skills)

## Edge Cases

- **Nodes with zero edges (isolates):** Rendered on ring with isolate styling, not clickable (same as current). Since isolates have no neighbors, clicking them would produce an empty radial view — so they remain non-interactive in both modes.
- **Node with no specific skills data:** If a node has no entry in the occupations data, treat it as having an empty skill set. Distance to all neighbors = 1.0 (maximum). Still appears in radial tree, just at maximum distance.
- **All neighbors at same distance:** Equal angular spacing still applies; they form a circle at the same radius
- **Very many neighbors:** Some nodes may have hundreds of connections. Radial layout handles this naturally — nodes get tighter angular spacing. Zoom level adjusts to fit.
- **Viewport resize:** Recompute ring/radial positions with new viewport dimensions. If in radial mode, maintain current selection.

## Files Modified

| File | Change |
|------|--------|
| `lib/layout.ts` | New file — ring and radial position computation |
| `lib/skills.ts` | New file — skill comparison and distance calculation |
| `lib/types.ts` | Add LayoutMode, LayoutPosition, SkillComparison types |
| `components/graph/OccupationGraph.tsx` | Replace force-directed positions with layout module, add animation logic, update edge rendering for curved arcs, remove TunerPanel force simulation controls (sizing controls remain) |
| `components/graph/TunerPanel.tsx` | Remove force layout sliders (charge, link distance, etc.) — only sizing controls (base, scale, exponent) and debug toggles remain |
| `hooks/useGraphInteraction.ts` | Add `layoutMode` state, update click handlers for ring/radial transitions |
| `app/page.tsx` | Build specificSkillsMap from existing occupations data, pass to graph component |

## TunerPanel Changes

The TunerPanel currently has force layout controls (charge, link distance, etc.) and sizing controls (base, scale, exponent). Since the force-directed layout is being replaced:

- **Remove:** Force layout sliders and the runtime force simulation in TunerPanel
- **Keep:** Sizing controls (base, scale, exponent) — these still affect node radii in both ring and radial modes
- **Keep:** Debug toggles (color by group) — still useful for ring mode visualization
- **Remove:** Show MST edges toggle — MST edges are not drawn in either new layout mode

## Coordinate System

Both layout functions operate in a graph-space coordinate system centered at `(0, 0)`. The ring and radial radii are computed relative to viewport dimensions but expressed in the same coordinate units that D3 zoom transforms. This is the same coordinate space the existing force-directed layout used, so the zoom/pan behavior works without changes.

The `minRadius` for radial mode uses the computed node radius of the center node (not the constant `NODE_RADIUS_BASE`), multiplied by 3, to ensure no overlap regardless of the center node's metric-based size.

## Out of Scope

- Re-centering radial tree on a neighbor (user goes back to ring, clicks new node)
- Edge labels or annotations in radial mode
- Alternative distance formulas (basic skills, tasks)
- New filter or search behaviors beyond current functionality
- Changes to OccupationPanel or detail pane components
