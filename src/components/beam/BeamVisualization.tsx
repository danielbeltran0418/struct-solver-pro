"use client";

import type { BeamModel, SupportType } from "@/lib/types";

export function BeamVisualization({ model }: { model: BeamModel }) {
  const totalL = model.spans.reduce((s, sp) => s + sp.L, 0) || 1;
  const W = 600;
  const H = 220;
  const padX = 40;
  const padY = 90;
  const scale = (W - 2 * padX) / totalL;

  // Acumular posiciones de nodos
  const nodePositions: number[] = [0];
  let acc = 0;
  for (const sp of model.spans) {
    acc += sp.L;
    nodePositions.push(acc);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-xs font-bold text-slate-700 tracking-wider mb-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-brand-500" />
        VISTA DE LA VIGA
      </h3>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Eje del piso */}
        <line x1={0} y1={padY + 30} x2={W} y2={padY + 30}
              stroke="#e2e8f0" strokeDasharray="2 4" />

        {/* Viga */}
        {model.spans.map((sp, i) => {
          const x1 = padX + nodePositions[i] * scale;
          const x2 = padX + nodePositions[i + 1] * scale;
          return (
            <g key={i}>
              <rect x={x1} y={padY - 4} width={x2 - x1} height={8}
                    fill="#60a5fa" stroke="#2563eb" />
              <text x={(x1 + x2) / 2} y={padY + 20} textAnchor="middle"
                    fontSize="11" fill="#64748b">
                T{i + 1} ({sp.L} m)
              </text>
            </g>
          );
        })}

        {/* Apoyos */}
        {model.supports.map((s, i) => {
          const x = padX + nodePositions[i] * scale;
          const y = padY + 4;
          return (
            <g key={s.id}>
              {renderSupport(s.type, x, y)}
              <text x={x} y={padY - 12} textAnchor="middle"
                    fontSize="11" fontWeight="600" fill="#2563eb">
                {s.id}
              </text>
            </g>
          );
        })}

        {/* Cargas */}
        {model.loads.map((l) => {
          const spanStart = nodePositions[l.spanIndex];
          const spanLen = model.spans[l.spanIndex]?.L ?? 0;
          if (l.type === "puntual") {
            const x = padX + (spanStart + (l.position ?? 0)) * scale;
            return (
              <g key={l.id}>
                <line x1={x} y1={padY - 35} x2={x} y2={padY - 6}
                      stroke="#dc2626" strokeWidth="2" markerEnd="url(#arrow)" />
                <text x={x + 4} y={padY - 36} fontSize="10" fill="#dc2626">
                  {l.magnitude} kN
                </text>
              </g>
            );
          }
          if (l.type === "uniforme") {
            const x1 = padX + spanStart * scale;
            const x2 = padX + (spanStart + spanLen) * scale;
            return (
              <g key={l.id}>
                <line x1={x1} y1={padY - 30} x2={x2} y2={padY - 30}
                      stroke="#dc2626" strokeWidth="2" />
                {Array.from({ length: 6 }).map((_, k) => {
                  const xa = x1 + ((x2 - x1) * k) / 5;
                  return <line key={k} x1={xa} y1={padY - 30} x2={xa} y2={padY - 6}
                                stroke="#dc2626" strokeWidth="1.5" markerEnd="url(#arrow)" />;
                })}
                <text x={(x1 + x2) / 2} y={padY - 36} textAnchor="middle"
                      fontSize="10" fill="#dc2626">
                  {l.magnitude} kN/m
                </text>
              </g>
            );
          }
          if (l.type === "momento") {
            const x = padX + (spanStart + (l.position ?? 0)) * scale;
            return (
              <g key={l.id}>
                <path d={`M ${x - 12} ${padY} A 12 12 0 1 1 ${x + 12} ${padY}`}
                      fill="none" stroke="#dc2626" strokeWidth="2"
                      markerEnd="url(#arrow)" />
                <text x={x + 18} y={padY - 8} fontSize="10" fill="#dc2626">
                  {l.magnitude} kN·m
                </text>
              </g>
            );
          }
          return null;
        })}

        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
          </marker>
        </defs>
      </svg>

      {/* Stats */}
      <div className="flex items-center gap-6 mt-2 text-sm text-slate-500">
        <span><span className="font-semibold text-slate-700 text-base">{model.spans.length}</span> Tramos</span>
        <span><span className="font-semibold text-slate-700 text-base">{model.supports.length}</span> Nodos</span>
        <span><span className="font-semibold text-slate-700 text-base">{model.loads.length}</span> Cargas</span>
      </div>

      {/* Guía rápida */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-bold text-slate-700 tracking-wider mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          GUÍA RÁPIDA
        </h4>
        <ol className="text-xs text-slate-600 space-y-1.5">
          <li><span className="font-semibold text-brand-600">1.</span> Añade tramos — ingresa L, material, E e I.</li>
          <li><span className="font-semibold text-brand-600">2.</span> Selecciona apoyo en cada nodo con el dropdown.</li>
          <li><span className="font-semibold text-brand-600">3.</span> Añade cargas puntuales, uniformes o trapezoidales.</li>
          <li><span className="font-semibold text-brand-600">4.</span> Presiona <strong>Calcular</strong> — verás Resultados.</li>
        </ol>
      </div>
    </div>
  );
}

function renderSupport(type: SupportType, x: number, y: number) {
  if (type === "PIN") {
    return (
      <g>
        <polygon points={`${x},${y} ${x - 10},${y + 16} ${x + 10},${y + 16}`}
                 fill="#1d4ed8" />
        <line x1={x - 14} y1={y + 16} x2={x + 14} y2={y + 16}
              stroke="#1d4ed8" strokeWidth="2" />
        {Array.from({ length: 5 }).map((_, k) => (
          <line key={k} x1={x - 12 + k * 6} y1={y + 16}
                x2={x - 16 + k * 6} y2={y + 22}
                stroke="#1d4ed8" strokeWidth="1" />
        ))}
      </g>
    );
  }
  if (type === "ROD") {
    return (
      <g>
        <polygon points={`${x},${y} ${x - 10},${y + 12} ${x + 10},${y + 12}`}
                 fill="#1d4ed8" />
        <circle cx={x - 5} cy={y + 17} r={3} fill="#1d4ed8" />
        <circle cx={x + 5} cy={y + 17} r={3} fill="#1d4ed8" />
        <line x1={x - 14} y1={y + 22} x2={x + 14} y2={y + 22}
              stroke="#1d4ed8" strokeWidth="2" />
      </g>
    );
  }
  if (type === "EMP") {
    return (
      <g>
        <rect x={x - 12} y={y} width={24} height={4} fill="#1d4ed8" />
        {Array.from({ length: 6 }).map((_, k) => (
          <line key={k} x1={x - 12 + k * 5} y1={y + 4}
                x2={x - 16 + k * 5} y2={y + 12}
                stroke="#1d4ed8" strokeWidth="1.2" />
        ))}
      </g>
    );
  }
  return null;
}
