# Light Mode Theming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the light mode CSS token palette around ISIS Malaysia brand colors, introduce a new data visualization palette, and fix all hardcoded colors for a clean, professional light mode.

**Architecture:** CSS-variable-first approach — update `:root` tokens in `globals.css`, update constants in `lib/constants.ts`, then fix 3 components that bypass the token system with hardcoded colors.

**Tech Stack:** Tailwind CSS v4 (OKLCH), shadcn/ui (new-york), next-themes, D3.js canvas rendering

**Design doc:** `docs/plans/2026-03-03-light-mode-theming-design.md`

---

### Task 1: Update light mode CSS variables in globals.css

**Files:**
- Modify: `app/globals.css:7-64` (the `:root` block)

**Step 1: Replace the `:root` CSS variable block**

In `app/globals.css`, replace lines 7–64 (the entire `:root { ... }` block) with these updated values:

```css
:root {
  --background: oklch(0.975 0.004 250);
  --canvas-background: #EAEAEB;
  --foreground: oklch(0.175 0.055 275);
  --card: oklch(0.995 0.001 250);
  --card-foreground: oklch(0.175 0.055 275);
  --popover: oklch(0.995 0.001 250);
  --popover-foreground: oklch(0.175 0.055 275);
  --primary: oklch(0.445 0.085 240);
  --primary-foreground: oklch(1.0 0 0);
  --secondary: oklch(0.920 0.008 245);
  --secondary-foreground: oklch(0.175 0.055 275);
  --muted: oklch(0.950 0.005 250);
  --muted-foreground: oklch(0.500 0.020 250);
  --accent: oklch(0.450 0.160 350);
  --accent-foreground: oklch(1.0 0 0);
  --destructive: oklch(0.4936 0.1903 1.4742);
  --destructive-foreground: oklch(1.0 0 0);
  --border: oklch(0.840 0.010 250);
  --input: oklch(0.840 0.010 250);
  --ring: oklch(0.445 0.085 240);
  --chart-1: oklch(0.175 0.055 275);
  --chart-2: oklch(0.445 0.085 240);
  --chart-3: oklch(0.450 0.160 350);
  --chart-4: oklch(0.4936 0.1903 1.4742);
  --chart-5: oklch(0.6901 0.0647 356.7533);
  --sidebar: oklch(0.950 0.005 250);
  --sidebar-foreground: oklch(0.175 0.055 275);
  --sidebar-primary: oklch(0.445 0.085 240);
  --sidebar-primary-foreground: oklch(1.0 0 0);
  --sidebar-accent: oklch(0.920 0.008 245);
  --sidebar-accent-foreground: oklch(0.175 0.055 275);
  --sidebar-border: oklch(0.840 0.010 250);
  --sidebar-ring: oklch(0.445 0.085 240);
  --font-sans: Inter, sans-serif;
  --font-serif: Merriweather, serif;
  --font-mono: JetBrains Mono, monospace;
  --radius: 0.5rem;
  --shadow-x: 0px;
  --shadow-y: 2px;
  --shadow-blur: 8px;
  --shadow-spread: -1px;
  --shadow-opacity: 0.1;
  --shadow-color: hsl(0 0% 0%);
  --shadow-2xs: 0px 4px 8px -1px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0px 4px 8px -1px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10);
  --shadow: 0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10);
  --shadow-md: 0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 2px 4px -2px hsl(0 0% 0% / 0.10);
  --shadow-lg: 0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 4px 6px -2px hsl(0 0% 0% / 0.10);
  --shadow-xl: 0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 8px 10px -2px hsl(0 0% 0% / 0.10);
  --shadow-2xl: 0px 4px 8px -1px hsl(0 0% 0% / 0.25);
  --tracking-normal: 0.01em;
  --spacing: 0.25rem;
  --shadow-offset-x: 0px;
  --shadow-offset-y: 4px;
  --letter-spacing: 0em;
}
```

**Step 2: Verify the app runs**

