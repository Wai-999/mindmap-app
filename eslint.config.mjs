import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // electron/** is plain CommonJS Node glue code (see its own comment), not part of
    // the TypeScript/Next.js app the rest of this config targets.
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "electron/**", "release/**"],
  },
];

export default eslintConfig;
