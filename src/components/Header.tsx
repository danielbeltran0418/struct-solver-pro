export function Header() {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-slate-800">
        Struct<span className="text-brand-600">Solver</span>
        <span className="ml-1 text-slate-500 font-normal text-sm">Pro</span>
      </h1>
    </header>
  );
}
