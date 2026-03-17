# Interactive Tutorial Design Spec

## Overview

Replace the current modal-based tutorial with an interactive overlay that guides users through the actual force-directed network graph. The tutorial auto-starts on every visit with a skip option. Users learn by performing real actions on real data.

## SLC Scope

- **Simple:** 4 steps, one overlay component, no persistence, force-directed layout only.
- **Lovable:** Spotlight + tooltip pattern feels polished and guided. Users interact with real data, not demos.
- **Complete:** By the end of step 4, users have searched, hovered, and clicked — they know how to use the app.

## Tutorial Steps

| Step | Name | Spotlight Target | Prompt Text | Completion Trigger |
|------|------|-----------------|-------------|-------------------|
| 1 | Orient | Centre of graph (wide, ~40% viewport) | "Each circle is a Malaysian occupation. Lines connect jobs that share skills. Bigger circles = higher AI exposure." | Manual "Next" button |
| 2 | Search & Select | Hero search bar (rectangular cutout) | "Search for any occupation — try typing a job title (e.g. "Pharmacists")." | `selectedNodeId` changes from null → value, then user confirms |
| 3 | Hover | Nearest visible neighbour of selected node | "Hover over connected nodes to see how they relate." | `hoveredNodeId` fires on a neighbour, then user confirms |
| 4 | Click to Compare | Connected neighbour nodes area | "Click a connected occupation to compare skills and see transition pathways." | `secondSelectedNodeId` changes from null → value, then user confirms |

After step 4, the overlay fades out. The user has two nodes selected with the detail panel showing a real skill comparison — the natural starting point for exploration.

**Note on step 4:** In the current app, clicking a neighbour of the selected node sets `secondSelectedNodeId` and opens the occupation panel. The tutorial detects `secondSelectedNodeId` being set (not `panelNodeId`) as the completion trigger.

## Constraints

- Force-directed layout only. On tutorial start, force `viewMode` to `'force'` and disable the view mode toggle while the tutorial is active.
- No persistence — tutorial auto-shows every visit, skip button always available.
- Overlay observes graph state but never controls it — with one exception: the tutorial sets `selectionMode` to `'single'` during steps 2-3 to prevent pair-selection mode from suppressing hover events. Normal selection mode resumes at step 4.
- Hero search bar dismissal is prevented while the tutorial is active (hide the "X" dismiss button during step 2).

## Component Architecture

### New Files

#### `components/tutorial/TutorialOverlay.tsx`
Main overlay component. Renders:
- Full-screen SVG dim layer (~0.6 opacity) with a masked spotlight cutout
- Spotlight cutout: circular for graph nodes, rectangular for DOM elements (search bar)
- Soft feathered edge on cutout via SVG `<feGaussianBlur>`
- Positioned tooltip with: step text, progress dots (4), "Got it" / "Next" button, "Skip tutorial" link
- ~300ms CSS transitions for spotlight position/size and tooltip position/opacity between steps

#### `components/tutorial/tutorialConfig.ts`
Step definitions array. Each step contains:
- `id`: string identifier
- `title`: short name
- `prompt`: display text
- `spotlightTarget`: function that resolves to screen coordinates and dimensions given current graph state
- `completionEvent`: what state change to watch for (`'manual'` | `'nodeSelected'` | `'nodeHovered'` | `'secondNodeSelected'`)

#### `components/tutorial/useTutorial.ts`
Hook managing tutorial state:
- `currentStep`: number (0-3)
- `isActive`: boolean
- `isConfirming`: boolean (action detected, showing "Got it" button)
- `advance()`: move to next step or complete
- `skip()`: end tutorial, reset graph state to defaults
- Watches relevant graph state values and sets `isConfirming` when completion trigger fires

### Modified Files

#### `app/page.tsx`
- Mount `<TutorialOverlay>` over the graph area
- Pass graph state: `selectedNodeId`, `hoveredNodeId`, `panelNodeId`, graph container ref
- Pass a ref or callback to read node screen positions from the D3 zoom transform
- On tutorial skip: reset `selectedNodeId`, `secondSelectedNodeId`, `panelNodeId` to null

#### `components/graph/OccupationGraph.tsx`
- Expose a method or ref to convert node data coordinates to screen coordinates using the current D3 zoom transform
- Add new callback prop `onNodeHover?: (nodeId: string | null) => void` — called when the user hovers/unhovers a node. This fires the existing internal hover logic and additionally calls the callback.
- `page.tsx` adds a new `hoveredNodeId` state, updated by this callback, and passed to `TutorialOverlay`

