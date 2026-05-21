import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StructSolver Pro",
  description: "Análisis estructural 2D — vigas, armaduras y pórticos por el Método Matricial de la Rigidez.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
