# Two-Click Mechanism Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a two-click interaction model where first click selects a node (showing neighbors), second click on a connected node isolates the pair and reveals shared skills on the edge.

**Architecture:** Extend existing `useState` in `page.tsx` with `secondSelectedNodeId` and `panelNodeId`. All rendering changes in `OccupationGraph.tsx`. New `EdgeSkillsTooltip` component for the skills comparison popover. Edge badge rendered as positioned HTML div.

**Tech Stack:** React, D3.js, TypeScript, Tailwind CSS

---

### Task 1: Add Second Selection State to page.tsx

**Files:**
- Modify: `app/page.tsx:31-33` (state declarations)
- Modify: `app/page.tsx:109-114` (handleNodeSelect + derived values)

**Step 1: Add new state variables**

In `app/page.tsx`, after line 33 (`isPanelOpen`), add:

```typescript
const [secondSelectedNodeId, setSecondSelectedNodeId] = useState<string | null>(null)
const [panelNodeId, setPanelNodeId] = useState<string | null>(null)
```

**Step 2: Build adjacency lookup for first selected node**

After the `allSkills` useMemo (line 69), add:

```typescript
const firstNodeNeighbors = useMemo<Set<string>>(() => {
  if (!selectedNodeId) return new Set()
  const set = new Set<string>()
  for (const e of edges) {
    if (e.source === selectedNodeId) set.add(e.target)
    if (e.target === selectedNodeId) set.add(e.source)
  }
  return set
}, [selectedNodeId, edges])
```

**Step 3: Replace handleNodeSelect with two-click logic**

Replace the current `handleNodeSelect` (lines 111-114) with:

```typescript
const handleNodeSelect = (id: string | null) => {
  if (id === null) {
    // Click background or deselect
    setSelectedNodeId(null)
    setSecondSelectedNodeId(null)
    setPanelNodeId(null)
    setIsPanelOpen(false)
    return
  }

  if (secondSelectedNodeId) {
    // In pair mode
    if (id === selectedNodeId || id === secondSelectedNodeId) {
      // Click either selected node → open panel
      setPanelNodeId(id)
      setIsPanelOpen(true)
    } else {
      // Click third node → reset to single
      setSelectedNodeId(id)
      setSecondSelectedNodeId(null)
      setPanelNodeId(null)
      setIsPanelOpen(false)
    }
    return
  }

  if (selectedNodeId) {
    // In single mode
    if (id === selectedNodeId) {
      // Click same node → open panel
      setPanelNodeId(id)
      setIsPanelOpen(true)
    } else if (firstNodeNeighbors.has(id)) {
      // Click connected neighbor → pair mode
      setSecondSelectedNodeId(id)
    } else {
      // Click unconnected node → new single selection
      setSelectedNodeId(id)
      setSecondSelectedNodeId(null)
    }
    return
  }

  // No selection → first click
  setSelectedNodeId(id)
}
```

**Step 4: Update panelDetail to use panelNodeId**

Replace line 109:
```typescript
const selectedDetail = selectedNodeId ? occupations[selectedNodeId] ?? null : null
```
with:
```typescript
const panelDetail = panelNodeId ? occupations[panelNodeId] ?? null : null
```

**Step 5: Update OccupationPanel props**

Update the `OccupationPanel` component usage (lines 228-236) to:

```typescript
<OccupationPanel
  nodeId={panelNodeId}
  detail={panelDetail}
  nodes={nodes}
  edges={edges}
  isOpen={isPanelOpen}
  onClose={() => {
    setIsPanelOpen(false)
    setPanelNodeId(null)
  }}
  onNodeSelect={handleNodeSelect}
/>
```

**Step 6: Pass new props to OccupationGraph**

Update the `OccupationGraph` usage (lines 174-189) to include:

```typescript
<OccupationGraph
  nodes={nodes}
  edges={edges}
  onNodeSelect={handleNodeSelect}
  selectedNodeId={selectedNodeId}
  secondSelectedNodeId={secondSelectedNodeId}
  occupations={occupations}
  filterGroup={filterGroup}
  filterSkills={filterSkills}
  allSkills={allSkills}
  sizeMetric={sizeMetric}
  sizeThreshold={sizeThreshold}
  nodeSizeMetric={nodeSizeMetric}
  maxWage={maxWage}
  maxWorkers={maxWorkers}
  tuning={tuningEnabled ? tuning : null}
  exportRef={exportLayoutRef}
/>
```

