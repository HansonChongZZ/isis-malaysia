'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

interface VirtualCursorProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
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
  delayMs = 600,
  lingerMs = 1000,
  onArrive,
  onComplete,
}: VirtualCursorProps) {
  const [phase, setPhase] = useState<'waiting' | 'fadeIn' | 'moving' | 'lingering' | 'fadeOut' | 'done'>('waiting')
  const [mounted, setMounted] = useState(false)

  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const innerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Phase state machine
  useEffect(() => {
    if (!mounted) return

    if (prefersReducedMotion) {
      // Skip animation: go straight to arrive → linger → complete
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
      const timer = setTimeout(() => setPhase('fadeIn'), delayMs)
      return () => clearTimeout(timer)
    }
    if (phase === 'fadeIn') {
      // Fade-in duration: 200ms, then start moving
      const timer = setTimeout(() => setPhase('moving'), 200)
      return () => clearTimeout(timer)
    }
    // 'moving' phase is handled by onAnimationComplete on the motion.div
    if (phase === 'lingering') {
      onArrive()
      const timer = setTimeout(() => setPhase('fadeOut'), lingerMs)
      return () => clearTimeout(timer)
    }
    if (phase === 'fadeOut') {
      const timer = setTimeout(() => {
        setPhase('done')
        onComplete()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [phase, mounted, delayMs, lingerMs, prefersReducedMotion, onArrive, onComplete])

  if (!mounted || phase === 'done' || phase === 'waiting' || prefersReducedMotion) return null

  const opacity = phase === 'fadeIn' || phase === 'moving' || phase === 'lingering' ? 1 : 0

  // Position: during fadeIn use `from`, during moving/lingering/fadeOut animate to `to`
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
          ? { x: { type: 'spring', damping: 25, stiffness: 120 }, y: { type: 'spring', damping: 25, stiffness: 120 }, opacity: { duration: 0.2 } }
          : { opacity: { duration: phase === 'fadeOut' ? 0.3 : 0.2 }, x: { duration: 0 }, y: { duration: 0 } }
      }
      onAnimationComplete={() => {
        if (phase === 'moving') {
          setPhase('lingering')
        }
      }}
    >
      <CursorIcon />
    </motion.div>
  )

  return createPortal(cursor, document.body)
}
