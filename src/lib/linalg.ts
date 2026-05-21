/**
 * Mini álgebra lineal compartida (matrices densas, JS puro).
 * Reutilizada por beam/truss/frame solvers.
 */

export function zeros(rows: number, cols?: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols ?? rows).fill(0));
}

export function matMulVec(M: number[][], v: number[]): number[] {
  const n = M.length;
  const out = Array(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < v.length; j++) out[i] += M[i][j] * v[j];
  return out;
}

export function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length, inner = B.length, cols = B[0].length;
  const C = zeros(rows, cols);
  for (let i = 0; i < rows; i++)
    for (let k = 0; k < inner; k++) {
      const aik = A[i][k];
      for (let j = 0; j < cols; j++) C[i][j] += aik * B[k][j];
    }
  return C;
}

export function transpose(A: number[][]): number[][] {
  const r = A.length, c = A[0].length;
  const T = zeros(c, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) T[j][i] = A[i][j];
  return T;
}

export function submatrix(M: number[][], rows: number[], cols: number[]): number[][] {
  return rows.map((r) => cols.map((c) => M[r][c]));
}

export function subvector(v: number[], idx: number[]): number[] {
  return idx.map((i) => v[i]);
}

/**
 * Condensación estática a nivel de elemento.
 * Dado k (n×n), f (n), y un conjunto de GDL "released" (típicamente rotaciones
 * en extremos articulados), retorna un k' y f' n×n donde:
 *   - Las filas/columnas de los GDL liberados quedan en cero.
 *   - Los GDL retenidos contienen la rigidez/fuerza efectiva tras condensar:
 *       k_a' = k_aa − k_ab · k_bb⁻¹ · k_ba
 *       f_a' = f_a   − k_ab · k_bb⁻¹ · f_b
 *
 * Esto representa físicamente que el momento (o cualquier GDL liberado) en
 * el extremo del elemento es CERO, y la deformación correspondiente queda
 * resuelta por las otras DOFs.
 */
export function staticCondense(
  k: number[][], f: number[], released: number[],
): { k: number[][]; f: number[] } {
  if (released.length === 0) return { k, f };
  const n = k.length;
  const releasedSet = new Set(released);
  const retained = Array.from({ length: n }, (_, i) => i).filter((i) => !releasedSet.has(i));

  const k_aa = submatrix(k, retained, retained);
  const k_ab = submatrix(k, retained, released);
  const k_ba = submatrix(k, released, retained);
  const k_bb = submatrix(k, released, released);
  const f_a = subvector(f, retained);
  const f_b = subvector(f, released);

  // k_bb_inv (típicamente 1×1 o 2×2 — usamos solve por columnas)
  const nb = released.length;
  const k_bb_inv = zeros(nb);
  for (let col = 0; col < nb; col++) {
    const e = Array(nb).fill(0); e[col] = 1;
    let sol: number[];
    try { sol = solveLinear(k_bb, e); }
    catch { return { k, f }; }  // fallback: si no se puede condensar, no liberar
    for (let row = 0; row < nb; row++) k_bb_inv[row][col] = sol[row];
  }

  const k_ab_kbbinv = matMul(k_ab, k_bb_inv);                 // (na × nb)
  const correction_k = matMul(k_ab_kbbinv, k_ba);             // (na × na)
  const k_a_new = k_aa.map((row, i) => row.map((v, j) => v - correction_k[i][j]));

  const correction_f = matMulVec(k_ab_kbbinv, f_b);
  const f_a_new = f_a.map((v, i) => v - correction_f[i]);

  // Re-expandir a n×n con ceros en filas/columnas liberadas
  const k_full = zeros(n);
  const f_full = Array(n).fill(0);
  for (let i = 0; i < retained.length; i++) {
    f_full[retained[i]] = f_a_new[i];
    for (let j = 0; j < retained.length; j++) {
      k_full[retained[i]][retained[j]] = k_a_new[i][j];
    }
  }
  return { k: k_full, f: f_full };
}

/** Gaussian elimination con pivoteo parcial. Resuelve A x = b. */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let maxRow = k;
    for (let i = k + 1; i < n; i++)
      if (Math.abs(M[i][k]) > Math.abs(M[maxRow][k])) maxRow = i;
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
