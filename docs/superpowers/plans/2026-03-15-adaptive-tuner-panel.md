# Adaptive TunerPanel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt TunerPanel to conditionally render force-layout or circular-layout controls based on viewMode, with state persistence across mode switches.

**Architecture:** Single TunerPanel component with conditional slider sections. New types (`CircularLayoutParams`, `ForceLayoutParams`) in `lib/types.ts`. Layout functions (`computeRingPositions`, `computeRadialPositions`) accept tunable parameters. Parent state in OccupationGraph persists slider values across mode switches via `initial*` props. MST computation restored in `page.tsx`.

**Tech Stack:** React, TypeScript, d3-force, Next.js

**Spec:** `docs/superpowers/specs/2026-03-15-adaptive-tuner-panel-design.md`

---

## Chunk 1: Types and Layout Functions

### Task 1: Add new types to lib/types.ts

**Files:**
- Modify: `lib/types.ts:37-44`

- [ ] **Step 1: Add CircularLayoutParams and ForceLayoutParams interfaces**

After the existing `TunerSizingParams` interface (line 41), add:

```ts
export interface CircularLayoutParams {
  ringRadiusFactor: number;
  nodeSpacing: number;
  radialMinDistance: number;
  radialMaxDistance: number;
}

export interface ForceLayoutParams {
  collidePadding: number;
  charge: number;
  linkDistanceBase: number;
  linkDistanceScale: number;
  linkStrengthDivisor: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from types.ts

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add CircularLayoutParams and ForceLayoutParams types"
```

---

### Task 2: Update computeRingPositions to accept tunable params

**Files:**
- Modify: `lib/layout.ts:17-37`

- [ ] **Step 1: Update function signature and body**

Replace the current `computeRingPositions` function with:

```ts
export function computeRingPositions(
  nodes: GraphNode[],
  viewportWidth: number,
  viewportHeight: number,
  ringRadiusFactor: number = RING_RADIUS_FACTOR,
  nodeSpacing: number = 0,
): Map<string, LayoutPosition> {
  const sorted = [...nodes].sort((a, b) => a.label.localeCompare(b.label));
  const total = sorted.length;
  const positions = new Map<string, LayoutPosition>();
  if (total === 0) return positions;

  // Base radius from factor
  let radius = Math.min(viewportWidth, viewportHeight) * ringRadiusFactor;

  // If nodeSpacing requires a larger ring, scale up
  if (nodeSpacing > 0 && total > 1) {
    const requiredCircumference = total * nodeSpacing;
    const minRadius = requiredCircumference / (2 * Math.PI);
    radius = Math.max(radius, minRadius);
  }

  for (let i = 0; i < total; i++) {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
    positions.set(sorted[i].id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return positions;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing callers pass 3 args, new params have defaults)

- [ ] **Step 3: Commit**

```bash
git add lib/layout.ts
git commit -m "feat: add ringRadiusFactor and nodeSpacing params to computeRingPositions"
```

---

### Task 3: Update computeRadialPositions to accept min/max distance

**Files:**
- Modify: `lib/layout.ts:44-98`

- [ ] **Step 1: Update function signature and body**

Replace the current `computeRadialPositions` function with:

```ts
export function computeRadialPositions(
  centerNodeId: string,
  neighbors: GraphNode[],
  distances: Map<string, SkillComparison>,
  centerNodeRadius: number,
  maxNeighborRadius: number,
  radialMinDistance: number,
  radialMaxDistance: number,
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();

  // Center node at origin
  positions.set(centerNodeId, { x: 0, y: 0 });

  if (neighbors.length === 0) return positions;

  // Floor: prevent overlap regardless of slider value
  const minRadius = Math.max(radialMinDistance, centerNodeRadius + maxNeighborRadius);
  const maxRadius = radialMaxDistance;

  // Sort neighbors by distance ascending (closest first)
  const sorted = [...neighbors].sort((a, b) => {
    const da = distances.get(a.id)?.distance ?? 1;
    const db = distances.get(b.id)?.distance ?? 1;
    return da - db;
  });

  // Find min/max distances for normalization
  const distValues = sorted.map((n) => distances.get(n.id)?.distance ?? 1);
  const minDist = Math.min(...distValues);
  const maxDist = Math.max(...distValues);
  const distRange = maxDist - minDist;

  for (let i = 0; i < sorted.length; i++) {
    const node = sorted[i];
    const dist = distances.get(node.id)?.distance ?? 1;

    // Normalize distance to [minRadius, maxRadius]
    const normalizedRadius =
      distRange === 0
        ? (minRadius + maxRadius) / 2
        : minRadius + ((dist - minDist) / distRange) * (maxRadius - minRadius);

    // Equal angular spacing, clockwise from top
    const angle = (i / sorted.length) * 2 * Math.PI - Math.PI / 2;

    positions.set(node.id, {
      x: Math.cos(angle) * normalizedRadius,
      y: Math.sin(angle) * normalizedRadius,
    });
  }

  return positions;
}
```

- [ ] **Step 2: Fix caller in OccupationGraph.tsx**

The call at `OccupationGraph.tsx:455` currently passes `(selectedNodeId, neighborNodes, neighborDistances, centerRadius, maxNodeRadius, ringRadius)`. The old `ringRadius` param is now split into `radialMinDistance` and `radialMaxDistance`. For now, keep it working with equivalent values. Replace the `radialPositions` useMemo (lines 447-456) with:

```ts
  const radialPositions = useMemo(() => {
    if (layoutMode !== 'radial' || !selectedNodeId || !connectedIds || !neighborDistances) return null;
    const neighborNodes = simNodes.filter(
      (n) => n.id !== selectedNodeId && connectedIds.has(n.id),
    );
    const centerNode = simNodes.find((n) => n.id === selectedNodeId);
    const centerRadius = centerNode ? getNodeRadius(centerNode) : NODE_RADIUS_BASE;
    const maxNeighborRadius = neighborNodes.length > 0
      ? Math.max(...neighborNodes.map(getNodeRadius))
      : NODE_RADIUS_BASE;
    const ringRadius = Math.min(20000, 20000) * RING_RADIUS_FACTOR;
    return computeRadialPositions(
      selectedNodeId, neighborNodes, neighborDistances,
      centerRadius, maxNeighborRadius,
      centerRadius + maxNeighborRadius * 2, // radialMinDistance (matches old clearanceRadius)
      ringRadius,                           // radialMaxDistance (matches old ringRadius)
    );
  }, [layoutMode, selectedNodeId, connectedIds, neighborDistances, simNodes, getNodeRadius, maxNodeRadius]);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add lib/layout.ts components/graph/OccupationGraph.tsx
git commit -m "feat: add radialMinDistance/radialMaxDistance params to computeRadialPositions"
```

---

## Chunk 2: TunerPanel Adaptation

### Task 4: Adapt TunerPanel for multi-mode support

**Files:**
- Modify: `components/graph/TunerPanel.tsx` (full rewrite of props, slider config, and conditional rendering)

- [ ] **Step 1: Rewrite TunerPanel.tsx**

Replace the entire file content with:

```tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import type {
  GraphNode,
  GraphEdge,
  TunerSizingParams,
  ViewMode,
  CircularLayoutParams,
  ForceLayoutParams,
} from '@/lib/types';
import {
  NODE_RADIUS_BASE,
  NODE_RADIUS_SCALE,
  NODE_RADIUS_EXPONENT,
  NODE_RADIUS_COLLIDE_PADDING,
} from '@/lib/constants';

interface TunerPanelProps {
  viewMode: ViewMode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mstEdges: GraphEdge[];
  onSizingChange: (params: TunerSizingParams) => void;
  onPositionsChange: (positions: Map<string, { x: number; y: number }>) => void;
  onCircularLayoutChange: (params: CircularLayoutParams) => void;
  onForceLayoutChange: (params: ForceLayoutParams) => void;
  colorByGroup: boolean;
  onColorByGroupChange: (value: boolean) => void;
  showMstEdges: boolean;
  onShowMstEdgesChange: (value: boolean) => void;
  initialSizing?: TunerSizingParams;
  initialCircularLayout?: CircularLayoutParams;
  initialForceLayout?: ForceLayoutParams;
}

