# Rigidez Lab

Laboratorio web de análisis estructural 2D: vigas continuas, armaduras 2D y pórticos 2D por el Método Matricial de la Rigidez.

- **Stack:** Next.js 15 + React 19 + Tailwind
- **Cálculo:** TypeScript puro en el navegador (sin backend, sin cold start)
- **Deploy:** GitHub Pages (sitio estático)

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Deploy

Push al repo GitHub y conectar con Vercel. Las funciones Python en `/api` se ejecutan como serverless.
