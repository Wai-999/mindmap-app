import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  // The e2e suite drives the dev server via 127.0.0.1 rather than localhost, which
  // Next's dev-only cross-origin check otherwise flags on every asset request.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