**Step 7: Add Escape key handler**

After the `handleNodeSelect` function, add:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedNodeId(null)
      setSecondSelectedNodeId(null)
      setPanelNodeId(null)
      setIsPanelOpen(false)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

**Step 8: Verify the app compiles**

Run: `npm run build`
Expected: Type errors for OccupationGraph missing `secondSelectedNodeId` and `occupations` props (will be fixed in Task 2)

**Step 9: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add two-click selection state to page.tsx"
```

---

### Task 2: Update OccupationGraph Props and Pair Mode Rendering

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:22-55` (props interface)
- Modify: `components/graph/OccupationGraph.tsx:148-246` (adjacency, opacity, edges logic)

**Step 1: Extend props interface**

Add to `OccupationGraphProps` (after line 28):

```typescript
secondSelectedNodeId: string | null;
occupations: Record<string, import('@/lib/types').OccupationDetail>;
```

Add to destructured props (after line 44):

```typescript
secondSelectedNodeId,
occupations,
```

**Step 2: Derive selection mode**

After the `selectedNodeId` assignment (line 64), add:

```typescript
const selectionMode = !selectedNodeId
  ? 'none'
  : secondSelectedNodeId
    ? 'pair'
    : 'single';
```

**Step 3: Compute pair edge**

After the `connectedIds` useMemo (line 160), add:

```typescript
const pairEdge = useMemo(() => {
  if (selectionMode !== 'pair' || !selectedNodeId || !secondSelectedNodeId) return null;
  return edges.find((e) => {
    const src = typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
    const tgt = typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
    return (
      (src === selectedNodeId && tgt === secondSelectedNodeId) ||
      (src === secondSelectedNodeId && tgt === selectedNodeId)
    );
  }) ?? null;
}, [selectionMode, selectedNodeId, secondSelectedNodeId, edges]);
```

**Step 4: Update getNodeOpacity for pair mode**

In the `getNodeOpacity` callback (lines 207-232), add a pair-mode check at the top (after the wage/workers null checks, before the existing `selectedNodeId` check):

```typescript
// Pair mode: only show the two selected nodes
if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
  if (node.id !== selectedNodeId && node.id !== secondSelectedNodeId) return 0.05;
  return 1;
}
```

Add `selectionMode` and `secondSelectedNodeId` to the dependency array.

**Step 5: Update visibleEdges for pair mode**

Replace the `visibleEdges` useMemo (lines 234-246) with:

```typescript
const visibleEdges = useMemo(() => {
  if (selectionMode === 'pair') {
    // Only show the edge between the two selected nodes
    return pairEdge ? [pairEdge] : [];
  }
  if (!selectedNodeId || !connectedIds) return [];
  return edges.filter((e) => {
    const src = typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
    const tgt = typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
    if (src !== selectedNodeId && tgt !== selectedNodeId) return false;
    if (visibleIds && (!visibleIds.has(src) || !visibleIds.has(tgt))) return false;
    return true;
  });
}, [selectionMode, pairEdge, selectedNodeId, connectedIds, edges, visibleIds]);
```

**Step 6: Draw pair edge thicker**

In the `drawEdges` callback (line 248), update the selection edges section. After `ctx.lineWidth = 0.5 / k;` (line 263), add:

```typescript
if (selectionMode === 'pair') {
  ctx.lineWidth = 2 / k;
}
```

**Step 7: Suppress hover tooltip in pair mode**

In the `onMouseEnter` handler (line 546), wrap the existing body:

```typescript
onMouseEnter={() => {
  if (selectionMode === 'pair') return;
  const t = transformRef.current;
  setHoveredNodeId(node.id);
  setTooltip({
    x: t.applyX(node.x ?? 0),
    y: t.applyY(node.y ?? 0),
    node,
  });
}}
```

**Step 8: Verify the app compiles and renders**

Run: `npm run dev`
Test: Click node → see neighbors. Click neighbor → only two nodes + edge visible, everything else dimmed.

**Step 9: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: add pair selection mode rendering to OccupationGraph"
```

---

### Task 3: Auto-Zoom to Frame Pair

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:431-481` (zoom setup)

**Step 1: Store zoom behavior in a ref**

At the top of the component (near other refs, line 60), add:

```typescript
const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
const preZoomTransformRef = useRef<d3.ZoomTransform | null>(null);
```

**Step 2: Assign zoom to ref in zoom setup**

