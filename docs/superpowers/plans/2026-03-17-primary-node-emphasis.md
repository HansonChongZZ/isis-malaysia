# Primary Node Emphasis Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selected (primary) node in the occupation graph unmistakably obvious through scale increase, gradient fill, and animated glow aura.

**Architecture:** All changes are in two files. CSS variables for theme-aware colors are added to `globals.css`. The SVG rendering in `OccupationGraph.tsx` is updated to use those colors for gradient defs, a stronger glow filter, an aura circle layer, and a scaled+animated primary node.

**Tech Stack:** React, SVG, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-17-primary-node-emphasis-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `app/globals.css` | New CSS vars: `--node-selected-gradient-start`, `--node-selected-gradient-end`, `--node-selected-aura` for both `:root` and `.dark` |
| `components/graph/OccupationGraph.tsx` | New refs + readThemeColors entries, new SVG defs (gradient, glow filters), aura `<g>` layer, updated node circle rendering, updated tooltip radius |

---

### Task 1: Add CSS Variables

**Files:**
- Modify: `app/globals.css:7-72` (`:root` block)
- Modify: `app/globals.css:74-138` (`.dark` block)

- [ ] **Step 1: Add light theme CSS vars**

In `app/globals.css`, add after line 44 (`--node-isolate-stroke: #204D39;`):

```css
  --node-selected-gradient-start: #6EE7B7;
  --node-selected-gradient-end: #10B981;
  --node-selected-aura: #10B981;
```

- [ ] **Step 2: Add dark theme CSS vars**

In `app/globals.css`, add after line 111 (`--node-isolate-stroke: #8BBFA5;`):

```css
  --node-selected-gradient-start: #A7F3D0;
  --node-selected-gradient-end: #34D399;
  --node-selected-aura: #34D399;
```

- [ ] **Step 3: Verify the app builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (CSS vars don't break anything on their own)

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: add CSS vars for selected node gradient and aura colors"
```

---

### Task 2: Add Theme Color Refs

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:166-172` (ref declarations)
- Modify: `components/graph/OccupationGraph.tsx:241-258` (`readThemeColors`)

- [ ] **Step 1: Add new refs and a theme revision counter**

After line 171 (`const isolateStrokeRef = useRef('#000000');`), add:

```tsx
const selectedGradientStartRef = useRef('#6EE7B7');
const selectedGradientEndRef = useRef('#10B981');
const selectedAuraRef = useRef('#10B981');
```

Also add a state counter (near the other `useState` declarations at the top of the component) to force re-renders when the theme changes, so that SVG `<defs>` (gradient stops, filter) pick up the new ref values:

```tsx
const [, setThemeRevision] = useState(0);
```

- [ ] **Step 2: Read new CSS vars in readThemeColors and bump revision**

After line 254 (`style.getPropertyValue('--node-isolate-stroke').trim() || '#000';`), add:

```tsx
    selectedGradientStartRef.current =
      style.getPropertyValue('--node-selected-gradient-start').trim() || '#6EE7B7';
    selectedGradientEndRef.current =
      style.getPropertyValue('--node-selected-gradient-end').trim() || '#10B981';
    selectedAuraRef.current =
      style.getPropertyValue('--node-selected-aura').trim() || '#10B981';
```

After line 257 (`drawEdgesRef.current();`), add:

```tsx
    setThemeRevision(r => r + 1);
```

This ensures that when the MutationObserver detects a theme change, the component re-renders and the SVG gradient/aura elements pick up the updated ref values.

- [ ] **Step 3: Verify the app builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: add refs for selected node theme colors"
```

---

### Task 3: Replace SVG Defs (Gradient + Glow Filters)

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:1255-1315` (`<defs>` block, including closing `</defs>` tag)

- [ ] **Step 1: Replace the entire `<defs>` block**

Replace lines 1255-1315 (the current `<defs>` containing the 4-layer `selected-glow` filter, through the closing `</defs>` tag) with:

```tsx
          <defs>
            {/* Radial gradient for selected node — colors from CSS vars via refs */}
            <radialGradient id="selected-node-gradient" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor={selectedGradientStartRef.current} />
              <stop offset="100%" stopColor={selectedGradientEndRef.current} />
            </radialGradient>

            {/* Enhanced 2-layer glow for selected node */}
            <filter
              id="selected-glow"
              x="-200%"
              y="-200%"
              width="500%"
              height="500%"
            >
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="10"
                result="blur1"
              />
              <feColorMatrix
                in="blur1"
                type="matrix"
                values="0 0 0 0 0.2  0 0 0 0 0.83  0 0 0 0 0.6  0 0 0 1 0"
                result="glow1"
              />
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="25"
                result="blur2"
              />
              <feColorMatrix
                in="blur2"
                type="matrix"
                values="0 0 0 0 0.2  0 0 0 0 0.83  0 0 0 0 0.6  0 0 0 0.5 0"
                result="glow2"
              />
              <feMerge>
                <feMergeNode in="glow2" />
                <feMergeNode in="glow1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
```

Note: The gradient uses ref values which are read from CSS vars, so it adapts to theme changes. The glow filter color matrix uses a universal green tint that works acceptably in both themes. The filter bounding box is tightened from 700% to 500% to match the reduced blur radii.

- [ ] **Step 2: Verify the app builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: replace SVG defs with gradient and enhanced glow filter"
```

---

### Task 4: Add Aura Circle Layer

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:1316-1317` (before `<g className="nodes">`)

- [ ] **Step 1: Add aura `<g>` layer before the nodes group**

After line 1316 (`<g ref={gRef}>`) and before line 1317 (`<g className="nodes">`), insert:

```tsx
            {/* Aura circle behind selected node */}
            {selectedNodeId && (() => {
              const selectedNode = simNodes.find(n => n.id === selectedNodeId);
              if (!selectedNode) return null;
              const auraBaseR = getNodeRadius(selectedNode) * 1.6 * 1.5;
              return (
                <circle
                  cx={selectedNode.x}
                  cy={selectedNode.y}
                  r={auraBaseR}
                  fill={selectedAuraRef.current}
                  opacity={0.15}
                  style={{ pointerEvents: 'none' }}
                >
                  <animate attributeName="r" values={`${auraBaseR};${auraBaseR + 4};${auraBaseR}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0.25;0.15" dur="3s" repeatCount="indefinite" />
                </circle>
              );
            })()}
