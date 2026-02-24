import { z } from "zod"
import { NodeSchema, EdgeSchema, OccupationDetailSchema, type GraphNode, type GraphEdge, type OccupationDetail } from "./types"

export async function loadNodes(): Promise<GraphNode[]> {
  const res = await fetch("/data/nodes.json")
  if (!res.ok) throw new Error("Failed to load nodes.json")
  const raw = await res.json()
  return z.array(NodeSchema).parse(raw)
}

export async function loadEdges(): Promise<GraphEdge[]> {
  const res = await fetch("/data/edges.json")
  if (!res.ok) throw new Error("Failed to load edges.json")
  const raw = await res.json()
  return z.array(EdgeSchema).parse(raw)
}

export async function loadOccupations(): Promise<Record<string, OccupationDetail>> {
  const res = await fetch("/data/occupations.json")
  if (!res.ok) throw new Error("Failed to load occupations.json")
  const raw = await res.json()
  return z.record(z.string(), OccupationDetailSchema).parse(raw)
}