### Deleted Files

- `components/tutorial/TutorialModal.tsx`
- `components/tutorial/TutorialButton.tsx`
- `components/tutorial/tutorialSteps.ts`
- `components/tutorial/steps/NodeRepresentationDemo.tsx`
- `components/tutorial/steps/NodeArrangementDemo.tsx`
- `components/tutorial/steps/NodeSizingDemo.tsx`
- `components/tutorial/steps/HoverBehaviourDemo.tsx`
- `components/tutorial/steps/ClickBehaviourDemo.tsx`

## Spotlight & Tooltip Positioning

### Spotlight

SVG overlay with `<mask>`. The overlay SVG has `pointer-events: none` globally, with `pointer-events: auto` only on the tooltip and its buttons. The spotlight cutout area passes pointer events through to the graph beneath, allowing the user to interact with the real graph. The dimmed area also passes events through — this is acceptable since the dim layer is just a visual guide, not a barrier.

Targets:
- **Step 1:** Large circle (~40% viewport) centred on graph. General orientation.
- **Step 2:** Rectangular cutout over the hero search bar. Use `getBoundingClientRect()`.
- **Step 3:** Circle centred on the neighbour node with the highest edge weight to the selected node (strongest skill connection). If weights are tied, pick the one closest in screen-pixel distance. Lock the spotlight to this node once resolved — do not update if the force simulation shifts positions. Convert D3 data coords → screen coords via zoom transform.
- **Step 4:** Same area as step 3 — connected nodes region.

### Tooltip

Positioned adjacent to the spotlight cutout:
- Spotlight in left half → tooltip on right, and vice versa
- Spotlight in top half → tooltip below, and vice versa
- Keeps tooltip out of the interaction area

### Transitions

- Spotlight position/size: ~300ms ease-out CSS transition
- Tooltip position/opacity: ~300ms ease-out, slight delay (50ms) after spotlight moves
- Step completion → confirmation button: fade-in ~200ms

## Event Detection

The overlay observes existing state managed by `page.tsx`. It never dispatches actions or controls the graph.

| Step | State Observed | Detection Logic |
|------|---------------|----------------|
| 1 | None | Manual "Next" button click |
| 2 | `selectedNodeId` | Transitions from `null` to any value |
| 3 | `hoveredNodeId` (new callback) | Fires with a node ID that is a neighbour of `selectedNodeId` |
| 4 | `secondSelectedNodeId` | Transitions from `null` to any value |

On detection, the overlay shows a "Got it, next" confirmation button. The user clicks it to advance. This gives them time to absorb what just happened before moving on.

## Skip & Completion Behaviour

- **Skip:** Visible on every step as "Skip tutorial" text link. Fades out overlay immediately. Resets graph state to defaults (deselects nodes, closes panel). Restores view mode toggle and hero search dismiss button.
- **Completion:** After step 4 confirmation, overlay fades out (~300ms). Graph retains current state — the user has two nodes selected with the comparison panel open. View mode toggle and hero search dismiss are restored.
- **Replay:** No explicit replay button. Since there's no persistence, refreshing the page restarts the tutorial. This is intentionally minimal per SLC — a replay button can be added later if users request it.

## Visual Design

- Dim layer: semi-transparent black, ~0.6 opacity
- Spotlight: feathered circular/rectangular cutout in the dim layer
- Tooltip: matches existing app theme (uses CSS variables for bg, text, border). Rounded corners, subtle shadow. Contains:
  - Progress dots (4, active dot highlighted)
  - Step text (1-2 sentences)
  - Action button ("Next" for step 1, "Got it, next" for steps 2-4)
  - "Skip tutorial" text link
- All elements respect light/dark theme via existing CSS variables

## Audience Considerations

- **General public / job seekers:** The 4-step flow teaches the core loop (search → explore → compare) with concrete examples. No jargon.
- **Researchers / policy makers:** The tutorial doesn't over-explain — it's quick enough that experienced users can skip or breeze through without frustration. Advanced features (filters, size metrics, layout modes) are left for self-discovery.

## Out of Scope

- Circular/radial layout tutorial support
- Tutorial persistence (localStorage)
- Multi-language support
- Mobile-specific tutorial flow
- Tutorial analytics/tracking
