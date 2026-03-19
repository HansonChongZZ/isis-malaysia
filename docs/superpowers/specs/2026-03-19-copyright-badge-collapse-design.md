# Copyright Badge Collapse

## Problem

The about/attribution copy in the bottom-left badge takes up too much space on the graph canvas. It needs to be minimised to a short copyright line that expands on demand.

## Design

### Default State

A single-line badge at `bottom-4 left-4` showing:

> © 2026 CERT · Institute of Strategic & International Studies (ISIS) Malaysia

Styled consistently with the existing badge: `text-xs text-muted-foreground bg-card/70 px-2 py-1 rounded`.

### Expanded State

On hover (desktop) or tap (mobile), the full attribution paragraph smoothly reveals below the copyright line:

> Malaysian Network Explorer visualises occupations and maps how they are connected through shared skills. Occupation titles are based on the Malaysian Standard Classification of Occupations (MASCO) 2020 at the 4‑digit level. This explorer is developed as part of the research project "Skill Pathways for Technology-Induced Employment Transitions", funded by the Centre for Responsible Technology (CERT). Platform development was supported by Shortcut Asia.

### Interaction

- **Desktop:** `onMouseEnter` expands, `onMouseLeave` collapses.
- **Mobile:** `onClick` toggles a boolean state (`expanded`). Both coexist — hover takes precedence on desktop, tap works on touch devices.

### Animation

CSS `max-height` + `opacity` transition on the expandable region:

- Collapsed: `max-height: 0; opacity: 0; overflow: hidden`
- Expanded: `max-height: 12rem; opacity: 1`
- Transition: `max-height 300ms ease, opacity 300ms ease`

### Structure

```
<div>  (outer container, absolute bottom-4 left-4, max-w-sm)
  <p>© 2026 CERT · ISIS Malaysia</p>              ← always visible
  <div>  (expandable region, max-height transition)
    <p>Malaysian Network Explorer visualises...</p> ← full copy
  </div>
</div>
```

### Approach

CSS-only expand with a small `useState` for mobile tap-toggle. No new dependencies.

## File Changes

- `app/page.tsx` — replace the current static badge div (lines ~573-578) with the new expandable component inline.
