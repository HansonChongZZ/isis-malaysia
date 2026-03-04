import type { ComponentType } from "react"

export interface TutorialStep {
  title: string
  description: string
  component: ComponentType
}

// Shared sample data used across demo animations
export const SAMPLE_NODES = [
  { id: "1", label: "Manager", group: 1, aiExposure: 0.45 },
  { id: "2", label: "Engineer", group: 2, aiExposure: 0.72 },
  { id: "3", label: "Technician", group: 3, aiExposure: 0.58 },
  { id: "4", label: "Clerk", group: 4, aiExposure: 0.85 },
  { id: "5", label: "Sales Worker", group: 5, aiExposure: 0.35 },
  { id: "6", label: "Farmer", group: 6, aiExposure: 0.15 },
  { id: "7", label: "Operator", group: 8, aiExposure: 0.62 },
] as const

export const SAMPLE_EDGES = [
  { source: "1", target: "2" },
  { source: "2", target: "3" },
  { source: "4", target: "5" },
  { source: "6", target: "7" },
] as const
