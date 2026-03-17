# Dual-Pane Detail Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal's interior with a 50/50 dual-pane layout supporting cards mode (transition pathway cards) and comparison mode (side-by-side occupation details with shared skill highlighting).

**Architecture:** Extract the monolithic OccupationPanel into focused sub-components: `OccupationDetailPane` (reusable detail view for both panes), `TransitionCard` (individual card), `TransitionCards` (card list with search/pagination). OccupationPanel becomes a thin orchestrator with a `comparisonNodeId` state that toggles between cards and comparison modes. CSS visibility toggling (not unmount) preserves scroll position.

**Tech Stack:** React, TypeScript, Tailwind CSS, @tanstack/react-table, shadcn/ui (Badge, Accordion, Dialog)

**Spec:** `docs/superpowers/specs/2026-03-12-dual-pane-detail-flow-design.md`

---

## File Structure

| File                                        | Action  | Responsibility                                                                                                                  |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `components/panel/OccupationDetailPane.tsx` | Create  | Reusable detail pane: AI exposure, wage, skills (with optional highlighting), tasks accordion. No occupation name/close button. |
| `components/panel/TransitionCard.tsx`       | Create  | Single transition card: name, code, match dots, AI badge, wage, shared skills preview.                                          |
| `components/panel/TransitionCards.tsx`      | Create  | Right-pane card list: search, scrollable card grid, pagination. Uses @tanstack/react-table for filtering/pagination.            |
| `components/panel/OccupationPanel.tsx`      | Rewrite | Thin orchestrator: dialog shell, `comparisonNodeId` state, shared skills computation, delegates to sub-components.              |
| `app/page.tsx`                              | Modify  | Pass `occupations` prop to OccupationPanel.                                                                                     |

---

## Chunk 1: Extract OccupationDetailPane

### Task 1: Create OccupationDetailPane component

**Files:**

- Create: `components/panel/OccupationDetailPane.tsx`

This component extracts the left column detail view from the current `OccupationPanel.tsx` (lines 213-336). It renders AI exposure, wage, skills, and tasks — but NOT the occupation name or close button (those stay in the dialog header).

- [ ] **Step 1: Create `OccupationDetailPane.tsx`**

