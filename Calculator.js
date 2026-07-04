'use client';
import { useState } from 'react';

export default function Calculator({ open, onClose }) {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState(null);

  if (!open) return null;

  function evaluate() {
    try {
      // Restrict to digits/operators only — this is a basic on-screen calculator, not a code evaluator.
      if (!/^[0-9+\-*/().\s]*$/.test(expr)) throw new Error('Invalid characters');
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${expr || 0})`)();
      setResult(value);
    } catch {
      setResult('Error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="panel w-72 p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs uppercase tracking-wide text-ink-muted mb-2 font-mono">Calculator (F4)</p>
        <input
          autoFocus
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') evaluate(); if (e.key === 'Escape') onClose(); }}
          placeholder="e.g. 1500*1.18"
          className="input-field w-full mb-3 font-mono"
        />
        <div className="data-figure text-2xl text-amber mb-3 min-h-[2rem]">{result !== null ? result : '\u00A0'}</div>
        <div className="flex gap-2">
          <button onClick={evaluate} className="btn-primary flex-1">Calculate</button>
          <button onClick={onClose} className="btn-ghost flex-1">Close</button>
        </div>
      </div>
    </div>
  );
}
