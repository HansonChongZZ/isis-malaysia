# Node Size & Layout Tuner Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dev-only collapsible bottom-right drawer to the graph with live sliders for tuning node sizing and force layout, plus export buttons for nodes.json and constants.

**Architecture:** A new `TunerPanel` component renders inside `OccupationGraph`'s container div. It manages slider state internally and passes sizing overrides + recomputed positions up to the parent via callbacks. The force simulation runs inline using d3-force with debouncing.

**Tech Stack:** React, d3-force, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-11-node-tuner-panel-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `components/graph/TunerPanel.tsx` | Create | Drawer UI: sliders, labels, export buttons, force simulation logic |
| `components/graph/OccupationGraph.tsx` | Modify | Accept tuner overrides for sizing, accept position updates, render TunerPanel |
| `lib/types.ts` | Modify | Add `TunerSizingParams` and `TunerLayoutParams` types |

---

## Chunk 1: Types and TunerPanel Component

### Task 1: Add tuner parameter types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add tuner types to `lib/types.ts`**

Append these types after the existing exports:

```typescript
export interface TunerSizingParams {
  base: number;
  scale: number;
  exponent: number;
}

export interface TunerLayoutParams {
  collidePadding: number;
  charge: number;
  linkDistanceBase: number;
  linkDistanceScale: number;
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add TunerSizingParams and TunerLayoutParams types"
```

---

### Task 2: Create TunerPanel component

**Files:**
- Create: `components/graph/TunerPanel.tsx`

- [ ] **Step 1: Create `components/graph/TunerPanel.tsx`**

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
import type { GraphNode, GraphEdge, TunerSizingParams, TunerLayoutParams } from '@/lib/types';
import {
  NODE_RADIUS_BASE,
  NODE_RADIUS_SCALE,
  NODE_RADIUS_EXPONENT,
  NODE_RADIUS_COLLIDE_PADDING,
} from '@/lib/constants';

interface TunerPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSizingChange: (params: TunerSizingParams) => void;
  onPositionsChange: (positions: Map<string, { x: number; y: number }>) => void;
}

const DEFAULTS = {
  base: NODE_RADIUS_BASE,
  scale: NODE_RADIUS_SCALE,
  exponent: NODE_RADIUS_EXPONENT,
  collidePadding: NODE_RADIUS_COLLIDE_PADDING,
  charge: -60,
  linkDistanceBase: 55,
  linkDistanceScale: 16,
};

const SLIDER_CONFIG = [
  { key: 'base', label: 'Base Radius', min: 2, max: 20, step: 1, group: 'sizing' },
  { key: 'scale', label: 'Scale', min: 10, max: 150, step: 1, group: 'sizing' },
  { key: 'exponent', label: 'Exponent', min: 0.5, max: 3.0, step: 0.1, group: 'sizing' },
  { key: 'collidePadding', label: 'Collision Padding', min: 0, max: 20, step: 0.5, group: 'layout' },
  { key: 'charge', label: 'Charge', min: -200, max: 0, step: 1, group: 'layout' },
  { key: 'linkDistanceBase', label: 'Link Dist Base', min: 20, max: 150, step: 1, group: 'layout' },
  { key: 'linkDistanceScale', label: 'Link Dist Scale', min: 5, max: 40, step: 1, group: 'layout' },
] as const;

type ParamKey = (typeof SLIDER_CONFIG)[number]['key'];

const INTRA_STRENGTH = 0.8;
const INTER_STRENGTH = 0.001;
const ITERATIONS = 300;