In the zoom setup effect (line 463-477), after `const zoom = d3.zoom(...)`, add:

```typescript
zoomRef.current = zoom;
```

**Step 3: Add auto-zoom effect for pair mode**

After the zoom setup effect, add a new effect:

```typescript
useEffect(() => {
  if (!svgRef.current || !zoomRef.current) return;
  const svg = d3.select(svgRef.current);
  const zoom = zoomRef.current;

  if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
    const nodeA = nodeById.current.get(selectedNodeId);
    const nodeB = nodeById.current.get(secondSelectedNodeId);
    if (!nodeA || !nodeB) return;

    // Save current transform for restoring later
    preZoomTransformRef.current = transformRef.current;

    const padding = 120;
    const ax = nodeA.x ?? 0;
    const ay = nodeA.y ?? 0;
    const bx = nodeB.x ?? 0;
    const by = nodeB.y ?? 0;

    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    const dx = Math.abs(bx - ax) + padding * 2;
    const dy = Math.abs(by - ay) + padding * 2;
    const scale = Math.min(
      dimensions.width / dx,
      dimensions.height / dy,
      2, // max zoom
    );
    const tx = dimensions.width / 2 - cx * scale;
    const ty = dimensions.height / 2 - cy * scale;
    const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

    svg.transition()
      .duration(500)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, target);
  } else if (selectionMode !== 'pair' && preZoomTransformRef.current) {
    // Restore previous zoom on deselect
    const prev = preZoomTransformRef.current;
    preZoomTransformRef.current = null;
    svg.transition()
      .duration(400)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, prev);
  }
}, [selectionMode, selectedNodeId, secondSelectedNodeId, dimensions.width, dimensions.height]);
```

**Step 4: Verify auto-zoom works**

Run: `npm run dev`
Test: Select node, click neighbor → should smoothly zoom to frame both. Click background → zoom restores.

**Step 5: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: auto-zoom to frame node pair on second selection"
```

---

### Task 4: Edge Skills Badge

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:483-598` (return JSX)

**Step 1: Compute badge position and shared skills count**

After the `pairEdge` useMemo, add:

```typescript
const pairSkillsComparison = useMemo(() => {
  if (selectionMode !== 'pair' || !selectedNodeId || !secondSelectedNodeId) return null;
  const detailA = occupations[selectedNodeId];
  const detailB = occupations[secondSelectedNodeId];
  if (!detailA || !detailB) return null;

  const skillsA = new Set([...detailA.basicSkills, ...detailA.specificSkills].map(s => s.toLowerCase()));
  const skillsB = new Set([...detailB.basicSkills, ...detailB.specificSkills].map(s => s.toLowerCase()));

  const shared: string[] = [];
  const onlyA: string[] = [];
  const onlyB: string[] = [];

  for (const skill of detailA.basicSkills) {
    if (skillsB.has(skill.toLowerCase())) shared.push(skill);
    else onlyA.push(skill);
  }
  for (const skill of detailA.specificSkills) {
    if (skillsB.has(skill.toLowerCase())) {
      if (!shared.some(s => s.toLowerCase() === skill.toLowerCase())) shared.push(skill);
    } else onlyA.push(skill);
  }
  for (const skill of [...detailB.basicSkills, ...detailB.specificSkills]) {
    if (!skillsA.has(skill.toLowerCase())) onlyB.push(skill);
  }

  return {
    shared,
    onlyA,
    onlyB,
    labelA: detailA.occupation,
    labelB: detailB.occupation,
    totalUnique: shared.length + onlyA.length + onlyB.length,
  };
}, [selectionMode, selectedNodeId, secondSelectedNodeId, occupations]);
```

**Step 2: Compute badge screen position**

Add state for badge position:

```typescript
const [badgePos, setBadgePos] = useState<{ x: number; y: number } | null>(null);
```

Add an effect to update badge position whenever the transform or pair changes:

```typescript
useEffect(() => {
  if (selectionMode !== 'pair' || !selectedNodeId || !secondSelectedNodeId) {
    setBadgePos(null);
    return;
  }
  const nodeA = nodeById.current.get(selectedNodeId);
  const nodeB = nodeById.current.get(secondSelectedNodeId);
  if (!nodeA || !nodeB) return;

  const t = transformRef.current;
  const mx = ((nodeA.x ?? 0) + (nodeB.x ?? 0)) / 2;
  const my = ((nodeA.y ?? 0) + (nodeB.y ?? 0)) / 2;
  setBadgePos({ x: t.applyX(mx), y: t.applyY(my) });
}, [selectionMode, selectedNodeId, secondSelectedNodeId]);
```

