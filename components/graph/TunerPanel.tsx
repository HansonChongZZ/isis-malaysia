'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import type {
  GraphNode,
  GraphEdge,
  TunerSizingParams,
  ViewMode,
  CircularLayoutParams,
  ForceLayoutParams,
} from '@/lib/types';
import {
  NODE_RADIUS_BASE,
  NODE_RADIUS_SCALE,
  NODE_RADIUS_EXPONENT,
  NODE_RADIUS_COLLIDE_PADDING,
} from '@/lib/constants';

interface TunerPanelProps {
  viewMode: ViewMode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mstEdges: GraphEdge[];
  onSizingChange: (params: TunerSizingParams) => void;
  onPositionsChange: (positions: Map<string, { x: number; y: number }>) => void;
  onCircularLayoutChange: (params: CircularLayoutParams) => void;
  onForceLayoutChange: (params: ForceLayoutParams) => void;
  showMstEdges: boolean;
  onShowMstEdgesChange: (value: boolean) => void;
  initialSizing?: TunerSizingParams;
  initialCircularLayout?: CircularLayoutParams;
  initialForceLayout?: ForceLayoutParams;
}

const SIZING_DEFAULTS = {
  base: NODE_RADIUS_BASE,
  scale: NODE_RADIUS_SCALE,
  exponent: NODE_RADIUS_EXPONENT,
};

const FORCE_DEFAULTS: ForceLayoutParams = {
  collidePadding: NODE_RADIUS_COLLIDE_PADDING,
  charge: -800,
  linkDistanceBase: 600,
  linkDistanceScale: 20,
  linkStrengthDivisor: 7,
};

const CIRCULAR_DEFAULTS: CircularLayoutParams = {
  ringRadiusFactor: 0.12,
  nodeSpacing: 0,
  radialMinDistance: 200,
  radialMaxDistance: 2400,
};

const SIZING_SLIDERS = [
  { key: 'base' as const, label: 'Base Radius', min: 2, max: 2000, step: 1 },
  { key: 'scale' as const, label: 'Scale', min: 10, max: 2000, step: 1 },
  { key: 'exponent' as const, label: 'Exponent', min: 0.5, max: 3.0, step: 0.1 },
];

const FORCE_SLIDERS = [
  { key: 'collidePadding' as const, label: 'Collision Padding', min: 0, max: 1000, step: 0.5 },
  { key: 'charge' as const, label: 'Charge', min: -80000, max: 400, step: 1 },
  { key: 'linkDistanceBase' as const, label: 'Link Dist Base', min: -60, max: 600, step: 1 },
  { key: 'linkDistanceScale' as const, label: 'Link Dist Scale', min: -20, max: 160, step: 1 },
  { key: 'linkStrengthDivisor' as const, label: 'Link Str Divisor', min: 1, max: 14, step: 0.5 },
];

const CIRCULAR_SLIDERS = [
  { key: 'ringRadiusFactor' as const, label: 'Ring Radius Factor', min: 0.02, max: 0.5, step: 0.01 },
  { key: 'nodeSpacing' as const, label: 'Node Spacing', min: 0, max: 200, step: 5 },
  { key: 'radialMinDistance' as const, label: 'Radial Min Distance', min: 50, max: 2000, step: 10 },
  { key: 'radialMaxDistance' as const, label: 'Radial Max Distance', min: 500, max: 10000, step: 50 },
];

const ITERATIONS = 300;