const SIZING_DEFAULTS = {
  base: NODE_RADIUS_BASE,
  scale: NODE_RADIUS_SCALE,
  exponent: NODE_RADIUS_EXPONENT,
};

const FORCE_DEFAULTS: ForceLayoutParams = {
  collidePadding: NODE_RADIUS_COLLIDE_PADDING,
  charge: -800,
  linkDistanceBase: 600,
  linkDistanceScale: 20,
  linkStrengthDivisor: 7,
};

const CIRCULAR_DEFAULTS: CircularLayoutParams = {
  ringRadiusFactor: 0.12,
  nodeSpacing: 0,
  radialMinDistance: 200,
  radialMaxDistance: 2400,
};

const SIZING_SLIDERS = [
  { key: 'base' as const, label: 'Base Radius', min: 2, max: 2000, step: 1 },
  { key: 'scale' as const, label: 'Scale', min: 10, max: 2000, step: 1 },
  { key: 'exponent' as const, label: 'Exponent', min: 0.5, max: 3.0, step: 0.1 },
];

const FORCE_SLIDERS = [
  { key: 'collidePadding' as const, label: 'Collision Padding', min: 0, max: 1000, step: 0.5 },
  { key: 'charge' as const, label: 'Charge', min: -80000, max: 400, step: 1 },
  { key: 'linkDistanceBase' as const, label: 'Link Dist Base', min: -60, max: 600, step: 1 },
  { key: 'linkDistanceScale' as const, label: 'Link Dist Scale', min: -20, max: 160, step: 1 },
  { key: 'linkStrengthDivisor' as const, label: 'Link Str Divisor', min: 1, max: 14, step: 0.5 },
];

const CIRCULAR_SLIDERS = [
  { key: 'ringRadiusFactor' as const, label: 'Ring Radius Factor', min: 0.02, max: 0.5, step: 0.01 },
  { key: 'nodeSpacing' as const, label: 'Node Spacing', min: 0, max: 200, step: 5 },
  { key: 'radialMinDistance' as const, label: 'Radial Min Distance', min: 50, max: 2000, step: 10 },
  { key: 'radialMaxDistance' as const, label: 'Radial Max Distance', min: 500, max: 10000, step: 50 },
];

const ITERATIONS = 300;

