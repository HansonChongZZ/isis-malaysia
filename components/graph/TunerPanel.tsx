'use client';

import { useState, useCallback } from 'react';
import type { GraphNode, GraphEdge, TunerSizingParams } from '@/lib/types';
import {
  NODE_RADIUS_BASE,
  NODE_RADIUS_SCALE,
  NODE_RADIUS_EXPONENT,
} from '@/lib/constants';

interface TunerPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSizingChange: (params: TunerSizingParams) => void;
  colorByGroup: boolean;
  onColorByGroupChange: (value: boolean) => void;
}

const DEFAULTS = {
  base: NODE_RADIUS_BASE,
  scale: NODE_RADIUS_SCALE,
  exponent: NODE_RADIUS_EXPONENT,
};

const SLIDER_CONFIG = [
  {
    key: 'base',
    label: 'Base Radius',
    min: 2,
    max: 2000,
    step: 1,
    group: 'sizing',
  },
  {
    key: 'scale',
    label: 'Scale',
    min: 10,
    max: 2000,
    step: 1,
    group: 'sizing',
  },
  {
    key: 'exponent',
    label: 'Exponent',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    group: 'sizing',
  },
] as const;

type ParamKey = (typeof SLIDER_CONFIG)[number]['key'];

export default function TunerPanel({
  nodes,
  edges,
  onSizingChange,
  colorByGroup,
  onColorByGroupChange,
}: TunerPanelProps) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<Record<ParamKey, number>>({
    ...DEFAULTS,
  });
  const [copied, setCopied] = useState(false);

  const handleChange = useCallback(
    (key: ParamKey, value: number) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        onSizingChange({
          base: next.base,
          scale: next.scale,
          exponent: next.exponent,
        });
        return next;
      });
    },
    [onSizingChange],
  );

  const handleCopyConstants = useCallback(() => {
    const text = [
      `export const NODE_RADIUS_BASE = ${params.base};`,
      `export const NODE_RADIUS_SCALE = ${params.scale};`,
      `export const NODE_RADIUS_EXPONENT = ${params.exponent};`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [params]);

  // Suppress unused variable warnings — nodes and edges may be needed by future tuner features
  void nodes;
  void edges;

  return (
    <div className="absolute bottom-0 right-0 z-30">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-popover text-popover-foreground border border-border shadow-md flex items-center justify-center text-sm hover:bg-accent transition-colors"
        title="Toggle tuner panel"
      >
        {open ? '\u2715' : '\u2699'}
      </button>

      {/* Drawer */}
      {open && (
        <div className="w-72 max-h-[70vh] overflow-y-auto bg-popover text-popover-foreground border border-border rounded-tl-lg shadow-xl p-3 text-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">Node Tuner</span>
          </div>

          {/* Sizing section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Node Sizing
            </div>
            {SLIDER_CONFIG.filter((s) => s.group === 'sizing').map((cfg) => (
              <label key={cfg.key} className="block mb-2">
                <div className="flex justify-between mb-0.5">
                  <span>{cfg.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {params[cfg.key]}
                  </span>
                </div>
                <input
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={params[cfg.key]}
                  onChange={(e) =>
                    handleChange(cfg.key, parseFloat(e.target.value))
                  }
                  className="w-full accent-foreground"
                />
              </label>
            ))}
          </div>

          {/* Debug section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Debug
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={colorByGroup}
                onChange={(e) => onColorByGroupChange(e.target.checked)}
                className="accent-foreground"
              />
              <span>Color by MASCO group</span>
            </label>
          </div>

          {/* Export section */}
          <div className="flex gap-2">
            <button
              onClick={handleCopyConstants}
              className="flex-1 py-1.5 rounded bg-accent text-accent-foreground text-xs font-medium hover:opacity-80 transition-opacity"
            >
              {copied ? 'Copied!' : 'Copy Constants'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
