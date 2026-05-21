export function Header() {
  return (
    <header className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
      {/* Logo: tres líneas estilizadas (axil, cortante, momento) */}
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-md">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor">
          <path d="M3 4v16" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M3 20h18" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M7 14c2-6 8-6 10 0" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="9" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div className="flex flex-col leading-tight">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">
          Rigidez<span className="text-brand-600 ml-1">Lab</span>
        </h1>
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
          Análisis Estructural 2D
        </span>
      </div>
    </header>
  );
}
