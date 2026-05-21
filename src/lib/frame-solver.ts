/**
 * Solver de pórtico 2D por el Método Matricial de la Rigidez.
 * 3 GDL por nodo: u (X), v (Y), theta (rotación).
 * Elementos: axial + flexión Euler-Bernoulli.
 */

import type { FrameLoad, FrameModel, SolveResponse } from "./types";
import {
  zeros, matMul, matMulVec, transpose, submatrix, subvector, solveLinear,
  staticCondense,
} from "./linalg";

// ============================================================
// Cargas equivalentes nodales para barras de pórtico
// Devuelve f_eq en sistema LOCAL del elemento (6 GDL: u', v', θ y j'iguales).
// Convención local: x' a lo largo del elemento (de i a j), y' 90° CCW desde x'.
// ============================================================
function localEquivFromGlobalY(w: number, L: number, c: number, s: number,
  type: FrameLoad["type"], pos?: number, mag2?: number): number[] {
  // Carga vertical global "abajo+", magnitud w. Descomposición a ejes locales:
  //   w_x_local = -w·sinθ   (eje x' = (c, s))
  //   w_y_local = -w·cosθ   (eje y' = (-s, c))
  const wx = -w * s;
  const wy = -w * c;
  return localEquivCombined(wx, wy, L, type, pos, mag2);
}

function localEquivFromLocalPerp(w: number, L: number,
  type: FrameLoad["type"], pos?: number, mag2?: number): number[] {
  // Carga perpendicular al eje del elemento, "abajo+ respecto al elemento"
  // → en dirección -y' local. Componente axial = 0.
  return localEquivCombined(0, -w, L, type, pos, mag2);
}

/**
 * Cargas equivalentes para componentes axial (wx) y perpendicular (wy) en LOCAL.
 * Retorna vector 6×1: [N_i, V_i, M_i, N_j, V_j, M_j] como cargas APLICADAS al elemento.
 * Estos valores se SUMAN al vector F global tras aplicar Tᵀ.
 */
function localEquivCombined(wx: number, wy: number, L: number,
  type: FrameLoad["type"], pos?: number, mag2?: number): number[] {
  const L2 = L * L, L3 = L * L2;
  const f = [0, 0, 0, 0, 0, 0];

  if (type === "uniforme") {
    // Axial: cada extremo carga wx·L/2 en +x' local
    f[0] += wx * L / 2;
    f[3] += wx * L / 2;
    // Perpendicular: equivalente de viga uniforme con magnitud wy en +y'
    // Como wy es la magnitud "aplicada" (+y' positiva = arriba):
    //   FE_v_i = wy·L/2 en +y' (i)        ; equivalente aplicada al elemento = -FE
    //   FE_M_i = wy·L²/12 (CCW en i)       ; equivalente = -FE
    // Pero la convención que usamos en el solver: f_eq es la carga aplicada en
    // los nodos del elemento ⇒ + en sentido positivo del GDL local.
    f[1] += wy * L / 2;
    f[2] += wy * L2 / 12;
    f[4] += wy * L / 2;
    f[5] += -wy * L2 / 12;
    return f;
  }

  if (type === "puntual") {
    const a = pos ?? L / 2;
    const b = L - a;
    if (a < 0 || b < 0) return f;
    // Puntual: wx (axial) y wy (transversal) son fuerzas concentradas (kN)
    // Axial: distribuir proporcionalmente
    f[0] += wx * b / L;
    f[3] += wx * a / L;
    // Transversal (mismo set de fórmulas que viga):
    f[1] += wy * b * b * (L + 2 * a) / L3;
    f[2] += wy * a * b * b / (L * L);
    f[4] += wy * a * a * (L + 2 * b) / L3;
    f[5] += -wy * a * a * b / (L * L);
    return f;
  }

  if (type === "momento") {
    // Momento puntual aplicado (CCW positivo en local) a distancia 'a' del nodo i
    const M0 = wy;   // magnitud "perpendicular" se reinterpreta como momento
    const a = pos ?? L / 2;
    const b = L - a;
    if (a < 0 || b < 0) return f;
    f[1] += -6 * M0 * a * b / L3;
    f[2] +=  M0 * b * (2 * a - b) / L2;
    f[4] +=  6 * M0 * a * b / L3;
    f[5] +=  M0 * a * (2 * b - a) / L2;
    return f;
  }

  if (type === "trapezoidal") {
    // Trapezoidal en perpendicular: descompongo en rectángulo (min) + triángulo
    const w1 = wy;
    const w2 = mag2 !== undefined ? -Math.abs(mag2) * Math.sign(wy || 1) : wy;
    // (interpretación: usar wy como w1 perp, y mag2 como w2 perp. Mantenemos signo consistente.)
    const wBase = Math.min(w1, w2);
    const eq = localEquivCombined(0, wBase, L, "uniforme");
    for (let i = 0; i < 6; i++) f[i] += eq[i];
    const delta = Math.abs(w2 - w1);
    if (delta < 1e-12) {
      // axial también va
      f[0] += wx * L / 2; f[3] += wx * L / 2;
      return f;
    }
    // Triángulo
    const sgn = w2 < w1 ? 1 : -1;  // sgn determina si el triángulo crece hacia la derecha o izq
    if (sgn < 0) {  // triángulo con pico DERECHA
      f[1] += -delta * L * 3 / 20;
      f[2] += -delta * L2 / 30;
      f[4] += -delta * L * 7 / 20;
      f[5] +=  delta * L2 / 20;
    } else {  // pico IZQUIERDA
      f[1] += -delta * L * 7 / 20;
      f[2] += -delta * L2 / 20;
      f[4] += -delta * L * 3 / 20;
      f[5] +=  delta * L2 / 30;
    }
    f[0] += wx * L / 2; f[3] += wx * L / 2;
    return f;
  }

  return f;
}

