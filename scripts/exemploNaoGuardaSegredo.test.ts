// Nenhum `.env*.example` guarda credencial de verdade.
//
// ===========================================================================
// O QUASE-ACIDENTE DE 25/08/2026
// ===========================================================================
//
// `.env*.example` são os ÚNICOS arquivos de ambiente que o `.gitignore`
// rastreia — a regra é `.env*` com exceção para eles. Existem para mostrar a
// FORMA das variáveis, com marcador no lugar do valor.
//
// Nesse dia, a chave `service_role` do Supabase de staging e a chave anônima
// foram coladas dentro de `.env.staging.example`, e não no `.env.staging`. O
// arquivo ficou solto na árvore. Um `git add -A` teria mandado a credencial
// para o repositório remoto, e credencial que chega num remoto público não
// volta: some do HEAD e continua no histórico.
//
// Foi pego por acaso, conferindo o diff antes de um push. "Por acaso" não é
// procedimento — daí este teste.
//
// ===========================================================================
// A REGRA
// ===========================================================================
//
// Num arquivo de exemplo, todo valor é uma de três coisas:
//
//   1. um marcador `<ASSIM>`;
//   2. vazio;
//   3. um valor de demonstração que não é segredo — `https://example.vercel.app`,
//      `gpt-5`, `gemini-2.5-flash`.
//
// O que reprova é o que TEM CARA DE CREDENCIAL: JWT, chave do Supabase no
// formato novo, ou uma sequência longa e opaca. Não se tenta adivinhar o
// resto — a regra é estreita de propósito, porque teste que reprova valor
// legítimo é teste que alguém desliga.
//
// Rodar: npx tsx --test scripts/exemploNaoGuardaSegredo.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { lerFonte } from "../src/testing/lerFonte.ts";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** As formas que um segredo tem. Cada uma é literal, nenhuma é heurística de tamanho só. */
const FORMAS_DE_SEGREDO: readonly { nome: string; teste: RegExp }[] = [
  { nome: "JWT (chave legada do Supabase)", teste: /^eyJ[A-Za-z0-9_-]{10,}\./ },
  { nome: "chave secreta do Supabase", teste: /^sb_secret_/ },
  { nome: "chave publicável do Supabase", teste: /^sb_publishable_/ },
  { nome: "chave da OpenAI", teste: /^sk-[A-Za-z0-9_-]{16,}/ },
  { nome: "chave da Anthropic", teste: /^sk-ant-/ },
  { nome: "chave do Google", teste: /^AIza[A-Za-z0-9_-]{20,}/ },
  // Rede fina para o que não tem prefixo conhecido: 40+ caracteres opacos,
  // sem espaço, sem barra e sem ponto — que é a cara de um secret gerado.
  { nome: "sequência longa e opaca", teste: /^[A-Za-z0-9+/_=-]{40,}$/ },
];

const exemplos = readdirSync(RAIZ).filter((f) => /^\.env.*\.example$/.test(f));

test("existe pelo menos um arquivo de exemplo para conferir", () => {
  // Sem isto, renomear os exemplos faria o teste passar varrendo o vazio.
  assert.ok(exemplos.length > 0, "nenhum .env*.example encontrado na raiz");
});

test("nenhum .env*.example guarda credencial", () => {
  const achados: string[] = [];

  for (const arquivo of exemplos) {
    const linhas = lerFonte(join(RAIZ, arquivo), "utf8").split("\n");
    linhas.forEach((linha, i) => {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#")) return;
      const igual = limpa.indexOf("=");
      if (igual < 0) return;

      const chave = limpa.slice(0, igual).trim();
      // O comentário de fim de linha não é valor.
      const valor = limpa.slice(igual + 1).split("#")[0].trim();
      if (!valor || /^<.*>$/.test(valor)) return;

      const forma = FORMAS_DE_SEGREDO.find((f) => f.teste.test(valor));
      if (forma) {
        // O valor NÃO entra na mensagem: um teste que imprime o segredo para
        // avisar que ele vazou espalha o que veio consertar.
        achados.push(`${arquivo}:${i + 1}  ${chave} — parece ${forma.nome}`);
      }
    });
  }

  assert.deepEqual(
    achados,
    [],
    "credencial num arquivo de exemplo, que é RASTREADO pelo git. Troque por um " +
      "marcador <ASSIM>. Se já foi commitada, trocar não basta: ela fica no histórico " +
      "e precisa ser rotacionada na origem."
  );
});

test("a rede pega as formas que ela existe para pegar", () => {
  // Uma sentinela com regex quebrado aprova tudo em silêncio.
  const pega = (v: string) => FORMAS_DE_SEGREDO.some((f) => f.teste.test(v));

  assert.equal(pega("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"), true, "JWT");
  assert.equal(pega("sb_secret_AbCdEf"), true, "sb_secret");
  assert.equal(pega("sb_publishable_AbCdEf"), true, "sb_publishable");
  assert.equal(pega("sk-proj-0123456789abcdef0123"), true, "OpenAI");
  assert.equal(pega("A".repeat(45)), true, "sequência longa e opaca");

  // E não pega o que é legítimo num exemplo.
  assert.equal(pega("https://example.vercel.app"), false, "URL de demonstração");
  assert.equal(pega("https://example.vercel.app/cliente/conectar-ml"), false, "URL com caminho");
  assert.equal(pega("gpt-5"), false, "nome de modelo");
  assert.equal(pega("gemini-2.5-flash-image"), false, "nome de modelo com pontos");
  assert.equal(pega("openai"), false, "nome de provedor");
});
