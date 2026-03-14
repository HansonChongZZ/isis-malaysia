# Adaptive TunerPanel Design

## Overview

Adapt the existing TunerPanel (from main) to work across both force-directed and circular (ring/radial) view modes. The panel conditionally renders mode-specific layout controls while sharing sizing and debug sections.

## Approach

Single TunerPanel component with conditional sections based on `viewMode`. Three slider groups: `sizing` (always), `force-layout` (force mode), `circular-layout` (circular mode).

## Types

New type in `lib/types.ts`:

```ts
export interface CircularLayoutParams {
  ringRadiusFactor: number;    // how large the ring is relative to viewport
  nodeSpacing: number;         // extra padding between ring nodes
  radialMinDistance: number;    // minimum radius for closest radial neighbor
  radialMaxDistance: number;    // maximum radius for farthest radial neighbor
}
```

Also add to `lib/types.ts`:

```ts
export interface ForceLayoutParams {
  collidePadding: number;
  charge: number;
  linkDistanceBase: number;
  linkDistanceScale: number;
  linkStrengthDivisor: number;
}
```

## TunerPanel Props

```ts
interface TunerPanelProps {
  viewMode: ViewMode;
  // Force mode
  nodes: GraphNode[];
  edges: GraphEdge[];
  mstEdges: GraphEdge[];
  onSizingChange: (params: TunerSizingParams) => void;
  onPositionsChange: (positions: Map<string, { x: number; y: number }>) => void;
  // Circular mode
  onCircularLayoutChange: (params: CircularLayoutParams) => void;
  // Debug
  colorByGroup: boolean;
  onColorByGroupChange: (value: boolean) => void;
  showMstEdges: boolean;
  onShowMstEdgesChange: (value: boolean) => void;
  // Init — all three are used to restore state on mode switch (key={viewMode} remounts)
  initialSizing?: TunerSizingParams;
  initialCircularLayout?: CircularLayoutParams;
  initialForceLayout?: ForceLayoutParams;
}
```

Import `ViewMode` from `@/lib/types` in TunerPanel.

## Slider Configuration

### Sizing (always shown)

| Slider | Min | Max | Step | Default |
|--------|-----|-----|------|---------|
| Base Radius | 2 | 2000 | 1 | 100 (NODE_RADIUS_BASE) |
| Scale | 10 | 2000 | 1 | 501 (NODE_RADIUS_SCALE) |
| Exponent | 0.5 | 3.0 | 0.1 | 3 (NODE_RADIUS_EXPONENT) |

### Force Layout (viewMode === 'force')

| Slider | Min | Max | Step | Default |
|--------|-----|-----|------|---------|
| Collision Padding | 0 | 1000 | 0.5 | 250.5 |
| Charge | -80000 | 400 | 1 | -800 |
| Link Dist Base | -60 | 600 | 1 | 600 |
| Link Dist Scale | -20 | 160 | 1 | 20 |
| Link Str Divisor | 1 | 14 | 0.5 | 7 |

### Circular Layout (viewMode === 'circular')

| Slider | Min | Max | Step | Default |
|--------|-----|-----|------|---------|
| Ring Radius Factor | 0.02 | 0.5 | 0.01 | 0.12 |
| Node Spacing | 0 | 200 | 5 | 0 |
| Radial Min Distance | 50 | 2000 | 10 | 200 |
| Radial Max Distance | 500 | 10000 | 50 | 2400 |

Note: `nodeSpacing` max reduced to 200 to avoid unreasonably large ring radii. At 200px spacing with ~120 nodes the ring circumference stays manageable.

## Behavior

- **Sizing sliders** → instant `onSizingChange` callback (both modes)
- **Force layout sliders** → `onForceLayoutChange` fires immediately on every change (to persist slider values across mode switches). The simulation is debounced 200ms, triggers `runSimulation` (d3-force with 300 iterations on MST edges), then `onPositionsChange`
- **Circular layout sliders** → instant `onCircularLayoutChange` (positions recompute via `useMemo` in OccupationGraph)

