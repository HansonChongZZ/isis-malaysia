"use client"

import { useEffect, useRef, useCallback } from "react"
import * as d3 from "d3"
import type { SimNode, SimEdge, GraphEdge } from "@/lib/types"
import { CLUSTER_OFFSETS } from "@/lib/constants"

interface UseForceSimulationProps {
  nodes: SimNode[]
  edges: GraphEdge[]
  width: number
  height: number
  onTick: () => void
}

const TARGET_FPS = 60

export function useForceSimulation({ nodes, edges, width, height, onTick }: UseForceSimulationProps) {
  const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null)
  const centerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!nodes.length || !width || !height) return

    const simEdges: SimEdge[] = edges.map((e) => ({ ...e }))

    const cx = width / 2
    const cy = height / 2
    centerRef.current = { x: cx, y: cy }

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((d) => 30 + (7 - (d as SimEdge).weight) * 10)
          .strength(0.3)
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-150))
      .force("center", d3.forceCenter(cx, cy))
      .force("collide", d3.forceCollide<SimNode>((d) => 4 + d.aiExposure * 12 + 2))
      .force(
        "x",
        d3
          .forceX<SimNode>((d) => {
            const offset = CLUSTER_OFFSETS[d.group]
            return cx + (offset?.x ?? 0)
          })
          .strength(0.05)
      )
      .force(
        "y",
        d3
          .forceY<SimNode>((d) => {
            const offset = CLUSTER_OFFSETS[d.group]
            return cy + (offset?.y ?? 0)
          })
          .strength(0.05)
      )

    simulation.stop()
    const alphaMin = simulation.alphaMin()
    const maxTicks = 2000
    let ticks = 0
    while (simulation.alpha() > alphaMin && ticks < maxTicks) {
      simulation.tick()
      ticks++
    }
    onTick()

    simulationRef.current = simulation

    return () => {
      simulation.on("tick", null)
      simulation.stop()
    }
  }, [nodes, edges, width, height, onTick])

  const reheat = useCallback(() => {
    const sim = simulationRef.current
    if (!sim) return
    sim.alpha(1)
    const alphaMin = sim.alphaMin()
    const maxTicks = 2000
    let ticks = 0
    while (sim.alpha() > alphaMin && ticks < maxTicks) {
      sim.tick()
      ticks++
    }
    onTick()
  }, [onTick])

  const animateToPositions = useCallback(
    (durationMs: number) => {
      const sim = simulationRef.current
      if (!sim || durationMs <= 0) return
      const { x: cx, y: cy } = centerRef.current
      for (const node of nodes) {
        node.x = cx
        node.y = cy
        node.vx = 0
        node.vy = 0
      }
      const alphaMin = sim.alphaMin()
      const totalTicks = (durationMs / 1000) * TARGET_FPS
      sim.alphaDecay(1 - Math.pow(alphaMin, 1 / totalTicks))
      sim.on("tick", onTick)
      sim.alpha(1).restart()
    },
    [onTick, nodes]
  )

  return { simulationRef, reheat, animateToPositions }
}