```

- [ ] **Step 2: Verify the app builds and the aura appears**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: add animated aura circle behind selected node"
```

---

### Task 5: Update Node Circle Rendering (Scale + Gradient + Breathe)

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:1326-1415` (node rendering inside `.map()`)

- [ ] **Step 1: Replace the circle rendering with selected/unselected branches**

Add a `displayR` calculation after line 1335 (`const isSelected = node.id === selectedNodeId;`):

```tsx
                const displayR = isSelected ? r * 1.6 : r;
```

Then replace the entire `return (` block for the circle (lines 1338-1415, including the closing `);`) with the code below. This splits into two branches: the selected branch uses gradient fill, 3px stroke, glow filter, and a breathing `<animate>` child; the unselected branch preserves all original behavior unchanged.

```tsx
                return isSelected ? (
                  <circle
                    key={node.id}
                    className="node"
                    data-id={node.id}
                    cx={node.x}
                    cy={node.y}
                    r={displayR}
                    fill="url(#selected-node-gradient)"
                    fillOpacity={opacity}
                    stroke="var(--foreground)"
                    strokeWidth={3}
                    strokeOpacity={opacity}
                    filter="url(#selected-glow)"
                    style={{
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      transition:
                        'r 250ms ease, fill-opacity 250ms ease, fill 250ms ease, stroke 250ms ease, stroke-width 250ms ease, stroke-opacity 250ms ease, filter 250ms ease',
                    }}
                    onClick={(e) => {
                      if (disableClick) return;
                      e.stopPropagation();
                      onNodeSelect(node.id);
                    }}
                    onMouseEnter={() => {
                      if (tooltipLeaveTimer.current) clearTimeout(tooltipLeaveTimer.current);
                      if (visibleIds && !visibleIds.has(node.id)) return;
                      if (selectionMode === 'pair') return;
                      const t = transformRef.current;
                      setHoveredNodeId(node.id);
                      onNodeHover?.(node.id);
                      setTooltip({
                        x: t.applyX(node.x),
                        y: t.applyY(node.y),
                        node,
                        skillComparison: undefined,
                      });
                    }}
                    onMouseLeave={() => {
                      tooltipLeaveTimer.current = setTimeout(() => {
                        setHoveredNodeId(null);
                        onNodeHover?.(null);
                        setTooltip(null);
                      }, 150);
                    }}
                  >
                    <animate attributeName="r" values={`${displayR};${displayR + 1};${displayR}`} dur="3s" repeatCount="indefinite" />
                  </circle>
                ) : (
                  <circle
                    key={node.id}
                    className="node"
                    data-id={node.id}
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={color}
                    fillOpacity={opacity}
                    stroke={
                      isHovered || isHoveredNeighbour
                        ? 'var(--foreground)'
                        : isIsolate
                          ? isolateStrokeRef.current
                          : 'var(--background)'
                    }
                    strokeWidth={
                      isHovered
                        ? 2.5
                        : isHoveredNeighbour
                          ? 2
                          : 0.8
                    }
                    strokeOpacity={opacity}
                    style={{
                      pointerEvents: (visibleIds && !visibleIds.has(node.id)) ? 'none' : 'auto',
                      cursor: isIsolate ? 'default'
                        : (selectedNodeId && !connectedIds?.has(node.id) && node.id !== selectedNodeId) ? 'default'
                        : 'pointer',
                      transition:
                        'r 250ms ease, fill-opacity 250ms ease, fill 250ms ease, stroke 250ms ease, stroke-width 250ms ease, stroke-opacity 250ms ease, filter 250ms ease',
                    }}
                    onClick={(e) => {
                      if (disableClick) return;
                      if (isIsolate) return;
                      if (visibleIds && !visibleIds.has(node.id)) return;
                      e.stopPropagation();
                      if (layoutMode === 'radial' && selectedNodeId && !connectedIds?.has(node.id) && node.id !== selectedNodeId) {
                        onNodeSelect(null);
                        return;
                      }
                      onNodeSelect(node.id);
                    }}
                    onMouseEnter={() => {
                      if (tooltipLeaveTimer.current) clearTimeout(tooltipLeaveTimer.current);
                      if (visibleIds && !visibleIds.has(node.id)) return;
                      if (selectionMode === 'pair') return;
                      if (selectedNodeId && !connectedIds?.has(node.id) && node.id !== selectedNodeId) return;
                      const t = transformRef.current;
                      setHoveredNodeId(node.id);
                      onNodeHover?.(node.id);
                      const sc =
                        selectedNodeId &&
                        node.id !== selectedNodeId &&
                        neighbourDistancesRef.current?.get(node.id);
                      setTooltip({
                        x: t.applyX(node.x),
                        y: t.applyY(node.y),
                        node,
                        skillComparison: sc || undefined,
                      });
                    }}
                    onMouseLeave={() => {
                      tooltipLeaveTimer.current = setTimeout(() => {
                        setHoveredNodeId(null);
                        onNodeHover?.(null);
                        setTooltip(null);
                      }, 150);
                    }}
                  />
                );
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: scale up selected node with gradient fill and breathing animation"
```

---

### Task 6: Update Tooltip Positioning

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:1425` (tooltip radius calculation)

