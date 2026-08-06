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
    // CÓPIAS DE TRABALHO DE OUTRA SESSÃO, não este código.
    //
    // Um agente rodando em worktree isolada cria um clone COMPLETO do repo em
    // `.claude/worktrees/<nome>/`. O ESLint varria essa cópia junto: medido em
    // 06/08/2026, o portão saltou de 46 para 112 avisos sem que uma linha
    // daqui mudasse. Pior que o número: o relatório passa a misturar arquivos
    // de dois trabalhos diferentes, e quem lê não tem como saber qual é qual.
    //
    // A worktree some sozinha quando o trabalho termina — mas enquanto existe,
    // ela empurra o portão para um número que não é sobre este código.
    ".claude/**",
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
