'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const WIDTH = 340
const HEIGHT = 220
const CX = WIDTH / 2
const ROW_Y = 100

const OCCUPATIONS = [
  'Manager',
  'Engineer',
  'Technician',
  'Clerk',
  'Sales Worker',
  'Farmer',
  'Operator',
]

export default function NodeRepresentationDemo() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const g = svg.append('g')

    const spacing = 42
    const totalWidth = (OCCUPATIONS.length - 1) * spacing
    const startX = CX - totalWidth / 2

    const nodes = OCCUPATIONS.map((label, i) => ({
      label,
      x: startX + i * spacing,
      y: ROW_Y,
    }))

    // Circles
    const circles = g
      .selectAll('circle.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 0)
      .attr('fill', 'var(--node-color)')
      .attr('opacity', 0)

    circles
      .transition()
      .delay((_, i) => i * 150)
      .duration(400)
      .attr('r', 11)
      .attr('opacity', 1)

    // Labels
    const labels = g
      .selectAll('text.label')
      .data(nodes)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => d.x)
      .attr('y', d => d.y + 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text(d => d.label)

    labels
      .transition()
      .delay((_, i) => i * 150 + 200)
      .duration(300)
      .attr('opacity', 1)

    // Pulse highlight on one node after all appear
    const totalDelay = OCCUPATIONS.length * 150 + 600
    const pulseNode = nodes[1] // Engineer

    const pulseRing = g
      .append('circle')
      .attr('cx', pulseNode.x)
      .attr('cy', pulseNode.y)
      .attr('r', 11)
      .attr('fill', 'none')
      .attr('stroke', 'var(--node-color)')
      .attr('stroke-width', 2)
      .attr('opacity', 0)

    let cancelled = false

    function pulse() {
      if (cancelled) return
      pulseRing
        .attr('r', 11)
        .attr('opacity', 0.8)
        .attr('stroke-width', 2)
        .transition()
        .duration(1000)
        .attr('r', 21)
        .attr('opacity', 0)
        .attr('stroke-width', 0.5)
        .on('end', pulse)
    }

    const pulseTimer = d3.timeout(pulse, totalDelay)

    return () => {
      cancelled = true
      pulseTimer.stop()
      svg.selectAll('*').interrupt()
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: 320 }}
      role="img"
      aria-label="Animation showing occupation nodes appearing as circles"
    />
  )
}
