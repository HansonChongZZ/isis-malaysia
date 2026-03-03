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
  Low: '#2D8A4E',
  'Medium low': '#6B9A2E',
  'Medium high': '#D4762C',
  High: '#C42B3E',
};

// Node radius configuration for graph visualization
// Visual radius = NODE_RADIUS_BASE + aiExposure * NODE_RADIUS_SCALE
export const NODE_RADIUS_BASE = 9;
export const NODE_RADIUS_SCALE = 27;
export const NODE_RADIUS_COLLIDE_PADDING = 4.5;
