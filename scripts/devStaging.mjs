// Sobe o `next dev` falando com o banco de STAGING.
//
// ===========================================================================
// POR QUE NÃO DÁ PARA USAR `node --env-file`
// ===========================================================================
//
// A primeira versão deste caminho era um script npm com
// `node --env-file=.env.staging .../next dev`. Funciona num `node -e`, e MORRE
// no `next dev`:
//
//     node.exe: --env-file= is not allowed in NODE_OPTIONS
//
// O `next dev` cria processos filhos e repassa os argumentos do pai por
// `NODE_OPTIONS` — e `--env-file` é proibido lá. O erro não vem do arquivo nem
// da política do Windows: vem do próprio Next repassando o que recebeu.
//
// ===========================================================================
// O QUE ISTO FAZ NO LUGAR
// ===========================================================================
//
// Lê o `.env.staging` aqui mesmo, põe os valores em `process.env`, e só então
// chama o `next dev` como filho. O filho herda o ambiente já pronto, e a linha
// de comando dele fica limpa — nada para repassar em `NODE_OPTIONS`.
//
// Funciona porque `process.env` é o PRIMEIRO da ordem de busca do Next, e a
// busca para no primeiro achado: o `.env.local` (que aponta para a PRODUÇÃO)
// não vence o que já está definido. É a doc do Next, não um truque.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// `NODE_ENV` só aceita `production`, `development` e `test`, então
// `.env.staging` nunca é carregado sozinho. Em 26/08/2026 isso custou duas
// operações na conta que paga: `npm run dev` carrega `.env.local`, e o
// `.env.local` desta máquina aponta para a produção.

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { parseEnv } from "node:util";

const ARQUIVO = ".env.staging";

let doArquivo;
try {
  doArquivo = parseEnv(readFileSync(ARQUIVO, "utf8"));
} catch (e) {
  // Sem o arquivo, subir seria subir contra a PRODUÇÃO — exatamente o que este
  // script existe para evitar. Falhar aqui é o desfecho certo.
  console.error(
    `Não consegui ler ${ARQUIVO}: ${e instanceof Error ? e.message : String(e)}\n` +
      `Sem ele este comando subiria contra a produção. Copie de .env.staging.example.`
  );
  process.exit(1);
}

const url = doArquivo.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = /https:\/\/([a-z0-9]+)\./.exec(url)?.[1] ?? "(sem NEXT_PUBLIC_SUPABASE_URL)";
console.log(`[dev:staging] banco: ${ref}`);

const filho = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], {
  stdio: "inherit",
  env: { ...process.env, ...doArquivo },
});

filho.on("exit", (codigo, sinal) => {
  process.exit(sinal ? 1 : (codigo ?? 0));
});
