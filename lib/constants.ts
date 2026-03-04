export const MASCO_GROUPS: Record<number, { label: string; colorVar: string }> = {
  1: { label: 'Managers', colorVar: '--masco-1' },
  2: { label: 'Professionals', colorVar: '--masco-2' },
  3: { label: 'Technicians', colorVar: '--masco-3' },
  4: { label: 'Clerical', colorVar: '--masco-4' },
  5: { label: 'Services & Sales', colorVar: '--masco-5' },
  6: { label: 'Skilled Agricultural', colorVar: '--masco-6' },
  7: { label: 'Craft & Trades', colorVar: '--masco-7' },
  8: { label: 'Plant & Machine Operators', colorVar: '--masco-8' },
  9: { label: 'Elementary', colorVar: '--masco-9' },
};

export const QUARTILE_LABELS: Record<string, string> = {
  Low: 'Low',
  'Medium low': 'Medium Low',
  'Medium high': 'Medium High',
  High: 'High',
};

export const QUARTILE_COLORS: Record<string, string> = {
  Low: 'var(--quartile-low)',
  'Medium low': 'var(--quartile-medium-low)',
  'Medium high': 'var(--quartile-medium-high)',
  High: 'var(--quartile-high)',
};

// Node radius configuration for graph visualization
// Visual radius = NODE_RADIUS_BASE + aiExposure * NODE_RADIUS_SCALE
export const NODE_RADIUS_BASE = 9;
export const NODE_RADIUS_SCALE = 27;
export const NODE_RADIUS_COLLIDE_PADDING = 4.5;
