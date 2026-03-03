# Light Mode Theming Design — ISIS Malaysia Occupational Space

**Date:** 2026-03-03
**Approach:** Brand-Anchored Refresh (Approach A)

## Context

The app defaults to dark mode. Light mode currently feels washed out, inconsistent (hardcoded colors), and disconnected from ISIS Malaysia branding. This design rebuilds the light mode palette around ISIS brand colors while fixing all hardcoded color issues.

## ISIS Brand Colors

| Color | Hex | Usage |
|---|---|---|
| Dark navy | `#111132` | Primary text, headings |
| Medium blue | `#33658A` | Primary interactive (buttons, links, focus) |
| Light blue | `#769AD0` | Decorative accents, hover states |
| Dark pink/magenta | `#AF125A` | Accent highlights, badges |
| Muted pink | `#BD8B9C` | Soft accents, secondary badges |
| Cool grey | `#AEB9C4` | Borders, muted text base |

## 1. Light Mode UI Token Palette

All values in OKLCH for consistency with existing system.

| Token | Proposed Value | Maps to ~Hex | Rationale |
|---|---|---|---|
| `--background` | `oklch(0.975 0.004 250)` | Slightly deeper cool white | Purposeful tint, not "default white" |
| `--foreground` | `oklch(0.175 0.055 275)` | ~`#111132` | ISIS dark navy for authority |
| `--card` | `oklch(0.995 0.001 250)` | Barely-tinted white | Differentiates from background |
| `--card-foreground` | Same as `--foreground` | ~`#111132` | Consistent text |
| `--popover` | Same as `--card` | | |
| `--popover-foreground` | Same as `--foreground` | | |
| `--primary` | `oklch(0.445 0.085 240)` | ~`#33658A` | ISIS medium blue |
| `--primary-foreground` | `oklch(1.0 0 0)` | White | Contrast on blue |
| `--secondary` | `oklch(0.920 0.008 245)` | Very light blue-grey | Secondary backgrounds |
| `--secondary-foreground` | Same as `--foreground` | ~`#111132` | |
| `--muted` | `oklch(0.950 0.005 250)` | Light grey | Better hierarchy visibility |
| `--muted-foreground` | `oklch(0.500 0.020 250)` | Medium grey | Darker for WCAG AA |
| `--accent` | `oklch(0.450 0.160 350)` | ~`#AF125A` | ISIS magenta |
| `--accent-foreground` | `oklch(1.0 0 0)` | White | Contrast on magenta |
| `--border` | `oklch(0.840 0.010 250)` | Stronger grey | Visible without heavy |
| `--input` | Same as `--border` | | Consistent input borders |
| `--ring` | Same as `--primary` | ~`#33658A` | Focus ring |
| `--destructive` | Keep current | Red | Universal error color |

### Sidebar tokens
- `--sidebar` → match `--muted`
- `--sidebar-foreground` → match `--foreground`
- `--sidebar-primary` → match `--primary`
- `--sidebar-primary-foreground` → match `--primary-foreground`
- `--sidebar-accent` → match `--secondary`
- `--sidebar-accent-foreground` → match `--foreground`
- `--sidebar-border` → match `--border`
- `--sidebar-ring` → match `--primary`

### Chart tokens
Update `--chart-1` through `--chart-5` to use colors from the new MASCO palette.

## 2. Data Visualization Palette

### MASCO Group Colors (light-mode-first)

| Group | Hex | Name |
|---|---|---|
| 1 Managers | `#2B5F8A` | Deep teal-blue (brand-anchored) |
| 2 Professionals | `#D4762C` | Burnt amber |
| 3 Technicians | `#AF125A` | ISIS magenta (brand) |
| 4 Clerical | `#5A9E96` | Muted teal |
| 5 Services & Sales | `#3D7A3E` | Forest green |
| 6 Skilled Agricultural | `#C4A035` | Goldenrod |
| 7 Craft & Trades | `#8B5E83` | Plum |
| 8 Plant & Machine | `#BD8B9C` | ISIS muted pink (brand) |
| 9 Elementary | `#7A6352` | Warm umber |

Design principles:
- Darker/richer tones for contrast on `#EAEAEB` canvas
- Brand colors woven into groups 1, 3, 8
- Hue diversity maintained for distinguishability
- Color-blind accessible (varied luminance, not just hue)

### AI Exposure Quartile Colors

| Quartile | Hex |
|---|---|
| Low | `#2D8A4E` (deep green) |
| Medium low | `#6B9A2E` (olive-green) |
| Medium high | `#D4762C` (burnt amber) |
| High | `#C42B3E` (deep red) |

## 3. Hardcoded Color Fixes

### Graph canvas edges (`OccupationGraph.tsx`)
- Replace `ctx.strokeStyle = '#888'` with theme-aware color derived from `--border`

### Task AI score bar (`OccupationPanel.tsx`)
- Replace `bg-orange-400` / `text-orange-300` with `bg-primary` / `text-primary`

### Dialog overlay (`dialog.tsx`)
- Lighten to `bg-black/40` in light mode (less heavy)

### Canvas background
- Keep `#EAEAEB` (`--canvas-background`) as-is

## 4. Files to Modify

1. `app/globals.css` — Update `:root` CSS variables
2. `lib/constants.ts` — Update `MASCO_GROUPS` colors and `QUARTILE_COLORS`
3. `components/graph/OccupationGraph.tsx` — Theme-aware edge color
4. `components/panel/OccupationPanel.tsx` — Remove hardcoded orange
5. `components/ui/dialog.tsx` — Adjust overlay opacity
