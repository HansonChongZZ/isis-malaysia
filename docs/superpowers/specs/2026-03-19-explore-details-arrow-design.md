# Explore Details Arrow — TransitionCard Visual Affordance

**Date:** 2026-03-19
**Status:** Approved

## Summary

Add an "Explore details →" text label with a right-arrow to each TransitionCard, positioned at the bottom-right of the card inline with the skills preview row. This is a visual affordance indicating the card is clickable — it does not introduce any new behavior.

## Motivation

The TransitionCard is an interactive `<button>` that navigates to occupation details, but there is no explicit visual cue signaling clickability beyond the hover state. Adding "Explore details →" makes the affordance obvious and gives users a clear call-to-action.

## Design

### Placement

- **Inline with the skills preview row** (Option B from brainstorming)
- The existing skills `flex-wrap` container and the new arrow are wrapped in an outer `flex` row with `justify-between` and `items-end`
- The arrow sits at the far right, vertically aligned to the bottom of the skills badges

### Appearance

- Text: `"Explore details"` followed by a right-arrow (`→` character or Lucide `ArrowRight` icon, whichever is already available)
- Font size: `text-xs` (matches card's existing type scale)
- Color: `text-muted-foreground` — subtle, not competing with skills badges
- `whitespace-nowrap` and `flex-shrink-0` to prevent wrapping or compression

### When no skills are present

- The arrow still renders at the bottom-right of the card, in its own row below the match dots section

### Behavior

- No new click handler — the entire card is already a `<button>` with `onClick`
- Purely decorative; no `tabIndex`, no `role`, no accessibility changes needed beyond what the card button already provides

## Scope

- **Single file change:** `components/panel/TransitionCard.tsx`
- No new dependencies, no new props, no changes to parent components

## Alternatives Considered

- **A: Own row below skills** — Clean but adds unnecessary vertical height to every card
- **C: Footer row with separator** — Over-designed for a simple affordance; moves wage out of its current position
