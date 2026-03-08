# Two-Click Mechanism Design

## Problem

Hovering over a node displays AI exposure and neighboring occupations, making the network feel like an AI exposure network rather than a skills network. We need an interaction model that foregrounds skill relationships between occupations.

## Solution

A two-click interaction mechanism that progressively reveals deeper skill-based information:

1. **Hover** — occupation callout tooltip
2. **First click** — select node, highlight neighbors and edges (current behavior)
3. **Second click on connected node** — isolate the pair, reveal shared skills on the edge
4. **Click either node in pair** — open occupation detail panel

## State Model

### State in `page.tsx`

```
selectedNodeId: string | null        // first selected node (existing)
secondSelectedNodeId: string | null  // second selected node (new)
isPanelOpen: boolean                 // existing
panelNodeId: string | null           // which node the panel shows (new)
```

### Derived

```
selectionMode:
  - none:   selectedNodeId === null
  - single: selectedNodeId !== null && secondSelectedNodeId === null
  - pair:   selectedNodeId !== null && secondSelectedNodeId !== null
```

### Local state in `OccupationGraph.tsx`

```
hoveredEdge: { sourceId, targetId } | null
edgeTooltip: { x, y, sourceId, targetId } | null
```

## Interaction Flow

### From `none`

- Hover node → show occupation callout tooltip
- Click node → transition to `single`, set `selectedNodeId`

### From `single`

- Hover other nodes → show occupation callout tooltip
- Click same node → open detail panel (`isPanelOpen = true`, `panelNodeId = selectedNodeId`)
- Click connected neighbor → transition to `pair`, set `secondSelectedNodeId`
- Click unconnected node → stay in `single`, replace `selectedNodeId`
- Click background / Escape → transition to `none`

### From `pair`

- Auto-zoom to frame both nodes
- Show "X shared skills" badge at edge midpoint
- Blur all other nodes and edges
- Hover edge badge → show skills comparison tooltip
- Click either selected node → open detail panel as overlay (`panelNodeId` = clicked node)
- Click a third node → transition to `single` with third node as `selectedNodeId`
- Click background / Escape → transition to `none`

### Panel open (overlay)

- Close panel → return to previous state (`single` or `pair`)
- Panel does NOT change selection state

## Visual Rendering

### Single selection (unchanged)

- Selected node: full opacity, foreground stroke, 2.5px stroke width
- Neighbors: visible with stroke, connected edges drawn
- Non-neighbors: dimmed to 0.12 opacity

### Pair selection

- Both selected nodes: full opacity, foreground stroke, 2.5px stroke width
- Single edge between them: foreground color, ~2px line width
- "X shared skills" badge: pill-shaped label at edge midpoint, `--muted-foreground` bg, foreground text, cursor pointer
- All other nodes: dimmed to 0.05 opacity
- All other edges: hidden

### Auto-zoom (pair)

- Calculate bounding box of both nodes with padding
- Animate zoom/pan via d3 transition (~500ms ease) to frame both nodes
- On deselect back to `none`, animate to previous zoom level

## Edge Badge & Tooltip

### Badge

- Rendered as an HTML div positioned absolutely at edge midpoint (not on canvas)
- Gets native mouse events for hover
- The edge line itself is not hoverable — only the badge is the interaction target

### Skills comparison tooltip (on badge hover)

```
┌─────────────────────────────────────────────┐
│  Accountant ↔ Financial Analyst             │
│  5 of 12 skills in common                   │
│─────────────────────────────────────────────│
│  Shared Skills                              │
│  [Critical Thinking] [Active Listening] ... │
│                                             │
│  Only Accountant        Only Fin. Analyst   │
│  [Tax Prep.] ...        [Wealth Mgmt.] ... │
└─────────────────────────────────────────────┘
```

- Skills as badges (consistent with existing skill badges in panel)
- Shared skills: primary/accent color
- Unique skills: muted styling
- Max height with scroll if many skills
- Positioned anchored to badge, flips if viewport overflow

## Skills Comparison Logic

Data source: `OccupationDetail.basicSkills` and `OccupationDetail.specificSkills`.

```
Given nodeA and nodeB:
  allSkillsA = [...basicSkills, ...specificSkills]
  allSkillsB = [...basicSkills, ...specificSkills]
  sharedSkills = intersection(allSkillsA, allSkillsB)  // case-insensitive
  onlyA = allSkillsA - sharedSkills
  onlyB = allSkillsB - sharedSkills
  badgeLabel = "${sharedSkills.length} shared skills"
```

- Memoized with `useMemo` keyed on the two node IDs
- Shared skills displayed first, grouped by type (basic then specific)
- Unique skills per occupation grouped the same way

## Deselection

- Click background → deselect all, return to `none`
- Escape key → deselect all, return to `none`

## Approach

Inline state in `page.tsx` using `useState`. Extends existing patterns with minimal new abstractions. No external state management library needed.