export default function TunerPanel({
  viewMode,
  nodes,
  edges,
  mstEdges,
  onSizingChange,
  onPositionsChange,
  onCircularLayoutChange,
  onForceLayoutChange,
  colorByGroup,
  onColorByGroupChange,
  showMstEdges,
  onShowMstEdgesChange,
  initialSizing,
  initialCircularLayout,
  initialForceLayout,
}: TunerPanelProps) {
  const [open, setOpen] = useState(false);
  const [sizingParams, setSizingParams] = useState(
    initialSizing ?? { ...SIZING_DEFAULTS },
  );
  const [forceParams, setForceParams] = useState<ForceLayoutParams>(
    initialForceLayout ?? { ...FORCE_DEFAULTS },
  );
  const [circularParams, setCircularParams] = useState<CircularLayoutParams>(
    initialCircularLayout ?? { ...CIRCULAR_DEFAULTS },
  );
  const [simulating, setSimulating] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshot original positions so every simulation starts from the same baseline
  const originalPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  if (!originalPositionsRef.current && nodes.length > 0) {
    originalPositionsRef.current = new Map(
      nodes.map((n) => [n.id, { x: n.x, y: n.y }]),
    );
  }

  // Run force simulation when layout params change
  const runSimulation = useCallback(
    (sizing: typeof sizingParams, force: ForceLayoutParams) => {
      setSimulating(true);
      const origPositions = originalPositionsRef.current;

      requestAnimationFrame(() => {
        const simNodes = nodes.map((n) => {
          const orig = origPositions?.get(n.id);
          return {
            id: n.id,
            aiExposure: n.aiExposure,
            x: orig?.x ?? n.x,
            y: orig?.y ?? n.y,
            vx: 0,
            vy: 0,
          };
        });

        const simEdges = mstEdges.map((e) => ({
          source:
            typeof e.source === 'string'
              ? e.source
              : (e.source as GraphNode).id,
          target:
            typeof e.target === 'string'
              ? e.target
              : (e.target as GraphNode).id,
          weight: e.weight,
        }));

        const sim = forceSimulation(simNodes)
          .alpha(0.3)
          .alphaDecay(0.01)
          .velocityDecay(0.6)
          .force(
            'link',
            forceLink(simEdges)
              .id((d: any) => d.id)
              .distance(
                (d: any) =>
                  force.linkDistanceBase + (7 - d.weight) * force.linkDistanceScale,
              )
              .strength((d: any) => d.weight / force.linkStrengthDivisor),
          )
          .force('charge', forceManyBody().strength(force.charge))
          .force(
            'center',
            forceCenter(
              simNodes.reduce((s, n) => s + n.x, 0) / simNodes.length,
              simNodes.reduce((s, n) => s + n.y, 0) / simNodes.length,
            ),
          )
          .force(
            'collide',
            forceCollide((d: any) => {
              const r = sizing.base + Math.pow(d.aiExposure, sizing.exponent) * sizing.scale;
              return r + force.collidePadding;
            }).strength(0.7),
          );

        sim.stop();
        for (let i = 0; i < ITERATIONS; i++) sim.tick();

        const positions = new Map<string, { x: number; y: number }>();
        for (const n of simNodes) {
          positions.set(n.id, {
            x: parseFloat(n.x.toFixed(1)),
            y: parseFloat(n.y.toFixed(1)),
          });
        }

        onPositionsChange(positions);
        setSimulating(false);
      });
    },
    [nodes, mstEdges, onPositionsChange],
  );

  const handleSizingChange = useCallback(
    (key: keyof TunerSizingParams, value: number) => {
      setSizingParams((prev) => {
        const next = { ...prev, [key]: value };
        onSizingChange(next);
        return next;
      });
    },
    [onSizingChange],
  );

  const handleForceChange = useCallback(
    (key: keyof ForceLayoutParams, value: number) => {
      setForceParams((prev) => {
        const next = { ...prev, [key]: value };
        onForceLayoutChange(next);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSimulation(sizingParams, next), 200);
        return next;
      });
    },
    [onForceLayoutChange, runSimulation, sizingParams],
  );

  const handleCircularChange = useCallback(
    (key: keyof CircularLayoutParams, value: number) => {
      setCircularParams((prev) => {
        const next = { ...prev, [key]: value };
        onCircularLayoutChange(next);
        return next;
      });
    },
    [onCircularLayoutChange],
  );

  const handleDownload = useCallback(() => {
    const output = nodes.map((n) => ({ ...n }));
    const blob = new Blob([JSON.stringify(output, null, 2) + '\n'], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodes.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

  const handleCopyConstants = useCallback(() => {
    const text = [
      `export const NODE_RADIUS_BASE = ${sizingParams.base};`,
      `export const NODE_RADIUS_SCALE = ${sizingParams.scale};`,
      `export const NODE_RADIUS_EXPONENT = ${sizingParams.exponent};`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [sizingParams]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const renderSliders = <T extends Record<string, number>>(
    sliders: ReadonlyArray<{ key: keyof T & string; label: string; min: number; max: number; step: number }>,
    params: T,
    onChange: (key: any, value: number) => void,
  ) =>
    sliders.map((cfg) => (
      <label key={cfg.key} className="block mb-2">
        <div className="flex justify-between mb-0.5">
          <span>{cfg.label}</span>
          <span className="font-mono text-muted-foreground">
            {params[cfg.key]}
          </span>
        </div>
        <input
          type="range"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={params[cfg.key]}
          onChange={(e) => onChange(cfg.key, parseFloat(e.target.value))}
          className="w-full accent-foreground"
        />
      </label>
    ));

  return (
    <div className="absolute bottom-0 right-0 z-30">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-popover text-popover-foreground border border-border shadow-md flex items-center justify-center text-sm hover:bg-accent transition-colors"
        title="Toggle tuner panel"
      >
        {open ? '\u2715' : '\u2699'}
      </button>

      {/* Drawer */}
      {open && (
        <div className="w-72 max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground border border-border rounded-tl-lg shadow-xl p-3 text-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">Node Tuner</span>
            {simulating && (
              <span className="text-muted-foreground animate-pulse">
                Computing...
              </span>
            )}
          </div>

          {/* Sizing section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Node Sizing
            </div>
            {renderSliders(SIZING_SLIDERS, sizingParams, handleSizingChange)}
          </div>

          {/* Force layout section */}
          {viewMode === 'force' && (
            <div className="mb-3">
              <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Layout Forces
              </div>
              {renderSliders(FORCE_SLIDERS, forceParams, handleForceChange)}
            </div>
          )}

          {/* Circular layout section */}
          {viewMode === 'circular' && (
            <div className="mb-3">
              <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Circular Layout
              </div>
              {renderSliders(CIRCULAR_SLIDERS, circularParams, handleCircularChange)}
            </div>
          )}

          {/* Debug section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Debug
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={colorByGroup}
                onChange={(e) => onColorByGroupChange(e.target.checked)}
                className="accent-foreground"
              />
              <span>Color by MASCO group</span>
            </label>
            {viewMode === 'force' && (
              <label className="flex items-center gap-2 cursor-pointer mt-1.5">
                <input
                  type="checkbox"
                  checked={showMstEdges}
                  onChange={(e) => onShowMstEdgesChange(e.target.checked)}
                  className="accent-foreground"
                />
                <span>Show MST edges</span>
              </label>
            )}
          </div>

          {/* Export section */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-1.5 rounded bg-accent text-accent-foreground text-xs font-medium hover:opacity-80 transition-opacity"
            >
              Download JSON
            </button>
            <button
              onClick={handleCopyConstants}
              className="flex-1 py-1.5 rounded bg-accent text-accent-foreground text-xs font-medium hover:opacity-80 transition-opacity"
            >
              {copied ? 'Copied!' : 'Copy Constants'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles (will have errors from OccupationGraph — expected)**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors about missing props at the TunerPanel call site in OccupationGraph — this is expected and will be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add components/graph/TunerPanel.tsx
git commit -m "feat: adapt TunerPanel for multi-mode support (force + circular)"
```

---

## Chunk 3: OccupationGraph Integration

### Task 5: Wire TunerPanel into OccupationGraph

**Files:**
- Modify: `components/graph/OccupationGraph.tsx` (state, props, TunerPanel call site, drawEdges, position effect)
- Modify: `app/page.tsx` (MST computation, prop passing)

- [ ] **Step 1: Add mstEdges prop and imports to OccupationGraph**

In `OccupationGraph.tsx`, add `mstEdges` to the props interface (after `edges` on line 49):

```ts
  mstEdges: GraphEdge[];
```

Add to the destructured props (after `edges,` on line 68):

```ts
  mstEdges,
```

Add `CircularLayoutParams` and `ForceLayoutParams` to the import from `@/lib/types` (line 11):

```ts
import type {
  GraphNode,
  GraphEdge,
  NodeSizeMetric,
  OccupationDetail,
  TunerSizingParams,
  CircularLayoutParams,
  ForceLayoutParams,
  LayoutMode,
  ViewMode,
} from '@/lib/types';
```

- [ ] **Step 2: Add new state variables**

After the `colorByGroup` state (line 121), add:

```ts
  const [showMstEdges, setShowMstEdges] = useState(false);
  const [tunerPositions, setTunerPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
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

- [ ] **Step 3: Wire circularLayout into ringPositions useMemo**

Replace the `ringPositions` useMemo (lines 171-174) with:

```ts
  const ringPositions = useMemo(
    () => computeRingPositions(simNodes, 20000, 20000, circularLayout.ringRadiusFactor, circularLayout.nodeSpacing),
    [simNodes, circularLayout.ringRadiusFactor, circularLayout.nodeSpacing],
  );
```

- [ ] **Step 4: Wire circularLayout into radialPositions useMemo**

Replace the `radialPositions` useMemo (lines 447-456) with:

```ts
  const radialPositions = useMemo(() => {
    if (layoutMode !== 'radial' || !selectedNodeId || !connectedIds || !neighborDistances) return null;
    const neighborNodes = simNodes.filter(
      (n) => n.id !== selectedNodeId && connectedIds.has(n.id),
    );
    const centerNode = simNodes.find((n) => n.id === selectedNodeId);
    const centerRadius = centerNode ? getNodeRadius(centerNode) : NODE_RADIUS_BASE;
    const maxNeighborRadius = neighborNodes.length > 0
      ? Math.max(...neighborNodes.map(getNodeRadius))
      : NODE_RADIUS_BASE;
    return computeRadialPositions(
      selectedNodeId, neighborNodes, neighborDistances,
      centerRadius, maxNeighborRadius,
      circularLayout.radialMinDistance,
      circularLayout.radialMaxDistance,
    );
  }, [layoutMode, selectedNodeId, connectedIds, neighborDistances, simNodes, getNodeRadius,
      circularLayout.radialMinDistance, circularLayout.radialMaxDistance]);
```

- [ ] **Step 5: Update position effect for tunerPositions and instant circular slider apply**

Add a `prevCircularLayoutRef` after the existing animation refs (after line 464):

```ts
  const prevCircularLayoutRef = useRef(circularLayout);
```

Replace the position effect (lines 543-635) with:

```ts
  useEffect(() => {
    const prevLayout = prevLayoutModeRef.current;
    const prevView = prevViewModeRef.current;
    const prevCircular = prevCircularLayoutRef.current;
    prevLayoutModeRef.current = layoutMode;
    prevViewModeRef.current = viewMode;
    prevCircularLayoutRef.current = circularLayout;

    const updateGraphCenter = () => {
      if (simNodes.length) {
        const xs = simNodes.map((n) => n.x);
        const ys = simNodes.map((n) => n.y);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        let maxDist = 0;
        for (const n of simNodes) {
          const d = Math.hypot(n.x - cx, n.y - cy);
          if (d > maxDist) maxDist = d;
        }
        graphCenterRef.current = { cx, cy, radius: maxDist + 80 };
      }
    };

    const applyPositions = (positions: Map<string, LayoutPosition>) => {
      for (const node of simNodes) {
        const pos = positions.get(node.id);
        if (pos) {
          node.x = pos.x;
          node.y = pos.y;
        }
      }
      updateGraphCenter();
      drawEdgesRef.current();
      const g = gRef.current;
      if (g) {
        d3.select(g).selectAll<SVGCircleElement, null>('.node').each(function () {
          const el = d3.select(this);
          const id = el.attr('data-id');
          const node = nodeById.current.get(id);
          if (node) {
            el.attr('cx', node.x).attr('cy', node.y);
          }
        });
      }
    };

    if (viewMode === 'force') {
      const positions = tunerPositions ?? forcePositions;
      applyPositions(positions);
      return;
    }

    // Circular mode
    const viewChanged = prevView !== viewMode;
    // Detect circular slider change (no mode switch)
    const circularParamsChanged = prevCircular !== circularLayout && prevLayout === layoutMode && !viewChanged;

    if (layoutMode === 'ring') {
      if (prevLayout === 'radial' && !viewChanged && !circularParamsChanged) {
        const targets = new Map<string, LayoutPosition>();
        for (const node of simNodes) {
          const pos = ringPositions.get(node.id);
          if (pos) targets.set(node.id, pos);
        }
        animateToPositions(targets, 600, () => {
          updateGraphCenter();
          drawEdgesRef.current();
        });
      } else {
        applyPositions(ringPositions);
      }
    } else if (layoutMode === 'radial' && radialPositions) {
      const targets = new Map<string, LayoutPosition>();
      for (const node of simNodes) {
        const radialPos = radialPositions.get(node.id);
        if (radialPos) {
          targets.set(node.id, radialPos);
        } else {
          const ringPos = ringPositions.get(node.id);
          if (ringPos) targets.set(node.id, ringPos);
        }
      }
      if (viewChanged || circularParamsChanged) {
        applyPositions(targets);
      } else {
        animateToPositions(targets, 800, () => {
          updateGraphCenter();
          drawEdgesRef.current();
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, layoutMode, simNodes, ringPositions, radialPositions, forcePositions, tunerPositions, circularLayout]);
```

- [ ] **Step 6: Add MST edge rendering to drawEdges**

In the `drawEdges` callback, after the grid fade code (after `ctx.globalCompositeOperation = 'source-over';` around line 709), add:

```ts
    // Draw baseline MST edges — toggled from TunerPanel, force mode only
    if (showMstEdges && viewModeRef.current === 'force') {
      const hasFocus = visibleEdges.length > 0 || hoveredEdges.length > 0;
      ctx.strokeStyle = edgeColorRef.current;
      ctx.lineWidth = 0.5 / k;
      ctx.globalAlpha = hasFocus ? 0.04 : 0.15;
      ctx.beginPath();
      for (const edge of mstEdges) {
        const src = nodeById.current.get(
          typeof edge.source === 'string'
            ? edge.source
            : (edge.source as GraphNode).id,
        );
        const tgt = nodeById.current.get(
          typeof edge.target === 'string'
            ? edge.target
            : (edge.target as GraphNode).id,
        );
        if (!src || !tgt) continue;
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
```

Update the `drawEdges` dependency array to include `showMstEdges` and `mstEdges`:

```ts
  }, [visibleEdges, hoveredEdges, tunerSizing, showMstEdges, mstEdges]);
```

- [ ] **Step 7: Update TunerPanel call site**

Replace the TunerPanel JSX (lines 1476-1482) with:

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

- [ ] **Step 8: Restore MST computation in page.tsx**

In `app/page.tsx`, add the import (after the existing imports around line 6):

```ts
import { computeMaxSpanningTree } from "@/lib/mst"
```

Add the memoized MST computation inside `HomePage` (after `edges` state or after `specificSkillsMap`):

```ts
  const mstEdges = useMemo(() => computeMaxSpanningTree(edges), [edges])
```

Add `mstEdges` prop to the `OccupationGraph` call site (after `edges={edges}`):

```tsx
            mstEdges={mstEdges}
```

- [ ] **Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add components/graph/OccupationGraph.tsx app/page.tsx
git commit -m "feat: wire adaptive TunerPanel into OccupationGraph with MST restoration"
```

---

## Chunk 4: Verification

### Task 6: Manual verification and cleanup

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Expected: App starts without errors

- [ ] **Step 2: Manual verification checklist**

Open the app in a browser and verify:

1. **Force mode**: Open tuner panel (gear icon bottom-right). Verify sizing sliders (Base Radius, Scale, Exponent) and force layout sliders (Collision Padding, Charge, Link Dist Base, Link Dist Scale, Link Str Divisor) are visible. Adjust a force slider — "Computing..." should flash and nodes should reposition.
2. **Force mode debug**: "Show MST edges" checkbox should be visible. Toggle it — faint MST edges should appear/disappear. "Color by MASCO group" checkbox should work.
3. **Switch to circular mode**: Tuner panel should remount. Force layout section should be replaced by Circular Layout section (Ring Radius Factor, Node Spacing, Radial Min Distance, Radial Max Distance). Sizing sliders should preserve their values from force mode.
4. **Circular mode**: Adjust Ring Radius Factor — nodes should instantly reposition on the ring. Adjust Node Spacing — ring should grow to accommodate spacing.
5. **Circular radial mode**: Select a node. Adjust Radial Min Distance / Radial Max Distance — neighbor positions should update instantly (no animation).
6. **Mode switch persistence**: Set custom force layout values. Switch to circular. Switch back to force. Force slider values should be preserved.
7. **Export**: "Download JSON" should download a JSON file. "Copy Constants" should copy only base/scale/exponent (no collidePadding).

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix: address issues found during manual verification"
```
