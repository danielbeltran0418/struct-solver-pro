import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // Static export only for GitHub Pages; Vercel uses standard Next.js deployment.
  ...(isGhPages && {
    output: "export",
    trailingSlash: true,
    basePath: "/struct-solver-pro",
    assetPrefix: "/struct-solver-pro/",
  }),
};

export default nextConfig;
