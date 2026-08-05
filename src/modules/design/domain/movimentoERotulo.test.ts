// Quem pediu menos movimento recebe menos movimento; e botão só com ícone tem nome.
//
// ===========================================================================
// DE ONDE VEM A RÉGUA
// ===========================================================================
//
// Passe de 05/08/2026 contra `ui-ux-pro-max` (a skill do dono, agora
// versionada em `.claude/skills/`). Das 99 diretrizes, 32 são de severidade
// High; 31 se aplicam a web. Estes dois testes guardam os dois achados dessa
// varredura que foram CONCLUSIVOS e cujo conserto não muda o visual:
//
//   Motion Sensitivity / Reduced Motion  →  "BAD: No motion query check"
//   ARIA Labels                          →  "BAD: <button><Icon/></button>"
//
// O que a varredura mediu, antes do conserto:
//
//     57 arquivos com animação          1 com verificação de preferência
//     32 usos de animate-spin           12 de animate-pulse
//
// As animações são as duas mais benignas que existem — spinner e esqueleto,
// nenhum parallax. E a regra vale igual: sensibilidade vestibular não escolhe
// qual movimento incomoda, e um spinner girando numa tela lenta é movimento
// contínuo no campo de visão.
//
// ===========================================================================
// POR QUE A GUARDA É NO CSS GLOBAL, E O TESTE OLHA PARA LÁ
// ===========================================================================
//
// `motion-reduce:` do Tailwind resolveria caso a caso e exigiria que cada tela
// NOVA lembrasse — o defeito de "a regra em cinco lugares" que este
// repositório já pagou na regra da capa. No CSS global a regra tem um lugar, e
// tela futura herda sem saber que ela existe. Por isso este teste lê
// `globals.css`, e não 57 componentes.
//
// A escolha contraintuitiva: NÃO usamos `animation: none`. Um spinner que PARA
// afirma que travou. Ele desacelera, então o carregamento continua legível
// como carregamento — e há teste para isso, porque `none` é o que qualquer
// pessoa escreveria ao "consertar" isto.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

import { lerFonte } from "../../../testing/lerFonte.ts";

const raiz = new URL("../../../", import.meta.url);
const CSS = lerFonte(new URL("app/globals.css", raiz), "utf8");

// ── Movimento ───────────────────────────────────────────────────────────────

test("existe a consulta de preferência de movimento, no CSS global", () => {
  assert.match(CSS, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("a regra alcança TUDO — inclusive tela que ainda não existe", () => {
  // O seletor universal é o que faz a guarda ser herdada. Se alguém trocá-lo
  // por uma lista de classes, a próxima tela nasce descoberta.
  const bloco = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(bloco, "não achei o bloco da consulta");
  assert.match(bloco[1], /\*\s*,/, "o seletor deixou de ser universal");
  assert.match(bloco[1], /animation-duration/);
  assert.match(bloco[1], /transition-duration/);
});

test("o movimento DESACELERA — não para", () => {
  // `animation: none` num spinner afirma que a tela travou. Este é o teste que
  // reprova o conserto óbvio e errado.
  const bloco = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(bloco);
  assert.doesNotMatch(
    bloco[1],
    /animation(-name)?:\s*none/,
    "o spinner passou a PARAR, e spinner parado parece travado"
  );
  assert.match(
    bloco[1],
    /animation-iteration-count:\s*infinite/,
    "sem repetição infinita o spinner roda uma vez e congela"
  );
});

// ── Rótulo ──────────────────────────────────────────────────────────────────

/** Todo arquivo de tela, para a varredura não depender de lista à mão. */
function telas(): string[] {
  const achados: string[] = [];
  const andar = (dir: URL, prefixo: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const rel = prefixo ? `${prefixo}/${e.name}` : e.name;
      if (e.isDirectory()) andar(new URL(`${rel}/`, raiz), rel);
      else if (e.name.endsWith(".tsx")) achados.push(rel);
    }
  };
  andar(raiz, "");
  return achados;
}

test("botão que mostra SÓ um ícone tem nome acessível", () => {
  // `title` não conta, e essa é a parte que engana: os três achados TINHAM
  // `title`. Ele é dica de mouse — não aparece em toque, e leitor de tela não
  // o anuncia de forma confiável. A régua pede `aria-label`.
  //
  // O padrão é estreito de propósito: casa `<button …><Icone/></button>` sem
  // nada mais dentro. Botão com estrutura maior não é visto aqui, então este
  // teste é um PISO, não um censo — e o comentário existe para ninguém ler o
  // verde dele como "não há mais nenhum".
  const faltando: string[] = [];
  for (const rel of telas()) {
    const fonte = lerFonte(new URL(rel, raiz), "utf8");
    for (const m of fonte.matchAll(
      /<button\b((?:[^>"']|"[^"]*"|'[^']*')*)>\s*<([A-Z]\w+)[^>]*\/>\s*<\/button>/g
    )) {
      if (!/aria-label/.test(m[1])) faltando.push(`${rel} <${m[2]}/>`);
    }
  }
  assert.deepEqual(faltando, [], `botão só com ícone sem aria-label: ${faltando.join(", ")}`);
});
