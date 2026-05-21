export type StructureType = "beam" | "truss" | "frame";
export type Section = "config" | "results" | "diagrams" | "matrices" | "section";

export type SupportType = "PIN" | "ROD" | "EMP" | "LIBRE";

export interface Span {
  id: string;
  L: number;            // metros
  material: string;     // "Acero" | "Hormigón" | ...
  E: number;            // GPa
  I: number;            // cm^4
}

export interface NodeSupport {
  id: string;           // "N1", "N2", ...
  type: SupportType;
}

export type LoadType = "puntual" | "uniforme" | "trapezoidal" | "momento";

export interface Load {
  id: string;
  type: LoadType;
  spanIndex: number;    // 0-based índice de tramo donde está la carga
  position?: number;    // distancia desde nodo izq del tramo (puntual / momento)
  magnitude: number;    // kN (puntual), kN/m (uniforme), kN·m (momento)
  magnitude2?: number;  // para trapezoidal (extremo derecho)
}

export interface BeamModel {
  spans: Span[];
  supports: NodeSupport[];
  loads: Load[];
}

export interface SolveResponse {
  ok: boolean;
  error?: string;
  // Resultados (kN, kN·m, m)
  displacements?: number[][];   // por nodo [v, theta]
  reactions?: number[][];       // por apoyo [R_y, M]
  member_forces?: {
    spanIndex: number;
    V_i: number;
    M_i: number;
    V_j: number;
    M_j: number;
  }[];
  // Matrices intermedias (para tab Matrices)
  K_global?: number[][];
  F_global?: number[];
  diagrams?: {
    spanIndex: number;
    x: number[];
    V: number[];
    M: number[];
  }[];
}
