"use client";

import { NumInput } from "@/components/shared/NumInput";
import type { FrameElement, FrameModel, FrameNode } from "@/lib/types";

function genId(prefix: string) {
  return prefix + Math.random().toString(36).slice(2, 6);
}

export function FrameConfig({
  model, onChange, onSolve,
}: { model: FrameModel; onChange: (m: FrameModel) => void; onSolve: () => void }) {
  const updateNode = (i: number, patch: Partial<FrameNode>) =>
    onChange({ ...model, nodes: model.nodes.map((n, idx) => idx === i ? { ...n, ...patch } : n) });
  const addNode = () => {
    const id = "N" + (model.nodes.length + 1);
    onChange({
      ...model,
      nodes: [...model.nodes, {
        id, x: 0, y: 0,
        fixed_u: false, fixed_v: false, fixed_theta: false,
        fx: 0, fy: 0, m: 0,
      }],
    });
  };
  const removeNode = (i: number) => {
    if (model.nodes.length <= 2) return;
    const removedId = model.nodes[i].id;
    onChange({
      ...model,
      nodes: model.nodes.filter((_, idx) => idx !== i),
      elements: model.elements.filter((e) => e.nodeI !== removedId && e.nodeJ !== removedId),
    });
  };

  const updateElement = (i: number, patch: Partial<FrameElement>) =>
    onChange({ ...model, elements: model.elements.map((e, idx) => idx === i ? { ...e, ...patch } : e) });
  const addElement = () =>
    onChange({
      ...model,
      elements: [...model.elements, {
        id: genId("B"),
        nodeI: model.nodes[0].id,
        nodeJ: model.nodes[1].id,
        E: 200, A: 100, I: 8356,
      }],
    });
  const removeElement = (i: number) => {
    if (model.elements.length <= 1) return;
    onChange({ ...model, elements: model.elements.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-5">
      <Section title={`NODOS  ${model.nodes.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs">
                <th className="text-left pb-1">ID</th>
                <th className="text-left pb-1">X (m)</th>
                <th className="text-left pb-1">Y (m)</th>
                <th className="text-center pb-1" title="Fija u">u</th>
                <th className="text-center pb-1" title="Fija v">v</th>
                <th className="text-center pb-1" title="Fija θ">θ</th>
                <th className="text-left pb-1">Fx</th>
                <th className="text-left pb-1">Fy</th>
                <th className="text-left pb-1">M</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {model.nodes.map((n, i) => (
                <tr key={n.id} className="border-t border-slate-100">
                  <td className="py-1">
                    <input className="w-12 bg-transparent border border-slate-200 rounded px-1"
                           value={n.id} onChange={(e) => updateNode(i, { id: e.target.value })} />
                  </td>
                  <td><Num value={n.x} onChange={(v) => updateNode(i, { x: v })} /></td>
                  <td><Num value={n.y} onChange={(v) => updateNode(i, { y: v })} /></td>
                  <td className="text-center"><Chk v={n.fixed_u} onChange={(v) => updateNode(i, { fixed_u: v })} /></td>
                  <td className="text-center"><Chk v={n.fixed_v} onChange={(v) => updateNode(i, { fixed_v: v })} /></td>
                  <td className="text-center"><Chk v={n.fixed_theta} onChange={(v) => updateNode(i, { fixed_theta: v })} /></td>
                  <td><Num value={n.fx} onChange={(v) => updateNode(i, { fx: v })} /></td>
                  <td><Num value={n.fy} onChange={(v) => updateNode(i, { fy: v })} /></td>
                  <td><Num value={n.m} onChange={(v) => updateNode(i, { m: v })} /></td>
                  <td>
                    <button onClick={() => removeNode(i)}
                            disabled={model.nodes.length <= 2}
                            className="text-slate-400 hover:text-red-500 disabled:opacity-30">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          Fuerzas en kN, momentos en kN·m. ✓ = restringido. Empotrado = u+v+θ.
        </p>
        <button onClick={addNode}
                className="mt-2 px-3 py-1 text-sm bg-brand-50 text-brand-700 rounded hover:bg-brand-100">
          + Añadir nodo
        </button>
      </Section>

      <Section title={`BARRAS  ${model.elements.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs">
                <th className="text-left pb-1">ID</th>
                <th className="text-left pb-1">i</th>
                <th className="text-left pb-1">j</th>
                <th className="text-left pb-1">E (GPa)</th>
                <th className="text-left pb-1">A (cm²)</th>
                <th className="text-left pb-1">I (cm⁴)</th>
                <th className="text-center pb-1" title="Rótula interna en extremo i (M=0)">◯i</th>
                <th className="text-center pb-1" title="Rótula interna en extremo j (M=0)">◯j</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {model.elements.map((e, i) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="py-1">
                    <input className="w-12 bg-transparent border border-slate-200 rounded px-1"
                           value={e.id} onChange={(ev) => updateElement(i, { id: ev.target.value })} />
                  </td>
                  <td><NodeSel value={e.nodeI} options={model.nodes.map((n) => n.id)}
                               onChange={(v) => updateElement(i, { nodeI: v })} /></td>
                  <td><NodeSel value={e.nodeJ} options={model.nodes.map((n) => n.id)}
                               onChange={(v) => updateElement(i, { nodeJ: v })} /></td>
                  <td><Num value={e.E} onChange={(v) => updateElement(i, { E: v })} /></td>
                  <td><Num value={e.A} onChange={(v) => updateElement(i, { A: v })} /></td>
                  <td><Num value={e.I} onChange={(v) => updateElement(i, { I: v })} /></td>
                  <td className="text-center">
                    <input type="checkbox" className="accent-brand-500"
                           checked={!!e.releaseI}
                           onChange={(ev) => updateElement(i, { releaseI: ev.target.checked })} />
                  </td>
                  <td className="text-center">
                    <input type="checkbox" className="accent-brand-500"
                           checked={!!e.releaseJ}
                           onChange={(ev) => updateElement(i, { releaseJ: ev.target.checked })} />
                  </td>
                  <td>
                    <button onClick={() => removeElement(i)}
                            disabled={model.elements.length <= 1}
                            className="text-slate-400 hover:text-red-500 disabled:opacity-30">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          ◯i / ◯j: rótula interna (libera momento, M = 0 en ese extremo).
        </p>
        <button onClick={addElement}
                className="mt-2 px-3 py-1 text-sm bg-brand-50 text-brand-700 rounded hover:bg-brand-100">
          + Añadir barra
        </button>
      </Section>

      <button onClick={onSolve}
              className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-semibold shadow hover:bg-brand-700">
        ▶ Calcular
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-xs font-bold text-slate-700 tracking-wider mb-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-brand-500" />{title}
      </h3>
      {children}
    </section>
  );
}
function Num(props: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  return <NumInput {...props}
                   className="w-16 bg-transparent border border-slate-200 rounded px-1 py-0.5 text-sm focus:border-brand-500 focus:outline-none" />;
}
function Chk({ v, onChange }: { v: boolean; onChange: (v: boolean) => void }) {
  return <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)}
           className="accent-brand-500" />;
}
function NodeSel({ value, options, onChange }:
  { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
            className="bg-transparent border border-slate-200 rounded px-1 py-0.5 text-sm">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