## Debug Section

- "Color by MASCO group" checkbox — always shown
- "Show MST edges" checkbox — only shown when `viewMode === 'force'`

## Export Section

- "Download JSON" — dumps node data as JSON file (always shown)
- "Copy Constants" — copies `NODE_RADIUS_*` export lines to clipboard (always shown). Only includes sizing constants (base, scale, exponent) — remove `NODE_RADIUS_COLLIDE_PADDING` from the copy output since collision padding is now a force-mode-only tuner param, not a shared constant.

## OccupationGraph Integration

### New state

```ts
const [circularLayout, setCircularLayout] = useState<CircularLayoutParams>({
  ringRadiusFactor: 0.12,
  nodeSpacing: 0,
  radialMinDistance: 200,
  radialMaxDistance: 2400,
});

const [forceLayout, setForceLayout] = useState<ForceLayoutParams>({
  collidePadding: 250.5,
  charge: -800,
  linkDistanceBase: 600,
  linkDistanceScale: 20,
  linkStrengthDivisor: 7,
});
```

### Restored state (from main)

- `showMstEdges` / `setShowMstEdges` — `useState(false)`, boolean toggle for MST edge rendering
- `tunerPositions` / `setTunerPositions` — `useState<Map<string, { x: number; y: number }> | null>(null)`, positions from TunerPanel's force simulation

### MST computation — restored in page.tsx

Restore the MST computation in `app/page.tsx` from main:

```ts
import { computeMaxSpanningTree } from "@/lib/mst";

const mstEdges = useMemo(() => computeMaxSpanningTree(edges), [edges]);
```

Pass `mstEdges` as a prop to `OccupationGraph`. Re-add `mstEdges: GraphEdge[]` to `OccupationGraphProps`.

### tunerPositions override logic

In the position-application effect, when `viewMode === 'force'`:
- Use `tunerPositions` if non-null (user has run the tuner simulation), otherwise fall back to `forcePositions` (from `nodes.json`).

```ts
if (viewMode === 'force') {
  const positions = tunerPositions ?? forcePositions;
  applyPositions(positions);
}
```

### Layout function changes

**`computeRingPositions`** — add optional params:

```ts
function computeRingPositions(
  nodes: GraphNode[],
  viewportWidth: number,
  viewportHeight: number,
  ringRadiusFactor?: number,   // defaults to RING_RADIUS_FACTOR (0.12)
  nodeSpacing?: number,        // defaults to 0
): Map<string, LayoutPosition>
```

- `ringRadiusFactor` replaces the hardcoded `RING_RADIUS_FACTOR` in the radius calculation.
- `nodeSpacing` adds extra arc-length padding between nodes. If the required circumference (sum of angular spacing) exceeds the ring's circumference, the ring radius scales up to fit.

**`computeRadialPositions`** — replace `ringRadius` with explicit min/max:

```ts
function computeRadialPositions(
  centerNodeId: string,
  neighbors: GraphNode[],
  distances: Map<string, SkillComparison>,
  centerNodeRadius: number,
  maxNeighborRadius: number,
  radialMinDistance: number,    // replaces derived clearanceRadius
  radialMaxDistance: number,    // replaces ringRadius
): Map<string, LayoutPosition>
```

- `radialMinDistance` sets the minimum radius for neighbor placement. A floor of `centerNodeRadius + maxNeighborRadius` is enforced to prevent visual overlap regardless of slider value.
- `radialMaxDistance` sets the maximum radius (replaces `ringRadius` / `maxRadius`).

### useMemo dependency wiring

`ringPositions` depends on `circularLayout` (specifically `ringRadiusFactor`, `nodeSpacing`):

```ts
const ringPositions = useMemo(
  () => computeRingPositions(simNodes, 20000, 20000, circularLayout.ringRadiusFactor, circularLayout.nodeSpacing),
  [simNodes, circularLayout.ringRadiusFactor, circularLayout.nodeSpacing],
);
```