Also update badge position on zoom: in the zoom `on('zoom')` handler (line 470-474), add after `drawEdgesRef.current();`:

```typescript
// Update badge position during zoom
if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
  const nodeA = nodeById.current.get(selectedNodeId);
  const nodeB = nodeById.current.get(secondSelectedNodeId);
  if (nodeA && nodeB) {
    const mx = ((nodeA.x ?? 0) + (nodeB.x ?? 0)) / 2;
    const my = ((nodeA.y ?? 0) + (nodeB.y ?? 0)) / 2;
    setBadgePos({ x: event.transform.applyX(mx), y: event.transform.applyY(my) });
  }
}
```

Note: The zoom handler references `selectionMode`, `selectedNodeId`, `secondSelectedNodeId` — these need to be accessible. Since the zoom effect recreates on dimension/simNodes changes but not on selection changes, store these in refs:

```typescript
const selectionModeRef = useRef(selectionMode);
const selectedNodeIdRef = useRef(selectedNodeId);
const secondSelectedNodeIdRef = useRef(secondSelectedNodeId);
useEffect(() => {
  selectionModeRef.current = selectionMode;
  selectedNodeIdRef.current = selectedNodeId;
  secondSelectedNodeIdRef.current = secondSelectedNodeId;
}, [selectionMode, selectedNodeId, secondSelectedNodeId]);
```

Then in the zoom handler use the refs instead.

**Step 3: Render the badge**

After the hover tooltip div (line 567-598), add:

```typescript
{/* Edge skills badge */}
{badgePos && pairSkillsComparison && (
  <div
    className="absolute z-20 cursor-pointer select-none"
    style={{
      left: badgePos.x,
      top: badgePos.y,
      transform: 'translate(-50%, -50%)',
    }}
    onMouseEnter={() => setShowEdgeTooltip(true)}
    onMouseLeave={() => setShowEdgeTooltip(false)}
  >
    <div className="bg-popover text-popover-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-md border border-border whitespace-nowrap">
      {pairSkillsComparison.shared.length} shared skills
    </div>
  </div>
)}
```

Add state for edge tooltip visibility:

```typescript
const [showEdgeTooltip, setShowEdgeTooltip] = useState(false);
```

**Step 4: Verify badge appears**

Run: `npm run dev`
Test: Select node, click neighbor → badge appears at edge midpoint showing "X shared skills".

**Step 5: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: add shared skills badge at edge midpoint in pair mode"
```

---

### Task 5: Edge Skills Tooltip Component

**Files:**
- Create: `components/graph/EdgeSkillsTooltip.tsx`

**Step 1: Create the tooltip component**

```typescript
import { Badge } from '@/components/ui/badge';

interface EdgeSkillsTooltipProps {
  labelA: string;
  labelB: string;
  shared: string[];
  onlyA: string[];
  onlyB: string[];
  totalUnique: number;
}

