/**
 * Solver de viga continua 2D por el Método Matricial de la Rigidez.
 * Portado de Python (NumPy) a TypeScript.
 *
 * GDL por nodo: 2 (v = desplazamiento vertical, theta = rotación).
 * Convención:
 *   - v positivo hacia arriba
 *   - theta positivo antihorario
 *   - Cargas POSITIVAS = hacia abajo (gravedad)
 *   - Momentos POSITIVOS = antihorario
 */

import type { BeamModel, Load, SolveResponse, SupportType } from "./types";
import { staticCondense } from "./linalg";

const SUPPORT_RESTRAINTS: Record<SupportType, [boolean, boolean]> = {
  PIN:   [true,  false],
  ROD:   [true,  false],
  EMP:   [true,  true],
  LIBRE: [false, false],
};

// ----------------------------------------------------------------------
// Algebra mínima
// ----------------------------------------------------------------------
function zeros(rows: number, cols?: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols ?? rows).fill(0));
}
function matMulVec(M: number[][], v: number[]): number[] {
  const n = M.length;
  const out = Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < v.length; j++) out[i] += M[i][j] * v[j];
  return out;
}
function submatrix(M: number[][], rows: number[], cols: number[]): number[][] {
  return rows.map((r) => cols.map((c) => M[r][c]));
}
function subvector(v: number[], idx: number[]): number[] {
  return idx.map((i) => v[i]);
}