`radialPositions` depends on `circularLayout` and `getNodeRadius`. Note: `neighborNodes` and `centerRadius` are derived inline inside the memo (from `simNodes`, `connectedIds`, and `getNodeRadius`), so the dependency array uses the source values:

```ts
const radialPositions = useMemo(() => {
  // ... existing guards ...
  const centerRadius = getNodeRadius(centerNode);
  const neighborNodes = simNodes.filter(n => connectedIds.has(n.id));
  const maxNeighborRadius = Math.max(...neighborNodes.map(getNodeRadius));
  return computeRadialPositions(
    selectedNodeId, neighborNodes, neighborDistances,
    centerRadius, maxNeighborRadius,
    circularLayout.radialMinDistance,
    circularLayout.radialMaxDistance,
  );
}, [selectedNodeId, simNodes, connectedIds, neighborDistances, getNodeRadius,
    circularLayout.radialMinDistance, circularLayout.radialMaxDistance]);
```

### Position animation on circular slider changes

When circular layout params change via the tuner, positions should apply **instantly** (no 600ms/800ms animation). The position effect should detect whether the change is a slider-driven layout param update vs a layout mode switch:

- **Layout mode switch** (ring→radial or radial→ring): animate as today (600ms/800ms).
- **Slider param change** (same layout mode): instant `applyPositions`.

Implementation: track `prevCircularLayout` via ref. If `circularLayout` changed but `layoutMode` and `viewMode` did not, apply instantly.

### ForceLayout persistence across mode switches

`TunerPanel` remounts on `viewMode` change (`key={viewMode}`). To preserve force layout slider values:

- OccupationGraph stores `forceLayout` state (see above).
- TunerPanel accepts `initialForceLayout?: ForceLayoutParams` and initializes force slider state from it.
- When force layout sliders change, TunerPanel calls a new `onForceLayoutChange?: (params: ForceLayoutParams) => void` callback so the parent can persist the values.

Update TunerPanelProps to add:

```ts
onForceLayoutChange?: (params: ForceLayoutParams) => void;
initialForceLayout?: ForceLayoutParams;
```

### TunerPanel call site

```tsx
<TunerPanel
  key={viewMode}
  viewMode={viewMode}
  nodes={simNodes}
  edges={edges}
  mstEdges={mstEdges}
  onSizingChange={setTunerSizing}
  onPositionsChange={setTunerPositions}
  onCircularLayoutChange={setCircularLayout}
  onForceLayoutChange={setForceLayout}
  colorByGroup={colorByGroup}
  onColorByGroupChange={setColorByGroup}
  showMstEdges={showMstEdges}
  onShowMstEdgesChange={setShowMstEdges}
  initialSizing={tunerSizing ?? undefined}
  initialCircularLayout={circularLayout}
  initialForceLayout={forceLayout}
/>
```

### MST edge rendering

Restore the MST edge drawing block from main into the canvas draw function, gated by `showMstEdges && viewMode === 'force'`.

### mstEdges reference stability

`mstEdges` must be memoized in `page.tsx` (via `useMemo` on `edges`) to prevent unnecessary re-renders and force simulation re-triggers in TunerPanel. The `runSimulation` callback depends on `mstEdges` — an unstable reference would cause simulation thrashing on every render.

### tunerPositions during mode switch

`tunerPositions` is only applied in force mode. When switching to circular mode, `tunerPositions` is ignored — the position effect's `if (viewMode === 'circular')` branch uses `ringPositions`/`radialPositions` exclusively. The `tunerPositions` state is preserved so it can be reapplied when switching back to force mode.

## Known Limitations

- **`key={viewMode}` remounts TunerPanel** — this resets internal UI state (scroll position, open/closed). Slider values are preserved via `initial*` props from parent state. This is intentional for SLC scope.
- **Force simulation runs on MST edges only** — same as the original main branch behavior. Full edge set is available but unused for simulation performance.
