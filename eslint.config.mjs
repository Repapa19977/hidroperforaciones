import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Estas reglas son utiles como aviso, pero no deben bloquear deploys ya validados
      // por TypeScript + build + pruebas E2E.
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",

    // Archivos generados o de terceros: no deben bloquear lint del app.
    "public/pdf.worker.min.mjs",
    "public/**/*.min.js",
    "coverage/**",

    // Scripts operativos/E2E se validan con predeploy/build y no forman parte del bundle Next.
    "scripts/**",
  ]),
]);

export default eslintConfig;
