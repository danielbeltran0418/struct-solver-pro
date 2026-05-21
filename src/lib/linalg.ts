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
