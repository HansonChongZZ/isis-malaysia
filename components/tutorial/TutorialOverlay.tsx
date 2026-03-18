'use client'

import { useState, useEffect, useId } from 'react'
import dynamic from 'next/dynamic'
import { type SpotlightTarget } from './tutorialConfig'

const VirtualCursor = dynamic(() => import('./VirtualCursor'), { ssr: false })

interface TutorialOverlayProps {
  isActive: boolean
  currentStep: number
  totalSteps: number
  isConfirming: boolean
  prompt: string
  spotlight: SpotlightTarget | null
  onAdvance: () => void
  onSkip: () => void
  cursorAnimProps?: { from: { x: number; y: number }; to: { x: number; y: number }; clickEffect?: boolean; delayMs?: number; lingerMs?: number } | null
  onCursorArrive?: () => void
  onCursorComplete?: () => void
  isLastStep?: boolean
}

export default function TutorialOverlay({
  isActive,
  currentStep,
  totalSteps,
  isConfirming,
  prompt,
  spotlight,
  onAdvance,
  onSkip,
  cursorAnimProps,
  onCursorArrive,
  onCursorComplete,
  isLastStep,
}: TutorialOverlayProps) {
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const id = useId()
  const maskId = `spotlight-mask-${id}`
  const filterId = `spotlight-blur-${id}`
  const tooltipStyle = computeTooltipPosition(spotlight, viewport.w, viewport.h)

  return (
    <div
      className="fixed inset-0 z-[60] transition-opacity duration-300"
      style={{
        pointerEvents: 'none',
        opacity: isActive ? 1 : 0,
      }}
    >
      {/* SVG dim layer with spotlight cutout — hidden when no spotlight */}
      {spotlight && (
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <filter id={filterId}>
              <feGaussianBlur stdDeviation="8" />
            </filter>
            <mask id={maskId}>
              <rect width="100%" height="100%" fill="white" />
              {spotlight.shape === 'circle' ? (
                <circle
                  cx={spotlight.x}
                  cy={spotlight.y}
                  r={spotlight.width / 2}
                  fill="black"
                  filter={`url(#${filterId})`}
                  className="transition-all duration-300 ease-out"
                />
              ) : (
                <rect
                  x={spotlight.x - spotlight.width / 2}
                  y={spotlight.y - spotlight.height / 2}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx={12}
                  fill="black"
                  filter={`url(#${filterId})`}
                  className="transition-all duration-300 ease-out"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.6)"
            mask={`url(#${maskId})`}
          />
        </svg>
      )}

      {/* Tooltip */}
      <div
        className="absolute transition-all duration-300 ease-out"
        style={{
          ...tooltipStyle,
          pointerEvents: 'auto',
          transitionDelay: '50ms',
        }}
      >
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 max-w-[280px]">
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-3">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Step text */}
          <p className="text-sm text-foreground leading-relaxed mb-4">
            {prompt}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tutorial
            </button>
            {isConfirming && (
              <button
                onClick={onAdvance}
                className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
              >
                {isLastStep ? 'Finish' : 'Got it, next \u2192'}
              </button>
            )}
          </div>
        </div>
      </div>

      {cursorAnimProps && onCursorArrive && onCursorComplete && (
        <VirtualCursor
          key={currentStep}
          from={cursorAnimProps.from}
          to={cursorAnimProps.to}
          clickEffect={cursorAnimProps.clickEffect}
          delayMs={cursorAnimProps.delayMs}
          lingerMs={cursorAnimProps.lingerMs}
          onArrive={onCursorArrive}
          onComplete={onCursorComplete}
        />
      )}
    </div>
  )
}

function computeTooltipPosition(
  spotlight: SpotlightTarget | null,
  vw: number,
  vh: number,
): React.CSSProperties {
  if (!spotlight || vw === 0) {
    return { left: 16, bottom: 16 }
  }

  const pad = 16
  const tooltipWidth = 300
  const tooltipHeight = 160
  // For circles, use radius. For rects, use half-dimensions so tooltip clears the edges.
  const rx = spotlight.shape === 'circle' ? spotlight.width / 2 : spotlight.width / 2
  const ry = spotlight.shape === 'circle' ? spotlight.width / 2 : spotlight.height / 2

  // Find which side of the spotlight has the most space
  const spaceRight = vw - (spotlight.x + rx)
  const spaceLeft = spotlight.x - rx
  const spaceBottom = vh - (spotlight.y + ry)
  const style: React.CSSProperties = {}

  // Horizontal: place on the side with more room
  if (spaceRight >= tooltipWidth + pad) {
    // Right of spotlight edge
    style.left = spotlight.x + rx + pad
  } else if (spaceLeft >= tooltipWidth + pad) {
    // Left of spotlight edge
    style.right = vw - (spotlight.x - rx - pad)
  } else {
    // Not enough horizontal space — centre horizontally, will go above/below
    style.left = Math.max(pad, Math.min(spotlight.x - tooltipWidth / 2, vw - tooltipWidth - pad))
  }

  // Vertical: centre on spotlight, clamped to viewport
  if (style.left !== undefined || style.right !== undefined) {
    // Tooltip is beside the spotlight — vertically centre on spotlight
    const centredTop = spotlight.y - tooltipHeight / 2
    style.top = Math.max(pad, Math.min(centredTop, vh - tooltipHeight - pad))
  } else if (spaceBottom >= tooltipHeight + pad) {
    style.top = spotlight.y + ry + pad
  } else {
    style.bottom = vh - (spotlight.y - ry - pad)
  }

  return style
}
