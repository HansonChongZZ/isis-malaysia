"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { SAMPLE_NODES, SAMPLE_EDGES } from "../tutorialSteps"

const WIDTH = 300
const HEIGHT = 200

// Static cluster positions
const POSITIONS = [
  { x: 90, y: 70 },
  { x: 140, y: 55 },
  { x: 190, y: 65 },
  { x: 210, y: 115 },
  { x: 160, y: 135 },
  { x: 80, y: 140 },
  { x: 100, y: 110 },
]

const HOVER_TARGET = 1 // Engineer (index 1)

export default function HoverBehaviorDemo() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const g = svg.append("g")

    const nodes = SAMPLE_NODES.map((n, i) => ({
      ...n,
      ...POSITIONS[i],
    }))

    // Find connected nodes for the hover target
    const targetNode = nodes[HOVER_TARGET]
    const connectedIds = new Set<string>()
    SAMPLE_EDGES.forEach((e) => {
      if (e.source === targetNode.id) connectedIds.add(e.target)
      if (e.target === targetNode.id) connectedIds.add(e.source)
    })

    // Draw edges
    const edges = g
      .selectAll("line")
      .data(SAMPLE_EDGES)
      .enter()
      .append("line")
      .attr("x1", (d) => nodes.find((n) => n.id === d.source)!.x)
      .attr("y1", (d) => nodes.find((n) => n.id === d.source)!.y)
      .attr("x2", (d) => nodes.find((n) => n.id === d.target)!.x)
      .attr("y2", (d) => nodes.find((n) => n.id === d.target)!.y)
      .attr("stroke", "var(--muted-foreground)")
      .attr("stroke-width", 1)
      .attr("opacity", 0.3)

    // Draw circles
    const circles = g
      .selectAll("circle.node")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 10)
      .attr("fill", 'var(--node-color)')
      .attr("stroke", "none")
      .attr("stroke-width", 2)

    // Animated cursor
    const cursor = g.append("g").attr("transform", `translate(40, 170)`).attr("opacity", 0.8)

    cursor
      .append("circle")
      .attr("r", 4)
      .attr("fill", "var(--foreground)")
      .attr("opacity", 0.7)

    cursor
      .append("line")
      .attr("x1", 0)
      .attr("y1", -7)
      .attr("x2", 0)
      .attr("y2", 7)
      .attr("stroke", "var(--foreground)")
      .attr("stroke-width", 1)
      .attr("opacity", 0.5)

    cursor
      .append("line")
      .attr("x1", -7)
      .attr("y1", 0)
      .attr("x2", 7)
      .attr("y2", 0)
      .attr("stroke", "var(--foreground)")
      .attr("stroke-width", 1)
      .attr("opacity", 0.5)

    // Tooltip (hidden initially)
    const tooltip = g.append("g").attr("opacity", 0)

    tooltip
      .append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("width", 130)
      .attr("height", 32)
      .attr("fill", "var(--popover)")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1)

    tooltip
      .append("text")
      .attr("x", 8)
      .attr("y", 13)
      .attr("font-size", 8)
      .attr("font-weight", 600)
      .attr("fill", "var(--foreground)")
      .text("Engineer")

    tooltip
      .append("text")
      .attr("x", 8)
      .attr("y", 25)
      .attr("font-size", 7)
      .attr("fill", "var(--muted-foreground)")
      .text("AI Exposure: 72%")

    tooltip.attr(
      "transform",
      `translate(${targetNode.x - 15}, ${targetNode.y - 46})`
    )

    let cancelled = false
    let timer: d3.Timer | null = null

    function runCycle() {
      if (cancelled) return

      // Reset state
      cursor.attr("transform", `translate(40, 170)`).attr("opacity", 0.8)
      circles.attr("opacity", 1).attr("stroke", "none")
      edges.attr("opacity", 0.3).attr("stroke-width", 1)
      tooltip.attr("opacity", 0)

      // Phase 1: Cursor glides to target
      timer = d3.timeout(() => {
        if (cancelled) return
        cursor
          .transition()
          .duration(1000)
          .ease(d3.easeCubicInOut)
          .attr("transform", `translate(${targetNode.x}, ${targetNode.y})`)
          .on("end", () => {
            if (cancelled) return
            // Phase 2: Hover effect
            circles
              .transition()
              .duration(300)
              .attr("opacity", (d) =>
                d.id === targetNode.id || connectedIds.has(d.id) ? 1 : 0.15
              )
              .attr("stroke", (d) =>
                d.id === targetNode.id ? "var(--foreground)" : "none"
              )

            edges
              .transition()
              .duration(300)
              .attr("opacity", (d) =>
                d.source === targetNode.id || d.target === targetNode.id ? 0.6 : 0.05
              )
              .attr("stroke-width", (d) =>
                d.source === targetNode.id || d.target === targetNode.id ? 1.5 : 1
              )

            tooltip.transition().duration(300).attr("opacity", 1)
          })
      }, 500)

      // Phase 3: Cursor moves away, everything resets
      d3.timeout(() => {
        if (cancelled) return
        cursor
          .transition()
          .duration(800)
          .ease(d3.easeCubicInOut)
          .attr("transform", `translate(260, 180)`)

        circles.transition().delay(200).duration(300).attr("opacity", 1).attr("stroke", "none")
        edges.transition().delay(200).duration(300).attr("opacity", 0.3).attr("stroke-width", 1)
        tooltip.transition().duration(200).attr("opacity", 0)
      }, 3500)

      // Restart cycle
      d3.timeout(() => {
        if (!cancelled) runCycle()
      }, 5000)
    }

    runCycle()

    return () => {
      cancelled = true
      if (timer) timer.stop()
      svg.selectAll("*").interrupt()
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: 320 }}
      role="img"
      aria-label="Animation showing hover interaction revealing node details and connections"
    />
  )
}
