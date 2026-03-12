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
// Visual radius = NODE_RADIUS_BASE + (metricValue ^ NODE_RADIUS_EXPONENT) * NODE_RADIUS_SCALE
// The power exponent compresses low values and amplifies high values,
// making top-exposure/wage/worker nodes visually jump out.
export const NODE_RADIUS_BASE = 100;
export const NODE_RADIUS_SCALE = 501;
export const NODE_RADIUS_EXPONENT = 3;
export const NODE_RADIUS_COLLIDE_PADDING = 250.5;
