# Design: Loose Cloud Graph Layout

## Problem

The force-directed graph with 456 nodes and 3,348 edges collapses into a dense circular ball. Link forces (0.25 strength, ~7 edges/node avg) overpower charge repulsion (-120), causing the graph to clump rather than fill the viewport.

## Goal

A "loose cloud" layout: clusters loosely visible, lots of breathing room between groups, filling the full viewport with a landscape bias.

## Approach: Aggressive Force Tuning

Dramatically shift the balance between repulsion and attraction so the graph expands to fill available space.

### Parameter Changes (in `hooks/useForceSimulation.ts`)

| Parameter | Current | New | Rationale |
|---|---|---|---|
| Charge strength | -120 | -400 | 3x more repulsion blows apart the dense ball |
| Link strength | 0.25 | 0.1 | Weaken pull so repulsion wins; clusters stay loose |
| Link distance | `20 + (7-w)*6` | `30 + (7-w)*8` | More breathing room between connected nodes |
| forceX strength | 0.02 | 0.01 | Very mild horizontal centering — lets nodes spread wide |
| forceY strength | 0.06 | 0.08 | Stronger vertical compression — landscape shape |
| Bounds padding | 60px | 40px | Allow nodes closer to edges for more usable space |
| Bounds strength | `alpha * 0.5` | `alpha * 0.8` | Stronger boundary keeps nodes in viewport |

### How it works

1. **Charge at -400** creates massive repulsion across 456 nodes, forcing expansion
2. **Link strength at 0.1** preserves loose grouping by connections without collapsing
3. **Asymmetric centering** (Y 8x stronger than X) compresses vertically, spreads horizontally
4. **Tighter bounds + stronger enforcement** keeps everything within the viewport

### Constraints

- Loose clustering: same-group nodes tend to group but mixing is fine
- Always landscape: graph wider than tall regardless of viewport shape
- No new forces or multi-pass layouts — simple parameter tuning only

### Files modified

- `hooks/useForceSimulation.ts` — update 7 force parameters
