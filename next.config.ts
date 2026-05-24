import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "true";
const isStaticExport = process.env.STATIC_EXPORT === "true" || isGhPages;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  ...(isStaticExport && { output: "export", trailingSlash: true }),
  ...(isGhPages && {
    basePath: "/struct-solver-pro",
    assetPrefix: "/struct-solver-pro/",
  }),
};

export default nextConfig;
