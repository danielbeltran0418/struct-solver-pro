export type StructureType = "beam" | "truss" | "frame";
export type Section = "config" | "results" | "diagrams" | "matrices" | "section";

export type SupportType = "PIN" | "ROD" | "EMP" | "LIBRE";

export interface Span {
  id: string;
  L: number;            // metros
  material: string;     // "Acero" | "Hormigón" | ...
  E: number;            // GPa
  I: number;            // cm^4
  releaseI?: boolean;   // Rótula interna en extremo izq (M = 0)
  releaseJ?: boolean;   // Rótula interna en extremo der (M = 0)
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
  displacements?: number[][];   // por nodo [v, theta] o [u, v] o [u, v, theta]
  reactions?: number[][];       // por apoyo [R_y, M] o [Rx, Ry] o [Rx, Ry, M]
  member_forces?: {
    spanIndex: number;
    V_i: number;
    M_i: number;
    V_j: number;
    M_j: number;
    N?: number;          // axial (armadura/pórtico)
    state?: "Tracción" | "Compresión" | "Nulo";
  }[];
  // Matrices intermedias
  K_global?: number[][];
  F_global?: number[];
  // Matrices por elemento (paso intermedio del Método de la Rigidez)
  element_matrices?: {
    id: string;            // etiqueta de la barra/tramo
    k_local: number[][];   // matriz de rigidez local (k')
    T?: number[][];        // matriz de transformación (no aplica a viga continua)
    k_global: number[][];  // k = T^T · k' · T
    dofMap: number[];      // GDL globales donde se ensambla
  }[];
  diagrams?: {
    spanIndex: number;
    x: number[];
    V: number[];
    M: number[];
  }[];
}

// =========================================================================
// Armadura 2D (truss) - 2 GDL por nodo (u, v), barras solo axiales
// =========================================================================
export interface TrussNode {
  id: string;
  x: number;
  y: number;
  fixed_u: boolean;
  fixed_v: boolean;
  fx: number;
  fy: number;
}
export interface TrussElement {
  id: string;
  nodeI: string;
  nodeJ: string;
  E: number;       // GPa
  A: number;       // cm²
}
export interface TrussModel {
  nodes: TrussNode[];
  elements: TrussElement[];
}

// =========================================================================
// Pórtico 2D (frame) - 3 GDL por nodo (u, v, theta)
// =========================================================================
export interface FrameNode {
  id: string;
  x: number;
  y: number;
  fixed_u: boolean;
  fixed_v: boolean;
  fixed_theta: boolean;
  fx: number;
  fy: number;
  m: number;
}
export interface FrameElement {
  id: string;
  nodeI: string;
  nodeJ: string;
  E: number;       // GPa
  A: number;       // cm²
  I: number;       // cm⁴
  releaseI?: boolean;   // Rótula interna en extremo nodeI (M = 0)
  releaseJ?: boolean;   // Rótula interna en extremo nodeJ (M = 0)
}
/**
 * Carga sobre una BARRA del pórtico (no nodal).
 * - direction: "global" → magnitud en kN o kN/m según eje global (Y por defecto, "abajo+")
 *              "local"  → perpendicular al eje del elemento (en dirección y')
 * - type: tipo de distribución
 * - position: distancia desde nodoI (para puntual/momento)
 * - magnitude2: extremo derecho de la trapezoidal
 */
export interface FrameLoad {
  id: string;
  elementId: string;
  type: "uniforme" | "puntual" | "trapezoidal" | "momento";
  direction: "global_y" | "global_x" | "local_perp";
  magnitude: number;
  magnitude2?: number;
  position?: number;
}

export interface FrameModel {
  nodes: FrameNode[];
  elements: FrameElement[];
  loads?: FrameLoad[];
}
