# Dual-Pane Detail Flow — Design Spec

## Problem

The current occupation detail panel is a modal dialog with a 40/60 split: left column shows occupation details, right column shows a transition pathways table. Clicking a table row replaces the entire panel with the new occupation's details, losing the original context. Users cannot compare two occupations side-by-side.

## Goal

Replace the modal's interior with a **50/50 dual-pane layout** that supports two modes:

1. **Cards Mode** — Left pane shows selected occupation details; right pane shows transition pathway cards (replacing the current table rows with richer cards)
2. **Comparison Mode** — Left pane stays; right pane replaces cards with a second occupation's details for side-by-side comparison, with shared skills visually highlighted on both sides

## Architecture: Extract Sub-Components

Refactor `OccupationPanel.tsx` into focused sub-components:

### Component Structure

```
OccupationPanel (orchestrator — dialog shell + state)
├── DialogHeader (occupation name + close button — shared across both modes)
├── OccupationDetailPane (left pane — reused for both sides)
│   ├── AI Exposure section
│   ├── Wage section
│   ├── Skills section (with optional shared-skill highlighting)
│   └── Tasks accordion
├── TransitionCards (right pane — cards mode)
│   ├── Search input
│   ├── Card grid (scrollable)
│   └── Pagination controls
└── OccupationDetailPane (right pane — comparison mode, same component)
    └── + Back button + skills match indicator + deltas
```

### Dialog Header

The existing full-width `DialogHeader` (showing primary occupation name, code, and close button) is **retained** as the dialog-level header. The `OccupationDetailPane` component does NOT render the occupation name or close button — these live only in the dialog header. In comparison mode, the dialog header still shows the primary occupation name; the right pane shows the comparison occupation's name in its own sub-header with the back button.

### Files

