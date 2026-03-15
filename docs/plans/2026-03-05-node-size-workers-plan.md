# Node Size by Number of Workers — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Number of Workers" as a third node size metric in the graph visualization settings.

**Architecture:** Extend the existing node size metric pattern (already supports AI Exposure and Wages) with a `workers` field. Data is parsed from the `no_of_workers` column in `nodelist.csv`. Log scaling is used because worker counts span 192–850k+.

**Tech Stack:** Next.js, TypeScript, D3, Zod, PapaParse

---

### Task 1: Add `workers` field to data pipeline

**Files:**
- Modify: `scripts/process-csv.ts:14-20` (NodeRow interface)
- Modify: `scripts/process-csv.ts:56-70` (node building)
- Modify: `lib/types.ts:3-12` (NodeSchema)

**Step 1: Update NodeRow interface in process-csv.ts**

Add `no_of_workers` to the interface at line 20:

```typescript
interface NodeRow {
  code: number | string
  occupation: string
  AI_exposure_index: number | string
  quartile: string
  wage: number | string | null
  no_of_workers: number | string | null
}
```

**Step 2: Parse workers in the node building loop**

In `scripts/process-csv.ts` inside the `nodeRows.map()` at line 56, add workers parsing after wage (line 60) and include it in the return object:

```typescript
const workers = row.no_of_workers === null || row.no_of_workers === "NA" || row.no_of_workers === "" ? null : Number(row.no_of_workers)
```

Add `workers` (after `wage`) to the return object:

```typescript
return {
  id: code,
  label: row.occupation,
  group,
  aiExposure: isNaN(aiExposure) ? 0 : aiExposure,
  quartile,
  wage,
  workers: isNaN(workers as number) ? null : workers,
}
```

**Step 3: Update NodeSchema in lib/types.ts**

Add `workers` field to the Zod schema at line 9 (after `wage`):

```typescript
workers: z.number().nullable(),
```

**Step 4: Run the data processing script**

Run: `npx tsx scripts/process-csv.ts`
Expected: Script outputs counts, `public/data/nodes.json` now contains `workers` field on each node.

**Step 5: Verify nodes.json contains workers**

Run: `head -15 public/data/nodes.json`
Expected: First node shows `"workers": 192`

**Step 6: Commit**

```bash
git add scripts/process-csv.ts lib/types.ts public/data/nodes.json
git commit -m "feat: add workers field to node data pipeline"
```

---

### Task 2: Add workers metric to node sizing logic

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:189-198` (getNodeRadius)
- Modify: `components/graph/OccupationGraph.tsx:200-224` (getNodeOpacity)
- Modify: `components/graph/OccupationGraph.tsx:22-37` (OccupationGraphProps)
- Modify: `hooks/useForceSimulation.ts:20-23` (UseForceSimulationProps)
- Modify: `hooks/useForceSimulation.ts:88-96` (collision radius in tuning mode)
- Modify: `hooks/useForceSimulation.ts:117-125` (collision radius in normal mode)

**Step 1: Create the NodeSizeMetric type**

Add a shared type. In `lib/types.ts` at the end of the file:

```typescript
export type NodeSizeMetric = 'aiExposure' | 'wage' | 'workers'
```

**Step 2: Update OccupationGraphProps**

In `OccupationGraph.tsx`, change the `nodeSizeMetric` prop type from `'aiExposure' | 'wage'` to use the new type (import it). Also add `maxWorkers: number`:

```typescript
import type { GraphNode, GraphEdge, SimNode, NodeSizeMetric } from '@/lib/types';
```

In the interface (~line 31-33):
```typescript
nodeSizeMetric: NodeSizeMetric;
maxWage: number;
maxWorkers: number;
```

Add `maxWorkers` to the destructured props.

**Step 3: Update getNodeRadius**

Replace the existing `getNodeRadius` callback (~line 189-198):

```typescript
const getNodeRadius = useCallback(
  (node: SimNode) => {
    if (nodeSizeMetric === 'wage') {
      if (node.wage === null || maxWage === 0) return NODE_RADIUS_BASE;
      return NODE_RADIUS_BASE + (node.wage / maxWage) * NODE_RADIUS_SCALE;
    }
    if (nodeSizeMetric === 'workers') {
      if (node.workers === null || maxWorkers === 0) return NODE_RADIUS_BASE;
      const maxLog = Math.log(maxWorkers);
      return NODE_RADIUS_BASE + (Math.log(node.workers) / maxLog) * NODE_RADIUS_SCALE;
    }
    return NODE_RADIUS_BASE + node.aiExposure * NODE_RADIUS_SCALE;
  },
  [nodeSizeMetric, maxWage, maxWorkers],
);
```

**Step 4: Update getNodeOpacity**

In `getNodeOpacity` (~line 200), add workers null check alongside the wage check:

```typescript
if (nodeSizeMetric === 'wage' && node.wage === null) return 0.06;
if (nodeSizeMetric === 'workers' && node.workers === null) return 0.06;
```

**Step 5: Update useForceSimulation**

In `hooks/useForceSimulation.ts`:

1. Import `NodeSizeMetric` from types
2. Change `nodeSizeMetric` type in `UseForceSimulationProps` to `NodeSizeMetric`
3. Add `maxWorkers: number` to the interface
4. Destructure `maxWorkers` in the function

Replace the collision radius calculation in **both** the tuning mode (~line 90) and normal mode (~line 119) with a helper:

```typescript
const getCollideRadius = (d: SimNode) => {
  let r: number;
  if (nodeSizeMetric === 'wage' && d.wage !== null && maxWage > 0) {
    r = NODE_RADIUS_BASE + (d.wage / maxWage) * NODE_RADIUS_SCALE;
  } else if (nodeSizeMetric === 'workers' && d.workers !== null && maxWorkers > 0) {
    const maxLog = Math.log(maxWorkers);
    r = NODE_RADIUS_BASE + (Math.log(d.workers) / maxLog) * NODE_RADIUS_SCALE;
  } else {
    r = NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE;
  }
  return r + NODE_RADIUS_COLLIDE_PADDING;
};
```

Use `getCollideRadius` in both `d3.forceCollide()` calls.

Add `maxWorkers` to the effect dependency array.

**Step 6: Commit**

```bash
git add components/graph/OccupationGraph.tsx hooks/useForceSimulation.ts lib/types.ts
git commit -m "feat: add workers metric to node sizing and collision logic"
```

---

### Task 3: Wire up state and UI in page and controls

**Files:**
- Modify: `app/page.tsx:34-36` (state declarations)
- Modify: `app/page.tsx:80-86` (maxWage memo — add maxWorkers)
- Modify: `app/page.tsx:102-114` (handler functions)
- Modify: `app/page.tsx:119-136` (GraphControls props)
- Modify: `app/page.tsx:157-171` (OccupationGraph props)
- Modify: `components/graph/GraphControls.tsx:21-38` (props interface)
- Modify: `components/graph/GraphControls.tsx:222-250` (Node Size section UI)

**Step 1: Update page.tsx state**

Change the type of `nodeSizeMetric` state (~line 36):

```typescript
import type { NodeSizeMetric } from '@/lib/types';

