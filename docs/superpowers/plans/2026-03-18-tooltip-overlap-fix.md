# Tooltip Overlap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix overlapping pair-mode labels and badge in the occupation graph by adding angle-based label mirroring, badge perpendicular offset, and hover-to-foreground stacking.

**Architecture:** Extract two pure utility functions (`computeMirroredPosition`, `checkBoundingBoxOverlap`) into `lib/layout.ts`. Add new state (`hasOverlap`, `lastHoveredElement` ref) to `OccupationGraph.tsx`. Update both position-computation sites (selection useEffect and zoom handler) to use the new utilities. Update the JSX rendering to apply conditional z-index and opacity.

**Tech Stack:** React, TypeScript, D3 zoom transforms

**Spec:** `docs/superpowers/specs/2026-03-18-tooltip-overlap-fix-design.md`

---

### Task 1: Add `computeMirroredPosition` utility to `lib/layout.ts`

**Files:**
- Modify: `lib/layout.ts`

- [ ] **Step 1: Add the `computeMirroredPosition` function**

```typescript
/** Estimated label dimensions for overlap detection */
export const LABEL_WIDTH = 220;
export const LABEL_HEIGHT = 70;
export const BADGE_WIDTH = 200;
export const BADGE_HEIGHT = 50;
export const GAP = 6;

interface MirroredPosition {
  left: number;
  top: number;
}

/**
 * Compute label position on the outward side of a node, away from the other node.
 * Falls back to right-side placement if nodes overlap (distance < 1px).
 */
export function computeMirroredPosition(
  nodeAScreen: { x: number; y: number },
  nodeBScreen: { x: number; y: number },
  targetScreen: { x: number; y: number },
  radius: number,
): MirroredPosition {
  const mx = (nodeAScreen.x + nodeBScreen.x) / 2;
  const my = (nodeAScreen.y + nodeBScreen.y) / 2;
  const dx = targetScreen.x - mx;
  const dy = targetScreen.y - my;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Degenerate case: nodes at same position
  if (dist < 1) {
    return {
      left: targetScreen.x + radius + GAP,
      top: targetScreen.y - 10,
    };
  }

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (angleDeg >= -45 && angleDeg < 45) {
    // Right
    return { left: targetScreen.x + radius + GAP, top: targetScreen.y - 10 };
  } else if (angleDeg >= 45 && angleDeg < 135) {
    // Bottom
    return { left: targetScreen.x - LABEL_WIDTH / 2, top: targetScreen.y + radius + GAP };
  } else if (angleDeg >= -135 && angleDeg < -45) {
    // Top
    return { left: targetScreen.x - LABEL_WIDTH / 2, top: targetScreen.y - radius - LABEL_HEIGHT - GAP };
  } else {
    // Left
    return { left: targetScreen.x - radius - LABEL_WIDTH - GAP, top: targetScreen.y - 10 };
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add lib/layout.ts
git commit -m "feat: add computeMirroredPosition utility for pair-mode labels"
```

---

### Task 2: Add `checkBoundingBoxOverlap` utility to `lib/layout.ts`

**Files:**
- Modify: `lib/layout.ts`

- [ ] **Step 1: Add the overlap detection function**

```typescript
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Check if any pair of bounding boxes in the array overlap.
 * Uses conservative estimated sizes (no DOM measurement).
 */
export function checkBoundingBoxOverlap(
  elements: BoundingBox[],
): boolean {
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      if (rectsIntersect(elements[i], elements[j])) return true;
    }
  }
  return false;
}

/** Build bounding box for a label at a mirrored position */
export function labelBounds(pos: MirroredPosition): BoundingBox {
  return { x: pos.left, y: pos.top, width: LABEL_WIDTH, height: LABEL_HEIGHT };
}

/** Build bounding box for the badge at its center position */
export function badgeBounds(centerX: number, centerY: number): BoundingBox {
  return {
    x: centerX - BADGE_WIDTH / 2,
    y: centerY - BADGE_HEIGHT / 2,
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
  };
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add lib/layout.ts
git commit -m "feat: add checkBoundingBoxOverlap and bounding box helpers"
```

---