export default function TunerPanel({
  nodes,
  edges,
  onSizingChange,
  onPositionsChange,
}: TunerPanelProps) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<Record<ParamKey, number>>({ ...DEFAULTS });
  const [simulating, setSimulating] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run force simulation when layout params change
  const runSimulation = useCallback(
    (p: Record<ParamKey, number>) => {
      setSimulating(true);

      // Use requestAnimationFrame to avoid blocking the UI render
      requestAnimationFrame(() => {
        const groupOf = new Map(nodes.map((n) => [n.id, n.group]));

        const simNodes = nodes.map((n) => ({
          id: n.id,
          aiExposure: n.aiExposure,
          group: n.group,
          x: n.x,
          y: n.y,
          vx: 0,
          vy: 0,
        }));

        const simEdges = edges.map((e) => ({
          source: typeof e.source === 'string' ? e.source : (e.source as GraphNode).id,
          target: typeof e.target === 'string' ? e.target : (e.target as GraphNode).id,
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
              .distance((d: any) => p.linkDistanceBase + (7 - d.weight) * p.linkDistanceScale)
              .strength((d: any) => {
                const srcId = typeof d.source === 'string' ? d.source : d.source.id;
                const tgtId = typeof d.target === 'string' ? d.target : d.target.id;
                return groupOf.get(srcId) === groupOf.get(tgtId) ? INTRA_STRENGTH : INTER_STRENGTH;
              }),
          )
          .force('charge', forceManyBody().strength(p.charge))
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
              const r = p.base + Math.pow(d.aiExposure, p.exponent) * p.scale;
              return r + p.collidePadding;
            }).strength(0.7),
          );

        sim.stop();
        for (let i = 0; i < ITERATIONS; i++) sim.tick();

        const positions = new Map<string, { x: number; y: number }>();
        for (const n of simNodes) {
          positions.set(n.id, { x: parseFloat(n.x.toFixed(1)), y: parseFloat(n.y.toFixed(1)) });
        }

        onPositionsChange(positions);
        setSimulating(false);
      });
    },
    [nodes, edges, onPositionsChange],
  );

  const handleChange = useCallback(
    (key: ParamKey, value: number) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };

        // Sizing params update instantly
        const sizingKeys: ParamKey[] = ['base', 'scale', 'exponent'];
        if (sizingKeys.includes(key)) {
          onSizingChange({ base: next.base, scale: next.scale, exponent: next.exponent });
        }

        // Layout params trigger debounced simulation
        const layoutKeys: ParamKey[] = ['collidePadding', 'charge', 'linkDistanceBase', 'linkDistanceScale'];
        if (layoutKeys.includes(key)) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => runSimulation(next), 200);
        }

        return next;
      });
    },
    [onSizingChange, runSimulation],
  );

  const handleDownload = useCallback(() => {
    const output = nodes.map((n) => ({ ...n }));
    const blob = new Blob([JSON.stringify(output, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodes.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

  const handleCopyConstants = useCallback(() => {
    const text = [
      `export const NODE_RADIUS_BASE = ${params.base};`,
      `export const NODE_RADIUS_SCALE = ${params.scale};`,
      `export const NODE_RADIUS_EXPONENT = ${params.exponent};`,
      `export const NODE_RADIUS_COLLIDE_PADDING = ${params.collidePadding};`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [params]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

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
              <span className="text-muted-foreground animate-pulse">Computing...</span>
            )}
          </div>

          {/* Sizing section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Node Sizing
            </div>
            {SLIDER_CONFIG.filter((s) => s.group === 'sizing').map((cfg) => (
              <label key={cfg.key} className="block mb-2">
                <div className="flex justify-between mb-0.5">
                  <span>{cfg.label}</span>
                  <span className="font-mono text-muted-foreground">{params[cfg.key]}</span>
                </div>
                <input
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={params[cfg.key]}
                  onChange={(e) => handleChange(cfg.key, parseFloat(e.target.value))}
                  className="w-full accent-foreground"
                />
              </label>
            ))}
          </div>

          {/* Layout section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Layout Forces
            </div>
            {SLIDER_CONFIG.filter((s) => s.group === 'layout').map((cfg) => (
              <label key={cfg.key} className="block mb-2">
                <div className="flex justify-between mb-0.5">
                  <span>{cfg.label}</span>
                  <span className="font-mono text-muted-foreground">{params[cfg.key]}</span>
                </div>
                <input
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={params[cfg.key]}
                  onChange={(e) => handleChange(cfg.key, parseFloat(e.target.value))}
                  className="w-full accent-foreground"
                />
              </label>
            ))}
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

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add components/graph/TunerPanel.tsx
git commit -m "feat: create TunerPanel component with sliders and export"
```

---

## Chunk 2: Integrate TunerPanel into OccupationGraph

### Task 3: Wire TunerPanel into OccupationGraph

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

The integration requires these changes:

1. Import `TunerPanel` and the new types
2. Add state for sizing overrides and position overrides
3. Modify `getNodeRadius` to use overrides when present
4. Apply position overrides to simNodes
5. Render `TunerPanel` inside the container div

- [ ] **Step 1: Add imports**

At the top of `OccupationGraph.tsx`, add:

```typescript
import TunerPanel from './TunerPanel';
import type { TunerSizingParams } from '@/lib/types';
```

- [ ] **Step 2: Add tuner state**

Inside the component function, after the existing state declarations (after line ~68 `const selectedNodeId = selectedNodeIdProp;`), add:

```typescript
const [tunerSizing, setTunerSizing] = useState<TunerSizingParams | null>(null);
const [tunerPositions, setTunerPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
```

- [ ] **Step 3: Apply position overrides to simNodes**

After the existing `simNodes` useMemo (around line 92-96), add an effect that applies tuner positions:

```typescript
useEffect(() => {
  if (!tunerPositions) return;
  for (const node of simNodes) {
    const pos = tunerPositions.get(node.id);
    if (pos) {
      node.x = pos.x;
      node.y = pos.y;
    }
  }
  // Recompute graph center for grid fade
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
  drawEdgesRef.current();
}, [tunerPositions, simNodes]);
```

- [ ] **Step 4: Modify `getNodeRadius` to use tuner overrides**

Replace the existing `getNodeRadius` callback (lines 305-319) with:

```typescript
const getNodeRadius = useCallback(
  (node: GraphNode) => {
    const base = tunerSizing?.base ?? NODE_RADIUS_BASE;
    const scale = tunerSizing?.scale ?? NODE_RADIUS_SCALE;
    const exp = tunerSizing?.exponent ?? NODE_RADIUS_EXPONENT;

    if (nodeSizeMetric === 'wage') {
      if (node.wage === null || maxWage === 0) return base;
      return base + Math.pow(node.wage / maxWage, exp) * scale;
    }
    if (nodeSizeMetric === 'workers') {
      if (node.workers === null || maxWorkers === 0) return base;
      const maxLog = Math.log(maxWorkers);
      return base + Math.pow(Math.log(node.workers) / maxLog, exp) * scale;
    }
    return base + Math.pow(node.aiExposure, exp) * scale;
  },
  [nodeSizeMetric, maxWage, maxWorkers, tunerSizing],
);
```

- [ ] **Step 5: Render TunerPanel inside the container div**

Before the closing `</div>` of the container (just before the final `</div>` at the end of the return statement), add:

```tsx
<TunerPanel
  nodes={simNodes}
  edges={edges}
  onSizingChange={setTunerSizing}
  onPositionsChange={setTunerPositions}
/>
```

- [ ] **Step 6: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

- [ ] **Step 7: Manual test**

Run: `npm run dev`
Open the app in the browser. Verify:
1. Gear icon appears in bottom-right corner
2. Clicking it opens the tuner drawer
3. Dragging sizing sliders changes node sizes immediately
4. Dragging layout sliders triggers a brief "Computing..." state and then repositions nodes
5. "Download JSON" downloads a valid nodes.json file
6. "Copy Constants" copies TypeScript constants to clipboard

- [ ] **Step 8: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: integrate TunerPanel into OccupationGraph with live overrides"
```
