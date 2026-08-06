// Todo link interno leva a uma rota que existe.
//
// ===========================================================================
// O DEFEITO QUE ESTE ARQUIVO EXISTE PARA MATAR
// ===========================================================================
//
// Em 06/08 apagamos 38 páginas do painel da agência (PLANO-003, item D). O
// portão ficou verde: typecheck, lint, 2.487 testes e `next build` — porque
// nada disso olha PARA ONDE um link aponta.
//
// A tela `/clientes/[id]`, que ficou, tinha ONZE links para rotas apagadas:
//
//     /tarefas/nova · /produtos/novo · /relatorios/novo · /onboarding
//     /produtos/:id · /anuncios/:id · /tarefas/:id/editar
//     /relatorios/:id/editar · /reunioes/nova · /reunioes/:id/editar
//     /anuncios/novo
//
// Todos davam 404. O dono viu na tela, não no CI — e a primeira varredura que
// fiz depois disso achou **um** deles, porque procurava só `href="/..."` e a
// tela usa template (`href={`/tarefas/nova${qs}`}`). Um instrumento que só lê
// a forma mais simples encontra o caso mais fácil e certifica o resto.
//
// ===========================================================================
// O QUE ESTE TESTE LÊ
// ===========================================================================
//
// As duas formas: `href="/x"` e `href={`/x/${id}`}`. Segmentos dinâmicos viram
// `:id` dos dois lados — o do link e o da rota — para `[id]` casar com `${p.id}`.
//
// NÃO cobre `router.push()` com string montada em variável, nem link vindo de
// dado. Cobre o que dá para ler estaticamente, que é onde estavam os onze.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { lerFonte } from "../testing/lerFonte.ts";

const APP = fileURLToPath(new URL("./", import.meta.url));
const SRC = fileURLToPath(new URL("../", import.meta.url));

function varrer(dir: string, filtro: (p: string) => boolean, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p, filtro, acc);
    else if (filtro(p)) acc.push(p);
  }
  return acc;
}

/** Um caminho comparável: `[id]` e `${qualquerCoisa}` viram `:id`. */
const normalizar = (rota: string) =>
  rota
    .replace(/\[[^\]]+\]/g, ":id")
    .replace(/\$\{[^}]*\}/g, ":id")
    .replace(/\/+$/, "") || "/";

/** As rotas que o Next serve de fato. */
const ROTAS = new Set(
  varrer(APP, (p) => /[\\/]page\.tsx$/.test(p)).map((p) =>
    normalizar("/" + relative(APP, p).replace(/\\/g, "/").replace(/\/?page\.tsx$/, ""))
  )
);

/** Onde um link pode apontar sem ser uma página: âncoras e rotas de API. */
const NAO_E_PAGINA = (destino: string) =>
  destino.startsWith("#") || destino.startsWith("/api/");

test("as rotas foram lidas — se este número for 0, o teste não prova nada", () => {
  // Sem isto, um erro de caminho faria o conjunto ficar vazio e TUDO passaria
  // por não haver nada com que comparar. É o falso verde que o repositório já
  // documenta em `lerFonte`.
  assert.ok(ROTAS.size > 10, `só ${ROTAS.size} rotas encontradas — a varredura quebrou`);
  assert.ok(ROTAS.has("/cliente/produtos"), "não achei uma rota que certamente existe");
});

test("nenhum link interno aponta para uma rota que não existe", () => {
  const arquivos = varrer(SRC, (p) => /\.tsx$/.test(p) && !/\.test\.tsx$/.test(p));
  const mortos: string[] = [];

  for (const arquivo of arquivos) {
    const texto = lerFonte(arquivo, "utf8");
    // `href="/x"` e href={`/x/${id}`} — as duas formas, porque a primeira
    // varredura só via a primeira e certificou os onze links quebrados.
    for (const m of texto.matchAll(/href=(?:"(\/[^"]*)"|\{`(\/[^`]*)`\})/g)) {
      const bruto = (m[1] ?? m[2]).split("?")[0].split("#")[0];
      if (NAO_E_PAGINA(bruto)) continue;
      const destino = normalizar(bruto);
      if (!ROTAS.has(destino)) {
        mortos.push(`${relative(SRC, arquivo).replace(/\\/g, "/")} → ${bruto}`);
      }
    }
  }

  assert.deepEqual(
    [...new Set(mortos)].sort(),
    [],
    `links para rotas que não existem:\n  ${[...new Set(mortos)].sort().join("\n  ")}`
  );
});
