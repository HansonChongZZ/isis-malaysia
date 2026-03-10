import { z } from "zod"

export const NodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.number().int().min(1).max(9),
  aiExposure: z.number().min(0).max(1),
  quartile: z.enum(["Low", "Medium low", "Medium high", "High"]),
  wage: z.number().nullable(),
  workers: z.number().nullable(),
  x: z.number(),
  y: z.number(),
})

export const EdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  weight: z.number().int().min(1).max(7),
})

export const OccupationDetailSchema = z.object({
  occupation: z.string(),
  aiExposure: z.number(),
  quartile: z.enum(["Low", "Medium low", "Medium high", "High"]),
  wage: z.number().nullable(),
  basicSkills: z.array(z.string()),
  specificSkills: z.array(z.string()),
  tasks: z.array(z.object({ description: z.string(), score: z.number() })),
})

export type GraphNode = z.infer<typeof NodeSchema>
export type GraphEdge = z.infer<typeof EdgeSchema>
export type OccupationDetail = z.infer<typeof OccupationDetailSchema>

export type NodeSizeMetric = 'aiExposure' | 'wage' | 'workers'

export interface TunerSizingParams {
  base: number;
  scale: number;
  exponent: number;
}

export interface TunerLayoutParams {
  collidePadding: number;
  charge: number;
  linkDistanceBase: number;
  linkDistanceScale: number;
}
