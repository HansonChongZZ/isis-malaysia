'use client'

import { useState, useEffect } from 'react'
import { type SpotlightTarget } from './tutorialConfig'

interface TutorialOverlayProps {
  isActive: boolean
  currentStep: number
  totalSteps: number
  isConfirming: boolean
  prompt: string
  spotlight: SpotlightTarget | null
  onAdvance: () => void
  onSkip: () => void
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
}: TutorialOverlayProps) {
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const tooltipStyle = computeTooltipPosition(spotlight, viewport.w, viewport.h)

  return (
    <div
      className="fixed inset-0 z-50 transition-opacity duration-300"
      style={{
        pointerEvents: 'none',
        opacity: isActive ? 1 : 0,
      }}
    >
      {/* SVG dim layer with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="spotlight-blur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              spotlight.shape === 'circle' ? (
                <circle
                  cx={spotlight.x}
                  cy={spotlight.y}
                  r={spotlight.width / 2}
                  fill="black"
                  filter="url(#spotlight-blur)"
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
                  filter="url(#spotlight-blur)"
                  className="transition-all duration-300 ease-out"
                />
              )
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
        />
      </svg>

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
            {(currentStep === 0 || isConfirming) && (
              <button
                onClick={onAdvance}
                className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
              >
                {currentStep === 0 ? 'Next \u2192' : 'Got it, next \u2192'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function computeTooltipPosition(
  spotlight: SpotlightTarget | null,
  vw: number,
  vh: number,
): React.CSSProperties {
  if (!spotlight || vw === 0) {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  }

  const pad = 20
  const style: React.CSSProperties = {}

  if (spotlight.x < vw / 2) {
    style.left = spotlight.x + spotlight.width / 2 + pad
  } else {
    style.right = vw - spotlight.x + spotlight.width / 2 + pad
  }

  if (spotlight.y < vh / 2) {
    style.top = spotlight.y + spotlight.height / 2 + pad
  } else {
    style.bottom = vh - spotlight.y + spotlight.height / 2 + pad
  }

  return style
}