```tsx
'use client';

import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { OccupationDetail } from '@/lib/types';
import { QUARTILE_COLORS } from '@/lib/constants';

interface OccupationDetailPaneProps {
  detail: OccupationDetail;
  sharedSkills?: Set<string>;
  comparisonDeltas?: {
    aiExposure: number;
    wage: number | null;
  };
  skillsMatchWeight?: number;
  header?: React.ReactNode;
}

function SkillBadge({
  skill,
  variant,
  isShared,
}: {
  skill: string;
  variant: 'basic' | 'specific';
  isShared: boolean;
}) {
  if (isShared) {
    return (
      <Badge
        variant="secondary"
        className="text-xs"
        style={{
          backgroundColor: 'rgba(59,130,246,0.15)',
          color: '#60a5fa',
          border: '1px solid rgba(59,130,246,0.3)',
        }}
      >
        {skill} ✓
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={
        variant === 'basic'
          ? 'text-xs bg-secondary text-secondary-foreground border-border'
          : 'text-xs bg-accent text-accent-foreground border-border'
      }
    >
      {skill}
    </Badge>
  );
}

export default function OccupationDetailPane({
  detail,
  sharedSkills,
  comparisonDeltas,
  skillsMatchWeight,
  header,
}: OccupationDetailPaneProps) {
  const quartileColor = QUARTILE_COLORS[detail.quartile] ?? '#888';

  return (
    <div className="overflow-y-auto p-5 space-y-6">
      {/* Optional header slot (used by comparison pane for back button + name) */}
      {header}

      {/* Match indicator (comparison pane only) */}
      {skillsMatchWeight != null && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Match:</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    i < skillsMatchWeight
                      ? quartileColor
                      : 'rgba(128,128,128,0.2)',
                }}
              />
            ))}
            <span className="ml-1 text-muted-foreground text-xs">
              ({skillsMatchWeight}/7)
            </span>
          </div>
        </div>
      )}

      {/* AI Exposure */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          AI Exposure Index
        </h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold"
                style={{ color: quartileColor }}
              >
                {(detail.aiExposure * 100).toFixed(1)}%
              </span>
              {comparisonDeltas && (
                <span
                  className="text-xs font-medium"
                  style={{
                    color:
                      comparisonDeltas.aiExposure < 0 ? '#22c55e' : '#ef4444',
                  }}
                >
                  {comparisonDeltas.aiExposure < 0 ? '▼' : '▲'}{' '}
                  {Math.abs(comparisonDeltas.aiExposure * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <Badge
              className="text-xs"
              style={{
                backgroundColor: `color-mix(in srgb, ${quartileColor} 20%, transparent)`,
                color: quartileColor,
                border: `1px solid color-mix(in srgb, ${quartileColor} 40%, transparent)`,
              }}
            >
              {detail.quartile}
            </Badge>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${detail.aiExposure * 100}%`,
                backgroundColor: quartileColor,
              }}
            />
          </div>
        </div>
      </section>

      {/* Wage */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Median Wage
        </h3>
        {detail.wage !== null ? (
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-foreground">
              MYR {detail.wage.toLocaleString()}
            </p>
            {comparisonDeltas?.wage != null && (
              <span
                className="text-xs font-medium"
                style={{
                  color: comparisonDeltas.wage > 0 ? '#22c55e' : '#ef4444',
                }}
              >
                {comparisonDeltas.wage > 0 ? '▲' : '▼'} MYR{' '}
                {Math.abs(comparisonDeltas.wage).toLocaleString()}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Data not available
          </p>
        )}
      </section>

      {/* Basic Skills */}
      {detail.basicSkills.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Basic Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.basicSkills.map((skill) => (
              <SkillBadge
                key={skill}
                skill={skill}
                variant="basic"
                isShared={sharedSkills?.has(skill.toLowerCase()) ?? false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Specific Skills */}
      {detail.specificSkills.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Specific Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {detail.specificSkills.map((skill) => (
              <SkillBadge
                key={skill}
                skill={skill}
                variant="specific"
                isShared={sharedSkills?.has(skill.toLowerCase()) ?? false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Tasks */}
      {detail.tasks.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Tasks ({detail.tasks.length})
          </h3>
          <Accordion type="multiple" className="space-y-1">
            {detail.tasks.map((task, i) => (
              <AccordionItem
                key={i}
                value={`task-${i}`}
                className="border border-border rounded-md overflow-hidden"
              >
                <AccordionTrigger className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:no-underline text-left leading-snug data-[state=open]:text-foreground">
                  <span className="pr-2 line-clamp-2">{task.description}</span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-2 pt-0">
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      AI Score:
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${task.score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-primary font-mono">
                      {(task.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `OccupationDetailPane.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/panel/OccupationDetailPane.tsx
git commit -m "feat: extract OccupationDetailPane component from OccupationPanel"
```

---

## Chunk 2: Create TransitionCard and TransitionCards

### Task 2: Create TransitionCard component

**Files:**

- Create: `components/panel/TransitionCard.tsx`

- [ ] **Step 1: Create `TransitionCard.tsx`**

```tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { QUARTILE_COLORS } from '@/lib/constants';

interface TransitionCardProps {
  id: string;
  label: string;
  weight: number;
  aiExposure: number;
  quartile: string;
  wage: number | null;
  sharedSkillsPreview: string[];
  totalSharedSkills: number;
  onClick: () => void;
}

export default function TransitionCard({
  id,
  label,
  weight,
  aiExposure,
  quartile,
  wage,
  sharedSkillsPreview,
  totalSharedSkills,
  onClick,
}: TransitionCardProps) {
  const color = QUARTILE_COLORS[quartile] ?? '#888';
  const remaining = totalSharedSkills - sharedSkillsPreview.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border border-border rounded-lg p-3 hover:border-foreground/30 hover:bg-muted/30 transition-colors cursor-pointer"
    >
      {/* Top row: name + quartile badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground text-sm leading-snug">
            {label}
          </div>
          <div className="text-muted-foreground font-mono text-xs mt-0.5">
            {id}
          </div>
        </div>
        <Badge
          className="text-xs px-1.5 py-0 shrink-0"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
            color,
            border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
          }}
        >
          {quartile}
        </Badge>
      </div>

      {/* Middle row: match dots + wage */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs text-muted-foreground mr-0.5">Match:</span>
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className="inline-block w-[7px] h-[7px] rounded-full"
            style={{
              backgroundColor: i < weight ? color : 'rgba(128,128,128,0.2)',
            }}
          />
        ))}
        <span className="text-muted-foreground text-xs ml-0.5">
          ({weight}/7)
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {wage !== null ? `MYR ${wage.toLocaleString()}` : '—'}
        </span>
      </div>

      {/* Bottom row: shared skills preview */}
      {totalSharedSkills > 0 && (
        <div className="flex flex-wrap gap-1">
          {sharedSkillsPreview.map((skill) => (
            <span
              key={skill}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(59,130,246,0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.25)',
              }}
            >
              {skill}
            </span>
          ))}
          {remaining > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              +{remaining} more shared
            </span>
          )}
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/panel/TransitionCard.tsx
git commit -m "feat: create TransitionCard component for transition pathway cards"
```

### Task 3: Create TransitionCards component

**Files:**

- Create: `components/panel/TransitionCards.tsx`

This component replaces the right-column table from OccupationPanel (lines 339-442). It uses @tanstack/react-table for filtering and pagination, but renders cards instead of table rows.

- [ ] **Step 1: Create `TransitionCards.tsx`**

```tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type FilterFn,
} from '@tanstack/react-table';
import type { OccupationDetail } from '@/lib/types';
import TransitionCard from './TransitionCard';

export type TransitionRow = {
  id: string;
  label: string;
  weight: number;
  aiExposure: number;
  quartile: string;
  wage: number | null;
};

interface TransitionCardsProps {
  transitions: TransitionRow[];
  occupations: Record<string, OccupationDetail>;
  primarySkills: Set<string>;
  onCardClick: (id: string) => void;
}

const fuzzyFilter: FilterFn<TransitionRow> = (
  row,
  _columnId,
  filterValue: string,
) => {
  const q = filterValue.toLowerCase();
  return (
    row.original.label.toLowerCase().includes(q) ||
    row.original.id.toLowerCase().includes(q)
  );
};

export default function TransitionCards({
  transitions,
  occupations,
  primarySkills,
  onCardClick,
}: TransitionCardsProps) {
  const [filterQuery, setFilterQuery] = useState('');

  // Reset filter when transitions change (new primary occupation)
  useEffect(() => {
    setFilterQuery('');
  }, [transitions]);

  // Compute shared skills preview per transition row
  const cardPreviews = useMemo(() => {
    const map = new Map<string, { preview: string[]; total: number }>();
    for (const t of transitions) {
      const occ = occupations[t.id];
      if (!occ) {
        map.set(t.id, { preview: [], total: 0 });
        continue;
      }
      const skills = [...occ.basicSkills, ...occ.specificSkills];
      const shared = skills.filter((s) => primarySkills.has(s.toLowerCase()));
      map.set(t.id, {
        preview: shared.slice(0, 3),
        total: shared.length,
      });
    }
    return map;
  }, [transitions, occupations, primarySkills]);

  // Minimal column definition (needed for tanstack table filtering/pagination)
  const columns = useMemo(() => [{ accessorKey: 'id' as const }], []);

  const table = useReactTable({
    data: transitions,
    columns,
    globalFilterFn: fuzzyFilter,
    state: { globalFilter: filterQuery },
    onGlobalFilterChange: setFilterQuery,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: 10 } },
  });

  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Header + search */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Transition Pathways (
          {filterQuery
            ? `${filteredCount} of ${transitions.length}`
            : transitions.length}
          )
        </h3>
        <p className="text-xs text-muted-foreground">
          Sorted by shared skills · AI risk · wage
        </p>
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter by name or code…"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Card grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3 space-y-2">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const t = row.original;
            const preview = cardPreviews.get(t.id);
            return (
              <TransitionCard
                key={t.id}
                id={t.id}
                label={t.label}
                weight={t.weight}
                aiExposure={t.aiExposure}
                quartile={t.quartile}
                wage={t.wage}
                sharedSkillsPreview={preview?.preview ?? []}
                totalSharedSkills={preview?.total ?? 0}
                onClick={() => onCardClick(t.id)}
              />
            );
          })
        ) : (
          <div className="text-center text-muted-foreground py-8 text-sm">
            {filterQuery
              ? 'No occupations match your search.'
              : 'No connected occupations found.'}
          </div>
        )}
      </div>

      {/* Pagination */}
      {transitions.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="bg-background border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>
              {(() => {
                const { pageIndex, pageSize } = table.getState().pagination;
                const total = filteredCount;
                if (total === 0) return '0 results';
                const from = pageIndex * pageSize + 1;
                const to = Math.min((pageIndex + 1) * pageSize, total);
                return `${from}–${to} of ${total}`;
              })()}
            </span>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-0.5 rounded border border-border disabled:opacity-30 hover:bg-muted/50 transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2 py-0.5 rounded border border-border disabled:opacity-30 hover:bg-muted/50 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/panel/TransitionCards.tsx
git commit -m "feat: create TransitionCards component with card grid, search, and pagination"
```

---

## Chunk 3: Rewrite OccupationPanel orchestrator + wire up page.tsx

### Task 4: Rewrite OccupationPanel as thin orchestrator

**Files:**

- Rewrite: `components/panel/OccupationPanel.tsx`

The panel becomes the dialog shell + state orchestrator. It computes transitions, shared skills, and comparison deltas, then delegates rendering to sub-components. The `TransitionCards` is CSS-hidden (not unmounted) when in comparison mode, preserving scroll position.

- [ ] **Step 1: Rewrite `OccupationPanel.tsx`**

```tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { ArrowLeftIcon, XIcon } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OccupationDetail, GraphNode, GraphEdge } from '@/lib/types';
import OccupationDetailPane from './OccupationDetailPane';
import TransitionCards, { type TransitionRow } from './TransitionCards';

interface OccupationPanelProps {
  nodeId: string | null;
  detail: OccupationDetail | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  occupations: Record<string, OccupationDetail>;
  isOpen: boolean;
  onClose: () => void;
}

export default function OccupationPanel({
  nodeId,
  detail,
  nodes,
  edges,
  occupations,
  isOpen,
  onClose,
}: OccupationPanelProps) {
  const [comparisonNodeId, setComparisonNodeId] = useState<string | null>(null);

  // Reset comparison when primary occupation changes or panel closes
  useEffect(() => {
    setComparisonNodeId(null);
  }, [nodeId, isOpen]);

  // Build transition rows (reused from previous implementation)
  const transitions = useMemo<TransitionRow[]>(() => {
    if (!nodeId || !nodes.length || !edges.length) return [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const seen = new Set<string>();
    const rows: TransitionRow[] = [];

    for (const e of edges) {
      const otherId =
        e.source === nodeId ? e.target : e.target === nodeId ? e.source : null;
      if (!otherId || seen.has(otherId)) continue;
      seen.add(otherId);
      const node = nodeMap.get(otherId);
      if (!node) continue;
      rows.push({
        id: otherId,
        label: node.label,
        weight: e.weight,
        aiExposure: node.aiExposure,
        quartile: node.quartile,
        wage: node.wage,
      });
    }

    rows.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (a.aiExposure !== b.aiExposure) return a.aiExposure - b.aiExposure;
      return (b.wage ?? -Infinity) - (a.wage ?? -Infinity);
    });
    return rows;
  }, [nodeId, nodes, edges]);

  // Primary occupation skills (for card previews)
  const primarySkills = useMemo<Set<string>>(() => {
    if (!detail) return new Set();
    return new Set(
      [...detail.basicSkills, ...detail.specificSkills].map((s) =>
        s.toLowerCase(),
      ),
    );
  }, [detail]);

  // Comparison detail
  const comparisonDetail = comparisonNodeId
    ? (occupations[comparisonNodeId] ?? null)
    : null;

  // Edge weight for comparison pair
  const comparisonWeight = useMemo(() => {
    if (!comparisonNodeId) return undefined;
    return transitions.find((t) => t.id === comparisonNodeId)?.weight;
  }, [comparisonNodeId, transitions]);

  // Shared skills (lowercase) between primary and comparison
  const sharedSkills = useMemo<Set<string> | undefined>(() => {
    if (!detail || !comparisonDetail) return undefined;

    const primarySet = new Set(
      [...detail.basicSkills, ...detail.specificSkills].map((s) =>
        s.toLowerCase(),
      ),
    );
    const compSet = new Set(
      [...comparisonDetail.basicSkills, ...comparisonDetail.specificSkills].map(
        (s) => s.toLowerCase(),
      ),
    );

    const shared = new Set<string>();
    for (const s of primarySet) {
      if (compSet.has(s)) shared.add(s);
    }
    return shared;
  }, [detail, comparisonDetail]);

  // Comparison deltas
  const comparisonDeltas = useMemo(() => {
    if (!detail || !comparisonDetail) return undefined;
    return {
      aiExposure: comparisonDetail.aiExposure - detail.aiExposure,
      wage:
        comparisonDetail.wage !== null && detail.wage !== null
          ? comparisonDetail.wage - detail.wage
          : null,
    };
  }, [detail, comparisonDetail]);

  const isComparing = comparisonNodeId !== null && comparisonDetail !== null;

  return (
    <Dialog
      open={isOpen && !!nodeId && !!detail}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="bg-card border-border text-foreground sm:max-w-6xl max-h-[90vh] overflow-hidden p-0 flex flex-col"
        showCloseButton={false}
      >
        {detail && nodeId && (
          <>
            {/* Full-width sticky header */}
            <DialogHeader className="p-5 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground font-mono">
                      {nodeId}
                    </span>
                  </div>
                  <DialogTitle className="text-foreground text-lg leading-tight font-semibold">
                    {detail.occupation}
                  </DialogTitle>
                </div>
                <DialogClose className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mt-0.5">
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </DialogHeader>

            {/* Two-column body — 50/50 split */}
            <div className="flex flex-1 min-h-0">
              {/* Left pane — primary occupation details */}
              <div className="w-1/2 border-r border-border">
                <OccupationDetailPane
                  detail={detail}
                  sharedSkills={sharedSkills}
                />
              </div>

              {/* Right pane — cards or comparison */}
              <div className="w-1/2 flex flex-col min-h-0">
                {/* TransitionCards — hidden (not unmounted) when comparing */}
                <div
                  className={
                    isComparing ? 'hidden' : 'flex flex-col min-h-0 h-full'
                  }
                >
                  <TransitionCards
                    transitions={transitions}
                    occupations={occupations}
                    primarySkills={primarySkills}
                    onCardClick={(id) => setComparisonNodeId(id)}
                  />
                </div>

                {/* Comparison detail pane */}
                {isComparing && comparisonDetail && (
                  <OccupationDetailPane
                    detail={comparisonDetail}
                    sharedSkills={sharedSkills}
                    comparisonDeltas={comparisonDeltas}
                    skillsMatchWeight={comparisonWeight}
                    header={
                      <div className="mb-2 space-y-1">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setComparisonNodeId(null)}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            <ArrowLeftIcon className="size-3" />
                            Back to pathways
                          </button>
                          <span className="text-xs text-muted-foreground font-mono">
                            {comparisonNodeId}
                          </span>
                        </div>
                        <div className="text-base font-semibold text-foreground leading-snug">
                          {comparisonDetail.occupation}
                        </div>
                      </div>
                    }
                  />
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors (may show errors in `page.tsx` since `occupations` prop is not wired yet — that's expected)

- [ ] **Step 3: Commit**

```bash
git add components/panel/OccupationPanel.tsx
git commit -m "refactor: rewrite OccupationPanel as thin orchestrator with dual-pane layout"
```

### Task 5: Wire up page.tsx

**Files:**

- Modify: `app/page.tsx`

Pass the `occupations` record to OccupationPanel and remove the now-unused `onNodeSelect` prop.

- [ ] **Step 1: Update OccupationPanel usage in page.tsx**

In `app/page.tsx`, update the `<OccupationPanel>` JSX (currently at lines 281-292):

Replace:

```tsx
<OccupationPanel
  nodeId={panelNodeId}
  detail={panelDetail}
  nodes={nodes}
  edges={edges}
  isOpen={isPanelOpen}
  onClose={() => {
    setIsPanelOpen(false);
    setPanelNodeId(null);
  }}
  onNodeSelect={handleNodeSelect}
/>
```

With:

```tsx
<OccupationPanel
  nodeId={panelNodeId}
  detail={panelDetail}
  nodes={nodes}
  edges={edges}
  occupations={occupations}
  isOpen={isPanelOpen}
  onClose={() => {
    setIsPanelOpen(false);
    setPanelNodeId(null);
  }}
/>
```

- [ ] **Step 2: Verify full build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run the dev server and manually verify**

Run: `npm run dev`

Test:

1. Select an occupation on the graph → double-click to open panel
2. Verify left pane (50%) shows occupation details, right pane (50%) shows transition cards
3. Verify cards show name, code, match dots, AI badge, wage, shared skills preview
4. Use search to filter cards
5. Click a transition card → verify right pane switches to comparison view
6. Verify shared skills highlighted blue with ✓ on both panes
7. Verify comparison deltas (▼/▲) on right pane
8. Click "← Back to pathways" → verify return to cards with scroll position preserved
9. Close dialog → verify clean state reset

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire occupations prop to OccupationPanel for comparison lookups"
```

---

## Verification Checklist

After all tasks complete, run through the full verification from the spec:

- [ ] Cards mode: 50/50 split, left=details, right=cards with search/pagination
- [ ] Card content: name, code, match dots, AI badge, wage, shared skills preview
- [ ] Comparison mode: click card → right pane shows details with back button, skill highlighting, deltas
- [ ] Back navigation: "← Back to pathways" returns to cards, scroll preserved
- [ ] Skill highlighting: shared skills blue with ✓ on both panes, non-shared keep original styling
- [ ] Close: dialog close button dismisses everything, state resets
- [ ] Theme: both modes work in light and dark theme
- [ ] Responsive: 50/50 split at various viewport widths (`sm:max-w-6xl`)
