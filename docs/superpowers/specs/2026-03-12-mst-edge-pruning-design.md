# Maximum Spanning Tree Edge Pruning

## Problem

The occupation graph has 3,348 edges across 456 nodes (359 connected, 97 isolated). The high edge density (~14.7 edges/node average) prevents natural clusters from forming in the force-directed layout — everything collapses into a uniform blob regardless of force parameter tuning.

A simple weight threshold filter (weight >= 2) reduced edges to 573 but still didn't produce clear cluster separation. The Harvard Atlas of Economic Complexity solved this with a maximum spanning tree approach.

## Solution

Replace the weight-threshold edge filter with a **maximum spanning forest** computed via Kruskal's algorithm. The MST keeps only the strongest edges needed to maintain connectivity within each connected component — approximately `N - C` edges, where N is the number of connected nodes (359) and C is the number of connected components. The actual count will be fewer than 358 depending on the component count.

### MST for layout, full edges on interaction

- **At rest:** Only MST edges are rendered and used for force layout positions
- **On interaction:** When a user hovers or clicks a node, all edges for that node are shown (from the full 3,348 edge set), revealing the complete connection network

This gives clean cluster separation in the default view while preserving full explorability.

## Algorithm

Kruskal's maximum spanning forest with Union-Find:

1. Sort all edges by weight descending (strongest first)
2. Initialize Union-Find — node IDs are derived from the edge list (no separate nodes input needed)
3. For each edge: if source and target are in different sets, keep the edge and union the sets; otherwise skip (would create a cycle)
4. Result: one spanning tree per connected component, using the strongest possible connections

Tie-breaking for equal weights is arbitrary (insertion order). This is acceptable — the resulting layout may vary slightly if edges are reordered, but the visual effect is equivalent.

Isolated nodes (97 with no edges) remain unaffected — they float freely in the force layout as they do today.

## Architecture

### New file: `lib/mst.ts`

Pure function `computeMaxSpanningTree(edges: GraphEdge[]): GraphEdge[]`.

- Input: full edge array
- Output: subset of edges forming the maximum spanning forest
- ~40 lines, standalone module with no side effects
- Uses internal Union-Find class (not exported)
- Node IDs are derived from the edge list — no `nodes` parameter needed

### Modified files

**`scripts/compute-layout.mjs`**
- Replace `edges.filter(e => e.weight >= MIN_EDGE_WEIGHT)` with MST computation
- Inline the MST algorithm in plain JS (~40 lines) since `.mjs` cannot import `.ts`
- Comment referencing `lib/mst.ts` as the canonical implementation

**`app/page.tsx`**
- `setEdges` stores the **unfiltered** full edge set (remove the `MIN_EDGE_WEIGHT` filter)
- Compute `mstEdges` from full edges via `computeMaxSpanningTree()`
- Pass both `edges` (full set) and `mstEdges` to OccupationGraph
- `firstNodeNeighbors` and `OccupationPanel` continue using the full edge set
- Remove `MIN_EDGE_WEIGHT` import
- Update node count badge to show MST count: e.g. `"456 occupations · 350 skill edges (3,348 total)"`

**`components/graph/OccupationGraph.tsx`**
- Accept new `mstEdges` prop
- Use `mstEdges` for: force layout baseline
- Use full `edges` for: `hoveredEdges` filtering, `selectedEdges` filtering, neighbor lookups on interaction
- Canvas edge rendering: when `selectionMode === 'none'` and no node is hovered, draw all MST edges at low opacity as the baseline visualization. Existing hover/selected edge rendering paths remain unchanged.
- `isolateIds` detection continues using full `edges` prop (correctly identifies the 97 truly isolated nodes)

**`components/graph/TunerPanel.tsx`**
- Import `computeMaxSpanningTree` from `lib/mst.ts` and apply to edges before simulation
- Remove `minEdgeWeight` slider and its default/config
- `linkStrengthDivisor` slider remains (controls `weight / N` strength on MST edges)

**`lib/constants.ts`**
- Remove `MIN_EDGE_WEIGHT` constant

## Data flow

```
edges.json (3,348 edges)
    │
    ├─ computeMaxSpanningTree() → mstEdges (~N-C)
    │   ├─ compute-layout.mjs: force simulation positions
    │   ├─ OccupationGraph: canvas edge rendering (at rest)
    │   └─ TunerPanel: force simulation
    │
    └─ full edges (3,348)
        ├─ OccupationGraph: hover/click edge filtering, isolate detection
        ├─ page.tsx: firstNodeNeighbors, neighbor lookups
        └─ OccupationPanel: panel data
```

## What stays the same

- Weight-dependent link strength (`weight / divisor`) — applies to MST edges
- Link distance formula (`base + (7 - weight) * scale`)
- All other force parameters (charge, collide, center, velocity decay)
- `linkStrengthDivisor` slider in TunerPanel
- Group coloring debug toggle
- Node sizing, rendering, interactions
- OccupationPanel, search, filters

## Expected outcome

MST edges visible at rest (approximately 350-358, depending on component count). Connected occupations reachable through strongest skill-similarity paths. Clear visual clusters with gaps between unrelated groups. Full edge data still accessible on hover/click for exploration.
