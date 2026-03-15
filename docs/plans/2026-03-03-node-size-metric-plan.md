# Node Size Metric Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an independent "Node Size" toggle to the visualization settings popover that controls whether node radius is driven by AI Exposure or Wage data.

**Architecture:** New `nodeSizeMetric` state in `app/page.tsx`, piped to `GraphControls` (UI toggle) and `OccupationGraph` (radius calculation). Nodes with null wages are dimmed when sizing by wage. The force simulation collide radius also updates to match.

**Tech Stack:** React, D3.js, Next.js, TypeScript, Tailwind CSS

---

### Task 1: Add `nodeSizeMetric` state to HomePage

**Files:**
- Modify: `app/page.tsx:32-33` (add state)
- Modify: `app/page.tsx:92-95` (add handler)
- Modify: `app/page.tsx:100-114` (pass new props to GraphControls)
- Modify: `app/page.tsx:135-145` (pass new props to OccupationGraph)

**Step 1: Add state declaration**

After line 33 (`const [sizeThreshold, setSizeThreshold] = useState(0)`), add:

```typescript
const [nodeSizeMetric, setNodeSizeMetric] = useState<'aiExposure' | 'wage'>('aiExposure')
```

**Step 2: Add handler**

After the `handleSizeMetricChange` function (line 95), add:

```typescript
const handleNodeSizeMetricChange = (metric: 'aiExposure' | 'wage') => {
  setNodeSizeMetric(metric)
}
```

**Step 3: Update "Default Settings" reset logic**

The "Default Settings" button in GraphControls resets threshold to 0. It should also reset `nodeSizeMetric`. We'll pass a single `onResetSettings` callback. Add after the new handler:

```typescript
const handleResetSettings = () => {
  setSizeThreshold(0)
  setNodeSizeMetric('aiExposure')
}
```

**Step 4: Pass new props to GraphControls**

Add these props to the `<GraphControls>` component:

```typescript
nodeSizeMetric={nodeSizeMetric}
onNodeSizeMetricChange={handleNodeSizeMetricChange}
onResetSettings={handleResetSettings}
```

**Step 5: Pass new props to OccupationGraph**

Add these props to the `<OccupationGraph>` component:

```typescript
nodeSizeMetric={nodeSizeMetric}
maxWage={maxWage}
```

**Step 6: Verify the app compiles**

Run: `npx next build` or check the dev server for TypeScript errors (will show type errors since GraphControls/OccupationGraph interfaces haven't been updated yet — that's expected).

**Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add nodeSizeMetric state and handlers to HomePage"
```

---

### Task 2: Add Node Size toggle to GraphControls popover

**Files:**
- Modify: `components/graph/GraphControls.tsx:19-35` (update interface)
- Modify: `components/graph/GraphControls.tsx:216-278` (add Node Size section, update reset button)

**Step 1: Update GraphControlsProps interface**

Add three new props to the interface at line 19:

```typescript
nodeSizeMetric: 'aiExposure' | 'wage';
onNodeSizeMetricChange: (metric: 'aiExposure' | 'wage') => void;
onResetSettings: () => void;
```

**Step 2: Destructure new props**

Add to the destructuring at lines 37-51:

```typescript
nodeSizeMetric,
onNodeSizeMetricChange,
onResetSettings,
```

**Step 3: Add Node Size section above existing Node Filter**

Replace the popover body (lines 216-278) with this structure. The new "Node Size" section goes first, then existing "Node Filter":

```tsx
{/* Node Size section */}
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
      className={`flex-1 px-3 py-1.5 transition-colors ${
        nodeSizeMetric === 'wage'
          ? 'bg-primary text-primary-foreground'
          : maxWage === 0
            ? 'bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground'
      }`}
    >
      Wages
    </button>
  </div>
</div>

<div className="border-t border-border" />
```

This goes right after the header `</div>` (line 213) and before the existing Node Filter section.

**Step 4: Update the existing section label**

Change the existing label from "Node Filter" to keep it as-is (it's already "Node Filter" at line 217).

**Step 5: Update the reset button**

Change the reset button (currently at line 271-277) to call `onResetSettings` and show when either threshold > 0 OR nodeSizeMetric !== 'aiExposure':

```tsx
{(sizeThreshold > 0 || nodeSizeMetric !== 'aiExposure') && (
  <button
    onClick={onResetSettings}
    className="text-xs text-muted-foreground hover:text-foreground underline"
  >
    Default Settings
  </button>
)}
```

**Step 6: Verify the popover renders**

Run the dev server (`npm run dev`), open the settings popover, and verify:
- Two sections visible: "Node Size" and "Node Filter"
- Both have segmented toggles
- Clicking toggles changes active state
- "Wages" button is disabled when no wage data
- "Default Settings" resets both

**Step 7: Commit**

```bash
git add components/graph/GraphControls.tsx
git commit -m "feat: add Node Size toggle to visualization settings popover"
```

---

### Task 3: Update OccupationGraph to size nodes by selected metric

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:15-25` (update interface)
- Modify: `components/graph/OccupationGraph.tsx:452-454` (dynamic radius)
- Modify: `components/graph/OccupationGraph.tsx:166-188` (opacity for null wages)

