# ISIS Malaysia — Occupational Space: Wireframe Screens

## App Structure Overview

Single-page app. Fixed header at top, control bar below it, graph fills remaining space,
legend anchored at bottom. Side panel slides in from the right (desktop) or up from bottom (mobile).

---

## SCREEN 1: Default / Empty State

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (fixed, ~56px, border-bottom)                            │
│  [IS logo] Malaysia Occupational Space    ISIS Malaysia · MASCO  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ GRAPH CONTROLS (sticky, ~48px, blur backdrop)                   │
│  [🔍 Search occupation or code…        ]  [All MASCO Groups ▾]  │
│  [Filter by skill…                     ]                         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ GRAPH CANVAS (flex-1, fills viewport)                           │
│                                                                  │
│   (force-directed network of ~1,825 circular nodes)             │
│   nodes cluster loosely by MASCO group (9 color groups)         │
│   edges drawn as thin grey lines on canvas layer                │
│                                                                  │
│   • Managers       — blue                                        │
│   • Professionals  — orange                                      │
│   • Technicians    — red                                         │
│   • Clerical       — teal                                        │
│   • Services/Sales — green                                       │
│   • Agri/Skilled   — yellow                                      │
│   • Craft/Trades   — purple                                      │
│   • Operators      — pink                                        │
│   • Elementary     — brown                                       │
│                                                                  │
│   Node size = AI exposure (small=low, large=high)               │
│                                                                  │
│   ┌──────────────────────┐  ← bottom-left badge                 │
│   │ 1,825 occupations    │                                       │
│   │ 23,950 skill edges   │                                       │
│   └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ LEGEND BAR (fixed bottom, ~40px, border-top)                    │
│  ● Managers  ● Professionals  ● Technicians  ● Clerical  ...    │
│                              Node size = AI exposure →          │
└─────────────────────────────────────────────────────────────────┘
```

---

## SCREEN 2: Loading State

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (same as Screen 1)                                       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ GRAPH CONTROLS (same as Screen 1)                               │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ GRAPH CANVAS (flex-1)                                           │
│                                                                  │
│                    ┌──────────────────┐                         │
│                    │   ⟳  (spinner)   │                         │
│                    │ Loading occupat- │                         │
│                    │ ional data…      │                         │
│                    └──────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ LEGEND BAR (same as Screen 1)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## SCREEN 3: Error State

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (same as Screen 1)                                       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ GRAPH CONTROLS (same as Screen 1)                               │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ GRAPH CANVAS (flex-1)                                           │
│                                                                  │
│        ┌────────────────────────────────────┐                   │
│        │ ⚠ Failed to load data              │                   │
│        │ [error message text here]          │                   │
│        └────────────────────────────────────┘                   │
│        (red-bordered box, centered)                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ LEGEND BAR                                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## SCREEN 4: Node Hover Tooltip

Tooltip appears near cursor when hovering over any node.

```
  ┌────────────────────────────────┐
  │ Human Resource Managers        │  ← bold label
  │ 1212                           │  ← monospace, grey
  │ AI Exposure: 75.0%             │  ← highlighted value
  │ Quartile: Medium high          │  ← quartile label
  └────────────────────────────────┘
       ↑ floating near node, flips if near right edge