export default function TunerPanel({
  viewMode,
  nodes,
  edges,
  mstEdges,
  onSizingChange,
  onPositionsChange,
  onCircularLayoutChange,
  onForceLayoutChange,
  showMstEdges,
  onShowMstEdgesChange,
  initialSizing,
  initialCircularLayout,
  initialForceLayout,
}: TunerPanelProps) {
  const [open, setOpen] = useState(false);
  const [sizingParams, setSizingParams] = useState(
    initialSizing ?? { ...SIZING_DEFAULTS },
  );
  const [forceParams, setForceParams] = useState<ForceLayoutParams>(
    initialForceLayout ?? { ...FORCE_DEFAULTS },
  );
  const [circularParams, setCircularParams] = useState<CircularLayoutParams>(
    initialCircularLayout ?? { ...CIRCULAR_DEFAULTS },
  );
  const [simulating, setSimulating] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshot original positions so every simulation starts from the same baseline
  const originalPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  if (!originalPositionsRef.current && nodes.length > 0) {
    originalPositionsRef.current = new Map(
      nodes.map((n) => [n.id, { x: n.x, y: n.y }]),
    );
  }

  // Run force simulation when layout params change
  const runSimulation = useCallback(
    (sizing: typeof sizingParams, force: ForceLayoutParams) => {
      setSimulating(true);
      const origPositions = originalPositionsRef.current;

      requestAnimationFrame(() => {
        const simNodes = nodes.map((n) => {
          const orig = origPositions?.get(n.id);
          return {
            id: n.id,
            aiExposure: n.aiExposure,
            x: orig?.x ?? n.x,
            y: orig?.y ?? n.y,
            vx: 0,
            vy: 0,
          };
        });

        const simEdges = mstEdges.map((e) => ({
          source:
            typeof e.source === 'string'
              ? e.source
              : (e.source as GraphNode).id,
          target:
            typeof e.target === 'string'
              ? e.target
              : (e.target as GraphNode).id,
          weight: e.weight,
        }));

        const sim = forceSimulation(simNodes)
          .alpha(0.3)
          .alphaDecay(0.01)
          .velocityDecay(0.6)
          .force(
            'link',
            forceLink(simEdges)
              .id((d: any) => d.id)
              .distance(
                (d: any) =>
                  force.linkDistanceBase + (7 - d.weight) * force.linkDistanceScale,
              )
              .strength((d: any) => d.weight / force.linkStrengthDivisor),
          )
          .force('charge', forceManyBody().strength(force.charge))
          .force(
            'center',
            forceCenter(
              simNodes.reduce((s, n) => s + n.x, 0) / simNodes.length,
              simNodes.reduce((s, n) => s + n.y, 0) / simNodes.length,
            ),
          )
          .force(
            'collide',
            forceCollide((d: any) => {
              const r = sizing.base + Math.pow(d.aiExposure, sizing.exponent) * sizing.scale;
              return r + force.collidePadding;
            }).strength(0.7),
          );

        sim.stop();
        for (let i = 0; i < ITERATIONS; i++) sim.tick();

        const positions = new Map<string, { x: number; y: number }>();
        for (const n of simNodes) {
          positions.set(n.id, {
            x: parseFloat(n.x.toFixed(1)),
            y: parseFloat(n.y.toFixed(1)),
          });
        }

        onPositionsChange(positions);
        setSimulating(false);
      });
    },
    [nodes, mstEdges, onPositionsChange],
  );

  const handleSizingChange = useCallback(
    (key: string, value: number) => {
      setSizingParams((prev) => {
        const next = { ...prev, [key]: value };
        onSizingChange(next);
        return next;
      });
    },
    [onSizingChange],
  );

  const handleForceChange = useCallback(
    (key: string, value: number) => {
      setForceParams((prev) => {
        const next = { ...prev, [key]: value } as ForceLayoutParams;
        onForceLayoutChange(next);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSimulation(sizingParams, next), 200);
        return next;
      });
    },
    [onForceLayoutChange, runSimulation, sizingParams],
  );

  const handleCircularChange = useCallback(
    (key: string, value: number) => {
      setCircularParams((prev) => {
        const next = { ...prev, [key]: value } as CircularLayoutParams;
        onCircularLayoutChange(next);
        return next;
      });
    },
    [onCircularLayoutChange],
  );

  const handleDownload = useCallback(() => {
    const output = nodes.map((n) => ({ ...n }));
    const blob = new Blob([JSON.stringify(output, null, 2) + '\n'], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodes.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

  const handleCopyConstants = useCallback(() => {
    const text = [
      `export const NODE_RADIUS_BASE = ${sizingParams.base};`,
      `export const NODE_RADIUS_SCALE = ${sizingParams.scale};`,
      `export const NODE_RADIUS_EXPONENT = ${sizingParams.exponent};`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [sizingParams]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function renderSlider(
    cfg: { key: string; label: string; min: number; max: number; step: number },
    value: number,
    onChange: (key: string, value: number) => void,
  ) {
    return (
      <label key={cfg.key} className="block mb-2">
        <div className="flex justify-between mb-0.5">
          <span>{cfg.label}</span>
          <span className="font-mono text-muted-foreground">{value}</span>
        </div>
        <input
          type="range"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={value}
          onChange={(e) => onChange(cfg.key, parseFloat(e.target.value))}
          className="w-full accent-foreground"
        />
      </label>
    );
  }

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
            {simulating && (
              <span className="text-muted-foreground animate-pulse">
                Computing...
              </span>
            )}
          </div>

          {/* Sizing section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Node Sizing
            </div>
            {SIZING_SLIDERS.map((cfg) => renderSlider(cfg, sizingParams[cfg.key], handleSizingChange))}
          </div>

          {/* Force layout section */}
          {viewMode === 'force' && (
            <div className="mb-3">
              <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Layout Forces
              </div>
              {FORCE_SLIDERS.map((cfg) => renderSlider(cfg, forceParams[cfg.key], handleForceChange))}
            </div>
          )}

          {/* Circular layout section */}
          {viewMode === 'circular' && (
            <div className="mb-3">
              <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Circular Layout
              </div>
              {CIRCULAR_SLIDERS.map((cfg) => renderSlider(cfg, circularParams[cfg.key], handleCircularChange))}
            </div>
          )}

          {/* Debug section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Debug
            </div>
            {viewMode === 'force' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMstEdges}
                  onChange={(e) => onShowMstEdgesChange(e.target.checked)}
                  className="accent-foreground"
                />
                <span>Show MST edges</span>
              </label>
            )}
          </div>

          {/* Export section */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-1.5 rounded bg-accent text-accent-foreground text-xs font-medium hover:opacity-80 transition-opacity"
            >
              Download JSON
            </button>
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
