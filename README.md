# StructSolver Pro

Aplicación web de análisis estructural 2D: vigas continuas, armaduras 2D y pórticos 2D por Método Matricial de la Rigidez.

- **Frontend:** Next.js 15 + React 19 + Tailwind
- **Backend:** Python serverless functions (Vercel) con NumPy
- **Deploy:** Vercel

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Deploy

Push al repo GitHub y conectar con Vercel. Las funciones Python en `/api` se ejecutan como serverless.
