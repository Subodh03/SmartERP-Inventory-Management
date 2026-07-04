'use client';

const KEYS = [
  { key: 'F1', label: 'Company' },
  { key: 'F2', label: 'Period' },
  { key: 'F3', label: 'Info' },
  { key: 'F4', label: 'Calculator' },
  { key: 'F5', label: 'Refresh' },
  { key: 'Esc', label: 'Back' },
  { key: '^Q', label: 'Logout' },
  { key: '^H', label: 'Home' },
  { key: '^K', label: 'Search' },
];

export default function FunctionKeyBar({ onAction }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-navy-light border-t border-navy-lighter z-40">
      <div className="flex items-stretch h-10 overflow-x-auto">
        {KEYS.map((k) => (
          <button
            key={k.key}
            onClick={() => onAction(k.key)}
            className="group flex items-center gap-2 px-4 border-r border-navy-lighter hover:bg-navy transition-colors whitespace-nowrap"
          >
            <span className="font-mono text-[11px] text-amber font-semibold group-hover:text-amber-light">{k.key}</span>
            <span className="text-[11px] text-ink-muted group-hover:text-ink">{k.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
