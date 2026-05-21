"use client";

import type { BeamModel, Load, NodeSupport, Span, SupportType } from "@/lib/types";

const SUPPORT_LABELS: Record<SupportType, string> = {
  PIN: "Articulado (PIN)",
  ROD: "Rodillo (ROD)",
  EMP: "Empotrado (EMP)",
  LIBRE: "Libre",
};

const MATERIALS: Record<string, number> = {
  Acero: 200,
  "Hormigón": 25,
  Aluminio: 70,
  Madera: 12,
};

const LOAD_TABS: { id: Load["type"]; label: string; icon: string }[] = [
  { id: "puntual",     label: "Puntual",      icon: "↓" },
  { id: "uniforme",    label: "Uniforme",     icon: "≡" },
  { id: "trapezoidal", label: "Trapezoidal",  icon: "◢" },
  { id: "momento",     label: "Momento",      icon: "↻" },
];

function genId(prefix: string) {
  return prefix + Math.random().toString(36).slice(2, 8);
}

export function BeamConfig({
  model, onChange, onSolve,
}: { model: BeamModel; onChange: (m: BeamModel) => void; onSolve: () => void }) {

  // ---- Span helpers ----
  const updateSpan = (i: number, patch: Partial<Span>) => {
    const spans = model.spans.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    const supports = syncSupports(spans, model.supports);
    onChange({ ...model, spans, supports });
  };
  const addSpan = () => {
    const spans = [...model.spans, {
      id: genId("T"), L: 4, material: "Acero", E: 200, I: 8356,
    }];
    const supports = syncSupports(spans, model.supports);
    onChange({ ...model, spans, supports });
  };
  const removeSpan = (i: number) => {
    if (model.spans.length <= 1) return;
    const spans = model.spans.filter((_, idx) => idx !== i);
    const supports = syncSupports(spans, model.supports);
    onChange({ ...model, spans, supports });
  };

  // ---- Support helpers ----
  const updateSupport = (i: number, type: SupportType) => {
    const supports = model.supports.map((s, idx) => idx === i ? { ...s, type } : s);
    onChange({ ...model, supports });
  };

  // ---- Load helpers ----
  const activeLoadType: Load["type"] = "puntual";
  const addLoad = (type: Load["type"]) => {
    const newLoad: Load = {
      id: genId("L"),
      type,
      spanIndex: 0,
      position: type === "puntual" || type === "momento" ? model.spans[0].L / 2 : undefined,
      magnitude: type === "uniforme" || type === "trapezoidal" ? 10 : 20,
      magnitude2: type === "trapezoidal" ? 5 : undefined,
    };
    onChange({ ...model, loads: [...model.loads, newLoad] });
  };
  const removeLoad = (i: number) => {
    onChange({ ...model, loads: model.loads.filter((_, idx) => idx !== i) });
  };
  const updateLoad = (i: number, patch: Partial<Load>) => {
    onChange({
      ...model,
      loads: model.loads.map((l, idx) => idx === i ? { ...l, ...patch } : l),
    });
  };

  return (
    <div className="space-y-5">
      {/* ===== Tramos ===== */}
      <Section title={`TRAMOS  ${model.spans.length}`} accent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs">
                <th className="text-left pl-1 pb-1">#</th>
                <th className="text-left pb-1">L (M)</th>
                <th className="text-left pb-1">MATERIAL</th>
                <th className="text-left pb-1">E (GPA)</th>
                <th className="text-left pb-1">I (CM⁴)</th>
                <th className="text-left pb-1">EI (KN·M²)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {model.spans.map((s, i) => {
                const EI = (s.E * 1e6) * (s.I * 1e-8); // GPa→kN/m², cm⁴→m⁴
                return (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="py-1.5 pl-1 text-slate-500 font-medium">T{i + 1}</td>
                    <td><Num value={s.L} onChange={(v) => updateSpan(i, { L: v })} /></td>
                    <td>
                      <select
                        value={s.material}
                        onChange={(e) => {
                          const m = e.target.value;
                          updateSpan(i, { material: m, E: MATERIALS[m] ?? s.E });
                        }}
                        className="bg-transparent border border-slate-200 rounded px-1 py-0.5 text-sm"
                      >
                        {Object.keys(MATERIALS).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td><Num value={s.E} onChange={(v) => updateSpan(i, { E: v })} /></td>
                    <td><Num value={s.I} onChange={(v) => updateSpan(i, { I: v })} /></td>
                    <td className="text-slate-500">{kFormat(EI)}</td>
                    <td>
                      <button
                        onClick={() => removeSpan(i)}
                        disabled={model.spans.length <= 1}
                        className="text-slate-400 hover:text-red-500 disabled:opacity-30"
                        title="Eliminar tramo"
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3">
          <label className="text-xs text-slate-500 flex items-center gap-1">
            <input type="checkbox" className="accent-brand-500" /> EI simbólico
          </label>
          <button
            onClick={addSpan}
            className="px-3 py-1 text-sm bg-brand-50 text-brand-700 rounded hover:bg-brand-100"
          >+ Añadir</button>
        </div>
      </Section>

      {/* ===== Apoyos ===== */}
      <Section title="APOYOS POR NODO" accent>
        <div className="space-y-2">
          {model.supports.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-brand-600 w-9">{s.id}</span>
              <select
                value={s.type}
                onChange={(e) => updateSupport(i, e.target.value as SupportType)}
                className="flex-1 bg-white border border-slate-200 rounded px-2 py-1"
              >
                {(Object.keys(SUPPORT_LABELS) as SupportType[]).map((k) => (
                  <option key={k} value={k}>{SUPPORT_LABELS[k]}</option>
                ))}
              </select>
              <span className="text-xs text-slate-400 w-12 text-right">{s.type}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
          <div><span className="font-mono">PIN</span> Articulado</div>
          <div><span className="font-mono">ROD</span> Rodillo</div>
          <div><span className="font-mono">EMP</span> Empotrado</div>
          <div><span className="font-mono">—</span> Libre</div>
        </div>
      </Section>

      {/* ===== Cargas ===== */}
      <Section title="CARGAS" accent>
        <div className="flex gap-1 mb-3">
          {LOAD_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => addLoad(t.id)}
              className="flex-1 px-2 py-1.5 text-xs font-medium rounded border border-slate-200
                         bg-white hover:bg-brand-50 hover:border-brand-200 transition-colors
                         flex items-center justify-center gap-1"
              title={`Añadir carga ${t.label}`}
            >
              <span className="text-base">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        {model.loads.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Sin cargas. Haz click en un tipo para añadir.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs">
                <th className="text-left pb-1">Tipo</th>
                <th className="text-left pb-1">Tramo</th>
                <th className="text-left pb-1">Pos (m)</th>
                <th className="text-left pb-1">Magnitud</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {model.loads.map((l, i) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-1 capitalize">{l.type}</td>
                  <td>
                    <select
                      value={l.spanIndex}
                      onChange={(e) => updateLoad(i, { spanIndex: Number(e.target.value) })}
                      className="bg-transparent border border-slate-200 rounded px-1 py-0.5"
                    >
                      {model.spans.map((_, idx) => (
                        <option key={idx} value={idx}>T{idx + 1}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {(l.type === "puntual" || l.type === "momento") ? (
                      <Num value={l.position ?? 0} onChange={(v) => updateLoad(i, { position: v })} />
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td>
                    <Num value={l.magnitude} onChange={(v) => updateLoad(i, { magnitude: v })} />
                    {l.type === "trapezoidal" && (
                      <Num value={l.magnitude2 ?? 0} onChange={(v) => updateLoad(i, { magnitude2: v })} />
                    )}
                  </td>
                  <td>
                    <button onClick={() => removeLoad(i)} className="text-slate-400 hover:text-red-500">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ===== Calcular ===== */}
      <button
        onClick={onSolve}
        className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-semibold shadow hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
      >
        <span>▶</span> Calcular
      </button>
    </div>
  );
}

// ============================================================
// Helpers UI
// ============================================================
function Section({ title, accent, children }:
  { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-xs font-bold text-slate-700 tracking-wider mb-3 flex items-center gap-1.5">
        {accent && <span className="w-2 h-2 rounded-full bg-brand-500" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 bg-transparent border border-slate-200 rounded px-1.5 py-0.5 text-sm"
    />
  );
}

function kFormat(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toFixed(1);
}

// Mantiene la cantidad de apoyos = spans.length + 1.
function syncSupports(spans: Span[], existing: NodeSupport[]): NodeSupport[] {
  const needed = spans.length + 1;
  const out: NodeSupport[] = [];
  for (let i = 0; i < needed; i++) {
    const id = `N${i + 1}`;
    const found = existing.find((s) => s.id === id);
    out.push(found ?? { id, type: i === 0 || i === needed - 1 ? "PIN" : "ROD" });
  }
  return out;
}
