"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { StructureTabs } from "@/components/StructureTabs";
import { SectionTabs } from "@/components/SectionTabs";

import { BeamConfig } from "@/components/beam/BeamConfig";
import { BeamVisualization } from "@/components/beam/BeamVisualization";
import { BeamResults, BeamDiagrams, BeamMatrices } from "@/components/beam/BeamResults";

import { TrussConfig } from "@/components/truss/TrussConfig";
import { TrussResults, TrussMatrices } from "@/components/truss/TrussResults";

import { FrameConfig } from "@/components/frame/FrameConfig";
import { FrameResults, FrameMatrices } from "@/components/frame/FrameResults";

import { GeometricView } from "@/components/shared/GeometricView";

import type {
  BeamModel, FrameModel, Section, SolveResponse, StructureType, TrussModel,
} from "@/lib/types";
import { solveBeam } from "@/lib/api";
import { solveTruss } from "@/lib/truss-solver";
import { solveFrame } from "@/lib/frame-solver";

// ---------- Defaults ----------
function defaultBeam(): BeamModel {
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
function defaultTruss(): TrussModel {
  // Cercha simple: 4 nodos, 5 barras (triángulos)
  return {
    nodes: [
      { id: "N1", x: 0, y: 0, fixed_u: true,  fixed_v: true,  fx: 0,   fy: 0 },
      { id: "N2", x: 4, y: 0, fixed_u: false, fixed_v: true,  fx: 0,   fy: -10 },
      { id: "N3", x: 8, y: 0, fixed_u: false, fixed_v: true,  fx: 0,   fy: 0 },
      { id: "N4", x: 4, y: 3, fixed_u: false, fixed_v: false, fx: 0,   fy: 0 },
    ],
    elements: [
      { id: "B1", nodeI: "N1", nodeJ: "N2", E: 200, A: 10 },
      { id: "B2", nodeI: "N2", nodeJ: "N3", E: 200, A: 10 },
      { id: "B3", nodeI: "N1", nodeJ: "N4", E: 200, A: 10 },
      { id: "B4", nodeI: "N2", nodeJ: "N4", E: 200, A: 10 },
      { id: "B5", nodeI: "N3", nodeJ: "N4", E: 200, A: 10 },
    ],
  };
}
function defaultFrame(): FrameModel {
  // Pórtico 3 barras (2 columnas + 1 viga), empotrado abajo
  return {
    nodes: [
      { id: "N1", x: 0, y: 0, fixed_u: true,  fixed_v: true,  fixed_theta: true,  fx: 0,  fy: 0,   m: 0 },
      { id: "N2", x: 0, y: 3, fixed_u: false, fixed_v: false, fixed_theta: false, fx: 10, fy: 0,   m: 0 },
      { id: "N3", x: 4, y: 3, fixed_u: false, fixed_v: false, fixed_theta: false, fx: 0,  fy: -5,  m: 0 },
      { id: "N4", x: 4, y: 0, fixed_u: true,  fixed_v: true,  fixed_theta: true,  fx: 0,  fy: 0,   m: 0 },
    ],
    elements: [
      { id: "B1", nodeI: "N1", nodeJ: "N2", E: 200, A: 100, I: 8356 },
      { id: "B2", nodeI: "N2", nodeJ: "N3", E: 200, A: 100, I: 8356 },
      { id: "B3", nodeI: "N3", nodeJ: "N4", E: 200, A: 100, I: 8356 },
    ],
  };
}

export default function Home() {
  const [structure, setStructure] = useState<StructureType>("beam");
  const [section, setSection]     = useState<Section>("config");

  const [beam, setBeam]     = useState<BeamModel>(defaultBeam());
  const [truss, setTruss]   = useState<TrussModel>(defaultTruss());
  const [frame, setFrame]   = useState<FrameModel>(defaultFrame());

  const [beamResult,  setBeamResult]  = useState<SolveResponse | null>(null);
  const [trussResult, setTrussResult] = useState<SolveResponse | null>(null);
  const [frameResult, setFrameResult] = useState<SolveResponse | null>(null);

  const [solving, setSolving] = useState(false);

  const onSolveBeam = async () => {
    setSolving(true);
    const r = await solveBeam(beam);
    setBeamResult(r);
    setSolving(false);
    if (r.ok) setSection("results");
  };
  const onSolveTruss = () => {
    setSolving(true);
    const r = solveTruss(truss);
    setTrussResult(r);
    setSolving(false);
    if (r.ok) setSection("results");
  };
  const onSolveFrame = () => {
    setSolving(true);
    const r = solveFrame(frame);
    setFrameResult(r);
    setSolving(false);
    if (r.ok) setSection("diagrams");
  };

  const leftPanel = useMemo(() => {
    if (structure === "beam") {
      if (section === "config")
        return <BeamConfig model={beam} onChange={setBeam} onSolve={onSolveBeam} />;
      return <BackToConfig setSection={setSection}
                           summary={`${beam.spans.length} tramos · ${beam.supports.length} nodos · ${beam.loads.length} cargas`} />;
    }
    if (structure === "truss") {
      if (section === "config")
        return <TrussConfig model={truss} onChange={setTruss} onSolve={onSolveTruss} />;
      return <BackToConfig setSection={setSection}
                           summary={`${truss.nodes.length} nodos · ${truss.elements.length} barras`} />;
    }
    if (section === "config")
      return <FrameConfig model={frame} onChange={setFrame} onSolve={onSolveFrame} />;
    return <BackToConfig setSection={setSection}
                         summary={`${frame.nodes.length} nodos · ${frame.elements.length} barras`} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, section, beam, truss, frame]);

  const rightPanel = useMemo(() => {
    if (structure === "beam") {
      if (section === "config")    return <BeamVisualization model={beam} />;
      if (section === "results")   return <BeamResults result={beamResult} />;
      if (section === "diagrams")  return <BeamDiagrams result={beamResult} />;
      if (section === "matrices")  return <BeamMatrices result={beamResult} />;
      return <BeamVisualization model={beam} />;
    }
    if (structure === "truss") {
      const view = <GeometricView nodes={truss.nodes} elements={truss.elements}
                                  results={trussResult} scale={200} />;
      if (section === "config")  return <ViewCard title="VISTA DE LA ARMADURA">{view}</ViewCard>;
      if (section === "results") return <TrussResults model={truss} result={trussResult} />;
      if (section === "diagrams")return <ViewCard title="ESTRUCTURA + DEFORMADA">{view}</ViewCard>;
      if (section === "matrices")return <TrussMatrices result={trussResult} />;
      return <ViewCard title="VISTA">{view}</ViewCard>;
    }
    // frame
    const view = <GeometricView nodes={frame.nodes} elements={frame.elements}
                                results={frameResult} scale={100}
                                frameLoads={frame.loads} />;
    if (section === "config")  return <ViewCard title="VISTA DEL PÓRTICO">{view}</ViewCard>;
    if (section === "results") return (
      <div className="space-y-4">
        <ViewCard title="DIAGRAMA CON REACCIONES">{view}</ViewCard>
        <FrameResults model={frame} result={frameResult} />
      </div>
    );
    if (section === "diagrams")return <ViewCard title="ESTRUCTURA + DEFORMADA">{view}</ViewCard>;
    if (section === "matrices")return <FrameMatrices result={frameResult} />;
    return <ViewCard title="VISTA">{view}</ViewCard>;
  }, [structure, section, beam, beamResult, truss, trussResult, frame, frameResult]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-5">
        <StructureTabs active={structure} onChange={(s) => { setStructure(s); setSection("config"); }} />
        <SectionTabs active={section} onChange={setSection} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          <div>{leftPanel}</div>
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

function BackToConfig({ setSection, summary }: { setSection: (s: Section) => void; summary: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Modelo actual</h3>
      <p className="text-xs text-slate-500 mb-3">{summary}</p>
      <button onClick={() => setSection("config")} className="text-sm text-brand-600 hover:underline">
        ← Volver a configuración
      </button>
    </div>
  );
}
function ViewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-xs font-bold text-slate-700 tracking-wider mb-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-brand-500" />{title}
      </h3>
      {children}
    </section>
  );
}
