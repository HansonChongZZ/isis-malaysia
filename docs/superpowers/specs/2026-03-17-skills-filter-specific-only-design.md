# Skills Filter: Specific Skills Only

## Summary

Change the skill filter combobox to only show and match against **specific skills**, removing all basic skills from the filter. This aligns the filter with the existing edge weight and skill distance calculations, which already use specific skills exclusively.

## Scope

### What changes

- **`allSkills` map construction** — build from `specificSkills[]` only, excluding `basicSkills[]`
- **Combobox dropdown** — only lists specific skills as filter options
- **Filter matching** — when skills are selected, only matches occupations by their specific skills

### What stays the same

- Occupation detail pane still displays both basic and specific skill badges
- Edge tooltips and skill comparisons unchanged
- Skill distance calculations unchanged (already specific-skills-only)
- All UI components (combobox, badges, accordion) unchanged
- Data files unchanged

## Implementation

Modify the `allSkills` map construction (in `OccupationGraph.tsx` or `page.tsx`) to only include `specificSkills` from each occupation's data, instead of the union of `basicSkills` and `specificSkills`.

This is a ~1-2 line change in the map-building logic.