| New File                                    | Purpose                                                                                                                                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/panel/OccupationDetailPane.tsx` | Reusable detail pane (AI exposure, wage, skills, tasks). Accepts optional `sharedSkills` set + `comparisonDeltas` for comparison mode. Does NOT render occupation name or close button (those live in dialog header). |
| `components/panel/TransitionCard.tsx`       | Single transition card component (name, code, match dots, AI badge, wage, shared skills preview).                                                                                                                     |
| `components/panel/TransitionCards.tsx`      | Right-pane card list with search, pagination, and card grid.                                                                                                                                                          |

| Modified File                          | Changes                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `components/panel/OccupationPanel.tsx` | Becomes thin orchestrator: dialog shell, `comparisonNodeId` state, delegates to sub-components.                                       |
| `app/page.tsx`                         | Pass `occupations` record to `OccupationPanel` (already passed as nodes/edges; needs full occupation details for comparison lookups). |

## Detailed Behaviour

### Cards Mode (default when panel opens)

- **Left pane (50%)**: `OccupationDetailPane` showing the selected occupation (same content as current left column)
- **Right pane (50%)**: `TransitionCards` showing connected occupations as cards
- **Card content**: Occupation name, MASCO code, skill match dots (1-7), AI exposure quartile badge, monthly wage, and top 3 shared skill badges (with "+N more" overflow)
- **Search**: Fuzzy filter by name or code (reuse existing `fuzzyFilter`)
- **Pagination**: 10/25/50 per page (reuse existing pattern)
- **Sort**: By shared skills weight (desc) → AI exposure (asc, lower = better) → wage (desc, higher = better) — same as current sort logic

### Comparison Mode (after clicking a card)

- **Trigger**: Click any transition card. This sets `comparisonNodeId` internally within `OccupationPanel` — it does NOT call the parent `onNodeSelect` callback (which would trigger graph navigation). The `onNodeSelect` prop is no longer used for transition row clicks.
- **Left pane**: Same `OccupationDetailPane` but with `sharedSkills` set — shared skills get blue background + ✓ marker
- **Right pane**: `OccupationDetailPane` for the clicked occupation, also with `sharedSkills` highlighting, plus:
  - **"← Back to pathways"** button at top (returns to cards mode)
  - **Match dots** below occupation name
  - **Comparison deltas**: AI exposure shows ▼/▲ percentage difference; wage shows ▼/▲ MYR difference (green = lower AI exposure or higher wage; red = opposite)
- **Navigation**: Back button on right pane returns to cards mode. Close button on dialog closes everything.

### Shared Skills Computation

Reuse existing pattern from `OccupationGraph.tsx` lines 293-351 (pair skill comparison):

```
sharedSkills = intersection of (basicSkills + specificSkills) for both occupations
```

Case-insensitive matching. Computed as a `useMemo` in `OccupationPanel` when `comparisonNodeId` is set.

## Component Props

### OccupationDetailPane

```typescript
interface OccupationDetailPaneProps {
  detail: OccupationDetail; // reuses OccupationDetail type from lib/types.ts
  sharedSkills?: Set<string>; // skills to highlight in blue (lowercase)
  comparisonDeltas?: {
    // shown on comparison (right) pane only
    aiExposure: number; // delta from primary
    wage: number | null; // delta from primary
  };
  skillsMatchWeight?: number; // 1-7, shown below name on comparison pane
  header?: React.ReactNode; // slot for comparison pane sub-header (back button + name)
}
```

Note: The component does NOT render the occupation name or close button. Those are in the dialog-level header for the left pane, and in the `header` slot for the right pane (comparison mode).

### TransitionCard

```typescript
interface TransitionCardProps {
  id: string;
  label: string;
  weight: number;
  aiExposure: number;
  quartile: string;
  wage: number | null;
  sharedSkillsPreview: string[]; // top 3 shared skill names
  totalSharedSkills: number; // for "+N more" badge
  onClick: () => void;
}
```

### TransitionCards

```typescript
// TransitionRow is reused from existing OccupationPanel code (type already defined there)
interface TransitionCardsProps {
  transitions: TransitionRow[];
  occupations: Record<string, OccupationDetail>;
  primarySkills: Set<string>; // primary occupation's skills, for preview (memoized)
  onCardClick: (id: string) => void;
}
```

Note: The shared skills preview per card should be computed in a `useMemo` inside `TransitionCards` (keyed on `transitions` + `primarySkills`) to avoid recomputation on every render.

### OccupationPanel (updated)

```typescript
interface OccupationPanelProps {
  nodeId: string | null;
  detail: OccupationDetail | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  occupations: Record<string, OccupationDetail>; // NEW — for comparison lookups
  isOpen: boolean;
  onClose: () => void;
}
```

Note: `onNodeSelect` has been removed — transition card clicks now set `comparisonNodeId` internally, and no external navigation is triggered from within the panel.

## State Management

`OccupationPanel` gains one new state variable:

```typescript
const [comparisonNodeId, setComparisonNodeId] = useState<string | null>(null);
```

- `null` → Cards mode
- `string` → Comparison mode (showing that occupation's details)
- Reset to `null` when: back button clicked, panel closes, or primary `nodeId` changes

**Scroll position preservation**: When switching from cards → comparison → back to cards, the `TransitionCards` component is conditionally rendered with `display: none` (CSS hiding) rather than unmounted, so scroll position and pagination state are preserved automatically. Both the cards view and the comparison view exist in the DOM simultaneously; only one is visible.

## Skill Highlighting Logic

In comparison mode, both panes receive the same `sharedSkills: Set<string>`:

```typescript
const sharedSkills = useMemo(() => {
  if (!nodeId || !comparisonNodeId) return undefined;
  const primaryOcc = occupations[nodeId];
  const compOcc = occupations[comparisonNodeId];
  if (!primaryOcc || !compOcc) return undefined;

  const primarySet = new Set(
    [...primaryOcc.basicSkills, ...primaryOcc.specificSkills].map((s) =>
      s.toLowerCase(),
    ),
  );
  const compSet = new Set(
    [...compOcc.basicSkills, ...compOcc.specificSkills].map((s) =>
      s.toLowerCase(),
    ),
  );

  const shared = new Set<string>();
  for (const s of primarySet) {
    if (compSet.has(s)) shared.add(s);
  }
  return shared;
}, [nodeId, comparisonNodeId, occupations]);
```

In `OccupationDetailPane`, each skill badge checks `sharedSkills?.has(skill.toLowerCase())` to decide styling:

- **Shared**: Blue background (`rgba(59,130,246,0.15)`), blue text, ✓ suffix
- **Not shared**: Keep existing styling (secondary for basic, accent for specific)

## Comparison Deltas

Computed in `OccupationPanel` when in comparison mode:

```typescript
const comparisonDeltas = useMemo(() => {
  if (!detail || !comparisonNodeId) return undefined;
  const compDetail = occupations[comparisonNodeId];
  if (!compDetail) return undefined;
  return {
    aiExposure: compDetail.aiExposure - detail.aiExposure,
    wage:
      compDetail.wage !== null && detail.wage !== null
        ? compDetail.wage - detail.wage
        : null,
  };
}, [detail, comparisonNodeId, occupations]);
```

Display: `▼ 4.2%` in green (lower AI exposure is better), `▲ MYR 150` in green (higher wage is better).

## Card Shared Skills Preview

Each transition card shows up to 3 shared skills as blue badges, computed by intersecting the primary occupation's skills with the transition occupation's skills:

```typescript
const primarySkillSet = new Set(
  [...primaryOcc.basicSkills, ...primaryOcc.specificSkills].map((s) =>
    s.toLowerCase(),
  ),
);
const cardSkills = [...cardOcc.basicSkills, ...cardOcc.specificSkills];
const shared = cardSkills.filter((s) => primarySkillSet.has(s.toLowerCase()));
// Show first 3, then "+N more" if overflow
```

## Verification

1. **Cards mode**: Select an occupation on the graph → double-click to open panel → verify left pane shows occupation details, right pane shows transition cards with search/pagination
2. **Card content**: Verify each card shows name, code, match dots, AI badge, wage, and shared skills preview
3. **Comparison mode**: Click a transition card → verify right pane switches to occupation details with back button, skill highlighting on both sides, and comparison deltas
4. **Back navigation**: Click "← Back to pathways" → verify return to cards list with scroll position preserved
5. **Skill highlighting**: In comparison mode, verify shared skills appear blue with ✓ on both panes, non-shared skills keep original styling
6. **Close**: Close button dismisses the entire dialog
7. **Theme**: Verify both modes work in light and dark theme
8. **Responsive**: Verify the 50/50 split works at various viewport widths (the modal is `sm:max-w-6xl`)
