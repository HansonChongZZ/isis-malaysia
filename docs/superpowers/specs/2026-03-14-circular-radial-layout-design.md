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

#### Data Loading

- Parse `data/masco-4d_with_skills.csv` at startup
- Filter to rows where `skill_type === "specific_skills"`
- Store as `Map<string, Set<string>>` — occupation code → set of specific skill names

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
- Curved arc edges from center to each neighbor (quadratic bezier, control point perpendicular to the line between nodes)
- Edge opacity based on skill distance: closer neighbors have more opaque edges, farther neighbors have fainter edges
- Hover on neighbor: tooltip showing shared skills count + skills to develop count

### Node Sizing

Both layouts use the same metric-based sizing as current:
```
radius = NODE_RADIUS_BASE + (metricValue ^ NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE
```

## Interaction Model

### Ring Mode

| Action | Result |
|--------|--------|
| Hover node | Tooltip: occupation name + metric value |
| Click node | Transition to radial mode centered on that node |
| Search | Highlight matching nodes on ring (glow) |
| Skill filter / size threshold | Non-matching nodes dim to 0.06 |

### Radial Mode

| Action | Result |
|--------|--------|
| Hover neighbor | Tooltip: shared skills count + skills to develop count |
| Click neighbor | Enter pair mode (same as current force-directed behavior) |
| Click center node | Open OccupationDetailPane |
| Click background | Animate back to ring mode |
| Escape key | Animate back to ring mode |
| Search | Transition back to ring first, then highlight matches |

### Pair Mode (Preserved)

Same behavior as current implementation:
- Shows only the 2 selected nodes + edge between them
- Skill badge at midpoint with shared skill count
- Hover badge shows skill comparison tooltip
- Click either node opens detail panel
- Click third node or background exits pair mode → back to radial mode (single selection on the first-selected node)

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

- Source: `data/masco-4d_with_skills.csv`
- Columns: `code`, `skills`, `skill_type`
- Filter: `skill_type === "specific_skills"` (1,652 entries across all occupations)
- Loaded once at app startup, stored in memory as `Map<string, Set<string>>`

### Existing Data (Unchanged)

- `nodes.json` — node positions (x, y fields ignored in favor of computed ring/radial positions, but other fields used)
- `edges.json` — edge weights (used to determine first-degree neighbors)
- `occupations/*.json` — detail data (unchanged, used by detail panel)

## Edge Cases

- **Nodes with zero edges (isolates):** Rendered on ring with isolate styling, not clickable (same as current)
- **Node with no specific skills data:** If a node has no entry in the skills CSV, treat it as having an empty skill set. Distance to all neighbors = 1.0 (maximum). Still appears in radial tree, just at maximum distance.
- **All neighbors at same distance:** Equal angular spacing still applies; they form a circle at the same radius
- **Very many neighbors:** Some nodes may have hundreds of connections. Radial layout handles this naturally — nodes get tighter angular spacing. Zoom level adjusts to fit.
- **Viewport resize:** Recompute ring/radial positions with new viewport dimensions. If in radial mode, maintain current selection.

## Files Modified

| File | Change |
|------|--------|
| `lib/layout.ts` | New file — ring and radial position computation |
| `lib/skills.ts` | New file — skill comparison and distance calculation |
| `lib/types.ts` | Add LayoutMode, LayoutPosition, SkillComparison types |
| `lib/data.ts` | Add skills data loading from CSV |
| `components/graph/OccupationGraph.tsx` | Replace force-directed positions with layout module, add animation logic, update edge rendering for curved arcs |
| `hooks/useGraphInteraction.ts` | Add layoutMode state, update click handlers for ring/radial transitions |
| `app/page.tsx` | Pass skills data down to graph component |

## Out of Scope

- Re-centering radial tree on a neighbor (user goes back to ring, clicks new node)
- Edge labels or annotations in radial mode
- Alternative distance formulas (basic skills, tasks)
- New filter or search behaviors beyond current functionality
