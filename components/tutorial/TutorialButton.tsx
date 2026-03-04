"use client"

import { useEffect, useState } from "react"
import { CircleHelp } from "lucide-react"
import TutorialModal from "./TutorialModal"

const STORAGE_KEY = "isis-tutorial-seen"

export default function TutorialButton() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Auto-open on first visit
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      const timer = setTimeout(() => {
        setOpen(true)
        localStorage.setItem(STORAGE_KEY, "1")
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <span
        className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground shrink-0"
        aria-hidden
      >
        <CircleHelp size={16} />
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Learn how to use this visualization"
        className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
      >
        <CircleHelp size={16} />
      </button>
      <TutorialModal open={open} onOpenChange={setOpen} />
    </>
  )
}