### Task 3: Add `computeBadgeOffset` utility to `lib/layout.ts`

**Files:**
- Modify: `lib/layout.ts`

- [ ] **Step 1: Add the badge perpendicular offset function**

```typescript
/**
 * If the badge overlaps a label, shift it perpendicular to the edge line
 * toward the side that does not contain a label center.
 * Returns the adjusted badge center position.
 */
export function computeBadgeOffset(
  badgeCenter: { x: number; y: number },
  labelAPos: MirroredPosition,
  labelBPos: MirroredPosition,
  nodeAScreen: { x: number; y: number },
  nodeBScreen: { x: number; y: number },
): { x: number; y: number } {
  const badge = badgeBounds(badgeCenter.x, badgeCenter.y);
  const labelA = labelBounds(labelAPos);
  const labelB = labelBounds(labelBPos);

  const overlapsA = rectsIntersect(badge, labelA);
  const overlapsB = rectsIntersect(badge, labelB);

  if (!overlapsA && !overlapsB) return badgeCenter;

  // Perpendicular to the edge line
  const edgeDx = nodeBScreen.x - nodeAScreen.x;
  const edgeDy = nodeBScreen.y - nodeAScreen.y;
  const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

  if (edgeLen < 1) return badgeCenter;

  // Perpendicular unit vector (rotate edge 90 degrees)
  let perpX = -edgeDy / edgeLen;
  let perpY = edgeDx / edgeLen;

  // Determine which side of the edge line the label centers are on
  // using the cross product sign
  const labelCenterAx = labelAPos.left + LABEL_WIDTH / 2;
  const labelCenterAy = labelAPos.top + LABEL_HEIGHT / 2;
  const labelCenterBx = labelBPos.left + LABEL_WIDTH / 2;
  const labelCenterBy = labelBPos.top + LABEL_HEIGHT / 2;

  const crossA = (labelCenterAx - badgeCenter.x) * perpY - (labelCenterAy - badgeCenter.y) * perpX;
  const crossB = (labelCenterBx - badgeCenter.x) * perpY - (labelCenterBy - badgeCenter.y) * perpX;

  // Shift toward the side without labels (negative cross = flip direction)
  const avgCross = (crossA + crossB) / 2;
  if (avgCross > 0) {
    perpX = -perpX;
    perpY = -perpY;
  }

  const offset = BADGE_HEIGHT / 2 + LABEL_HEIGHT / 2 + 8;
  return {
    x: badgeCenter.x + perpX * offset,
    y: badgeCenter.y + perpY * offset,
  };
}
```

- [ ] **Step 2: Make `rectsIntersect` accessible to this function**

Ensure `rectsIntersect` is defined before `computeBadgeOffset` (it was added in Task 2 — just verify ordering).

- [ ] **Step 3: Verify the file compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add lib/layout.ts
git commit -m "feat: add computeBadgeOffset for perpendicular badge shifting"
```

---

### Task 4: Wire utilities into OccupationGraph position computation

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:996-1025` (selection useEffect)
- Modify: `components/graph/OccupationGraph.tsx:1139-1168` (zoom handler)

- [ ] **Step 1: Add imports at top of OccupationGraph.tsx**

Add to the existing imports:

```typescript
import {
  computeMirroredPosition,
  computeBadgeOffset,
  checkBoundingBoxOverlap,
  labelBounds,
  badgeBounds,
  LABEL_WIDTH,
} from '@/lib/layout';
```

- [ ] **Step 2: Add new state and ref**

Near the existing state declarations (around line ~200-250), add:

```typescript
const [hasOverlap, setHasOverlap] = useState(false);
const [lastHoveredElement, setLastHoveredElement] = useState<'badge' | 'labelA' | 'labelB'>('badge');
```

- [ ] **Step 3: Extract shared position computation helper**

Above the selection useEffect (~line 996), add a helper function that both the useEffect and zoom handler can call:

```typescript
const updatePairPositions = useCallback(
  (
    nodeA: { x: number; y: number; label: string; aiExposure: number },
    nodeB: { x: number; y: number; label: string; aiExposure: number },
    t: d3.ZoomTransform,
  ) => {
    const screenA = { x: t.applyX(nodeA.x), y: t.applyY(nodeA.y) };
    const screenB = { x: t.applyX(nodeB.x), y: t.applyY(nodeB.y) };

    const radiusA =
      (NODE_RADIUS_BASE + Math.pow(nodeA.aiExposure, NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE) * t.k;
    const radiusB =
      (NODE_RADIUS_BASE + Math.pow(nodeB.aiExposure, NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE) * t.k;

    const mirroredA = computeMirroredPosition(screenA, screenB, screenA, radiusA);
    const mirroredB = computeMirroredPosition(screenA, screenB, screenB, radiusB);

    const mx = (screenA.x + screenB.x) / 2;
    const my = (screenA.y + screenB.y) / 2;
    const rawBadge = { x: mx, y: my };
    const adjustedBadge = computeBadgeOffset(rawBadge, mirroredA, mirroredB, screenA, screenB);

    setBadgePos(adjustedBadge);
    setPairLabelPositions({
      a: { ...screenA, label: nodeA.label, aiExposure: nodeA.aiExposure, mirroredLeft: mirroredA.left, mirroredTop: mirroredA.top },
      b: { ...screenB, label: nodeB.label, aiExposure: nodeB.aiExposure, mirroredLeft: mirroredB.left, mirroredTop: mirroredB.top },
    });

    const overlap = checkBoundingBoxOverlap([
      labelBounds(mirroredA),
      labelBounds(mirroredB),
      badgeBounds(adjustedBadge.x, adjustedBadge.y),
    ]);
    setHasOverlap(overlap);
  },
  [],
);
```

- [ ] **Step 4: Update the `pairLabelPositions` type**

Find where `pairLabelPositions` state is declared and update its type to include `mirroredLeft` and `mirroredTop`:

```typescript
const [pairLabelPositions, setPairLabelPositions] = useState<{
  a: { x: number; y: number; label: string; aiExposure: number; mirroredLeft: number; mirroredTop: number };
  b: { x: number; y: number; label: string; aiExposure: number; mirroredLeft: number; mirroredTop: number };
} | null>(null);
```

- [ ] **Step 5: Replace selection useEffect body (~line 996-1025)**

Replace the existing position computation with a call to `updatePairPositions`:

```typescript
useEffect(() => {
  if (selectionMode === 'pair' && selectedNodeId && secondSelectedNodeId) {
    const nodeA = nodeById.current.get(selectedNodeId);
    const nodeB = nodeById.current.get(secondSelectedNodeId);
    if (nodeA && nodeB) {
      updatePairPositions(nodeA, nodeB, transformRef.current);
    }
  } else {
    setBadgePos(null);
    setPairLabelPositions(null);
    setHasOverlap(false);
  }
}, [selectionMode, selectedNodeId, secondSelectedNodeId, updatePairPositions]);
```

- [ ] **Step 6: Replace zoom handler pair-mode block (~line 1139-1168)**

Replace the duplicated position computation in the zoom handler:

```typescript
if (
  selectionModeRef.current === 'pair' &&
  selectedNodeIdRef.current &&
  secondSelectedNodeIdRef.current
) {
  const nodeA = nodeById.current.get(selectedNodeIdRef.current);
  const nodeB = nodeById.current.get(secondSelectedNodeIdRef.current);
  if (nodeA && nodeB) {
    updatePairPositions(nodeA, nodeB, event.transform);
  }
}
```

- [ ] **Step 7: Verify the app compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds (labels still render, positions now use mirroring)

- [ ] **Step 8: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: wire mirrored label positions and overlap detection into pair mode"
```

---

### Task 5: Update JSX rendering for mirrored positions and stacking

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:1636-1715` (pair labels + badge rendering)

- [ ] **Step 1: Update pair label rendering to use mirrored positions**

Replace the label positioning in the `.map()` at ~line 1638. Change the `style` prop from:

```typescript
style={{
  left: pos.x + pairR + 6,
  top: pos.y - 10,
  borderColor: nodeColourRef.current,
  transform:
    pos.x > (dimensions.width ?? 0) - 240
      ? 'translateX(-110%)'
      : undefined,
}}
```

