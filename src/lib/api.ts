import type { BeamModel, SolveResponse } from "./types";
import { solveBeamLocal } from "./beam-solver";

/**
 * Resolución del modelo de viga.
 * Corre 100% en el navegador (cliente): no hay backend.
 */
export async function solveBeam(model: BeamModel): Promise<SolveResponse> {
  try {
    return solveBeamLocal(model);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
