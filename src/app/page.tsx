"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { StructureTabs } from "@/components/StructureTabs";
import { SectionTabs } from "@/components/SectionTabs";
import { BeamConfig } from "@/components/beam/BeamConfig";
import { BeamVisualization } from "@/components/beam/BeamVisualization";
import { BeamResults, BeamDiagrams, BeamMatrices } from "@/components/beam/BeamResults";
import type { BeamModel, Section, SolveResponse, StructureType } from "@/lib/types";
import { solveBeam } from "@/lib/api";

function defaultBeamModel(): BeamModel {
  return {
    spans: [
      { id: "T1", L: 6, material: "Acero", E: 200, I: 8356 },
      { id: "T2", L: 4, material: "Acero", E: 200, I: 8356 },
    ],
    supports: [
      { id: "N1", type: "PIN" },
      { id: "N2", type: "ROD" },
      { id: "N3", type: "PIN" },
    ],
    loads: [],
  };
}

export default function Home() {
  const [structure, setStructure] = useState<StructureType>("beam");
  const [section, setSection] = useState<Section>("config");
  const [beam, setBeam] = useState<BeamModel>(defaultBeamModel());
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [solving, setSolving] = useState(false);

  const onSolve = async () => {
    setSolving(true);
    const r = await solveBeam(beam);
    setResult(r);
    setSolving(false);
    if (r.ok) setSection("results");
  };

  const rightPanel = useMemo(() => {
    if (structure !== "beam") return null;
    if (section === "config")    return <BeamVisualization model={beam} />;
    if (section === "results")   return <BeamResults result={result} />;
    if (section === "diagrams")  return <BeamDiagrams result={result} />;
    if (section === "matrices")  return <BeamMatrices result={result} />;
    return <BeamVisualization model={beam} />;
  }, [structure, section, beam, result]);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-5">
        <StructureTabs active={structure} onChange={setStructure} />
        <SectionTabs active={section} onChange={setSection} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          {/* Panel izquierdo: configuración / control */}
          <div>
            {structure === "beam" && section === "config" && (
              <BeamConfig model={beam} onChange={setBeam} onSolve={onSolve} />
            )}
            {structure === "beam" && section !== "config" && (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Modelo actual</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {beam.spans.length} tramos · {beam.supports.length} nodos · {beam.loads.length} cargas
                </p>
                <button
                  onClick={() => setSection("config")}
                  className="text-sm text-brand-600 hover:underline"
                >← Volver a configuración</button>
              </div>
            )}
            {structure !== "beam" && (
              <ComingSoon name={structure === "truss" ? "Armadura 2D" : "Pórtico 2D"} />
            )}
          </div>

          {/* Panel derecho: visualización / resultados */}
          <div>{rightPanel}</div>
        </div>
      </main>

      {solving && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-6 py-4 shadow-xl">Calculando…</div>
        </div>
      )}
    </div>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-lg p-8 text-center">
      <p className="text-slate-400 text-sm mb-1">Módulo</p>
      <p className="text-xl font-semibold text-slate-700">{name}</p>
      <p className="text-xs text-slate-400 mt-3">En desarrollo. Pronto disponible.</p>
    </div>
  );
}