/** Gaussian elimination con pivoteo parcial. Resuelve A x = b. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let maxRow = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[maxRow][k])) maxRow = i;
    [M[k], M[maxRow]] = [M[maxRow], M[k]];
    if (Math.abs(M[k][k]) < 1e-12) throw new Error("Matriz singular");
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

// ----------------------------------------------------------------------
// Rigidez de elemento
// ----------------------------------------------------------------------
function kLocal(EI: number, L: number): number[][] {
  const L2 = L * L, L3 = L2 * L;
  return [
    [ 12 * EI / L3,    6 * EI / L2,   -12 * EI / L3,    6 * EI / L2],
    [  6 * EI / L2,    4 * EI / L,    -6 * EI / L2,     2 * EI / L ],
    [-12 * EI / L3,   -6 * EI / L2,   12 * EI / L3,    -6 * EI / L2],
    [  6 * EI / L2,    2 * EI / L,    -6 * EI / L2,     4 * EI / L ],
  ];
}

// ----------------------------------------------------------------------
// Cargas equivalentes nodales (signo: positivo = abajo)
// ----------------------------------------------------------------------
function equivUniform(w: number, L: number): number[] {
  return [-w * L / 2, -w * L * L / 12, -w * L / 2, w * L * L / 12];
}
function equivPoint(P: number, a: number, L: number): number[] {
  const b = L - a;
  if (a < 0 || b < 0) return [0, 0, 0, 0];
  const L3 = L ** 3;
  return [
    -P * b * b * (L + 2 * a) / L3,
    -P * a * b * b / (L * L),
    -P * a * a * (L + 2 * b) / L3,
     P * a * a * b / (L * L),
  ];
}
function equivMoment(M0: number, a: number, L: number): number[] {
  const b = L - a;
  if (a < 0 || b < 0) return [0, 0, 0, 0];
  const L2 = L * L, L3 = L * L2;
  return [
     6 * M0 * a * b / L3,
    -M0 * b * (2 * a - b) / L2,
    -6 * M0 * a * b / L3,
    -M0 * a * (2 * b - a) / L2,
  ];
}
function equivTrapezoidal(w1: number, w2: number, L: number): number[] {
  const wBase = Math.min(w1, w2);
  const eq = equivUniform(wBase, L);
  const delta = Math.abs(w2 - w1);
  if (delta < 1e-12) return eq;
  const tri = w2 > w1
    ? [-delta * L * 3 / 20, -delta * L * L / 30, -delta * L * 7 / 20,  delta * L * L / 20]
    : [-delta * L * 7 / 20, -delta * L * L / 20, -delta * L * 3 / 20,  delta * L * L / 30];
  return eq.map((v, i) => v + tri[i]);
}

function spanEquivLoad(load: Load, L: number): number[] {
  switch (load.type) {
    case "uniforme":    return equivUniform(load.magnitude, L);
    case "puntual":     return equivPoint(load.magnitude, load.position ?? L / 2, L);
    case "momento":     return equivMoment(load.magnitude, load.position ?? L / 2, L);
    case "trapezoidal": return equivTrapezoidal(load.magnitude, load.magnitude2 ?? load.magnitude, L);
  }
}

// ----------------------------------------------------------------------
// Solver principal
// ----------------------------------------------------------------------
export function solveBeamLocal(model: BeamModel): SolveResponse {
  const { spans, supports, loads } = model;
  if (spans.length < 1) return { ok: false, error: "Se requiere al menos 1 tramo." };
  const nNodes = spans.length + 1;
  if (supports.length !== nNodes) {
    return { ok: false, error: `Se esperaban ${nNodes} apoyos, llegaron ${supports.length}.` };
  }

  const nDof = nNodes * 2;
  const K = zeros(nDof);
  const F = Array(nDof).fill(0);
  const spansData: {
    L: number; EI: number; dofMap: number[];
    keCondensed: number[][]; fEqCondensed: number[];
    releaseI: boolean; releaseJ: boolean;
  }[] = [];

  // ---------- Ensamblaje de K y F con condensación por rótula interna ----------
  // Para cada tramo: armamos k_local 4×4 y f_eq 4×1, aplicamos condensación
  // estática si hay rótulas internas (releaseI/releaseJ), luego ensamblamos.
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    const L = sp.L;
    if (L <= 0) return { ok: false, error: `Tramo T${i + 1}: L debe ser > 0.` };
    const E_kN_m2 = sp.E * 1e6;
    const I_m4 = sp.I * 1e-8;
    const EI = E_kN_m2 * I_m4;
    let ke = kLocal(EI, L);

    // f_eq de este tramo (suma de equivalentes de todas sus cargas)
    let fEqElem = [0, 0, 0, 0];
    for (const load of loads) {
      if (load.spanIndex !== i) continue;
      const eq = spanEquivLoad(load, L);
      fEqElem = fEqElem.map((v, j) => v + eq[j]);
    }

    // GDL locales liberados (rotaciones en extremos articulados):
    // - releaseI → libera θ_i en GDL local 1
    // - releaseJ → libera θ_j en GDL local 3
    const released: number[] = [];
    if (sp.releaseI) released.push(1);
    if (sp.releaseJ) released.push(3);
    if (released.length === 2) {
      return { ok: false, error: `Tramo T${i + 1}: no puede tener rótulas en ambos extremos (mecanismo).` };
    }
    if (released.length > 0) {
      const cond = staticCondense(ke, fEqElem, released);
      ke = cond.k;
      fEqElem = cond.f;
    }

    const dofMap = [2 * i, 2 * i + 1, 2 * (i + 1), 2 * (i + 1) + 1];
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++)
        K[dofMap[a]][dofMap[b]] += ke[a][b];
    for (let a = 0; a < 4; a++)
      F[dofMap[a]] += fEqElem[a];
    spansData.push({
      L, EI, dofMap,
      keCondensed: ke, fEqCondensed: fEqElem,
      releaseI: !!sp.releaseI, releaseJ: !!sp.releaseJ,
    });
  }

  // GDL libres/restringidos
  const free: number[] = [], fixed: number[] = [];
  for (let i = 0; i < supports.length; i++) {
    const [rv, rt] = SUPPORT_RESTRAINTS[supports[i].type];
    (rv ? fixed : free).push(2 * i);
    (rt ? fixed : free).push(2 * i + 1);
  }

  // Resolución
  const U = Array(nDof).fill(0);
  if (free.length > 0) {
    const K_LL = submatrix(K, free, free);
    const F_L = subvector(F, free);
    let U_L: number[];
    try { U_L = solveLinear(K_LL, F_L); }
    catch { return { ok: false, error: "Matriz singular: la viga es un mecanismo. Revisar apoyos." }; }
    for (let i = 0; i < free.length; i++) U[free[i]] = U_L[i];
  }

  // Reacciones: R = K·U - F
  const KU = matMulVec(K, U);
  const R_full = KU.map((v, i) => v - F[i]);

  // Desplazamientos por nodo
  const displacements: number[][] = [];
  for (let i = 0; i < nNodes; i++) displacements.push([U[2 * i], U[2 * i + 1]]);

  // Reacciones por nodo
  const reactions: number[][] = [];
  for (let i = 0; i < supports.length; i++) {
    const [rv, rt] = SUPPORT_RESTRAINTS[supports[i].type];
    reactions.push([rv ? R_full[2 * i] : 0, rt ? R_full[2 * i + 1] : 0]);
  }

  // Fuerzas internas y diagramas por tramo
  const member_forces: NonNullable<SolveResponse["member_forces"]> = [];
  const diagrams: NonNullable<SolveResponse["diagrams"]> = [];

  for (let i = 0; i < spansData.length; i++) {
    const { L, dofMap, keCondensed, fEqCondensed, releaseI, releaseJ } = spansData[i];
    const u_e = dofMap.map((d) => U[d]);

    // f_internal = k_condensed·u - F_eq_condensed
    // Esto da fuerzas internas consistentes con la condensación por rótula.
    const ku = matMulVec(keCondensed, u_e);
    const fInt = ku.map((v, j) => v - fEqCondensed[j]);

    // Convención de INGENIERÍA: M_eng = -M_matricial en el extremo izq.
    // Si hay rótula en el extremo i, M_i = 0 por definición.
    const V_i = fInt[0];
    const M_i = releaseI ? 0 : -fInt[1];
    // (M_j sigue saliendo del cálculo del diagrama, automáticamente correcto.)
    void releaseJ;

    // Diagramas
    const N_POINTS = 41;
    const xs: number[] = [], Vs: number[] = [], Ms: number[] = [];
    const spanLoads = loads.filter((l) => l.spanIndex === i);
    for (let k = 0; k < N_POINTS; k++) {
      const x = (L * k) / (N_POINTS - 1);
      let V = V_i;
      let M = M_i + V_i * x;
      for (const l of spanLoads) {
        if (l.type === "uniforme") {
          const w = l.magnitude;
          V -= w * x;
          M -= w * x * x / 2;
        } else if (l.type === "puntual") {
          const a = l.position ?? L / 2;
          if (x >= a) { V -= l.magnitude; M -= l.magnitude * (x - a); }
        } else if (l.type === "momento") {
          const a = l.position ?? L / 2;
          if (x >= a) M -= l.magnitude;
        } else if (l.type === "trapezoidal") {
          const w1 = l.magnitude, w2 = l.magnitude2 ?? w1;
          const Fw = w1 * x + (w2 - w1) * x * x / (2 * L);
          const Mw = w1 * x * x / 2 + (w2 - w1) * x * x * x / (3 * L);
          V -= Fw;
          M -= Mw;
        }
      }
      xs.push(x); Vs.push(V); Ms.push(M);
    }
    diagrams.push({ spanIndex: i, x: xs, V: Vs, M: Ms });
    member_forces.push({
      spanIndex: i,
      V_i: Vs[0], M_i: Ms[0],
      V_j: Vs[Vs.length - 1], M_j: Ms[Ms.length - 1],
    });
  }

  return {
    ok: true,
    displacements,
    reactions,
    member_forces,
    K_global: K,
    F_global: F,
    diagrams,
  };
}
