# Technical Scope: Malaysia Occupational Space Visualization

**Client:** ISIS Malaysia (Institute of Strategic & International Studies)
**Prepared for:** Hanson Chong, Economist, ISIS Malaysia
**Prepared by:** Shortcut Asia (Alika Choo, Anson Xin)
**Date:** March 4, 2026 (updated March 13, 2026)
**Based on:** Kickoff meeting (February 27, 2026), review sessions (March 6 & 13, 2026) with Hanson Chong

---

## 1. Project Overview

### Background

ISIS Malaysia — a policy research institute situated in the Prime Minister's Office — is commissioning an interactive web-based visualization of the Malaysian occupational landscape. The project sits within their economics team's research on labour market dynamics, AI exposure, and occupational transitions.

### Objective

Build a single-page application that visualizes **~456 Malaysian occupations** (classified by MASCO 4-digit codes) as a **skill-similarity network**. The tool enables users to:

- Explore how occupations relate to one another through shared skills
- Understand each occupation's exposure to AI automation
- Identify viable transition pathways to occupations with lower AI risk and higher wages
- Compare occupations by wage, AI exposure, and workforce size

### Target Audience

1. **Policymakers** — understand workforce vulnerability to AI disruption and inform reskilling policy
2. **Retrenched workers** — discover related occupations they could transition into based on existing skills

### Design Benchmark

