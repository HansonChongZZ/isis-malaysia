import { z } from "zod"

export const NodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.number().int().min(1).max(9),
  aiExposure: z.number().min(0).max(1),
  quartile: z.enum(["Low", "Medium low", "Medium high", "High"]),
  wage: z.number().nullable(),
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

export type SimNode = GraphNode & {
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export type SimEdge = {
  source: SimNode | string
  target: SimNode | string
  weight: number
}
