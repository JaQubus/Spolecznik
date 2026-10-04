import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Pipeline danych w Pythonie (venv zawiera pliki JS z pakietów)
    "data/**",
    // Worktree agentów (pełne kopie repo z własnym .next) i raporty z `pnpm lighthouse`.
    ".claude/**",
    "lighthouse-report/**",
  ]),
]);

export default eslintConfig;