- [ ] **Step 1: Account for selected node scale in tooltip offset**

Change line 1425 from:
```tsx
          const tooltipR = getNodeRadius(tooltip.node) * transformRef.current.k;
```
to:
```tsx
          const isTooltipSelected = tooltip.node.id === selectedNodeId;
          const tooltipR = getNodeRadius(tooltip.node) * (isTooltipSelected ? 1.6 : 1) * transformRef.current.k;
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "feat: adjust tooltip offset for scaled selected node"
```

---

### Task 7: Manual Visual QA

- [ ] **Step 1: Run dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify dark mode**

1. Open the app in dark mode
2. Click a node — verify it scales up ~1.6x, shows gradient fill (light-to-bright green), has a visible glow, and the aura circle pulses behind it
3. Verify neighbor nodes remain at normal size with flat fill
4. Verify the tooltip positions correctly (not overlapping the enlarged node)
5. Verify the breathing animation is smooth and subtle (~1px oscillation)

- [ ] **Step 3: Verify light mode**

1. Switch to light mode
2. Repeat step 2 — verify gradient shifts darker, stroke is dark green, glow is visible against light background

- [ ] **Step 4: Verify pair mode**

1. Select a node, then click a neighbor
2. Verify the primary node has the emphasis treatment and the second node does not

- [ ] **Step 5: Verify deselection**

1. Press Escape or click background
2. Verify the node smoothly transitions back to normal size, flat fill, and the aura disappears

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: visual QA adjustments for primary node emphasis"
```
