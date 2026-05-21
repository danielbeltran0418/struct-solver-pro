"use client";

import type { FrameModel, SolveResponse } from "@/lib/types";

export function FrameResults({ model, result }: { model: FrameModel; result: SolveResponse | null }) {
  if (!result) return <Empty text="Presiona Calcular para ver resultados." />;
  if (!result.ok) return <Err msg={result.error ?? "Error en el cálculo"} />;

  return (
    <div className="space-y-4">
      <Card title="Desplazamientos nodales">
        <Table headers={["Nodo", "u (m)", "v (m)", "θ (rad)"]}
               rows={(result.displacements ?? []).map((d, i) => [
                 model.nodes[i].id, fmt(d[0], 6), fmt(d[1], 6), fmt(d[2], 6),
               ])} />
      </Card>
      <Card title="Reacciones en apoyos">
        <Table headers={["Nodo", "Rx (kN)", "Ry (kN)", "M (kN·m)"]}
               rows={(result.reactions ?? []).map((r, i) => [
                 model.nodes[i].id, fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3),
               ])
               .filter((_, i) => {
                 const n = model.nodes[i];
                 return n.fixed_u || n.fixed_v || n.fixed_theta;
               })} />
      </Card>
      <Card title="Fuerzas internas por barra (extremos)">
        <Table
          headers={["Barra", "N (kN)", "Estado", "V_i", "M_i", "V_j", "M_j"]}
          rows={(result.member_forces ?? []).map((mf) => {
            const e = model.elements[mf.spanIndex];
            return [
              e.id,
              fmt(mf.N ?? 0, 3),
              <Badge key="b" state={mf.state} />,
              fmt(mf.V_i, 3), fmt(mf.M_i, 3),
              fmt(mf.V_j, 3), fmt(mf.M_j, 3),
            ];
          })}
        />
        <p className="text-[10px] text-slate-400 mt-2">
          Valores en sistema LOCAL del elemento. N positivo = tracción.
        </p>
      </Card>
    </div>
  );
}

export function FrameMatrices({ result }: { result: SolveResponse | null }) {
  if (!result?.ok) return <Empty text="Calcula la estructura para ver las matrices." />;
  return (
    <div className="space-y-4">
      <Card title="Matriz de rigidez global K">
        <Mat M={result.K_global ?? []} />
      </Card>
      <Card title="Vector de fuerzas F">
        <Mat M={(result.F_global ?? []).map((v) => [v])} />
      </Card>
    </div>
  );
}

// helpers (idénticos a TrussResults — se podría refactorear, lo dejo inline por ahora)
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-xs font-bold text-slate-700 tracking-wider mb-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-brand-500" />{title.toUpperCase()}
      </h3>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="bg-white border border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">{text}</div>;
}
function Err({ msg }: { msg: string }) {
  return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{msg}</div>;
}
function Table({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-slate-500 text-xs">
          {headers.map((h) => <th key={h} className="text-left pb-2 font-medium">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-slate-100">
            {row.map((c, j) => <td key={j} className="py-1.5">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function Mat({ M }: { M: number[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs font-mono">
        <tbody>
          {M.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j} className="px-2 py-1 border border-slate-100">
                  {Math.abs(v) < 1e-9 ? "0" : v.toExponential(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Badge({ state }: { state?: "Tracción" | "Compresión" | "Nulo" }) {
  if (!state) return null;
  const color = state === "Tracción" ? "bg-green-100 text-green-700"
              : state === "Compresión" ? "bg-red-100 text-red-700"
              : "bg-slate-100 text-slate-500";
  return <span className={`text-xs px-2 py-0.5 rounded ${color}`}>{state}</span>;
}
function fmt(n: number, d = 3): string {
  if (Math.abs(n) < 1e-9) return "0";
  if (Math.abs(n) >= 1e4 || Math.abs(n) < 1e-3) return n.toExponential(2);
  return n.toFixed(d);
}