**Step 1: Update OccupationGraphProps interface**

Add to the interface (lines 15-25):

```typescript
nodeSizeMetric: 'aiExposure' | 'wage';
maxWage: number;
```

**Step 2: Destructure new props**

Add to the destructuring (lines 27-37):

```typescript
nodeSizeMetric,
maxWage,
```

**Step 3: Create a `getNodeRadius` helper**

Add this before the `getNodeOpacity` callback (before line 166):

```typescript
const getNodeRadius = useCallback(
  (node: SimNode) => {
    if (nodeSizeMetric === 'wage') {
      if (node.wage === null || maxWage === 0) return NODE_RADIUS_BASE;
      return NODE_RADIUS_BASE + (node.wage / maxWage) * NODE_RADIUS_SCALE;
    }
    return NODE_RADIUS_BASE + node.aiExposure * NODE_RADIUS_SCALE;
  },
  [nodeSizeMetric, maxWage],
);
```

**Step 4: Update `getNodeOpacity` to dim null-wage nodes**

In the `getNodeOpacity` callback (line 166-188), add a check at the top of the function body (after the opening `(`):

```typescript
if (nodeSizeMetric === 'wage' && node.wage === null) return 0.06;
```

This goes before the existing `if (visibleIds && !visibleIds.has(node.id)) return 0.06;` line. Add `nodeSizeMetric` to the dependency array.

**Step 5: Update the radius calculation in the render**

Replace line 453-454:

```typescript
const r =
  NODE_RADIUS_BASE + node.aiExposure * NODE_RADIUS_SCALE;
```

With:

```typescript
const r = getNodeRadius(node);
```

**Step 6: Verify in the browser**

Run dev server and verify:
- Default (AI Exposure): nodes sized as before
- Switch to Wages: node sizes change to reflect wage values
- Nodes with null wages become dim (opacity 0.06)
- Switching back to AI Exposure restores original sizing

**Step 7: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: size graph nodes by selected metric (AI exposure or wage)"
```

---

### Task 4: Update force simulation collide radius

**Files:**
- Modify: `hooks/useForceSimulation.ts:8-14` (update interface)
- Modify: `hooks/useForceSimulation.ts:46-48` (update collide force)
- Modify: `components/graph/OccupationGraph.tsx:297-303` (pass new props)

**Step 1: Update UseForceSimulationProps interface**

Add to the interface (lines 8-14):

```typescript
nodeSizeMetric: 'aiExposure' | 'wage';
maxWage: number;
```

**Step 2: Destructure new props**

Add to the destructuring (lines 16-22):

```typescript
nodeSizeMetric,
maxWage,
```

**Step 3: Update collide force radius**

Replace line 47:

```typescript
d3.forceCollide<SimNode>((d) => NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE + NODE_RADIUS_COLLIDE_PADDING),
```

With:

```typescript
d3.forceCollide<SimNode>((d) => {
  const r = nodeSizeMetric === 'wage' && d.wage !== null && maxWage > 0
    ? NODE_RADIUS_BASE + (d.wage / maxWage) * NODE_RADIUS_SCALE
    : NODE_RADIUS_BASE + d.aiExposure * NODE_RADIUS_SCALE;
  return r + NODE_RADIUS_COLLIDE_PADDING;
}),
```

**Step 4: Add new props to dependency array**

The `useEffect` dependency array at line 77 should include `nodeSizeMetric` and `maxWage`. They're already covered by the existing deps since they're part of the function closure, but verify the eslint rule doesn't flag them. Update to:

```typescript
}, [nodes, edges, width, height, onTick, nodeSizeMetric, maxWage]);
```

**Step 5: Pass new props from OccupationGraph**

In `OccupationGraph.tsx`, update the `useForceSimulation` call (lines 297-303):

```typescript
const { simulationRef } = useForceSimulation({
  nodes: simNodes,
  edges,
  width: dimensions.width,
  height: dimensions.height,
  onTick: handleTick,
  nodeSizeMetric,
  maxWage,
});
```

**Step 6: Verify collisions work**

Run dev server and verify:
- When sized by wages, large-wage nodes don't overlap
- When sized by AI exposure, behavior is unchanged from before
- Switching metrics triggers re-simulation with correct spacing

**Step 7: Commit**

```bash
git add hooks/useForceSimulation.ts components/graph/OccupationGraph.tsx
git commit -m "feat: update force simulation collide radius for node size metric"
```

---

### Task 5: Final verification and cleanup

**Step 1: Full manual test**

Verify the complete feature:
1. Open app, settings popover shows two sections
2. "Node Size" defaults to AI Exposure — nodes sized as before
3. Toggle to Wages — nodes resize, null-wage nodes dim
4. Toggle back — everything restores
5. "Node Filter" still works independently
6. Set both filter=Wages threshold=RM 2000 AND size=Wages — filter hides low-wage nodes, remaining nodes sized by wage
7. "Default Settings" resets both size metric and threshold
8. Wages buttons disabled when maxWage === 0

**Step 2: Build check**

Run: `npm run build`
Expected: Clean build, no TypeScript errors.

**Step 3: Commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup for node size metric feature"
```