const [nodeSizeMetric, setNodeSizeMetric] = useState<NodeSizeMetric>('aiExposure')
```

**Step 2: Add maxWorkers memo**

After the `maxWage` memo (~line 80-86), add:

```typescript
const maxWorkers = useMemo(() => {
  let max = 0
  for (const n of nodes) {
    if (n.workers !== null && n.workers > max) max = n.workers
  }
  return max
}, [nodes])
```

**Step 3: Update handlers**

Change `handleNodeSizeMetricChange` to accept `NodeSizeMetric`:

```typescript
const handleNodeSizeMetricChange = (metric: NodeSizeMetric) => {
  setNodeSizeMetric(metric)
}
```

**Step 4: Pass maxWorkers to OccupationGraph**

Add `maxWorkers={maxWorkers}` to the OccupationGraph component props (~line 168).

**Step 5: Update GraphControls props interface**

In `GraphControls.tsx`, update the interface to use `NodeSizeMetric` type for `nodeSizeMetric` and `onNodeSizeMetricChange`. Also add `maxWorkers: number`:

```typescript
import type { NodeSizeMetric } from '@/lib/types';

interface GraphControlsProps {
  // ... existing props ...
  nodeSizeMetric: NodeSizeMetric;
  onNodeSizeMetricChange: (metric: NodeSizeMetric) => void;
  maxWorkers: number;
  // ... rest ...
}
```

Pass `maxWorkers={maxWorkers}` to GraphControls in page.tsx.

Destructure `maxWorkers` in the component function.

**Step 6: Update Node Size UI from 2-button toggle to 3-button segmented control**

Replace the Node Size section (~lines 222-250) with:

```tsx
<div className="px-4 py-3 space-y-3">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Node Size</p>
  <div className="flex rounded-md border border-border overflow-hidden text-xs">
    <button
      onClick={() => onNodeSizeMetricChange('aiExposure')}
      aria-pressed={nodeSizeMetric === 'aiExposure'}
      className={`flex-1 px-3 py-1.5 transition-colors ${
        nodeSizeMetric === 'aiExposure'
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted/50 text-muted-foreground hover:text-foreground'
      }`}
    >
      AI Exposure
    </button>
    <button
      onClick={() => onNodeSizeMetricChange('wage')}
      aria-pressed={nodeSizeMetric === 'wage'}
      disabled={maxWage === 0}
      className={`flex-1 px-3 py-1.5 transition-colors border-l border-border ${
        nodeSizeMetric === 'wage'
          ? 'bg-primary text-primary-foreground'
          : maxWage === 0
            ? 'bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
      }`}
    >
      Wages
    </button>
    <button
      onClick={() => onNodeSizeMetricChange('workers')}
      aria-pressed={nodeSizeMetric === 'workers'}
      disabled={maxWorkers === 0}
      className={`flex-1 px-3 py-1.5 transition-colors border-l border-border ${
        nodeSizeMetric === 'workers'
          ? 'bg-primary text-primary-foreground'
          : maxWorkers === 0
            ? 'bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
      }`}
    >
      Workers
    </button>
  </div>
</div>
```

**Step 7: Update export layout in OccupationGraph**

In the export function (~line 388), add `workers` to the exported object:

```typescript
workers: n.workers,
```

(After `wage: n.wage,`)

**Step 8: Commit**

```bash
git add app/page.tsx components/graph/GraphControls.tsx components/graph/OccupationGraph.tsx
git commit -m "feat: add workers option to node size UI controls"
```

---

### Task 4: Verify and test

**Step 1: Run the dev server**

Run: `npm run dev`
Expected: No TypeScript errors, app loads.

**Step 2: Manual verification**

1. Open the app in browser
2. Click the settings gear icon
3. Verify 3 buttons appear in Node Size: "AI Exposure", "Wages", "Workers"
4. Click "Workers" — nodes should resize with log scaling
5. Nodes with missing worker data should appear at minimum size and be dimmed
6. Switch back to "AI Exposure" — verify it still works
7. Switch to "Wages" — verify it still works

**Step 3: Commit any fixes if needed**
