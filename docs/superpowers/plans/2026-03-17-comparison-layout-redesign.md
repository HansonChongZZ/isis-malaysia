# Comparison Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-pane row-aligned ComparisonGrid with a unified single-column layout using inline comparison cells, merged skills badges, and side-by-side task columns.

**Architecture:** Single file rewrite of `ComparisonGrid.tsx`. The component keeps the same props interface and sub-components (`SkillBadge`, `TaskAccordion`) but replaces the JSX layout. No new files, no prop changes, no parent component modifications.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, Radix UI (Accordion), shadcn/ui (Badge)

**Spec:** `docs/superpowers/specs/2026-03-17-comparison-layout-redesign-design.md`

---

## File Structure

- **Modify:** `components/panel/ComparisonGrid.tsx` — full rewrite of the default export's JSX; `SkillBadge` updated (remove `side` prop, simplify to shared/to-develop only); `TaskAccordion` unchanged

No new files created. No other files modified.

---

### Task 1: Rewrite SkillBadge + ComparisonGrid layout (back bar, names, metrics)

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx:24-447`

Replace the `SkillBadge` sub-component and the entire main component layout in one step to avoid broken intermediate states. The `SkillBadge` `side` prop is removed (simplified to `isShared` only), and the main layout is rewritten with sections 2-5 (back bar, occupation names, AI exposure, wage). Skills and tasks are left as TODO comments for Tasks 2 and 3.

- [ ] **Step 1: Replace SkillBadge (lines 24-80) and the main component return (lines 133-447)**

Replace lines 24-80 with the simplified SkillBadge:

```tsx
function SkillBadge({
  skill,
  isShared,
}: {
  skill: string;
  isShared: boolean;
}) {
  if (isShared) {
    return (
      <Badge
        variant="secondary"
        className="text-xs"
        style={{
          backgroundColor: 'rgba(34,197,94,0.12)',
          color: '#16a34a',
          border: '1px solid rgba(34,197,94,0.25)',
        }}
      >
        {skill} ✓
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="text-xs"
      style={{
        backgroundColor: 'rgba(59,130,246,0.12)',
        color: '#3b82f6',
        border: '1px solid rgba(59,130,246,0.25)',
      }}
    >
      {skill}
    </Badge>
  );
}
```

Then replace the entire return block (lines 133-447) with the new layout:

```tsx
export default function ComparisonGrid({
  primary,
  primaryNodeId,
  comparison,
  comparisonNodeId,
  sharedSkills,
  comparisonDeltas,
  onBack,
}: ComparisonGridProps) {
  const primaryColour = QUARTILE_COLOURS[primary.quartile] ?? '#888';
  const comparisonColour = 'var(--primary)';

  const TARGET_TINT = 'rgba(32,77,57,0.015)';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Back to pathways bar — full width */}
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center gap-3 px-5 py-2.5 bg-primary/15 hover:bg-primary/25 border-b border-primary/30 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center justify-center size-7 rounded-md bg-primary/20">
          <ArrowLeftIcon className="size-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold text-primary">Back to pathways</div>
          <div className="text-xs text-primary/60">Return to transition list</div>
        </div>
      </button>

      {/* Occupation names row */}
      <div className="flex border-b border-border" style={{ background: '#fafafa' }}>
        <div className="flex-1 px-5 py-3">
          <div className="text-[10px] text-muted-foreground mb-0.5">Current role</div>
          <div className="text-xs text-muted-foreground font-mono mb-1">
            {primaryNodeId}
          </div>
          <div className="text-[13px] font-semibold text-foreground leading-snug">
            {primary.occupation}
          </div>
        </div>
        <div
          className="flex-1 px-5 py-3 border-l border-border"
          style={{ background: TARGET_TINT }}
        >
          <div className="text-[10px] text-muted-foreground mb-0.5">Target role</div>
          <div className="text-xs text-muted-foreground font-mono mb-1">
            {comparisonNodeId}
          </div>
          <div className="text-[13px] font-semibold leading-snug" style={{ color: comparisonColour }}>
            {comparison.occupation}
          </div>
          {(() => {
            const sharedCount = comparison.specificSkills.filter((s) =>
              sharedSkills.has(s.toLowerCase()),
            ).length;
            const developCount = comparison.specificSkills.length - sharedCount;
            const total = comparison.specificSkills.length;
            if (total === 0) return null;
            return (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-muted-foreground">Match:</span>
                <div className="flex flex-wrap gap-[3px] bg-muted rounded px-1.5 py-1">
                  {[...comparison.specificSkills]
                    .sort((a, b) => {
                      const aShared = sharedSkills.has(a.toLowerCase()) ? 0 : 1;
                      const bShared = sharedSkills.has(b.toLowerCase()) ? 0 : 1;
                      return aShared - bShared;
                    })
                    .map((skill, i) => (
                      <span
                        key={i}
                        className="inline-block w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: sharedSkills.has(skill.toLowerCase())
                            ? '#22c55e'
                            : 'rgba(59,130,246,0.4)',
                        }}
                      />
                    ))}
                </div>
                <span className="text-muted-foreground text-xs">
                  {sharedCount} shared, {developCount} to develop
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* AI Exposure row */}
      <div className="flex border-b border-border">
        <div className="flex-1 px-5 py-3">
          <div className="text-[10px] text-muted-foreground mb-1">AI Exposure</div>
          <div className="text-base font-bold" style={{ color: primaryColour }}>
            {(primary.aiExposure * 100).toFixed(1)}%
          </div>
          <div className="h-[7px] bg-muted rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${primary.aiExposure * 100}%`,
                backgroundColor: primaryColour,
              }}
            />
          </div>
        </div>
        <div
          className="flex-1 px-5 py-3 border-l border-border"
          style={{ background: TARGET_TINT }}
        >
          <div className="text-[10px] text-muted-foreground mb-1">AI Exposure</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold" style={{ color: comparisonColour }}>
              {(comparison.aiExposure * 100).toFixed(1)}%
            </span>
            <span className="text-[11px]" style={{ color: comparisonColour }}>
              {comparisonDeltas.aiExposure < 0 ? '▼' : '▲'}{' '}
              {Math.abs(comparisonDeltas.aiExposure * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-[7px] bg-muted rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${comparison.aiExposure * 100}%`,
                backgroundColor: comparisonColour,
              }}
            />
          </div>
        </div>
      </div>

      {/* Wage row */}
      <div className="flex border-b border-border">
        <div className="flex-1 px-5 py-3">
          <div className="text-[10px] text-muted-foreground mb-1">Median Wage</div>
          {primary.wage !== null ? (
            <div className="text-base font-bold text-foreground">
              MYR {primary.wage.toLocaleString()}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Data not available</div>
          )}
        </div>
        <div
          className="flex-1 px-5 py-3 border-l border-border"
          style={{ background: TARGET_TINT }}
        >
          <div className="text-[10px] text-muted-foreground mb-1">Median Wage</div>
          {comparison.wage !== null ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold" style={{ color: comparisonColour }}>
                MYR {comparison.wage.toLocaleString()}
              </span>
              {comparisonDeltas.wage != null && (
                <span className="text-[11px]" style={{ color: comparisonColour }}>
                  {comparisonDeltas.wage > 0 ? '▲' : '▼'} MYR{' '}
                  {Math.abs(comparisonDeltas.wage).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">Data not available</div>
          )}
        </div>
      </div>

      {/* TODO: Skills section (Task 2) */}
      {/* TODO: Tasks section (Task 3) */}
    </div>
  );
}
```

- [ ] **Step 2: Verify the app compiles and the top half renders**

Run: `npm run dev` — open the panel, select a transition. Confirm back bar, occupation names, AI exposure, and wage rows render correctly. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/panel/ComparisonGrid.tsx
git commit -m "feat: rewrite ComparisonGrid layout with simplified SkillBadge"
```

---

### Task 2: Add unified skills section

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx` — replace the skills TODO comment

- [ ] **Step 1: Replace the skills TODO with the full-width skills section**

Insert after the wage row closing `</div>` and before the tasks TODO:

```tsx
      {/* Skills section — full width, target occupation's skills */}
      {(comparison.basicSkills.length > 0 ||
        comparison.specificSkills.length > 0) && (
        <div className="px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-3.5 mb-2.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Skills
            </h3>
            <span className="flex items-center gap-1.5 ml-auto">
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: 'rgba(34,197,94,0.12)',
                  color: '#16a34a',
                  border: '1px solid rgba(34,197,94,0.25)',
                }}
              >
                ✓
              </Badge>
              <span className="text-xs text-muted-foreground">Shared</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: 'rgba(59,130,246,0.12)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59,130,246,0.25)',
                }}
              >
                &bull;
              </Badge>
              <span className="text-xs text-muted-foreground">To develop</span>
            </span>
          </div>

          {comparison.basicSkills.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] text-muted-foreground mb-1">Basic</div>
              <div className="flex flex-wrap gap-1.5">
                {[...comparison.basicSkills]
                  .sort((a, b) => {
                    const aShared = sharedSkills.has(a.toLowerCase()) ? 0 : 1;
                    const bShared = sharedSkills.has(b.toLowerCase()) ? 0 : 1;
                    return aShared - bShared;
                  })
                  .map((skill) => (
                    <SkillBadge
                      key={skill}
                      skill={skill}
                      isShared={sharedSkills.has(skill.toLowerCase())}
                    />
                  ))}
              </div>
            </div>
          )}

          {comparison.specificSkills.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Specific</div>
              <div className="flex flex-wrap gap-1.5">
                {[...comparison.specificSkills]
                  .sort((a, b) => {
                    const aShared = sharedSkills.has(a.toLowerCase()) ? 0 : 1;
                    const bShared = sharedSkills.has(b.toLowerCase()) ? 0 : 1;
                    return aShared - bShared;
                  })
                  .map((skill) => (
                    <SkillBadge
                      key={skill}
                      skill={skill}
                      isShared={sharedSkills.has(skill.toLowerCase())}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 2: Verify skills render correctly**

Run: `npm run dev` — open the panel, select a transition. Confirm skills section shows with legend, Basic/Specific sub-labels, and correct shared (green ✓) / to-develop (blue) badges.

- [ ] **Step 3: Commit**

```bash
git add components/panel/ComparisonGrid.tsx
git commit -m "feat: add unified skills section with shared/to-develop badges"
```

---

### Task 3: Add side-by-side tasks section

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx` — replace the tasks TODO comment

- [ ] **Step 1: Replace the tasks TODO with side-by-side task columns**

Insert after the skills section and before the closing `</div>`:

```tsx
      {/* Tasks section — side by side */}
      {(primary.tasks.length > 0 || comparison.tasks.length > 0) && (
        <div className="flex">
          <div className="flex-1 px-4 py-3.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Current Tasks ({primary.tasks.length})
            </h3>
            <TaskAccordion tasks={primary.tasks} prefix="primary" />
          </div>
          <div
            className="flex-1 px-4 py-3.5 border-l border-border"
            style={{ background: TARGET_TINT }}
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Target Tasks ({comparison.tasks.length})
            </h3>
            <TaskAccordion tasks={comparison.tasks} prefix="comparison" />
          </div>
        </div>
      )}
```

- [ ] **Step 2: Verify tasks render correctly**

Run: `npm run dev` — open the panel, select a transition. Confirm:
- Tasks show side by side
- Left column: "Current Tasks (N)" with accordion items
- Right column: "Target Tasks (N)" with accordion items and green tint
- Expanding a task shows AI score bar

- [ ] **Step 3: Commit**

```bash
git add components/panel/ComparisonGrid.tsx
git commit -m "feat: add side-by-side tasks section to comparison layout"
```

---

### Task 4: Visual polish and final verification

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx` (if needed)

- [ ] **Step 1: Full visual review**

Run: `npm run dev` — test the following scenarios:
1. Select a transition with many skills (verify badges wrap correctly)
2. Select a transition with no skills (verify skills section hides)
3. Select a transition with no tasks (verify tasks section hides)
4. Select a transition where wage is null (verify "Data not available" shows)
5. Click "Back to pathways" (verify navigation works)
6. Verify scrolling works when content overflows the dialog

- [ ] **Step 2: Fix any visual issues found**

Adjust spacing, colors, or layout as needed based on the review.

- [ ] **Step 3: Final commit**

```bash
git add components/panel/ComparisonGrid.tsx
git commit -m "fix: polish comparison layout spacing and edge cases"
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: Clean build, no TypeScript errors, no warnings.