Run: `npm run dev` (or `pnpm dev`)
Expected: App compiles without errors. Switch to light mode — background, text, and borders should look different from before.

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: update light mode CSS tokens to ISIS brand palette"
```

---

### Task 2: Update data visualization constants

**Files:**
- Modify: `lib/constants.ts:1-11` (MASCO_GROUPS) and `lib/constants.ts:34-39` (QUARTILE_COLORS)

**Step 1: Replace MASCO_GROUPS colors**

In `lib/constants.ts`, replace lines 1–11 with:

```typescript
export const MASCO_GROUPS: Record<number, { label: string; color: string }> = {
  1: { label: 'Managers', color: '#2B5F8A' },
  2: { label: 'Professionals', color: '#D4762C' },
  3: { label: 'Technicians', color: '#AF125A' },
  4: { label: 'Clerical', color: '#5A9E96' },
  5: { label: 'Services & Sales', color: '#3D7A3E' },
  6: { label: 'Skilled Agricultural', color: '#C4A035' },
  7: { label: 'Craft & Trades', color: '#8B5E83' },
  8: { label: 'Plant & Machine Operators', color: '#BD8B9C' },
  9: { label: 'Elementary', color: '#7A6352' },
};
```

**Step 2: Replace QUARTILE_COLORS**

In `lib/constants.ts`, replace lines 34–39 with:

```typescript
export const QUARTILE_COLORS: Record<string, string> = {
  Low: '#2D8A4E',
  'Medium low': '#6B9A2E',
  'Medium high': '#D4762C',
  High: '#C42B3E',
};
```

**Step 3: Verify**

Run: `npm run dev`
Expected: Graph nodes now show the new, darker/richer colors. Legend colors update automatically. Quartile badges in OccupationPanel show new green-to-red spectrum.

**Step 4: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: update MASCO and quartile color palettes for light mode"
```

---

### Task 3: Fix hardcoded edge color in OccupationGraph

**Files:**
- Modify: `components/graph/OccupationGraph.tsx:144` (hardcoded `#888` edge stroke)

**Step 1: Make edge color theme-aware**

The canvas 2D context can't read CSS variables directly during paint, so read the computed value once and store it. Add a ref to cache the computed border color, and read it from the DOM.

At line 43 (after the `nodeById` ref), add:

```typescript
const edgeColorRef = useRef('#888');
```

After the existing `useEffect` for `nodeById` (line 51–53), add a new effect:

```typescript
useEffect(() => {
  const el = containerRef.current;
  if (el) {
    edgeColorRef.current = getComputedStyle(el).getPropertyValue('--border').trim() || '#888';
  }
}, []);
```

Then at line 144, replace:

```typescript
ctx.strokeStyle = '#888';
```

with:

```typescript
ctx.strokeStyle = edgeColorRef.current;
```

**Step 2: Verify**

Run: `npm run dev`
Expected: In light mode, graph edges should pick up the `--border` color (a cool grey) instead of the generic `#888`. In dark mode, they pick up the dark mode border color.

**Step 3: Commit**

```bash
git add components/graph/OccupationGraph.tsx
git commit -m "fix: make graph edge color theme-aware via CSS variable"
```

---

### Task 4: Fix hardcoded orange in OccupationPanel task AI score

**Files:**
- Modify: `components/panel/OccupationPanel.tsx:329` and `components/panel/OccupationPanel.tsx:333`

**Step 1: Replace hardcoded orange with theme tokens**

At line 329, replace:

```tsx
className="h-full rounded-full bg-orange-400"
```

with:

```tsx
className="h-full rounded-full bg-primary"
```

At line 333, replace:

```tsx
<span className="text-xs text-orange-300 font-mono">
```

with:

```tsx
<span className="text-xs text-primary font-mono">
```

**Step 2: Verify**

Run: `npm run dev`
Expected: Open any occupation panel → expand a Task accordion item → the AI Score bar and percentage text should now use the ISIS blue (`--primary`) instead of orange. Works in both light and dark mode.

**Step 3: Commit**

```bash
git add components/panel/OccupationPanel.tsx
git commit -m "fix: replace hardcoded orange with theme primary in task AI score"
```

---

### Task 5: Soften dialog overlay for light mode

**Files:**
- Modify: `components/ui/dialog.tsx:41`

**Step 1: Reduce overlay opacity**

At line 41, replace:

```tsx
"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
```

with:

```tsx
"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40",
```

**Step 2: Verify**

Run: `npm run dev`
Expected: Open an occupation panel dialog → the backdrop overlay should be slightly more transparent (40% vs 50% black). Still dim enough to focus attention on the dialog.

**Step 3: Commit**

```bash
git add components/ui/dialog.tsx
git commit -m "fix: lighten dialog overlay opacity for better light mode feel"
```

---

### Task 6: Visual verification and final commit

**Step 1: Full visual verification**

Switch to light mode and verify each area:
- [ ] Header: navy text, blue logo placeholder, cool-tinted card background
- [ ] Graph canvas: `#EAEAEB` background, new MASCO node colors, themed edge colors
- [ ] Graph legend: new colors, readable labels
- [ ] Graph tooltip: popover with proper contrast
- [ ] Occupation panel dialog: softer overlay, navy text, blue primary accents
- [ ] AI Exposure section: new quartile colors (green-to-red)
- [ ] Skills badges: secondary (blue-grey) and accent (magenta) variants
- [ ] Task accordion: blue AI score bar (not orange)
- [ ] Transition table: readable, proper hover states
- [ ] Theme toggle: switching between light/dark works cleanly

Also verify dark mode is not broken — it should be unchanged since we only modified `:root`.

**Step 2: If any issues found, fix and commit individually**

**Step 3: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: light mode theming visual polish"
```
