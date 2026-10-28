import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF.js loads its worker relative to this package at runtime.
  serverExternalPackages: ['pdf-parse'],
  outputFileTracingIncludes: {
    '/api/upload': ['./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs'],
    '/api/documents/*': ['./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs'],
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
