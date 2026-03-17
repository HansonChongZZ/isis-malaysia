# Skills Filter: Specific Skills Only

## Summary

Change the skill filter combobox to only show and match against **specific skills**, removing all basic skills from the filter. This aligns the filter with the existing edge weight and skill distance calculations, which already use specific skills exclusively.

Specific skills are occupation-specific technical competencies (e.g., "Contract Drafting", "Financial Analysis"). Basic skills are generic transferable skills shared across many occupations (e.g., "Active Listening", "Critical Thinking").

## Scope

### What changes (in `app/page.tsx`)

- **`allSkills` map** — replace with `specificSkillsMap` (already exists, built by `buildSpecificSkillsMap`). This eliminates a redundant data structure since after this change both maps would be identical.
- **`uniqueSkills` array** — derive from specific skills only, removing basic skills from the combobox dropdown options
- **Filter matching** — by passing the specific-skills-only map to `OccupationGraph`, filtering only matches occupations by their specific skills

### What stays the same

- Occupation detail pane still displays both basic and specific skill badges
- Panel skill highlighting in comparisons still uses both basic + specific (intentional — shared basic skills remain visible in comparisons)
- Edge tooltips and skill comparisons unchanged
- Skill distance calculations unchanged (already specific-skills-only)
- All UI components (combobox, badges, accordion) unchanged
- Data files unchanged

### Edge cases

- Occupations with no specific skills (only basic skills) become unfilterable by skill. This is intentional — they also have no skill-based edges in the graph.
