"use client";

/**
 * Visualización SVG genérica para armaduras y pórticos.
 * Dibuja nodos, barras, apoyos, cargas y (opcionalmente) deformada.
 */

import type { SolveResponse } from "@/lib/types";

interface GenericNode {
  id: string;
  x: number; y: number;
  fixed_u: boolean;
  fixed_v: boolean;
  fixed_theta?: boolean;
  fx: number; fy: number;
  m?: number;
}
interface GenericElement {
  id: string;
  nodeI: string;
  nodeJ: string;
}

export function GeometricView({
  nodes, elements, results, scale = 100, deformed = true,
}: {
  nodes: GenericNode[];
  elements: GenericElement[];
  results?: SolveResponse | null;
  scale?: number;
  deformed?: boolean;
}) {
  if (nodes.length === 0) return null;

  // Calcular bbox
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const span = Math.max(xMax - xMin, yMax - yMin, 1);
  const pad = span * 0.15;

  const W = 600, H = 420;
  const padPx = 40;
  const scaleX = (W - 2 * padPx) / (xMax - xMin + 2 * pad || 1);
  const scaleY = (H - 2 * padPx) / (yMax - yMin + 2 * pad || 1);
  const k = Math.min(scaleX, scaleY);
  const px = (x: number) => padPx + (x - xMin + pad) * k;
  const py = (y: number) => H - padPx - (y - yMin + pad) * k;

  const idIndex = new Map(nodes.map((n, i) => [n.id, i]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid suave */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
        </pattern>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" opacity="0.5" />

      {/* Elementos (estructura original) */}
      {elements.map((e) => {
        const i = idIndex.get(e.nodeI)!;
        const j = idIndex.get(e.nodeJ)!;
        const ni = nodes[i], nj = nodes[j];

        // Color por estado axial
        let stroke = "#0d9488";
        let strokeWidth = 3;
        if (results?.ok && results.member_forces) {
          const mf = results.member_forces.find((m) => m.spanIndex ===
            elements.indexOf(e));
          if (mf?.state === "Tracción") { stroke = "#16a34a"; strokeWidth = 3; }
          else if (mf?.state === "Compresión") { stroke = "#dc2626"; strokeWidth = 3; }
        }
        return (
          <line key={e.id}
                x1={px(ni.x)} y1={py(ni.y)}
                x2={px(nj.x)} y2={py(nj.y)}
                stroke={stroke} strokeWidth={strokeWidth} />
        );
      })}

      {/* Deformada */}
      {deformed && results?.ok && results.displacements && (
        elements.map((e) => {
          const i = idIndex.get(e.nodeI)!;
          const j = idIndex.get(e.nodeJ)!;
          const ni = nodes[i], nj = nodes[j];
          const di = results.displacements![i];
          const dj = results.displacements![j];
          return (
            <line key={"d-" + e.id}
                  x1={px(ni.x + scale * di[0])} y1={py(ni.y + scale * di[1])}
                  x2={px(nj.x + scale * dj[0])} y2={py(nj.y + scale * dj[1])}
                  stroke="#0d9488" strokeWidth={1.5}
                  strokeDasharray="4 3" opacity={0.6} />
          );
        })
      )}

      {/* Nodos */}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={px(n.x)} cy={py(n.y)} r={5} fill="#0f172a" />
          <text x={px(n.x) + 8} y={py(n.y) - 6}
                fontSize="11" fontWeight="600" fill="#0f766e">
            {n.id}
          </text>
          {renderSupport(n, px(n.x), py(n.y))}
        </g>
      ))}

      {/* Cargas nodales */}
      {nodes.map((n) => {
        const arrowLen = 35;
        const out: React.ReactNode[] = [];
        if (n.fx) {
          const dir = n.fx > 0 ? 1 : -1;
          out.push(
            <line key={"fx-" + n.id}
                  x1={px(n.x) - dir * arrowLen} y1={py(n.y)}
                  x2={px(n.x)} y2={py(n.y)}
                  stroke="#dc2626" strokeWidth={2}
                  markerEnd="url(#arrow-red)" />
          );
          out.push(
            <text key={"fx-t-" + n.id}
                  x={px(n.x) - dir * (arrowLen + 4)} y={py(n.y) + 4}
                  fontSize="10" fill="#dc2626"
                  textAnchor={dir > 0 ? "end" : "start"}>
              {n.fx} kN
            </text>
          );
        }
        if (n.fy) {
          const dir = n.fy > 0 ? -1 : 1;  // +Fy hacia arriba, -Fy hacia abajo en pantalla
          out.push(
            <line key={"fy-" + n.id}
                  x1={px(n.x)} y1={py(n.y) - dir * arrowLen}
                  x2={px(n.x)} y2={py(n.y)}
                  stroke="#dc2626" strokeWidth={2}
                  markerEnd="url(#arrow-red)" />
          );
          out.push(
            <text key={"fy-t-" + n.id}
                  x={px(n.x) + 6} y={py(n.y) - dir * (arrowLen + 2)}
                  fontSize="10" fill="#dc2626">
              {n.fy} kN
            </text>
          );
        }
        if (n.m) {
          out.push(
            <text key={"m-" + n.id}
                  x={px(n.x) - 20} y={py(n.y) + 22}
                  fontSize="10" fill="#dc2626">
              M={n.m} kN·m
            </text>
          );
        }
        return <g key={"loads-" + n.id}>{out}</g>;
      })}
    </svg>
  );
}