To:

```typescript
style={{
  left: pos.mirroredLeft,
  top: pos.mirroredTop,
  borderColor: nodeColourRef.current,
  transform:
    pos.mirroredLeft + LABEL_WIDTH > (dimensions.width ?? 0)
      ? 'translateX(-110%)'
      : undefined,
  opacity: hasOverlap && lastHoveredElement !== (i === 0 ? 'labelA' : 'labelB') ? 0.75 : 1,
  zIndex: hasOverlap && lastHoveredElement === (i === 0 ? 'labelA' : 'labelB') ? 30 : 20,
  transition: 'opacity 150ms ease, z-index 150ms ease',
}}
```

Note: Import `LABEL_WIDTH` from `@/lib/layout` (already imported in Task 4 Step 1). This preserves the viewport-edge flip logic from the original code, adapted for the mirrored position.

- [ ] **Step 2: Add hover handlers to pair labels**

Add `onMouseEnter` and `onMouseLeave` to each pair label div:

```typescript
onMouseEnter={() => {
  if (hasOverlap) {
    setLastHoveredElement(i === 0 ? 'labelA' : 'labelB');
  }
}}
onMouseLeave={() => {
  // lastHoveredElement state stays — last-touched wins
}}
```

- [ ] **Step 3: Update badge rendering for stacking**

Update the badge div at ~line 1685. Add opacity/z-index and hover handlers:

In the outer `<div className="absolute z-20"` change to:

```typescript
<div
  className="absolute"
  style={{
    left: badgePos.x,
    top: badgePos.y,
    transform: 'translate(-50%, -50%)',
    opacity: hasOverlap && lastHoveredElement !== 'badge' ? 0.75 : 1,
    zIndex: hasOverlap && lastHoveredElement === 'badge' ? 30 : 20,
    transition: 'opacity 150ms ease, z-index 150ms ease',
  }}
>
```

Add hover handlers to the inner badge div (the one with `ref={badgeRef}`):

```typescript
onMouseEnter={() => {
  setShowEdgeTooltip(true);
  onBadgeInteract?.();
  if (hasOverlap) {
    setLastHoveredElement('badge');
  }
}}
```

- [ ] **Step 4: Remove unused `pairR` variable and hardcoded `z-20` class**

The `pairR` computation at ~line 1639-1643 is no longer needed since label positions are now pre-computed via `pos.mirroredLeft`/`pos.mirroredTop`. Remove the `pairR` variable declaration from inside the `.map()` callback.

Also remove hardcoded `z-20` class from pair labels:

In the pair label div (~line 1647), remove `z-20` from the className since z-index is now controlled via inline style:

Change: `className="absolute z-20 bg-popover ..."`
To: `className="absolute bg-popover ..."`

Similarly for the badge outer div, remove `z-20` from className.

- [ ] **Step 5: Verify the app compiles and runs**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

Run: `npm run dev` and manually test:
1. Select two occupation nodes that are close together
2. Verify labels fan outward instead of both going right
3. Verify badge shifts if it overlaps a label
4. Hover each element — it should come to foreground with others fading slightly

- [ ] **Step 6: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: apply mirrored positions and hover-to-foreground stacking in pair mode"
```

---

### Task 6: Reset stacking state on pair mode changes

**Files:**
- Modify: `components/graph/OccupationGraph.tsx`

- [ ] **Step 1: Reset `lastHoveredElementRef` when pair selection changes**

In the existing useEffect that resets edge tooltip on selection change (~line 1027-1031), add the reset:

```typescript
useEffect(() => {
  setShowEdgeTooltip(false);
  setPinnedEdgeTooltip(false);
  setLastHoveredElement('badge'); // reset to badge-on-top default
}, [selectedNodeId, secondSelectedNodeId]);
```

- [ ] **Step 2: Verify no stale stacking state persists**

Run: `npm run dev` and manually test:
1. Select pair A → B (check stacking works)
2. Deselect and select pair A → C
3. Verify badge starts on top again (no stale labelA/labelB on top)

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "fix: reset stacking state when pair selection changes"
```