```

---

## SCREEN 5: Node Selected — Occupation Detail Panel (Desktop)

Right sidebar slides in (400px wide). Graph canvas shrinks or panel overlaps.

```
┌─────────────────────────────────────────────────────────┬──────────────────────┐
│ HEADER                                                  │                      │
├─────────────────────────────────────────────────────────┤                      │
│ GRAPH CONTROLS                                          │  OCCUPATION PANEL    │
├─────────────────────────────────────────────────────────┤  (400px, right)      │
│ GRAPH CANVAS (shrinks or overlaps)                      │                      │
│                                                         │  [×] close button    │
│  (selected node highlighted — white stroke, larger)     │  ─────────────────── │
│  (connected nodes slightly emphasized)                  │  ● 1212 · Managers   │
│  (unrelated nodes dim to 0.4 opacity)                   │                      │
│                                                         │  Human Resource      │
│                                                         │  Managers            │
│                                                         │  ─────────────────── │
│                                                         │                      │
│                                                         │  AI EXPOSURE INDEX   │
│                                                         │  75.0%  [Medium High]│
│                                                         │  ████████████░░░░░░  │
│                                                         │  (progress bar)      │
│                                                         │                      │
│                                                         │  MEDIAN WAGE        │
│                                                         │  MYR 6,094           │
│                                                         │                      │
│                                                         │  BASIC SKILLS        │
│                                                         │  [Active Listening]  │
│                                                         │  [Management]  [...] │
│                                                         │                      │
│                                                         │  SPECIFIC SKILLS     │
│                                                         │  [Payroll Admin]     │
│                                                         │  [HR Software]  [..] │
│                                                         │                      │
│                                                         │  TASKS (12)          │
│                                                         │  ▸ Coordinate with   │
│                                                         │    department heads… │
│                                                         │  ▸ Develop training  │
│                                                         │    programs…         │
│                                                         │  ▸ Review employee   │
│                                                         │    performance…      │
│                                                         │  (accordion items)   │
├─────────────────────────────────────────────────────────┤                      │
│ LEGEND BAR                                              │                      │
└─────────────────────────────────────────────────────────┴──────────────────────┘
```

---

## SCREEN 6: Node Selected — Occupation Detail Panel (Mobile)

Bottom sheet rises up (75vh). Graph partially visible above.

```
┌─────────────────────────────────────────────────────────┐
│ HEADER                                                  │
├─────────────────────────────────────────────────────────┤
│ GRAPH CONTROLS                                          │
├─────────────────────────────────────────────────────────┤
│ GRAPH CANVAS (top portion visible)                      │
│                                                         │
│   .... (partial graph visible above panel) ....         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ OCCUPATION PANEL (bottom sheet, ~75vh, rounded top)     │
│  ─── drag handle ────────────────────────────           │
│                                               [×] close │
│  ● 1212 · Managers                                      │
│  Human Resource Managers                                │
│  ─────────────────────────────────────────────────────  │
│  AI EXPOSURE INDEX                                      │
│  75.0%  [Medium High]                                   │
│  ████████████░░░░░░░░░░░░░░░░  (progress bar)           │
│                                                         │
│  MEDIAN WAGE: MYR 6,094                                │
│                                                         │
│  BASIC SKILLS                                           │
│  [Active Listening]  [Management]  [...]                │
│                                                         │
│  SPECIFIC SKILLS                                        │
│  [Payroll Admin]  [HR Software]  [...]                  │
│                                                         │
│  TASKS (12)  (scrollable accordion)                     │
│  ▸ Coordinate with department heads…                    │
│  ▸ Develop training programs…                           │
└─────────────────────────────────────────────────────────┘
```

---

## SCREEN 7: Task Expanded in Accordion

Within the Occupation Panel (desktop or mobile), one task accordion item opened:

```
│  TASKS (12)                                              │
│  ▾ Coordinate with department heads to determine…        │  ← expanded
│    ████████░░░░░░░░░░░░░░░░░░  65%   (AI score bar)     │
│                                                          │
│  ▸ Develop training programs for new employees…          │  ← collapsed
│  ▸ Review employee performance metrics quarterly…        │  ← collapsed
```

---

## SCREEN 8: Filtered by MASCO Group

After clicking a legend button or selecting a group filter dropdown:

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER                                                          │
├─────────────────────────────────────────────────────────────────┤
│ GRAPH CONTROLS                                                  │
│  [🔍 Search…]  [Professionals ▾]  [Filter by skill…]  [Clear]  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ GRAPH CANVAS                                                    │
│                                                                  │
│   Professionals nodes: full color, full opacity, normal stroke   │
│   All other nodes: 0.4 opacity, greyed out                      │
│   Edges still visible but dimmed for non-selected groups        │
│                                                                  │
│   ┌──────────────────────┐                                      │
│   │ 1,825 occupations    │                                      │
│   │ 23,950 skill edges   │                                      │
│   └──────────────────────┘                                      │
├─────────────────────────────────────────────────────────────────┤
│ LEGEND BAR                                                      │
│  ● Managers  ● Professionals ←(highlighted)  ● Technicians…    │
└─────────────────────────────────────────────────────────────────┘
```

---

## SCREEN 9: Filtered by Skill

After typing a skill into the skill filter input:

```
┌─────────────────────────────────────────────────────────────────┐
│ GRAPH CONTROLS                                                  │
│  [🔍 Search…]  [All MASCO Groups ▾]  [Active Listening  ×]     │
│                 [Clear Filters]                                  │
├─────────────────────────────────────────────────────────────────┤
│ GRAPH CANVAS                                                    │
│                                                                  │
│   Nodes with "Active Listening" skill: full opacity             │
│   All other nodes: 0.4 opacity, greyed out                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## SCREEN 10: Search Active

After typing in the search box:

```
┌─────────────────────────────────────────────────────────────────┐
│ GRAPH CONTROLS                                                  │
│  [🔍 Human Resource              ×]  [All MASCO Groups ▾]       │
│  [Filter by skill…                ]                             │
├─────────────────────────────────────────────────────────────────┤
│ GRAPH CANVAS                                                    │
│                                                                  │
│   Matching nodes: full opacity + white stroke highlight         │
│   Non-matching nodes: 0.4 opacity                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Inventory (for Pencil screen generation)

| Component | Description |
|-----------|-------------|
| Header | Fixed bar: logo badge + title + subtitle |
| GraphControls | Search input + group dropdown + skill input + clear button |
| GraphCanvas | Full-bleed network visualization with nodes and edges |
| NodeBadge | Bottom-left absolute: "N occupations · N skill edges" |
| HoverTooltip | Floating card: name, code, exposure %, quartile |
| GraphLegend | Bottom bar: 9 color-dot group buttons + size note |
| OccupationPanel | Right sidebar (desktop) or bottom sheet (mobile) |
| SkillBadge | Pill badge: basic (grey) or specific (dark grey) |
| AIExposureBar | Label + % + colored progress bar |
| TaskAccordion | Expandable task list with AI score bars |
