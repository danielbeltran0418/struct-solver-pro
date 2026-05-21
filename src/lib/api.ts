import type { BeamModel, SolveResponse } from "./types";

export async function solveBeam(model: BeamModel): Promise<SolveResponse> {
  try {
    const res = await fetch("/api/solve_beam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    }
    return await res.json();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
