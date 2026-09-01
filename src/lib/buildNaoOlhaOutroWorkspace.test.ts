// O build do app não type-checa o monorepo `platform/`.
//
// ===========================================================================
// O CASO, 20/08/2026
// ===========================================================================
//
// Um commit que tocava DOIS arquivos em `src/app/api/ml/` derrubou o deploy:
//
//   Failed to type check.
//   ./platform/packages/certification/src/fixtures.ts:9:8
//   Type error: Cannot find module '@zion/shared'
//
// `tsconfig.json` inclui `**/*.ts`, o que varre também `platform/` — que é
// OUTRO workspace, com pnpm e tsconfig próprios. Na máquina local os pacotes
// `@zion/*` resolvem pelos links do pnpm dentro de `platform/node_modules`; a
// Vercel instala só a raiz, então lá eles não existem.
//
// O efeito é o pior tipo: o gate passa (3250 testes, 0 lint), o build local
// passa, e a produção recusa por um arquivo que não é do app. Nada no
// resultado do gate aponta para a causa.
//
// A trava é de CONFIGURAÇÃO, então a sentinela lê a configuração.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAIZ = new URL("../../", import.meta.url);

function lerJsonc(nome: string): Record<string, unknown> {
  const bruto = readFileSync(new URL(nome, RAIZ), "utf8");
  // O tsconfig do Next aceita comentários; JSON.parse não.
  return JSON.parse(bruto.replace(/^\s*\/\/.*$/gm, "")) as Record<string, unknown>;
}

test("o tsconfig do app exclui o workspace `platform`", () => {
  const excluir = (lerJsonc("tsconfig.json").exclude ?? []) as string[];
  assert.ok(
    excluir.includes("platform"),
    "o type check do app voltou a varrer o compilador — build quebra na Vercel, não aqui"
  );
});

// A segunda metade: mesmo excluído do type check, o diretório continuaria
// sendo ENVIADO no deploy. Não quebra o build, mas sobe um monorepo inteiro a
// cada publicação.
test("o deploy não envia o workspace `platform`", () => {
  const ignore = readFileSync(new URL(".vercelignore", RAIZ), "utf8");
  const linhas = ignore
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  assert.ok(linhas.includes("platform"), "o `.vercelignore` parou de ignorar o compilador");
});
