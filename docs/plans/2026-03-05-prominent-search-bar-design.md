# Prominent Search Bar Design

**Date:** 2026-03-05
**Branch:** `feat/prominent-search-bar`

## Overview

Make the occupation search bar the hero element of the app, inspired by ChatGPT's centered prompt bar. The search bar floats prominently over the graph when no occupation is selected, then collapses into the control bar after selection to maximize graph real estate.

## Design

### Two States

**Hero state** (no occupation selected):
- Absolutely positioned, centered horizontally over the graph
- Positioned ~20-25% from the top of the graph area
- Width: `max-w-xl` (~576px), Height: `h-12`
- Z-index above graph, below modals/panels
- Filters remain in the control bar below the header as a secondary row

**Collapsed state** (occupation selected):
- Search bar animates into the control bar as the existing combobox (`max-w-sm`, `h-9`)
- Filters share the same row, same as current layout
- Clicking X to clear selection returns to hero state

### Visual Treatment

**Hero state:**
- Translucent background with backdrop blur: `bg-card/90 backdrop-blur-md`
- Gradient border: thin gradient stroke from primary blue (`oklch(0.445 0.085 240)`) to a complementary accent (`oklch(0.55 0.12 280)`)
- Soft glow/shadow: `shadow-lg` + faint colored spread matching gradient
- Larger text: `text-base` or `text-lg`
- Search icon (magnifying glass) on the left
- Placeholder: "Search any occupation in Malaysia..."
- Rounded corners: `rounded-xl`

**Collapsed state:**
- Reverts to current combobox styling: normal border, `rounded-md`, `h-9`
- No glow or gradient

### Transition Animation

- CSS transition ~300ms ease-out on width, height, position, border, shadow
- Hero -> collapsed: shrinks and slides up into control bar
- Collapsed -> hero: expands and floats down to center position

### State Logic

- Driven by existing `selectedOccupation` state
- `null` = hero state, set = collapsed state
- "Clear filters" button also triggers return to hero state

### Mobile

No changes. Mobile keeps the current behavior as-is.

## ASCII Wireframes

### Hero State

```
+---------------------------------------------------------------------+
|  IS  Malaysia Occupational Space           [Tutorial] [moon]        |
+---------------------------------------------------------------------+
|  [MASCO Group v] [Skills v]  [Clear filters]  [gear]               |
+---------------------------------------------------------------------+
|                                                                     |
|            +=============================================+          |
|            |  magnifier  Search any occupation in Malaysia...|      |
|            +=============================================+          |
|              ^ gradient border + glow                               |
|                          .  .                                       |
|               .    .  .     .  .                                    |
|            .    .       .  .    .   .                               |
|          .   .    . GRAPH .   .   .                                 |
|            .    .   NODES  .    .                                   |
|         .     .   .      .   .    .                                 |
|            .    .    .  .   .   .                                   |
|              .     .   .  .                                         |
|                                                                     |
| [Legend: * Manager * Professional * Technician * Clerical ...]      |
+---------------------------------------------------------------------+
```

### Collapsed State

```
+---------------------------------------------------------------------+
|  IS  Malaysia Occupational Space           [Tutorial] [moon]        |
+---------------------------------------------------------------------+
|  [Software Developer x] [MASCO Group v] [Skills v]  [gear]         |
+---------------------------------------------------------------------+
|                                                                     |
|                          .  .                                       |
|               .    .  .     .  .                                    |
|            .    .       .  .    .   .                               |
|          .   .    . GRAPH .   .   .                                 |
|            .    .   NODES  .    .                                   |
|         .     .   .    * .   .    .    +----------------+           |
|            .    .    .  .   .   .      |  Occupation    |           |
|              .     .   .  .            |  Detail Panel  |           |
|                                        |     ...        |           |
|                                        +----------------+           |
| [Legend: * Manager * Professional * Technician * Clerical ...]      |
+---------------------------------------------------------------------+
```

## Technical Notes

- The search combobox component (`combobox.tsx`) will need a `variant` or `expanded` prop to switch between hero and collapsed styles
- `GraphControls.tsx` will conditionally render the search bar either as a floating overlay or inline, based on `selectedOccupation`
- Animation can use Tailwind's `transition-all duration-300 ease-out` or CSS `@starting-style` for entry animations
- The floating search bar should use `pointer-events-none` on its container with `pointer-events-auto` on the input itself, so graph interactions pass through
