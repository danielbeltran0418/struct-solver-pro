"use client";

/**
 * Input numérico con manejo amigable del cero inicial:
 *   - Muestra "" (vacío) cuando el valor es 0 → aparece el placeholder
 *   - Permite escribir directamente sin tener que borrar el "0"
 *   - Selecciona todo al recibir foco si tiene el valor por defecto
 */

import { useEffect, useState } from "react";

export function NumInput({
  value, onChange, placeholder = "0", className, step = "any",
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  step?: string;
}) {
  const [text, setText] = useState<string>(value === 0 ? "" : String(value));

  // Resync cuando el valor cambia externamente (ej. reset del modelo).
  useEffect(() => {
    const current = text === "" ? 0 : Number(text);
    if (current !== value) setText(value === 0 ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      step={step}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (v === "" || v === "-") {
          onChange(0);
          return;
        }
        const n = Number(v);
        if (!Number.isNaN(n)) onChange(n);
      }}
      className={
        className ??
        "w-20 bg-transparent border border-slate-200 rounded px-1.5 py-0.5 text-sm focus:border-brand-500 focus:outline-none"
      }
    />
  );
}
