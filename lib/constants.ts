export const MASCO_GROUPS: Record<number, { label: string; color: string }> = {
  1: { label: 'Managers', color: '#4E79A7' },
  2: { label: 'Professionals', color: '#F28E2B' },
  3: { label: 'Technicians', color: '#E15759' },
  4: { label: 'Clerical', color: '#76B7B2' },
  5: { label: 'Services & Sales', color: '#59A14F' },
  6: { label: 'Skilled Agricultural', color: '#EDC948' },
  7: { label: 'Craft & Trades', color: '#B07AA1' },
  8: { label: 'Plant & Machine Operators', color: '#FF9DA7' },
  9: { label: 'Elementary', color: '#9C755F' },
};

// Cluster center offsets (relative to canvas center) for MASCO groups
// These guide the forceX/Y to produce cluster organization
export const CLUSTER_OFFSETS: Record<number, { x: number; y: number }> = {
  1: { x: -180, y: -120 },
  2: { x: 0, y: -168 },
  3: { x: 180, y: -120 },
  4: { x: 210, y: 30 },
  5: { x: 120, y: 168 },
  6: { x: 0, y: 192 },
  7: { x: -120, y: 168 },
  8: { x: -210, y: 30 },
  9: { x: -90, y: -30 },
};

export const QUARTILE_LABELS: Record<string, string> = {
  Low: 'Low',
  'Medium low': 'Medium Low',
  'Medium high': 'Medium High',
  High: 'High',
};

export const QUARTILE_COLORS: Record<string, string> = {
  Low: '#9C755F',
  'Medium low': '#E15759',
  'Medium high': '#F28E2B',
  High: '#59A14F',
};

// Node radius configuration for graph visualization
// Visual radius = NODE_RADIUS_BASE + aiExposure * NODE_RADIUS_SCALE
export const NODE_RADIUS_BASE = 9;
export const NODE_RADIUS_SCALE = 27;
export const NODE_RADIUS_COLLIDE_PADDING = 4.5;
