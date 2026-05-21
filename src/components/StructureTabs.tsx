"use client";

import type { StructureType } from "@/lib/types";

const TABS: { id: StructureType; label: string; icon: React.ReactNode }[] = [
  {
    id: "beam",
    label: "Viga Continua",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4">
        <path d="M3 12h18" stroke="currentColor" strokeWidth="2" />
        <path d="M3 10v4M21 10v4" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "truss",
    label: "Armadura 2D",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4">
        <path d="M3 19L12 5L21 19H3Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M3 19L21 19M7 19L12 12L17 19" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    id: "frame",
    label: "Pórtico 2D",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4">
        <path d="M4 4v16M20 4v16M4 4h16" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
];

export function StructureTabs({
  active, onChange,
}: { active: StructureType; onChange: (t: StructureType) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 tracking-wide mr-1">
        ESTRUCTURA:
      </span>
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            "px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors " +
            (active === t.id
              ? "bg-brand-500 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")
          }
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