function loadToLocalEquiv(load: FrameLoad, L: number, c: number, s: number): number[] {
  if (load.direction === "local_perp") {
    return localEquivFromLocalPerp(load.magnitude, L, load.type, load.position, load.magnitude2);
  }
  return localEquivFromGlobalY(load.magnitude, L, c, s, load.type, load.position, load.magnitude2);
}

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

  // ===== Cargas distribuidas/puntuales sobre las barras =====
  // Calcula equivalentes nodales en LOCAL, rota a GLOBAL con Tᵀ y suma a F.
  const loads = model.loads ?? [];
  const elementLocalEquiv: number[][] = elementData.map(() => [0, 0, 0, 0, 0, 0]);
  for (const load of loads) {
    const idx = elements.findIndex((e) => e.id === load.elementId);
    if (idx < 0) continue;
    const ed = elementData[idx];
    const fLocEq = loadToLocalEquiv(load, ed.L, ed.c, ed.s);
    // Acumulamos en el almacén local del elemento (para cálculo de fuerzas internas)
    for (let i = 0; i < 6; i++) elementLocalEquiv[idx][i] += fLocEq[i];
    // Rotamos a global: f_global = Tᵀ · f_local
    const fGlobEq = matMulVec(transpose(ed.T), fLocEq);
    for (let i = 0; i < 6; i++) F[ed.dofMap[i]] += fGlobEq[i];
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
  //   f_local = k_local · T · u_global_e − f_eq_local
  // (restamos las equivalentes locales para obtener las fuerzas internas verdaderas)
  const member_forces: NonNullable<SolveResponse["member_forces"]> = [];
  for (let idx = 0; idx < elements.length; idx++) {
    const e = elementData[idx];
    const uGlob = e.dofMap.map((d) => U[d]);
    const uLoc = matMulVec(e.T, uGlob);
    const fLocRaw = matMulVec(e.kLoc, uLoc);
    const fLoc = fLocRaw.map((v, k) => v - elementLocalEquiv[idx][k]);
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

  const element_matrices = elementData.map((ed, i) => ({
    id: elements[i].id,
    k_local: ed.kLoc,
    T: ed.T,
    k_global: matMul(matMul(transpose(ed.T), ed.kLoc), ed.T),
    dofMap: ed.dofMap,
  }));

  return {
    ok: true,
    displacements, reactions, member_forces,
    K_global: K, F_global: F,
    element_matrices,
  };
}
