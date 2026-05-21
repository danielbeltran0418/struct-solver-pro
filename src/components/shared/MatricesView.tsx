"use client";

import type { SolveResponse } from "@/lib/types";

/**
 * Componente compartido para mostrar todas las matrices del Método de la Rigidez:
 *   - Por cada elemento: k' (local), T (transformación), k (global)
 *   - K global ensamblada
 *   - Vector F global
 *   - Mapeo de GDL
 */
export function MatricesView({
  result, hasTransform = true,
}: {
  result: SolveResponse | null;
  hasTransform?: boolean;   // false para viga continua (T = I)
}) {
  if (!result) {
    return <Empty text="Presiona Calcular para ver las matrices intermedias." />;
  }
  if (!result.ok) {
    return <ErrorBox msg={result.error ?? "Error en el cálculo"} />;
  }

  return (
    <div className="space-y-4">
      {/* Matrices por elemento */}
      {(result.element_matrices ?? []).map((em) => (
        <Card key={em.id} title={`Elemento ${em.id}`}>
          <p className="text-[10px] text-slate-400 mb-2">
            GDL globales: [{em.dofMap.join(", ")}]
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SubMat label="k' (local)" m={em.k_local} />
            {hasTransform && em.T && <SubMat label="T (transformación)" m={em.T} />}
            <SubMat
              label={hasTransform ? "k = TᵀkT (global)" : "k (global = local)"}
              m={em.k_global}
            />
          </div>
        </Card>
      ))}

      {/* K global */}
      <Card title="Matriz de rigidez global K (ensamblada)">
        <Mat m={result.K_global ?? []} />
      </Card>

      {/* F global */}
      <Card title="Vector de fuerzas global F">
        <Mat m={(result.F_global ?? []).map((v) => [v])} />
      </Card>
    </div>
  );
}

// ===========================================================
// helpers
// ===========================================================
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

function SubMat({ label, m }: { label: string; m: number[][] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-600 mb-1">{label}</p>
      <Mat m={m} compact />
    </div>
  );
}

function Mat({ m, compact = false }: { m: number[][]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={"font-mono " + (compact ? "text-[10px]" : "text-xs")}>
        <tbody>
          {m.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j} className={
                  "border border-slate-100 " +
                  (compact ? "px-1 py-0.5" : "px-2 py-1") + " " +
                  (Math.abs(v) < 1e-9 ? "text-slate-300" : "text-slate-700")
                }>
                  {Math.abs(v) < 1e-9 ? "0" : formatNum(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatNum(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e5 || abs < 1e-3) return v.toExponential(2);
  if (abs >= 100) return v.toFixed(1);
  return v.toFixed(3);
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
      {text}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      {msg}
    </div>
  );
}
