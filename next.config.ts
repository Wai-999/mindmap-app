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
  // Without this, `output: "standalone"`'s file tracing swept the project's own
  // release/ directory (built .dmg/.zip artifacts from previous packaging runs,
  // several GB) straight into .next/standalone — ballooning a ~250MB app into a
  // multi-gigabyte one. None of these are ever imported by server code; they're
  // just build output sitting in the project root.
  outputFileTracingExcludes: {
    "*": ["release/**", "test-results/**", ".git/**"],
  },
};

export default nextConfig;
