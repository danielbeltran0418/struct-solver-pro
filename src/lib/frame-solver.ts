/**
 * Solver de pórtico 2D por el Método Matricial de la Rigidez.
 * 3 GDL por nodo: u (X), v (Y), theta (rotación).
 * Elementos: axial + flexión Euler-Bernoulli.
 */

import type { FrameModel, SolveResponse } from "./types";
import {
  zeros, matMul, matMulVec, transpose, submatrix, subvector, solveLinear,
  staticCondense,
} from "./linalg";

const DOF = 3;

function kLocal(E_kN_m2: number, A_m2: number, I_m4: number, L: number): number[][] {
  const EA_L = E_kN_m2 * A_m2 / L;
  const EI = E_kN_m2 * I_m4;
  const L2 = L * L, L3 = L2 * L;
  return [
    [ EA_L,         0,            0,        -EA_L,        0,            0       ],
    [    0,   12 * EI / L3,  6 * EI / L2,      0,  -12 * EI / L3,  6 * EI / L2  ],
    [    0,    6 * EI / L2,  4 * EI / L,       0,   -6 * EI / L2,  2 * EI / L   ],
    [-EA_L,         0,            0,         EA_L,        0,            0       ],
    [    0,  -12 * EI / L3, -6 * EI / L2,      0,   12 * EI / L3, -6 * EI / L2  ],
    [    0,    6 * EI / L2,  2 * EI / L,       0,   -6 * EI / L2,  4 * EI / L   ],
  ];
}

function transformT(c: number, s: number): number[][] {
  return [
    [ c,  s, 0,  0,  0, 0],
    [-s,  c, 0,  0,  0, 0],
    [ 0,  0, 1,  0,  0, 0],
    [ 0,  0, 0,  c,  s, 0],
    [ 0,  0, 0, -s,  c, 0],
    [ 0,  0, 0,  0,  0, 1],
  ];
}

export function solveFrame(model: FrameModel): SolveResponse {
  const { nodes, elements } = model;
  if (nodes.length < 2) return { ok: false, error: "Se requieren al menos 2 nodos." };
  if (elements.length < 1) return { ok: false, error: "Se requiere al menos 1 barra." };

  const idIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const nDof = nodes.length * DOF;
  const K = zeros(nDof);
  const F = Array(nDof).fill(0);

  // Cargas nodales (Fx, Fy, M)
  nodes.forEach((n, i) => {
    F[DOF * i]     += n.fx;
    F[DOF * i + 1] += n.fy;
    F[DOF * i + 2] += n.m;
  });

  const elementData: {
    L: number; c: number; s: number;
    dofMap: number[]; T: number[][];
    kLoc: number[][];     // matriz local (posiblemente condensada por rótula)
    releaseI: boolean; releaseJ: boolean;
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
    // E: GPa -> kN/m² (×1e6); A: cm² -> m² (×1e-4); I: cm⁴ -> m⁴ (×1e-8)
    const E_kN_m2 = e.E * 1e6;
    const A_m2 = e.A * 1e-4;
    const I_m4 = e.I * 1e-8;
    let kLoc = kLocal(E_kN_m2, A_m2, I_m4, L);

    // Rótula interna: liberar rotación en extremo i (GDL local 2) o j (GDL local 5).
    // No hay cargas distribuidas por barra en frame (solo nodales), así que f_eq = 0 → no
    // hay corrección de fuerzas equivalentes a nivel de elemento.
    const released: number[] = [];
    if (e.releaseI) released.push(2);
    if (e.releaseJ) released.push(5);
    if (released.length === 2) {
      return { ok: false, error: `Barra ${e.id}: no puede tener rótulas en ambos extremos (mecanismo de flexión).` };
    }
    if (released.length > 0) {
      const cond = staticCondense(kLoc, [0, 0, 0, 0, 0, 0], released);
      kLoc = cond.k;
    }

    const T = transformT(c, s);
    const kGlob = matMul(matMul(transpose(T), kLoc), T);
    const dofMap = [
      DOF * i, DOF * i + 1, DOF * i + 2,
      DOF * j, DOF * j + 1, DOF * j + 2,
    ];
    for (let a = 0; a < 6; a++)
      for (let b = 0; b < 6; b++)
        K[dofMap[a]][dofMap[b]] += kGlob[a][b];
    elementData.push({
      L, c, s, dofMap, T, kLoc,
      releaseI: !!e.releaseI, releaseJ: !!e.releaseJ,
    });
  }

  // GDL libres/restringidos
  const free: number[] = [], fixed: number[] = [];
  nodes.forEach((n, i) => {
    (n.fixed_u     ? fixed : free).push(DOF * i);
    (n.fixed_v     ? fixed : free).push(DOF * i + 1);
    (n.fixed_theta ? fixed : free).push(DOF * i + 2);
  });

  const U = Array(nDof).fill(0);
  if (free.length > 0) {
    const K_LL = submatrix(K, free, free);
    const F_L = subvector(F, free);
    let U_L: number[];
    try { U_L = solveLinear(K_LL, F_L); }
    catch { return { ok: false, error: "Matriz singular: el pórtico es un mecanismo. Revisar apoyos." }; }
    for (let k = 0; k < free.length; k++) U[free[k]] = U_L[k];
  }

  const R_full = matMulVec(K, U).map((v, i) => v - F[i]);

  const displacements = nodes.map((_, i) => [
    U[DOF * i], U[DOF * i + 1], U[DOF * i + 2],
  ]);
  const reactions = nodes.map((n, i) => [
    n.fixed_u     ? R_full[DOF * i]     : 0,
    n.fixed_v     ? R_full[DOF * i + 1] : 0,
    n.fixed_theta ? R_full[DOF * i + 2] : 0,
  ]);

  // Fuerzas internas en coordenadas LOCALES por elemento:
  //   f_local = k_local · T · u_global_e
  const member_forces: NonNullable<SolveResponse["member_forces"]> = [];
  for (let idx = 0; idx < elements.length; idx++) {
    const e = elementData[idx];
    const uGlob = e.dofMap.map((d) => U[d]);
    const uLoc = matMulVec(e.T, uGlob);
    const fLoc = matMulVec(e.kLoc, uLoc);
    // fLoc = [N_i, V_i_loc, M_i, N_j, V_j_loc, M_j]
    const N = fLoc[3];
    let state: "Tracción" | "Compresión" | "Nulo" = "Nulo";
    if (Math.abs(N) > 1e-6) state = N > 0 ? "Tracción" : "Compresión";
    member_forces.push({
      spanIndex: idx,
      N, state,
      V_i: fLoc[1], M_i: e.releaseI ? 0 : fLoc[2],
      V_j: fLoc[4], M_j: e.releaseJ ? 0 : fLoc[5],
    });
  }

  return {
    ok: true,
    displacements, reactions, member_forces,
    K_global: K, F_global: F,
  };
}