function renderSupport(n: GenericNode, x: number, y: number) {
  // Empotrado (fixed_u + fixed_v + fixed_theta)
  if (n.fixed_u && n.fixed_v && (n.fixed_theta ?? false)) {
    return (
      <g>
        <rect x={x - 14} y={y + 3} width={28} height={5} fill="#0f766e" />
        {Array.from({ length: 6 }).map((_, k) => (
          <line key={k} x1={x - 12 + k * 5} y1={y + 8}
                x2={x - 16 + k * 5} y2={y + 14}
                stroke="#0f766e" strokeWidth="1.2" />
        ))}
      </g>
    );
  }
  // Articulado (PIN: fixed_u + fixed_v)
  if (n.fixed_u && n.fixed_v) {
    return (
      <g>
        <polygon points={`${x},${y} ${x - 10},${y + 14} ${x + 10},${y + 14}`}
                 fill="#0f766e" />
        <line x1={x - 14} y1={y + 14} x2={x + 14} y2={y + 14}
              stroke="#0f766e" strokeWidth="2" />
        {Array.from({ length: 5 }).map((_, k) => (
          <line key={k} x1={x - 12 + k * 6} y1={y + 14}
                x2={x - 16 + k * 6} y2={y + 20}
                stroke="#0f766e" strokeWidth="1" />
        ))}
      </g>
    );
  }
  // Rodillo (solo fixed_v)
  if (n.fixed_v) {
    return (
      <g>
        <polygon points={`${x},${y} ${x - 10},${y + 12} ${x + 10},${y + 12}`}
                 fill="#0f766e" />
        <circle cx={x - 5} cy={y + 17} r={3} fill="#0f766e" />
        <circle cx={x + 5} cy={y + 17} r={3} fill="#0f766e" />
        <line x1={x - 14} y1={y + 22} x2={x + 14} y2={y + 22}
              stroke="#0f766e" strokeWidth="2" />
      </g>
    );
  }
  // Solo horizontal restringido
  if (n.fixed_u) {
    return (
      <g>
        <polygon points={`${x},${y} ${x + 14},${y - 10} ${x + 14},${y + 10}`}
                 fill="#0f766e" />
        <line x1={x + 14} y1={y - 14} x2={x + 14} y2={y + 14}
              stroke="#0f766e" strokeWidth="2" />
      </g>
    );
  }
  return null;
}
