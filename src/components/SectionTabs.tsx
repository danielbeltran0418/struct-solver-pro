"use client";

import type { Section } from "@/lib/types";

const TABS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "config",    label: "Configuración", icon: <span>⚙</span> },
  { id: "results",   label: "Resultados",    icon: <span>📊</span> },
  { id: "diagrams",  label: "Diagramas",     icon: <span>📈</span> },
  { id: "matrices",  label: "Matrices",      icon: <span>🔢</span> },
  { id: "section",   label: "Sección",       icon: <span>📐</span> },
];

export function SectionTabs({
  active, onChange,
}: { active: Section; onChange: (s: Section) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 mt-3">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            "px-3 py-2 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px transition-colors " +
            (active === t.id
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700")
          }
        >
          <span className="text-base">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
