# Node Arrangement Demo Redesign

## Problem

The tutorial Step 2 (`NodeArrangementDemo`) uses generic unnamed nodes with hardcoded radii. It fails to communicate the key insight: occupations with similar skills cluster together. Nodes escape the viewport and the animation lacks meaning.

## Solution

Replace the component with a demo using real occupation names across 3 recognizable clusters. Edges are visible from the start so the user watches a tangle of connections resolve into distinct groups.

## Node Data

14 hardcoded nodes across 3 clusters. Each node has `id`, `label`, `aiExposure`, and `cluster`:

**Finance (cluster: "finance")**
| Label             | aiExposure |
|-------------------|-----------|
| Accountant        | 0.65      |
| Auditor           | 0.60      |
| Financial Analyst | 0.72      |
| Tax Consultant    | 0.58      |
| Bookkeeper        | 0.50      |

**Trades (cluster: "trades")**
| Label       | aiExposure |
|-------------|-----------|
| Plumber     | 0.15      |
| Electrician | 0.20      |
| Welder      | 0.12      |
| Carpenter   | 0.18      |

**Healthcare (cluster: "healthcare")**
| Label            | aiExposure |
|------------------|-----------|
| Nurse            | 0.40      |
| Pharmacist       | 0.55      |
| Physiotherapist  | 0.35      |
| Lab Technician   | 0.45      |
| Radiographer     | 0.48      |

## Edge Data

Intra-cluster edges use a chain topology (each node connected to its neighbors in the list above, plus one closing edge per cluster to increase density):

**Finance (5 edges):**
Accountant–Auditor, Auditor–Financial Analyst, Financial Analyst–Tax Consultant, Tax Consultant–Bookkeeper, Bookkeeper–Accountant

**Trades (4 edges):**
Plumber–Electrician, Electrician–Welder, Welder–Carpenter, Carpenter–Plumber

**Healthcare (5 edges):**
Nurse–Pharmacist, Pharmacist–Physiotherapist, Physiotherapist–Lab Technician, Lab Technician–Radiographer, Radiographer–Nurse

**Cross-cluster (2 edges):**
Bookkeeper–Lab Technician, Electrician–Nurse

Total: 16 edges.

## Node Sizing

Derived from the real formula using constants from `lib/constants.ts`:

```
radius = (NODE_RADIUS_BASE + Math.pow(aiExposure, NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE) * SCALE
```

`SCALE` = 0.09 to fit the 340x220 viewport (same as steps 1 and 3).

Example radii: Welder (0.12) → ~14px, Financial Analyst (0.72) → ~22px.

## Animation

1. Nodes start scattered randomly. Edges already drawn (opacity 0.15, tangled lines).
2. Force simulation runs live over ~2-3 seconds. Link force pulls connected nodes together; charge pushes unconnected nodes apart.
3. Three clusters visibly form as the tangle resolves.
4. Edges transition to opacity 0.3 after ~2s.
5. Cluster labels ("Finance", "Trades", "Healthcare") fade in after ~2.5s at each group's centroid (average x/y of cluster members), offset 20px above the centroid to avoid overlapping nodes.

## Force Simulation

- **Link distance:** per-link accessor function — 35px for intra-cluster edges, 120px for cross-cluster edges
- **Link strength:** per-link accessor — 0.3 for intra-cluster, 0.05 for cross-cluster
- **Charge:** `forceManyBody().strength(-25)`
- **Center:** `forceCenter(CX, CY).strength(0.15)`
- **Collide:** `forceCollide(d => d.r + 2)`
- **Alpha decay:** 0.012 (smooth settling)
- **Position clamping:** on every tick, clamp `x` to `[PAD + r, WIDTH - PAD - r]` and `y` to `[PAD + r, HEIGHT - PAD - r]` where `PAD = 20`

## Labels

- **Node labels:** font-size 7px, positioned below each node (`cy + r + 10`), follow position on tick. Some overlap is acceptable — the point is recognizability, not full legibility of every label.
- **Cluster labels:** font-size 9px, font-weight 600, `var(--muted-foreground)`, fade in at centroid (average x, average y - 20px offset) after 2.5s with 400ms transition.

## Viewport

340x220 viewBox (unchanged). `style={{ height: 320 }}` (unchanged).

## File Changed

`components/tutorial/steps/NodeArrangementDemo.tsx` — full rewrite. No other files affected.
