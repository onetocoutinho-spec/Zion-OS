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
    // Fora do escopo do app (PR-005): estado pessoal do Obsidian (plugins
    // minificados geravam TODOS os "erros" de lint) e o workspace congelado
    // da plataforma (tem eslint próprio).
    ".obsidian/**",
    "platform/**",
  ]),
  // Regras novas do React Compiler (eslint-plugin-react-hooks recente): úteis,
  // mas NÃO devem barrar o build/deploy. Ficam como aviso até limparmos.
  {
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]);

export default eslintConfig;
