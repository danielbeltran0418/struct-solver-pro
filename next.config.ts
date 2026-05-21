import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Export estático para GitHub Pages: todo el sitio es HTML/JS/CSS plano,
  // sin servidor — el solver corre 100% en el navegador.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isGhPages ? "/struct-solver-pro" : "",
  assetPrefix: isGhPages ? "/struct-solver-pro/" : "",
};

export default nextConfig;
