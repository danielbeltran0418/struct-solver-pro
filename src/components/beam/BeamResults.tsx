"use client";

import { MatricesView } from "@/components/shared/MatricesView";
import type { SolveResponse } from "@/lib/types";

export function BeamResults({ result }: { result: SolveResponse | null }) {
  if (!result) return <Placeholder text="Presiona Calcular para ver resultados." />;
  if (!result.ok) return <ErrorBox msg={result.error ?? "Error en el cálculo"} />;

  return (
    <div className="space-y-4">
      <Card title="Desplazamientos nodales">
        <Table headers={["Nodo", "v (m)", "θ (rad)"]}
               rows={(result.displacements ?? []).map((d, i) => [`N${i + 1}`, fmt(d[0], 6), fmt(d[1], 6)])} />
      </Card>
      <Card title="Reacciones en apoyos">
        <Table headers={["Nodo", "R_y (kN)", "M (kN·m)"]}
               rows={(result.reactions ?? []).map((r, i) => [`N${i + 1}`, fmt(r[0], 3), fmt(r[1], 3)])} />
      </Card>
      <Card title="Fuerzas internas por tramo">
        <Table
          headers={["Tramo", "V_i (kN)", "M_i (kN·m)", "V_j (kN)", "M_j (kN·m)"]}
          rows={(result.member_forces ?? []).map((f) => [
            `T${f.spanIndex + 1}`,
            fmt(f.V_i, 3), fmt(f.M_i, 3), fmt(f.V_j, 3), fmt(f.M_j, 3),
          ])}
        />
      </Card>
    </div>
  );
}

export function BeamDiagrams({ result }: { result: SolveResponse | null }) {
  if (!result?.ok) return <Placeholder text="Calcula la estructura para ver los diagramas." />;
  return (
    <div className="space-y-4">
      <Card title="Diagrama de Cortante (V)">
        <DiagramSvg data={result.diagrams ?? []} key_y="V" color="#16a34a" unit="kN" />
      </Card>
      <Card title="Diagrama de Momento (M)">
        <DiagramSvg data={result.diagrams ?? []} key_y="M" color="#dc2626" unit="kN·m" />
      </Card>
    </div>
  );
}

export function BeamMatrices({ result }: { result: SolveResponse | null }) {
  // En viga continua no hay matriz de transformación (todos los tramos son horizontales)
  return <MatricesView result={result} hasTransform={false} />;
}

// ============================================================
// Helpers
// ============================================================
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-xs font-bold text-slate-700 tracking-wider mb-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-brand-500" />
        {title.toUpperCase()}
      </h3>
      {children}
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
      {text}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{msg}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
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

function Matrix({ mat }: { mat: number[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs font-mono">
        <tbody>
          {mat.map((row, i) => (
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

function DiagramSvg({
  data, key_y, color, unit,
}: {
  data: NonNullable<SolveResponse["diagrams"]>;
  key_y: "V" | "M";
  color: string;
  unit: string;
}) {
  if (data.length === 0) return null;
  const W = 600, H = 180, padX = 30, padY = 30;

  const allX: number[] = [];
  const allY: number[] = [];
  let offset = 0;
  const segments: { x: number[]; y: number[] }[] = [];
  for (const seg of data) {
    const xs = seg.x.map((v) => v + offset);
    segments.push({ x: xs, y: seg[key_y] });
    allX.push(...xs);
    allY.push(...seg[key_y]);
    offset += seg.x[seg.x.length - 1];
  }
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const yMin = Math.min(...allY, 0), yMax = Math.max(...allY, 0);
  const yRange = yMax - yMin || 1;

  const px = (x: number) => padX + ((x - xMin) / (xMax - xMin || 1)) * (W - 2 * padX);
  const py = (y: number) => padY + (H - 2 * padY) * (1 - (y - yMin) / yRange);
  const py0 = py(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <line x1={padX} y1={py0} x2={W - padX} y2={py0} stroke="#94a3b8" strokeWidth="1" />
      {segments.map((seg, i) => {
        const path = seg.x.map((xv, k) =>
          `${k === 0 ? "M" : "L"} ${px(xv)} ${py(seg.y[k])}`
        ).join(" ");
        const fillPath =
          `M ${px(seg.x[0])} ${py0} ` +
          seg.x.map((xv, k) => `L ${px(xv)} ${py(seg.y[k])}`).join(" ") +
          ` L ${px(seg.x[seg.x.length - 1])} ${py0} Z`;
        return (
          <g key={i}>
            <path d={fillPath} fill={color} fillOpacity={0.15} />
            <path d={path} fill="none" stroke={color} strokeWidth="2" />
          </g>
        );
      })}
      <text x={padX} y={padY - 10} fontSize="10" fill={color}>max {fmt(yMax, 2)} {unit}</text>
      <text x={padX} y={H - 8} fontSize="10" fill={color}>min {fmt(yMin, 2)} {unit}</text>
    </svg>
  );
}

function fmt(n: number, digits = 3): string {
  if (Math.abs(n) < 1e-9) return "0";
  if (Math.abs(n) >= 1e4 || Math.abs(n) < 1e-3) return n.toExponential(2);
  return n.toFixed(digits);
}
