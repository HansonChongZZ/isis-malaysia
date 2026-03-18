'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { SAMPLE_NODES } from '../tutorialSteps'

const WIDTH = 340
const HEIGHT = 220
const CX = WIDTH / 2
const ROW_Y = 105

const UNIFORM_R = 10
const MIN_R = 5
const MAX_R = 25

function scaledRadius(value: number) {
  return MIN_R + value * (MAX_R - MIN_R)
}

// Sort by AI exposure so the row goes small → large
const SORTED_INDICES = SAMPLE_NODES.map((_, i) => i).sort(
  (a, b) => SAMPLE_NODES[a].aiExposure - SAMPLE_NODES[b].aiExposure
)

export default function NodeSizingDemo() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const g = svg.append('g')

    const spacing = 42
    const totalWidth = (SORTED_INDICES.length - 1) * spacing
    const startX = CX - totalWidth / 2

    const nodes = SORTED_INDICES.map((origIdx, sortPos) => ({
      ...SAMPLE_NODES[origIdx],
      x: startX + sortPos * spacing,
      y: ROW_Y,
    }))

    // Draw circles at uniform size
    const circles = g
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', UNIFORM_R)
      .attr('fill', 'var(--node-color)')

    // Scale axis line
    const axisLine = g
      .append('line')
      .attr('x1', nodes[0].x)
      .attr('y1', ROW_Y + 32)
      .attr('x2', nodes[nodes.length - 1].x)
      .attr('y2', ROW_Y + 32)
      .attr('stroke', 'var(--muted-foreground)')
      .attr('stroke-width', 1)
      .attr('opacity', 0)

    // "Low" label
    const lowLabel = g
      .append('text')
      .attr('x', nodes[0].x)
      .attr('y', ROW_Y + 44)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text('Low')

    // "High" label
    const highLabel = g
      .append('text')
      .attr('x', nodes[nodes.length - 1].x)
      .attr('y', ROW_Y + 44)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('fill', 'var(--muted-foreground)')
      .attr('opacity', 0)
      .text('High')

    // Mode label at top
    const modeLabel = g
      .append('text')
      .attr('x', CX)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', 'var(--foreground)')
      .attr('opacity', 0)
      .text('Sized by: AI Exposure')

    let cancelled = false

    const t1 = d3.timeout(() => {
      if (cancelled) return
      circles
        .transition()
        .duration(800)
        .attr('r', d => scaledRadius(d.aiExposure))

      modeLabel.transition().delay(200).duration(300).attr('opacity', 1)
      axisLine.transition().delay(500).duration(400).attr('opacity', 0.3)
      lowLabel.transition().delay(600).duration(300).attr('opacity', 1)
      highLabel.transition().delay(600).duration(300).attr('opacity', 1)
    }, 400)

    return () => {
      cancelled = true
      t1.stop()
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
      aria-label="Animation showing nodes sized by AI exposure"
    />
  )
}
