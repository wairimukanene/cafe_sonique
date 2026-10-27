import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  experimental: {
    serverActions: {
      // A product save can carry the main photo plus one photo per colour, each up to ~950 KB.
      bodySizeLimit: "12mb",
    },
  },
  images: {
    // Optimised images can't be invalidated, so a replaced photo needs a new file name.
    minimumCacheTTL: 604800,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
