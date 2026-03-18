import type { ComponentType } from 'react'

export interface ModalStep {
  title: string
  description: string
  component: ComponentType
}

// Shared sample data used across demo animations
export const SAMPLE_NODES = [
  { id: '1', label: 'Manager', aiExposure: 0.45 },
  { id: '2', label: 'Engineer', aiExposure: 0.72 },
  { id: '3', label: 'Technician', aiExposure: 0.58 },
  { id: '4', label: 'Clerk', aiExposure: 0.85 },
  { id: '5', label: 'Sales Worker', aiExposure: 0.35 },
  { id: '6', label: 'Farmer', aiExposure: 0.15 },
  { id: '7', label: 'Operator', aiExposure: 0.62 },
] as const
