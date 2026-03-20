'use client'

import { useState, useEffect, useId, useRef } from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import confetti from 'canvas-confetti'
import { type SpotlightTarget } from './tutorialConfig'

const VirtualCursor = dynamic(() => import('./VirtualCursor'), { ssr: false })

interface TutorialOverlayProps {
  isActive: boolean
  currentStepIndex: number
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
  /** Resolved tooltip position from anchor system — takes priority over spotlight-based positioning */
  tooltipPosition?: { left: number; top: number } | null
}

export default function TutorialOverlay({
  isActive,
  currentStepIndex,
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
  tooltipPosition,
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

  // Use anchor-based position if provided, otherwise compute from spotlight
  const tooltipStyle = tooltipPosition
    ? tooltipPosition
    : computeTooltipPosition(spotlight, viewport.w, viewport.h)

  // Fire confetti from bottom-left on the final step
  const confettiFired = useRef(false)
  useEffect(() => {
    if (isLastStep && isConfirming && !confettiFired.current) {
      confettiFired.current = true
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.1, y: 1 },
        angle: 60,
        startVelocity: 45,
        gravity: 0.8,
        ticks: 200,
      })
    }
    if (!isLastStep) {
      confettiFired.current = false
    }
  }, [isLastStep, isConfirming])

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

      {/* Tooltip with spring animation */}
      <motion.div
        className="absolute"
        animate={tooltipStyle}
        transition={{
          type: 'spring',
          damping: 25,
          stiffness: 200,
        }}
        style={{
          pointerEvents: 'auto',
        }}
      >
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 max-w-[280px]">
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-3">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStepIndex ? 'bg-primary' : 'bg-muted-foreground/30'
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
      </motion.div>

      {cursorAnimProps && onCursorArrive && onCursorComplete && (
        <VirtualCursor
          key={currentStepIndex}
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

/**
 * Compute tooltip position from spotlight. Always returns { left, top }
 * for consistent spring animation interpolation.
 */
function computeTooltipPosition(
  spotlight: SpotlightTarget | null,
  vw: number,
  vh: number,
): { left: number; top: number } {
  const tooltipWidth = 300
  const tooltipHeight = 160

  if (!spotlight || vw === 0) {
    return { left: 16, top: Math.max(16, vh - tooltipHeight - 16) }
  }

  const pad = 16
  const rx = spotlight.shape === 'circle' ? spotlight.width / 2 : spotlight.width / 2
  const ry = spotlight.shape === 'circle' ? spotlight.width / 2 : spotlight.height / 2

  const spaceRight = vw - (spotlight.x + rx)
  const spaceLeft = spotlight.x - rx
  const spaceBottom = vh - (spotlight.y + ry)

  let left: number
  let top: number

  // Horizontal placement
  if (spaceRight >= tooltipWidth + pad) {
    left = spotlight.x + rx + pad
  } else if (spaceLeft >= tooltipWidth + pad) {
    left = spotlight.x - rx - pad - tooltipWidth
  } else {
    left = Math.max(pad, Math.min(spotlight.x - tooltipWidth / 2, vw - tooltipWidth - pad))
  }

  // Vertical placement
  const isHorizontal = spaceRight >= tooltipWidth + pad || spaceLeft >= tooltipWidth + pad
  if (isHorizontal) {
    const centredTop = spotlight.y - tooltipHeight / 2
    top = Math.max(pad, Math.min(centredTop, vh - tooltipHeight - pad))
  } else if (spaceBottom >= tooltipHeight + pad) {
    top = spotlight.y + ry + pad
  } else {
    top = Math.max(pad, spotlight.y - ry - pad - tooltipHeight)
  }

  return { left, top }
}
