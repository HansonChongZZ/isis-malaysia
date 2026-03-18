'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

interface VirtualCursorProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  clickEffect?: boolean
  delayMs?: number
  lingerMs?: number
  onArrive: () => void
  onComplete: () => void
}

// macOS-style pointer cursor as inline SVG
function CursorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 3l14 8.5-6.5 1.5-3 6L5 3z"
        fill="white"
        stroke="black"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function VirtualCursor({
  from,
  to,
  clickEffect = false,
  delayMs = 800,
  lingerMs = 2200,
  onArrive,
  onComplete,
}: VirtualCursorProps) {
  const [phase, setPhase] = useState<'waiting' | 'fadeIn' | 'moving' | 'lingering' | 'fadeOut'>('waiting')
  const [mounted, setMounted] = useState(false)
  const hasFiredRef = useRef(false)
  const [clickActive, setClickActive] = useState(false)

  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const innerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Phase state machine — loops: fadeOut → waiting → fadeIn → moving → lingering → fadeOut → ...
  useEffect(() => {
    if (!mounted) return

    if (prefersReducedMotion) {
      const timer = setTimeout(() => {
        onArrive()
        innerTimerRef.current = setTimeout(() => {
          onComplete()
        }, lingerMs)
      }, delayMs)
      return () => {
        clearTimeout(timer)
        if (innerTimerRef.current) clearTimeout(innerTimerRef.current)
      }
    }

    if (phase === 'waiting') {
      const delay = hasFiredRef.current ? 600 : delayMs
      const timer = setTimeout(() => setPhase('fadeIn'), delay)
      return () => clearTimeout(timer)
    }
    if (phase === 'fadeIn') {
      const timer = setTimeout(() => setPhase('moving'), 350)
      return () => clearTimeout(timer)
    }
    // 'moving' → 'lingering' is driven by a generous timer that overshoots
    // the spring duration to ensure visual settlement before phase change
    if (phase === 'moving') {
      const timer = setTimeout(() => setPhase('lingering'), 1200)
      return () => clearTimeout(timer)
    }
    if (phase === 'lingering') {
      if (!hasFiredRef.current) {
        onArrive()
      }
      const timer = setTimeout(() => {
        setClickActive(false)
        setPhase('fadeOut')
      }, lingerMs)
      return () => clearTimeout(timer)
    }
    if (phase === 'fadeOut') {
      const timer = setTimeout(() => {
        if (!hasFiredRef.current) {
          hasFiredRef.current = true
          onComplete()
        }
        setPhase('waiting')
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [phase, mounted, delayMs, lingerMs, prefersReducedMotion, onArrive, onComplete])

  // Track whether cursor has reached near the target
  const nearTargetRef = useRef(false)

  // Only activate click animation once cursor is in lingering phase AND near target
  useEffect(() => {
    if (clickEffect && phase === 'lingering' && nearTargetRef.current) {
      setClickActive(true)
    } else {
      setClickActive(false)
    }
    if (phase === 'waiting' || phase === 'fadeIn') {
      nearTargetRef.current = false
    }
  }, [clickEffect, phase])

  if (!mounted || phase === 'waiting' || prefersReducedMotion) return null

  const opacity = phase === 'fadeIn' || phase === 'moving' || phase === 'lingering' ? 1 : 0
  const targetPos = phase === 'fadeIn' ? from : to

  const cursor = (
    <motion.div
      style={{
        position: 'fixed',
        zIndex: 60,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))',
      }}
      initial={{ x: from.x, y: from.y, opacity: 0 }}
      animate={{
        x: targetPos.x,
        y: targetPos.y,
        opacity,
      }}
      transition={
        phase === 'moving'
          ? { x: { type: 'spring', damping: 30, stiffness: 60 }, y: { type: 'spring', damping: 30, stiffness: 60 }, opacity: { duration: 0.35 } }
          : { opacity: { duration: phase === 'fadeOut' ? 0.4 : 0.35 }, x: { duration: 0 }, y: { duration: 0 } }
      }
      onUpdate={(latest) => {
        if (phase === 'moving' && clickEffect && !nearTargetRef.current) {
          const dx = (latest.x as number) - to.x
          const dy = (latest.y as number) - to.y
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
            nearTargetRef.current = true
          }
        }
      }}
    >
      {/* Click scale is a separate element with CSS animation —
          completely decoupled from the position spring */}
      <div
        style={{
          transformOrigin: 'top left',
          animation: clickActive ? 'cursorClick 0.5s ease-in-out infinite' : 'none',
        }}
      >
        <CursorIcon />
      </div>
      <style>{`
        @keyframes cursorClick {
          0%, 100% { transform: scale(1); }
          40% { transform: scale(0.7); }
        }
      `}</style>
    </motion.div>
  )

  return createPortal(cursor, document.body)
}