The [Harvard Atlas of Economic Complexity — Product Space](https://atlas.cid.harvard.edu/) serves as the primary visual reference. This project adapts the same concept — network visualization with hover/click interactions, toggleable sizing, and filtering — but maps **occupations connected by shared skills** rather than products connected by trade proximity.

### Data Source

All data is provided by ISIS Malaysia, derived from the **2021 Labour Force Survey** (Department of Statistics Malaysia / DOSM). This is a **static, one-time dataset** — no live data feeds or updates are required.

**Datasets:**

| File | Description | Records |
|---|---|---|
| Occupation nodelist | Occupations with AI exposure index, quartile, wage, worker count | ~456 rows |
| Occupation edgelist (conditional) | Skill-based connections between occupations, pre-filtered: edges exist only where the target occupation has **lower AI exposure AND higher wage** | ~9,580 edges |
| MASCO-4D with skills | Occupation-to-skill mappings (basic + specific skills) | ~3,659 pairs |
| MASCO-4D with tasks + scores | Occupation tasks scored for AI automation potential (GPT-4o) | ~3,476 pairs |

### Timeline

**~2 weeks** from kickoff to delivery, assuming continuous feedback cycles. A staging draft will be available for client review within the first week.

### Release Structure

Single release. Post-delivery, ISIS Malaysia may choose to maintain and extend the tool through PERKESO or another agency.

---

## 2. Technical Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (React 19, TypeScript 5) |
| Visualization | D3.js 7 (force simulation, SVG nodes, Canvas edges) |
| Styling | Tailwind CSS 4, CSS custom properties (OkLCh color space) |
| UI Components | shadcn/ui (Radix UI primitives, Base UI) |
| Data Tables | @tanstack/react-table 8 |
| Data Validation | Zod 4 |
| Data Pipeline | PapaParse (CSV parsing), custom `process-csv.ts` script |
| Theming | next-themes (light/dark mode) |
| Deployment | Vercel (staging), ISIS Malaysia infrastructure (production) |

### Data Pipeline

```
Raw CSV (ISIS Malaysia) → process-csv.ts → JSON (nodes.json, edges.json, occupations.json) → Client-side fetch + Zod validation
```

All data is pre-processed at build time into optimized JSON files served as static assets.

---

## 3. Feature Scope & Deliverables

### 3.1 Core Graph Visualization

**Two layout modes** rendering ~456 occupation nodes connected by skill-similarity edges.

**Layout mode 1 — Force-directed network (default):**
- **Node positioning:** Force simulation with minimal cluster guidance (intra-cluster strength ≈ 0, as MASCO 1-digit grouping is not central to this research). Nodes with stronger skill overlap are pulled closer. Charge: 200. Collision padding: 200–300 to avoid overlaps. Positions stabilize after initial simulation (300 ticks pre-computed).
- **Default edges:** MST (minimum spanning tree) edges shown by default. Full 1-degree connections shown on hover or selection.

**Layout mode 2 — Circular / radial tree (on node selection):**
- On clicking a node, transitions to a radial tree layout centred on the selected occupation.
- Distance between the selected node and its neighbours is determined by: number of specific skills to develop + number of specific skills in common.
- Users can toggle between the two layout modes.

**Shared rendering properties (both modes):**
- **Node coloring:** Single color scheme — connected (non-isolated) nodes are **CERT green**; isolated nodes (no connected occupations) are **light grey with a black outline**.
- **Isolated nodes:** Not clickable, do not open a detail panel. Display a tooltip on hover with basic occupation info.
- **Node sizing:** Toggleable between three metrics:
  - AI Exposure Index (default) — higher exposure = larger node
  - Median Monthly Wage — higher wage = larger node
  - Number of Workers — more workers = larger node
- **Node size parameters:** base = 50, scale = 300, exponent = 3. Greater variability in size so that occupations with the highest AI exposure are immediately noticeable.
- **Attention animation:** The top 10 occupations with the highest number of workers AND an AI exposure index of 100% vibrate subtly every 5 seconds to draw user attention.
- **Node positions remain fixed** when switching size metrics; only radius changes.
- **Selected node emphasis:** Selected nodes are visually distinct (e.g., stroke, glow, or scale) so the active selection is immediately obvious.
- **Edges:** Hidden by default (except MST edges in force-directed mode). Full 1-degree connections displayed on hover or node selection. Single color (grey), weight-based opacity. Rendered on HTML Canvas for performance.
- **Zoom & pan:** Mouse wheel zoom and drag-to-pan, constrained to node bounds. On first load, zoom level fits the **entire network** in the viewport — users see the full graph, not a zoomed-in portion.
- **Centre on selection:** When a node is selected (first click), the viewport centres on that node while showing its entire neighbourhood network.
- **HiDPI support:** Canvas rendering at device pixel ratio for sharp edges on Retina displays.
- **Theme-aware:** All colors read from CSS custom properties; adapts to light/dark mode.

### 3.2 Search & Filtering

- **Occupation search:** Autocomplete combobox searching by occupation name or 4-digit MASCO code. Accessible via `Ctrl+F` / `Cmd+F` keyboard shortcut. Selecting an occupation highlights it on the graph and opens the detail panel.
- **MASCO group filter:** Dropdown to filter by any of the 9 occupation groups. Non-matching nodes fade to reduced opacity.
- **Skill keyword filter:** Multi-select input with chip display. Filter nodes to only those possessing all selected skills.
- **Node visibility threshold:** Slider controlling which nodes are visible based on the selected metric (AI exposure percentage or wage in MYR). Nodes below the threshold fade out.
- **Edge weight threshold:** Slider controlling which edges are displayed based on weight (number of shared skills). Default: show all.
- **Clear filters** button to reset all active filters.
- **Reset settings** button to restore defaults (node size metric, thresholds).

### 3.3 Hover Interaction

When hovering over a node (and no node is currently selected):

- **Tooltip:** Floating card near cursor displaying occupation name, MASCO code, AI exposure percentage, and quartile label. Repositions to avoid viewport edges. **Clickable** — clicking the tooltip opens the occupation detail panel.
- **Shared skills tooltip:** On hover between a selected node and a neighbour, shows shared skills. Users can **pin** (make persistent) this tooltip by clicking it.
- **1-degree neighbors:** Connected nodes become visually emphasized; connecting edges appear.
- **Fade effect:** All non-connected nodes dim to reduced opacity.
- **Isolated nodes:** Display a basic tooltip (occupation name, MASCO code, AI exposure) but are not clickable and do not show connections.
- **Visual justification:** Connections are "visualized, not verbalized" — the graph shows relationships through edges and proximity rather than explanatory text.

### 3.4 Occupation Detail Panel

Triggered by clicking a connected (non-isolated) node, or by clicking a tooltip. Opens as a **full-screen modal dialog** (desktop) or **bottom sheet** (mobile). Uses a **first-click / second-click** interaction model: first click highlights the node and its neighbourhood on the graph; second click (or tooltip click) opens the detail panel.

**Left column — Occupation profile:**
- MASCO code, group badge, occupation name
- AI Exposure Index with progress bar and quartile badge
- Median monthly wage (MYR)
- **Skills to develop** (badge list, featured prominently — these are skills the worker would need to acquire for transition targets)
- Skills in common (badge list)
- Specific/technical skills (badge list)
- Tasks with AI automation scores (expandable accordion, each task showing a score bar)

**Right column — Transition pathways table:**
- Lists connected occupations as potential transition targets
- **Sorted by:** (1) most shared skills first (edge weight), (2) lower AI exposure preferred, (3) higher wage preferred
- Column header: **"Match"** (not "Skill match")
- Copy displays: *"# specific skills in common, # specific skills to develop"*
- Columns: occupation name, match (shared skill count + skills to develop), AI exposure quartile, wage
- Fuzzy search to filter pathway rows
- Sortable column headers
- Pagination for long lists
- Click any row to navigate to that occupation's detail panel

**Deselection:** Clicking empty canvas space (not another node) returns the graph to default state. Avoids accidental deselection when users click near other nodes.

### 3.5 UI Chrome

**Header (fixed, top):**
- ISIS Malaysia logo
- MCMC logo (Malaysian Communications and Multimedia Commission)
- Third partner logo (asset to be provided by ISIS Malaysia)
- Application title: "Malaysia Occupational Space" (or as specified by client)

**Legend bar (fixed, bottom):**
- MASCO group labels as clickable filter buttons
- Node size metric indicator

**"How to Read" widget:**
- Persistent, always-visible element explaining what the visualization represents
- Static content (does not change with interaction)
- Simple step-by-step guide to reading the network

**"Learn How to Use" tutorial:**
- **Appears by default** on first page load (not behind a button click)
- Button in header area to re-trigger the tutorial at any time
- **Based on the actual network** — tutorial walkthrough uses real nodes and interactions from the live graph, not abstract illustrations
- Animated guide showing how to search, hover, click, filter, and adjust settings

**Credits / Attribution:**
- Accessible via button (header or footer placement)
- Content: "This visualization is made using methodology from ISIS Malaysia and using labour force survey data from the Department of Statistics Malaysia (DOSM)."
- Lists data sources, methodology, and development credits

**Theme toggle:**
- Light/dark mode switch following ISIS Malaysia branding guidelines (hex codes provided by client)

---

## 4. User Stories

### US-1: Search for an Occupation
> As a **policymaker**, I want to search for a specific occupation by name or MASCO code, so I can quickly locate it in the network and view its details.

**Acceptance criteria:**
- Autocomplete shows matching results as user types
- Matching by both occupation name and 4-digit code
- Selecting a result highlights the node and opens the detail panel

### US-2: Explore AI Exposure
> As a **policymaker**, I want to see which occupations face the highest AI exposure, so I can prioritize reskilling policy interventions.

**Acceptance criteria:**
- Node size visually communicates AI exposure level (default sizing)
- Hovering shows AI exposure percentage in tooltip
- Detail panel displays exposure index with progress bar and quartile

### US-3: Discover Transition Pathways
> As a **retrenched worker**, I want to see which occupations I could transition to based on my current skills, so I can identify viable career moves with lower AI risk and higher wages.

**Acceptance criteria:**
- Clicking an occupation shows a transition table sorted by shared skills, lower exposure, and higher wage
- Table rows are clickable to explore target occupations
- Sorting criteria reflect the pre-filtered edgelist logic

### US-4: Hover to Discover Connections
> As a **user**, I want to hover over an occupation and see its skill-connected neighbors, so I can understand how occupations relate to each other.

**Acceptance criteria:**
- Hovering highlights 1-degree neighbors and shows connecting edges
- Non-connected nodes fade out
- Tooltip appears with key occupation data

### US-5: Filter by Skill
> As a **policymaker**, I want to filter occupations by specific skills, so I can identify clusters of occupations that share common competencies.

**Acceptance criteria:**
- Multi-select skill filter with chip display
- Only occupations possessing all selected skills remain fully visible
- Clear filter button resets the view

### US-6: Compare Occupations by Metric
> As a **user**, I want to toggle node sizing between AI exposure, wage, and number of workers, so I can compare occupations across different dimensions.

**Acceptance criteria:**
- Three-way toggle in visualization settings
- Node sizes update smoothly; positions remain fixed
- Legend updates to reflect active metric

### US-7: Adjust Visibility Thresholds
> As a **policymaker**, I want to use threshold sliders to reduce visual noise, so I can focus on occupations or connections above a certain level.

**Acceptance criteria:**
- Node threshold slider filters by selected metric (AI exposure or wage)
- Edge weight threshold slider filters by number of shared skills
- Defaults show all nodes and all edges

### US-8: Access Help & Credits
> As a **first-time user**, I want to understand how to read the visualization and how to interact with it, so I can use the tool effectively.

**Acceptance criteria:**
- "How to Read" widget is persistently visible and explains the visualization
- "Learn How to Use" tutorial appears automatically on first page load
- Tutorial uses real network nodes and interactions, not abstract illustrations
- Credits section attributes ISIS Malaysia methodology and DOSM data source

---

## 5. Acceptance Criteria & Quality

### Data Integrity
- [ ] All ~456 occupations from the nodelist render as nodes on the graph
- [ ] Edge count matches the provided edgelist
- [ ] Occupation details (skills, tasks, scores) match source CSVs exactly
- [ ] No duplicate nodes or orphaned edges
- [ ] Zod schema validation passes on all data files

### Graph Rendering
- [ ] Connected nodes are CERT green; isolated nodes are light grey with black outline
- [ ] Force simulation produces a stable, readable layout (collision padding 200–300, charge 200)
- [ ] Node sizing correctly reflects the selected metric with sufficient variability (base=50, scale=300, exponent=3)
- [ ] Top 10 highest-worker + 100% AI exposure nodes vibrate every 5 seconds
- [ ] Switching size metric does not change node positions
- [ ] Edges render only when contextually appropriate (MST default in force-directed mode; full 1-degree on hover/selection)
- [ ] Zoom and pan function smoothly; initial zoom fits the entire network in the viewport
- [ ] Force-directed and circular/radial tree layout modes both function correctly
- [ ] Selected node is visually distinct and viewport centres on it

### Search & Filtering
- [ ] Occupation search returns results within 100ms of typing
- [ ] Search matches both name and 4-digit MASCO code
- [ ] MASCO group filter correctly dims non-matching nodes
- [ ] Skill filter correctly identifies nodes possessing all selected skills
- [ ] Threshold sliders produce immediate visual feedback
- [ ] Clear/reset buttons restore default state

### Hover & Selection
- [ ] Hover tooltip appears near cursor with correct occupation data
- [ ] Tooltip repositions to avoid viewport edges
- [ ] Tooltip is clickable and opens the detail panel
- [ ] Shared skills tooltip can be pinned by clicking
- [ ] Isolated nodes show tooltip but are not clickable for detail panel
- [ ] 1-degree neighbor highlighting is accurate (based on edgelist)
- [ ] Non-connected nodes dim to reduced opacity on hover
- [ ] First click highlights node + neighbourhood; second click opens detail panel
- [ ] Deselection only occurs when clicking empty canvas, not when clicking near other nodes

### Occupation Detail Panel
- [ ] AI exposure index, wage, skills, and tasks display correctly
- [ ] "Skills to develop" is featured more prominently than "skills in common"
- [ ] Transition table column header reads "Match" (not "Skill match")
- [ ] Transition table copy shows "# specific skills in common, # specific skills to develop"
- [ ] Transition table sorts by: (1) shared skills, (2) lower AI exposure, (3) higher wage
- [ ] Transition table supports fuzzy search, column sorting, and pagination
- [ ] Clicking a transition row navigates to that occupation's panel
- [ ] Panel closes cleanly and returns graph to default state

### UI Chrome & Branding
- [ ] Header displays all required logos (ISIS Malaysia, MCMC, partner)
- [ ] Branding colors match ISIS Malaysia guidelines
- [ ] Legend bar shows MASCO groups with correct labels
- [ ] "How to Read" widget is persistently visible
- [ ] "Learn How to Use" tutorial appears by default on first load
- [ ] Tutorial walkthrough uses actual network nodes and interactions
- [ ] Credits section contains correct attribution text
- [ ] Light and dark themes both render correctly
- [ ] `Ctrl+F` / `Cmd+F` focuses the search bar

### Responsive Layout
- [ ] Desktop-first design with mobile-aware adaptations
- [ ] Detail panel renders as side panel (desktop) or bottom sheet (mobile)
- [ ] Graph controls are usable on smaller screens
- [ ] Touch interactions work on mobile (tap = select, pinch = zoom)

### Performance
- [ ] Initial page load under 3 seconds on broadband
- [ ] Force simulation pre-computes before rendering (no visible jitter)
- [ ] Canvas edge rendering handles full edgeset without frame drops
- [ ] Static data served with appropriate cache headers

---

## 6. Deployment & Handover

### Staging Environment
- **Platform:** Vercel (managed by Shortcut Asia)
- **Purpose:** Development, iteration, and client review
- **Access:** Shareable preview link provided to ISIS Malaysia team for feedback
- **Timeline:** Staging draft available within the first week

### Production Environment
- **Platform:** ISIS Malaysia-owned infrastructure
- **Options under consideration:**
  - **Cloud (AWS):** ISIS Malaysia creates and owns the AWS account; dev team receives temporary access for deployment. Credentials and costs borne by ISIS Malaysia.
  - **Physical server:** ISIS Malaysia has an on-premises server available. Early access required if this route is chosen.
- **IT contact:** Shahkir (ISIS Malaysia IT) for server details and access provisioning
- **Decision:** To be finalized by ISIS Malaysia

### Redirect & Integration
- The visualization will be accessible via a click-through button from the ISIS Malaysia website
- Bidirectional navigation: users can navigate from the ISIS website to the tool, and from the tool back to the associated publication/report

### Handover
- Full source code repository transferred to ISIS Malaysia
- Documentation covering: setup, build, deployment, data pipeline, and architecture
- ISIS Malaysia assumes full ownership post-delivery; dev team access can be revoked at their discretion

### Static Data Caching
- All data files (`nodes.json`, `edges.json`, `occupations.json`) served as static assets
- Cache headers configured for optimal performance (currently 24-hour cache on Vercel)
- No server-side rendering required for data; client-side fetch with validation

---

## 7. Out of Scope

The following are explicitly **not** included in this release:

- Live data feeds or automatic data updates
- User accounts, authentication, or saved preferences
- Multi-year data comparison or time-series analysis
- Server-side API or database
- Content management system
- Analytics or usage tracking
- Internationalization / multi-language support
- Ongoing maintenance or hosting management post-handover
- Native mobile application

---

## 8. Open Items

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Provide updated edgelist CSV | Hanson Chong | Pending |
| 2 | Provide logo assets (ISIS Malaysia, MCMC, partner) | Hanson Chong | Pending |
| 3 | Share branding guidelines document (hex codes) | Hanson Chong | Pending |
| 4 | Confirm production hosting choice (AWS vs physical server) | Hanson Chong / Shahkir | Pending |
| 5 | Provide Number of Workers data per occupation | Hanson Chong | Pending |
| 6 | Confirm "How to Read" and tutorial content/copy | Hanson Chong | Pending |
| 7 | Confirm credits/attribution text | Hanson Chong | Pending |
| 8 | Coordinate server access with Shahkir | Alika Choo | Pending |

---

## 9. Assumptions

1. All data is static and will not change during or after development
2. ISIS Malaysia provides all logo assets and branding guidelines before UI finalization
3. The edgelist is pre-filtered by ISIS Malaysia (target has lower AI exposure AND higher wage)
4. The visualization is a single-page application with no multi-page routing
5. Browser support targets modern evergreen browsers (Chrome, Firefox, Safari, Edge)
6. The development team has temporary access to the production environment for initial deployment
7. Content for "How to Read," tutorial, and credits will be provided or approved by ISIS Malaysia
