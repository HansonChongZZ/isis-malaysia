# Maximum Spanning Tree Edge Pruning

## Problem

The occupation graph has 3,348 edges across 456 nodes (359 connected, 97 isolated). The high edge density (~14.7 edges/node average) prevents natural clusters from forming in the force-directed layout — everything collapses into a uniform blob regardless of force parameter tuning.

A simple weight threshold filter (weight >= 2) reduced edges to 573 but still didn't produce clear cluster separation. The Harvard Atlas of Economic Complexity solved this with a maximum spanning tree approach.

## Solution

Replace the weight-threshold edge filter with a **maximum spanning tree (MST)** computed via Kruskal's algorithm. The MST keeps only the strongest edges needed to maintain connectivity — approximately 358 edges for 359 connected nodes.

### MST for layout, full edges on interaction

- **At rest:** Only MST edges are rendered and used for force layout positions (~358 edges)
- **On interaction:** When a user hovers or clicks a node, all edges for that node are shown (from the full 3,348 edge set), revealing the complete connection network

This gives clean cluster separation in the default view while preserving full explorability.

## Algorithm

Kruskal's maximum spanning tree with Union-Find:

1. Sort all edges by weight descending (strongest first)
2. Initialize Union-Find with one set per node
3. For each edge: if source and target are in different sets, keep the edge and union the sets; otherwise skip (would create a cycle)
4. Result: N-1 edges for N connected nodes, using the strongest possible connections

Isolated nodes (97 with no edges) remain unaffected — they float freely in the force layout as they do today.

## Architecture

### New file: `lib/mst.ts`

Pure function `computeMaxSpanningTree(edges: GraphEdge[]): GraphEdge[]`.

- Input: full edge array
- Output: subset of edges forming the maximum spanning tree
- ~40 lines, standalone module with no side effects
- Uses internal Union-Find class (not exported)

### Modified files

**`scripts/compute-layout.mjs`**
- Replace `edges.filter(e => e.weight >= MIN_EDGE_WEIGHT)` with MST computation
- Import or inline the MST algorithm (ESM script, can't import .ts directly)

**`app/page.tsx`**
- Compute `mstEdges` from full edges at load time
- Pass both `edges` (full set) and `mstEdges` to OccupationGraph
- Remove `MIN_EDGE_WEIGHT` import

**`components/graph/OccupationGraph.tsx`**
- Accept new `mstEdges` prop
- Use `mstEdges` for: canvas edge rendering (default view), force layout baseline
- Use full `edges` for: `hoveredEdges` filtering, `selectedEdges` filtering, neighbor lookups on interaction
- No changes to node rendering, zoom, or other interactions

**`components/graph/TunerPanel.tsx`**
- Apply MST to edges before running simulation
- Remove `minEdgeWeight` slider and its default/config
- `linkStrengthDivisor` slider remains (controls `weight / N` strength on MST edges)

**`lib/constants.ts`**
- Remove `MIN_EDGE_WEIGHT` constant

## Data flow

```
edges.json (3,348 edges)
    │
    ├─ computeMaxSpanningTree() → mstEdges (~358)
    │   ├─ compute-layout.mjs: force simulation positions
    │   ├─ OccupationGraph: canvas edge rendering (default)
    │   └─ TunerPanel: force simulation
    │
    └─ full edges (3,348)
        ├─ OccupationGraph: hover/click edge filtering
        └─ page.tsx: neighbor lookups, panel data
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

~358 edges visible at rest (down from 3,348). Connected occupations reachable through strongest skill-similarity paths. Clear visual clusters with gaps between unrelated groups. Full edge data still accessible on hover/click for exploration.
