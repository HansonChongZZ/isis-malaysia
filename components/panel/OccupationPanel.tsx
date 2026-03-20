"use client"

import { useMemo, useState, useEffect } from "react"
import { XIcon } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { OccupationDetail, GraphNode, GraphEdge } from "@/lib/types"
import OccupationDetailPane from "./OccupationDetailPane"
import TransitionCards, { type TransitionRow } from "./TransitionCards"
import ComparisonGrid from "./ComparisonGrid"

interface OccupationPanelProps {
  nodeId: string | null
  detail: OccupationDetail | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  occupations: Record<string, OccupationDetail>
  isOpen: boolean
  onClose: () => void
  initialComparisonId: string | null
  onComparisonChange?: (isComparing: boolean) => void
  onCardClick?: (id: string) => void
  preventInteractOutside?: boolean
}

export default function OccupationPanel({
  nodeId,
  detail,
  nodes,
  edges,
  occupations,
  isOpen,
  onClose,
  initialComparisonId,
  onComparisonChange,
  onCardClick,
  preventInteractOutside,
}: OccupationPanelProps) {
  const [comparisonNodeId, setComparisonNodeId] = useState<string | null>(null)

  // Reset comparison when primary occupation changes or panel closes
  useEffect(() => {
    if (isOpen) {
      setComparisonNodeId(initialComparisonId)
    }
  }, [nodeId, isOpen, initialComparisonId])

  // Build transition rows (reused from previous implementation)
  const transitions = useMemo<TransitionRow[]>(() => {
    if (!nodeId || !nodes.length || !edges.length) return []
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const seen = new Set<string>()
    const rows: TransitionRow[] = []

    for (const e of edges) {
      // Directed: only follow source → target
      const otherId = e.source === nodeId ? e.target : null
      if (!otherId || seen.has(otherId)) continue
      seen.add(otherId)
      const node = nodeMap.get(otherId)
      if (!node) continue
      rows.push({
        id: otherId,
        label: node.label,
        weight: e.weight,
        aiExposure: node.aiExposure,
        quartile: node.quartile,
        wage: node.wage,
      })
    }

    return rows
  }, [nodeId, nodes, edges])

  // Primary occupation skills (for card previews)
  const primarySkills = useMemo<Set<string>>(() => {
    if (!detail) return new Set()
    return new Set(
      [...detail.basicSkills, ...detail.specificSkills].map((s) =>
        s.toLowerCase()
      )
    )
  }, [detail])

  // Comparison detail
  const comparisonDetail = comparisonNodeId
    ? occupations[comparisonNodeId] ?? null
    : null

  // Shared skills (lowercase) between primary and comparison
  const sharedSkills = useMemo<Set<string> | undefined>(() => {
    if (!detail || !comparisonDetail) return undefined

    const primarySet = new Set(
      [...detail.basicSkills, ...detail.specificSkills].map((s) =>
        s.toLowerCase()
      )
    )
    const compSet = new Set(
      [...comparisonDetail.basicSkills, ...comparisonDetail.specificSkills].map(
        (s) => s.toLowerCase()
      )
    )

    const shared = new Set<string>()
    for (const s of primarySet) {
      if (compSet.has(s)) shared.add(s)
    }
    return shared
  }, [detail, comparisonDetail])

  // Comparison deltas
  const comparisonDeltas = useMemo(() => {
    if (!detail || !comparisonDetail) return undefined
    return {
      aiExposure: comparisonDetail.aiExposure - detail.aiExposure,
      wage:
        comparisonDetail.wage !== null && detail.wage !== null
          ? comparisonDetail.wage - detail.wage
          : null,
    }
  }, [detail, comparisonDetail])

  const isComparing = comparisonNodeId !== null && comparisonDetail !== null

  useEffect(() => {
    onComparisonChange?.(isComparing)
  }, [isComparing, onComparisonChange])

  return (
    <Dialog
      open={isOpen && !!nodeId && !!detail}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="bg-card border-border text-foreground max-w-full md:max-w-6xl h-[90dvh] overflow-hidden p-0 flex flex-col gap-0"
        showCloseButton={false}
        onInteractOutside={preventInteractOutside ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={preventInteractOutside ? (e) => e.preventDefault() : undefined}
      >
        {detail && nodeId && (
          <>
            {/* Full-width sticky header */}
            <DialogHeader className="p-5 pb-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground font-mono">
                      {nodeId}
                    </span>
                  </div>
                  <DialogTitle className="text-foreground text-lg leading-tight font-semibold">
                    {detail.occupation}
                  </DialogTitle>
                </div>
                <DialogClose
                  data-tutorial-target="panel-close"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mt-0.5"
                >
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </DialogHeader>

            {/* Body — cards mode: 50/50 split, comparison mode: shared-row grid */}
            {isComparing && comparisonDetail && comparisonDeltas ? (
              <ComparisonGrid
                primary={detail}
                primaryNodeId={nodeId}
                comparison={comparisonDetail}
                comparisonNodeId={comparisonNodeId!}
                sharedSkills={sharedSkills ?? new Set()}
                comparisonDeltas={comparisonDeltas}
                onBack={() => setComparisonNodeId(null)}
              />
            ) : transitions.length === 0 ? (
              <div className="flex flex-1 min-h-0">
                <div className="w-full min-h-0 overflow-hidden">
                  <OccupationDetailPane detail={detail} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row flex-1 md:min-h-0 overflow-y-auto md:overflow-hidden">
                {/* Left pane — primary occupation details */}
                <div className="w-full md:w-1/2 md:border-r border-border md:min-h-0 md:overflow-hidden">
                  <OccupationDetailPane detail={detail} />
                </div>

                {/* Right pane — transition cards */}
                <div className="w-full md:w-1/2 flex flex-col md:min-h-0" data-tutorial-target="pathways-list">
                  <TransitionCards
                    transitions={transitions}
                    occupations={occupations}
                    primarySkills={primarySkills}
                    onCardClick={(id) => {
                      setComparisonNodeId(id)
                      onCardClick?.(id)
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
