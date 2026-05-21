import { NextResponse } from "next/server";
import { solveBeamLocal } from "@/lib/beam-solver";
import type { BeamModel } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const model = (await req.json()) as BeamModel;
    const result = solveBeamLocal(model);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Server error: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
