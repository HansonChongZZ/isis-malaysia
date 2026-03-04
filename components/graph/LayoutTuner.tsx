'use client';

import { useState } from 'react';
import type { LayoutTuning } from '@/hooks/useForceSimulation';

interface LayoutTunerProps {
  tuning: LayoutTuning;
  onChange: (tuning: LayoutTuning) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onExport?: () => void;
}

export default function LayoutTuner({
  tuning,
  onChange,
  enabled,
  onToggle,
  onExport,
}: LayoutTunerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const update = (key: keyof LayoutTuning, value: number) => {
    onChange({ ...tuning, [key]: value });
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-2 right-2 z-30 bg-card border border-border rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Tuner
      </button>
    );
  }

  return (
    <div className="absolute top-2 right-2 z-30 bg-card border border-border rounded-lg shadow-lg p-4 w-72 text-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-foreground">Layout Tuner</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Collapse
        </button>
      </div>

      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="accent-primary"
        />
        <span className="text-xs text-muted-foreground">
          Enable runtime tuning
        </span>
      </label>

      <div
        className="space-y-3"
        style={{
          opacity: enabled ? 1 : 0.4,
          pointerEvents: enabled ? 'auto' : 'none',
        }}
      >
        <SliderRow
          label="Intra-cluster strength"
          value={tuning.intraStrength}
          min={0.001}
          max={0.8}
          step={0.001}
          onChange={(v) => update('intraStrength', v)}
        />
        <SliderRow
          label="Inter-cluster strength"
          value={tuning.interStrength}
          min={0.001}
          max={0.3}
          step={0.001}
          onChange={(v) => update('interStrength', v)}
        />
        <SliderRow
          label="Charge"
          value={tuning.charge}
          min={-3000}
          max={-50}
          step={10}
          onChange={(v) => update('charge', v)}
        />
      </div>

      {enabled && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
            intra: {tuning.intraStrength} | inter: {tuning.interStrength} |
            charge: {tuning.charge}
          </p>
          {onExport && (
            <button
              onClick={onExport}
              className="mt-2 w-full bg-primary text-primary-foreground text-xs rounded px-3 py-1.5 hover:opacity-90 transition-opacity"
            >
              Export Layout
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-primary cursor-pointer"
      />
    </div>
  );
}
