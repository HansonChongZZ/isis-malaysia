# Explore Details Arrow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Explore details →" visual affordance to each TransitionCard, inline with the skills row at the bottom-right.

**Architecture:** Single component change — wrap the skills preview and a new arrow span in a flex container with `justify-between`. When no skills are present, the arrow renders alone.

**Tech Stack:** React, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-19-explore-details-arrow-design.md`

---

### Task 1: Add "Explore details" arrow to TransitionCard

**Files:**
- Modify: `components/panel/TransitionCard.tsx:101-131`

- [ ] **Step 1: Restructure the bottom section to always render**

Currently the skills preview is conditionally rendered (`skillsPreview.length > 0`). Restructure so the outer container always renders (for the arrow), and only the skill badges are conditional.

In `components/panel/TransitionCard.tsx`, add `ArrowRight` to the lucide-react import:

```tsx
import { ArrowRight } from 'lucide-react';
```

Then replace the bottom section (lines 101-131) with:

```tsx
{/* Bottom row: skills preview + explore details arrow */}
<div className="flex justify-between items-end gap-2">
  <div className="flex flex-wrap gap-1 min-w-0">
    {skillsPreview.map((skill) => {
      const isShared = primarySkills.has(skill.toLowerCase());
      return (
        <SkillBadgePopover
          key={skill}
          skill={skill}
          type="specific"
          variant={isShared ? 'shared' : 'to-develop'}
          suffix={isShared ? ' ✓' : undefined}
          className="text-[10px]"
        />
      );
    })}
    {remaining > 0 && (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded"
        style={{
          backgroundColor: 'rgba(59,130,246,0.15)',
          color: '#60a5fa',
          border: '1px solid rgba(59,130,246,0.25)',
        }}
      >
        +{remaining} more
      </span>
    )}
  </div>
  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 inline-flex items-center gap-1">
    Explore details
    <ArrowRight size={14} />
  </span>
</div>
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`

Check that:
- Cards with skills show badges on the left, "Explore details →" on the right
- Cards without skills show just the arrow at the bottom-right
- Arrow does not wrap or overlap badges on narrow viewports
- Clicking the arrow still triggers the card's onClick (no pointer event issues)

- [ ] **Step 3: Commit**

```bash
git add components/panel/TransitionCard.tsx
git commit -m "feat: add explore-details arrow to TransitionCard"
```
