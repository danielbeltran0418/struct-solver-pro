/**
 * Solver de armadura 2D por el Método Matricial de la Rigidez.
 * 2 GDL por nodo: u (X), v (Y). Barras solo axiales.
 */

import type { SolveResponse, TrussModel } from "./types";
import {
  zeros, matMul, matMulVec, transpose, submatrix, subvector, solveLinear,
} from "./linalg";

const DOF = 2;

function kLocal(EA_L: number): number[][] {
  return [
    [ EA_L,  0, -EA_L, 0],
    [    0,  0,     0, 0],
    [-EA_L,  0,  EA_L, 0],
    [    0,  0,     0, 0],
  ];
}

function transformT(c: number, s: number): number[][] {
  return [
    [ c,  s, 0, 0],
    [-s,  c, 0, 0],
    [ 0,  0, c, s],
    [ 0,  0,-s, c],
  ];
}

export function solveTruss(model: TrussModel): SolveResponse {
  const { nodes, elements } = model;
  if (nodes.length < 2) return { ok: false, error: "Se requieren al menos 2 nodos." };
  if (elements.length < 1) return { ok: false, error: "Se requiere al menos 1 barra." };

  const idIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const nDof = nodes.length * DOF;
  const K = zeros(nDof);
  const F = Array(nDof).fill(0);

  // Cargas nodales
  nodes.forEach((n, i) => {
    F[DOF * i]     += n.fx;
    F[DOF * i + 1] += n.fy;
  });

  // Ensamblaje
  const elementData: {
    L: number; c: number; s: number; EA_L: number;
    dofMap: number[]; T: number[][]; kLoc: number[][]; kGlob: number[][];
  }[] = [];

  for (const e of elements) {
    const i = idIndex.get(e.nodeI), j = idIndex.get(e.nodeJ);
    if (i === undefined || j === undefined)
      return { ok: false, error: `Barra ${e.id}: nodo ${e.nodeI} o ${e.nodeJ} no existe.` };
    const ni = nodes[i], nj = nodes[j];
    const dx = nj.x - ni.x, dy = nj.y - ni.y;
    const L = Math.hypot(dx, dy);
    if (L <= 0) return { ok: false, error: `Barra ${e.id}: longitud nula.` };
    const c = dx / L, s = dy / L;
    // E: GPa -> kN/m² (×1e6); A: cm² -> m² (×1e-4)
    const EA_L = (e.E * 1e6) * (e.A * 1e-4) / L;
    const kLoc = kLocal(EA_L);
    const T = transformT(c, s);
    const kGlob = matMul(matMul(transpose(T), kLoc), T);
    const dofMap = [DOF * i, DOF * i + 1, DOF * j, DOF * j + 1];
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++)
        K[dofMap[a]][dofMap[b]] += kGlob[a][b];
    elementData.push({ L, c, s, EA_L, dofMap, T, kLoc, kGlob });
  }

  // GDL libres/restringidos
  const free: number[] = [], fixed: number[] = [];
  nodes.forEach((n, i) => {
    (n.fixed_u ? fixed : free).push(DOF * i);
    (n.fixed_v ? fixed : free).push(DOF * i + 1);
  });

  const U = Array(nDof).fill(0);
  if (free.length > 0) {
    const K_LL = submatrix(K, free, free);
    const F_L = subvector(F, free);
    let U_L: number[];
    try { U_L = solveLinear(K_LL, F_L); }
    catch { return { ok: false, error: "Matriz singular: la armadura es un mecanismo. Revisar apoyos." }; }
    for (let k = 0; k < free.length; k++) U[free[k]] = U_L[k];
  }

  const R_full = matMulVec(K, U).map((v, i) => v - F[i]);

  const displacements = nodes.map((_, i) => [U[DOF * i], U[DOF * i + 1]]);
  const reactions = nodes.map((n, i) => [
    n.fixed_u ? R_full[DOF * i]     : 0,
    n.fixed_v ? R_full[DOF * i + 1] : 0,
  ]);

  // Fuerza axial por barra: N = (EA/L) * (uj' - ui')  donde u' es disp. axial local
  const member_forces: NonNullable<SolveResponse["member_forces"]> = [];
  for (let idx = 0; idx < elements.length; idx++) {
    const e = elementData[idx];
    const uGlob = e.dofMap.map((d) => U[d]);
    const uLoc = matMulVec(e.T, uGlob);
    const delta = uLoc[2] - uLoc[0];   // alargamiento del elemento
    const N = e.EA_L * delta;          // positivo = tracción
    let state: "Tracción" | "Compresión" | "Nulo" = "Nulo";
    if (Math.abs(N) > 1e-6) state = N > 0 ? "Tracción" : "Compresión";
    member_forces.push({
      spanIndex: idx,
      V_i: 0, M_i: 0, V_j: 0, M_j: 0,
      N, state,
    });
  }

  return {
    ok: true,
    displacements, reactions,
    member_forces,
    K_global: K, F_global: F,
  };
}
