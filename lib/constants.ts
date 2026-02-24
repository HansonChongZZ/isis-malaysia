export const MASCO_GROUPS: Record<number, { label: string; color: string }> = {
  1: { label: "Managers", color: "#4E79A7" },
  2: { label: "Professionals", color: "#F28E2B" },
  3: { label: "Technicians", color: "#E15759" },
  4: { label: "Clerical", color: "#76B7B2" },
  5: { label: "Services & Sales", color: "#59A14F" },
  6: { label: "Skilled Agricultural", color: "#EDC948" },
  7: { label: "Craft & Trades", color: "#B07AA1" },
  8: { label: "Plant & Machine Operators", color: "#FF9DA7" },
  9: { label: "Elementary", color: "#9C755F" },
}

// Cluster center offsets (relative to canvas center) for MASCO groups
// These guide the forceX/Y to produce cluster organization
export const CLUSTER_OFFSETS: Record<number, { x: number; y: number }> = {
  1: { x: -300, y: -200 },
  2: { x: 0, y: -280 },
  3: { x: 300, y: -200 },
  4: { x: 350, y: 50 },
  5: { x: 200, y: 280 },
  6: { x: 0, y: 320 },
  7: { x: -200, y: 280 },
  8: { x: -350, y: 50 },
  9: { x: -150, y: -50 },
}

export const QUARTILE_LABELS: Record<string, string> = {
  "Medium low": "Medium Low",
  "Medium high": "Medium High",
  High: "High",
}

export const QUARTILE_COLORS: Record<string, string> = {
  "Medium low": "#E15759",
  "Medium high": "#F28E2B",
  High: "#59A14F",
}
