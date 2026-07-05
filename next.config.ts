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
  // Defense in depth: `output: "standalone"`'s file tracing has swept the
  // project's own release/ directory (built .dmg/.zip artifacts from previous
  // packaging runs, several GB) straight into .next/standalone, ballooning a
  // ~80MB bundle into multiple GB. This alone wasn't reliably enough under a
  // Turbopack build to stop it recurring, though — the actual guarantee is
  // `electron:prepare` (package.json) removing release/ before every build.
  outputFileTracingExcludes: {
    "*": ["release/**", "test-results/**", ".git/**"],
  },
};

export default nextConfig;