export default function EdgeSkillsTooltip({
  labelA,
  labelB,
  shared,
  onlyA,
  onlyB,
  totalUnique,
}: EdgeSkillsTooltipProps) {
  return (
    <div className="w-[360px] max-h-[400px] overflow-y-auto bg-popover text-popover-foreground rounded-lg shadow-xl border border-border p-4 space-y-3">
      {/* Header */}
      <div>
        <p className="font-semibold text-sm leading-tight">
          {labelA} <span className="text-muted-foreground mx-1">↔</span> {labelB}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {shared.length} of {totalUnique} skills in common
        </p>
      </div>

      <hr className="border-border" />

      {/* Shared skills */}
      {shared.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Shared Skills
          </p>
          <div className="flex flex-wrap gap-1">
            {shared.map((skill) => (
              <Badge
                key={skill}
                className="text-xs bg-primary/15 text-primary border-primary/30"
              >
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Unique skills columns */}
      {(onlyA.length > 0 || onlyB.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {onlyA.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 truncate" title={labelA}>
                Only {labelA}
              </p>
              <div className="flex flex-wrap gap-1">
                {onlyA.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-xs opacity-70"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {onlyB.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 truncate" title={labelB}>
                Only {labelB}
              </p>
              <div className="flex flex-wrap gap-1">
                {onlyB.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-xs opacity-70"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/graph/EdgeSkillsTooltip.tsx
git commit -m "feat: create EdgeSkillsTooltip component"
```

---

### Task 6: Wire Edge Tooltip into OccupationGraph

**Files:**
- Modify: `components/graph/OccupationGraph.tsx` (import + render tooltip)

**Step 1: Import the tooltip**

At the top of OccupationGraph.tsx, add:

```typescript
import EdgeSkillsTooltip from './EdgeSkillsTooltip';
```

**Step 2: Render tooltip below the badge**

Update the badge JSX from Task 4 to include the tooltip:

```typescript
{/* Edge skills badge + tooltip */}
{badgePos && pairSkillsComparison && (
  <div
    className="absolute z-20"
    style={{
      left: badgePos.x,
      top: badgePos.y,
      transform: 'translate(-50%, -50%)',
    }}
  >
    <div
      className="cursor-pointer select-none"
      onMouseEnter={() => setShowEdgeTooltip(true)}
      onMouseLeave={() => setShowEdgeTooltip(false)}
    >
      <div className="bg-popover text-popover-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-md border border-border whitespace-nowrap">
        {pairSkillsComparison.shared.length} shared skills
      </div>
    </div>
    {showEdgeTooltip && (
      <div
        className="absolute left-1/2 mt-2"
        style={{
          transform: badgePos.y > (dimensions.height ?? 0) / 2
            ? 'translate(-50%, calc(-100% - 40px))'
            : 'translateX(-50%)',
        }}
        onMouseEnter={() => setShowEdgeTooltip(true)}
        onMouseLeave={() => setShowEdgeTooltip(false)}
      >
        <EdgeSkillsTooltip
          labelA={pairSkillsComparison.labelA}
          labelB={pairSkillsComparison.labelB}
          shared={pairSkillsComparison.shared}
          onlyA={pairSkillsComparison.onlyA}
          onlyB={pairSkillsComparison.onlyB}
          totalUnique={pairSkillsComparison.totalUnique}
        />
      </div>
    )}
  </div>
)}
```

**Step 3: Reset tooltip on selection change**

Add an effect:

```typescript
useEffect(() => {
  setShowEdgeTooltip(false);
}, [selectedNodeId, secondSelectedNodeId]);
```

**Step 4: Verify full flow**

Run: `npm run dev`
Test full flow:
1. Hover node → callout appears
2. Click node → neighbors + edges highlighted
3. Click same node → panel opens
4. Close panel → back to single selection
5. Click connected neighbor → pair mode, auto-zoom, badge visible
6. Hover badge → skills comparison tooltip
7. Click either node → panel opens as overlay
8. Close panel → back to pair view
9. Click background → deselect all, zoom restores
10. Escape key → deselect all

**Step 5: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: wire edge skills tooltip into pair mode"
```

---

### Task 7: Final Cleanup and Edge Cases

**Files:**
- Modify: `app/page.tsx` (hero search visibility)
- Modify: `components/graph/OccupationGraph.tsx` (edge cases)

**Step 1: Hide hero search when any node is selected**

The hero search condition at line 193 already uses `!selectedNodeId`, which is correct — it hides when first node is selected.

**Step 2: Ensure Escape doesn't conflict with Dialog**

The OccupationPanel uses a Dialog which already handles Escape to close. The page-level Escape handler (from Task 1) should only deselect when the panel is closed. Update it:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isPanelOpen) {
      setSelectedNodeId(null)
      setSecondSelectedNodeId(null)
      setPanelNodeId(null)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [isPanelOpen])
```

**Step 3: Handle panel onNodeSelect for pair mode navigation**

In `OccupationPanel`, clicking a transition row calls `onNodeSelect(id)`. With the new logic in `handleNodeSelect`, if we're in pair mode and click a row in the panel, it will either:
- Open that node's panel (if it's one of the two selected)
- Reset to single select (if it's a third node)

This is correct behavior. No changes needed.

**Step 4: Verify all edge cases**

Run: `npm run dev`
Test:
- Click unconnected node while in single mode → replaces selection
- Click third node while in pair mode → resets to single
- Escape while panel open → only closes panel (Dialog handles it)
- Escape while panel closed → deselects all
- Click background in pair mode → deselects all, zoom restores

**Step 5: Commit**

```bash
git add app/page.tsx components/graph/OccupationGraph.tsx
git commit -m "fix: handle escape key and edge cases for two-click mechanism"
```
