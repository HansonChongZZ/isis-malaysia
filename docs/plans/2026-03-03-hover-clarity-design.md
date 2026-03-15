# Hover Clarity Design

## Problem

When hovering a node in the occupation graph, first-degree neighbours get a slightly thicker stroke in their MASCO color, but this doesn't create enough contrast against non-neighbours to make the network structure instantly clear.

## Solution: Opacity-based focus

Dim non-neighbours and highlight connecting edges on hover, using the same visual language already established by node selection.

### Node opacity on hover

When hovering a node (and no node is selected):

| State | Opacity | Stroke color | Stroke width |
|-------|---------|-------------|-------------|
| Hovered node | 1.0 | `--foreground` | 2.5px |
| Neighbour node | 1.0 | `--foreground` | 2px |
| Non-neighbour | 0.15 | `--background` | 0.8px |
| Filtered-out node | 0.06 | unchanged | unchanged |

### Edge highlighting on hover

| State | Opacity | Width | Color |
|-------|---------|-------|-------|
| Connected to hovered node | 1.0 | 1.5px | `--foreground` |
| Not connected | 0.05 | unchanged | unchanged |

### Transitions

- SVG circles: `transition: fill-opacity 150ms ease, stroke 150ms ease, stroke-width 150ms ease, stroke-opacity 150ms ease`
- Canvas edges: redrawn immediately (no CSS transition possible)

### Interaction hierarchy

1. Filter (filtered-out nodes always at 0.06)
2. Selection (selected + connected nodes highlighted, hover suppressed)
3. Hover (this design)

## Approach rationale

- Consistent with existing selection behavior (which already dims non-connected nodes)
- Simple — no new visual elements, just opacity/stroke adjustments
- SLC-aligned: narrow scope, feels complete
