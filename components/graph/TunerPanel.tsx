'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import type { GraphNode, GraphEdge, TunerSizingParams } from '@/lib/types';
import {
  NODE_RADIUS_BASE,
  NODE_RADIUS_SCALE,
  NODE_RADIUS_EXPONENT,
  NODE_RADIUS_COLLIDE_PADDING,
} from '@/lib/constants';

interface TunerPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSizingChange: (params: TunerSizingParams) => void;
  onPositionsChange: (positions: Map<string, { x: number; y: number }>) => void;
}

const DEFAULTS = {
  base: NODE_RADIUS_BASE,
  scale: NODE_RADIUS_SCALE,
  exponent: NODE_RADIUS_EXPONENT,
  collidePadding: NODE_RADIUS_COLLIDE_PADDING,
  charge: -60,
  linkDistanceBase: 55,
  linkDistanceScale: 16,
};

const SLIDER_CONFIG = [
  {
    key: 'base',
    label: 'Base Radius',
    min: 2,
    max: 200,
    step: 1,
    group: 'sizing',
  },
  { key: 'scale', label: 'Scale', min: 10, max: 150, step: 1, group: 'sizing' },
  {
    key: 'exponent',
    label: 'Exponent',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    group: 'sizing',
  },
  {
    key: 'collidePadding',
    label: 'Collision Padding',
    min: 0,
    max: 80,
    step: 0.5,
    group: 'layout',
  },
  {
    key: 'charge',
    label: 'Charge',
    min: -800,
    max: 400,
    step: 1,
    group: 'layout',
  },
  {
    key: 'linkDistanceBase',
    label: 'Link Dist Base',
    min: -60,
    max: 600,
    step: 1,
    group: 'layout',
  },
  {
    key: 'linkDistanceScale',
    label: 'Link Dist Scale',
    min: -20,
    max: 160,
    step: 1,
    group: 'layout',
  },
] as const;

type ParamKey = (typeof SLIDER_CONFIG)[number]['key'];

const ITERATIONS = 300;

export default function TunerPanel({
  nodes,
  edges,
  onSizingChange,
  onPositionsChange,
}: TunerPanelProps) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<Record<ParamKey, number>>({
    ...DEFAULTS,
  });
  const [simulating, setSimulating] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot original positions so every simulation starts from the same baseline
  const originalPositionsRef = useRef<Map<
    string,
    { x: number; y: number }
  > | null>(null);
  if (!originalPositionsRef.current && nodes.length > 0) {
    originalPositionsRef.current = new Map(
      nodes.map((n) => [n.id, { x: n.x, y: n.y }]),
    );
  }

  // Run force simulation when layout params change
  const runSimulation = useCallback(
    (p: Record<ParamKey, number>) => {
      setSimulating(true);
      const origPositions = originalPositionsRef.current;

      // Use requestAnimationFrame to avoid blocking the UI render
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

        const simEdges = edges.map((e) => ({
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
                  p.linkDistanceBase + (7 - d.weight) * p.linkDistanceScale,
              )
              .strength(0.3),
          )
          .force('charge', forceManyBody().strength(p.charge))
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
              const r = p.base + Math.pow(d.aiExposure, p.exponent) * p.scale;
              return r + p.collidePadding;
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
    [nodes, edges, onPositionsChange],
  );

  const handleChange = useCallback(
    (key: ParamKey, value: number) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };

        // Sizing params update instantly
        const sizingKeys: ParamKey[] = ['base', 'scale', 'exponent'];
        if (sizingKeys.includes(key)) {
          onSizingChange({
            base: next.base,
            scale: next.scale,
            exponent: next.exponent,
          });
        }

        // Layout params trigger debounced simulation
        const layoutKeys: ParamKey[] = [
          'collidePadding',
          'charge',
          'linkDistanceBase',
          'linkDistanceScale',
        ];
        if (layoutKeys.includes(key)) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => runSimulation(next), 200);
        }

        return next;
      });
    },
    [onSizingChange, runSimulation],
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
      `export const NODE_RADIUS_BASE = ${params.base};`,
      `export const NODE_RADIUS_SCALE = ${params.scale};`,
      `export const NODE_RADIUS_EXPONENT = ${params.exponent};`,
      `export const NODE_RADIUS_COLLIDE_PADDING = ${params.collidePadding};`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [params]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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

          {/* Layout section */}
          <div className="mb-3">
            <div className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              Layout Forces
            </div>
            {SLIDER_CONFIG.filter((s) => s.group === 'layout').map((cfg) => (
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
