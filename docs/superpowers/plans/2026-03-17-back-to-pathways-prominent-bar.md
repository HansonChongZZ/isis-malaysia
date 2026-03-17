# Prominent "Back to Pathways" Bar — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tiny "Back to pathways" text link in ComparisonGrid with a full-width, tinted, sticky bar at the top of the right pane so users can always find their way back to the transition card list.

**Architecture:** Single-component change in `ComparisonGrid.tsx`. The right pane's header column gets restructured: remove padding from the outer wrapper, add a sticky `<button>` bar as the first child, then wrap the existing occupation info in a padded inner div. No new props, state, or components.

**Tech Stack:** React, Tailwind CSS, lucide-react (ArrowLeftIcon already imported)

**Spec:** `docs/superpowers/specs/2026-03-17-back-to-pathways-prominent-bar-design.md`

---

## File Structure

- **Modify:** `components/panel/ComparisonGrid.tsx` — the only file that changes

No new files. No new dependencies.

---

## Chunk 1: Implementation

### Task 1: Restructure the right pane header and add the sticky bar

**Files:**
- Modify: `components/panel/ComparisonGrid.tsx:145-198`

- [ ] **Step 1: Restructure the right pane header column**

The current right pane header (line 145) is:
```tsx
<div className="w-1/2 px-5 py-4 border-l-[3px] border-l-blue-500">
```

Remove `px-5 py-4` from this outer div so the sticky bar can span full width. The existing content moves into an inner wrapper that carries the padding.

Replace lines 145–198 (the entire right pane column in the header row) with:

```tsx
<div className="w-1/2 border-l-[3px] border-l-blue-500">
  {/* Sticky back-to-pathways bar */}
  <button
    type="button"
    onClick={onBack}
    className="sticky top-0 z-10 w-full flex items-center gap-3 px-5 py-2.5 bg-primary/15 hover:bg-primary/25 border-b border-primary/30 transition-colors cursor-pointer text-left"
  >
    <div className="flex items-center justify-center size-7 rounded-md bg-primary/20">
      <ArrowLeftIcon className="size-4 text-primary" />
    </div>
    <div>
      <div className="text-sm font-semibold text-primary">Back to pathways</div>
      <div className="text-xs text-primary/60">Return to transition list</div>
    </div>
  </button>

  {/* Occupation info — carries the padding that was on the parent */}
  <div className="px-5 py-4">
    <div className="flex items-center gap-3 mb-1">
      <span className="text-xs text-muted-foreground font-mono">
        {comparisonNodeId}
      </span>
    </div>
    <div className="text-base font-semibold text-foreground leading-snug">
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
            {sharedCount} specific skills in common, {developCount}{' '}
            specific skills to develop
          </span>
        </div>
      );
    })()}
  </div>
</div>
```

Key changes from the current code:
- The old `<button>` back link (lines 147-154) is **removed**
- The outer `w-1/2` div loses `px-5 py-4` so the bar spans full width
- A new sticky `<button>` element is added as the first child
- The existing occupation info is wrapped in `<div className="px-5 py-4">` to preserve its spacing

- [ ] **Step 2: Verify visually**

Run: `npm run dev` (or whatever the dev server command is)

Open the app, select an occupation, click a transition card to enter comparison mode, and verify:
1. The tinted green bar appears at the top of the right pane
2. It has the arrow icon in a rounded container + "Back to pathways" + "Return to transition list"
3. Hovering the bar changes the background opacity
4. Scrolling down keeps the bar pinned at the top of the right pane
5. Clicking the bar returns to the card list view
6. The left pane header is unaffected

- [ ] **Step 3: Commit**

```bash
git add components/panel/ComparisonGrid.tsx
git commit -m "feat: make back-to-pathways bar prominent and sticky in comparison view"
```
