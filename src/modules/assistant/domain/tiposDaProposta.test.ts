// Os tipos de proposta que o CÓDIGO conhece são os que o BANCO aceita.
//
// ===========================================================================
// O DEFEITO QUE ISTO PEGA — MEDIDO EM PRODUÇÃO, 10/08/2026
// ===========================================================================
//
// A migração 057 criou a função que executa `descricao` e `palavras_chave`, e o
// código passou a montar essas propostas. O CHECK da coluna `tipo` continuou
// listando cinco.
//
// `criarProposta` falhava, a rota capturava — corretamente, porque sem Proposal
// não há confirmação possível — e a lojista via a resposta SEM BOTÃO. Nenhum
// erro na tela: só um botão que não aparecia.
//
// A duplicação é inerente: o mesmo conjunto vive no TypeScript e num CHECK SQL,
// e as duas cópias não se conhecem. O que dá para garantir é que quem editar
// uma seja obrigado a olhar a outra.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DOMINIO = readFileSync(new URL("./propostaPersistida.ts", import.meta.url), "utf8");

const DIR_MIGRACOES = new URL("../../../../database/migrations/", import.meta.url);
/** O CHECK vigente é o da migração de maior número que o define. */
const CHECK = readdirSync(DIR_MIGRACOES)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, DIR_MIGRACOES), "utf8"))
  .filter((t) => t.includes("copilot_propostas_tipo_check") && t.includes("add constraint"))
  .pop();

test("existe uma migração que define o check dos tipos", () => {
  assert.ok(CHECK, "nenhuma migração define `copilot_propostas_tipo_check`");
});

test("TODO tipo do TypeScript é aceito pelo CHECK do banco", () => {
  // A direção que dói: um tipo no código sem lugar no banco vira proposta que
  // não grava, e resposta sem botão.
  // SÓ a declaração de `TipoDeProposta`.
  //
  // A primeira versão varria o arquivo inteiro procurando `| "algo"` e pegou
  // `"pendente"`, de outra união. Um teste que falha apontando um tipo que não
  // é do conjunto ensina a ignorar a mensagem.
  const decl = DOMINIO.slice(
    DOMINIO.indexOf("export type TipoDeProposta"),
    DOMINIO.indexOf(";", DOMINIO.indexOf("export type TipoDeProposta"))
  );
  const doCodigo = [...decl.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(doCodigo.length >= 7, `esperava 7+ tipos no domínio, achei ${doCodigo.length}`);
  for (const t of doCodigo) {
    assert.ok(
      CHECK!.includes(`'${t}'::text`),
      `o tipo "${t}" existe no código e NÃO no check do banco — a proposta falharia ao gravar e a lojista veria resposta sem botão`
    );
  }
});

test("o CHECK não aceita tipo que o código não conhece", () => {
  // A outra direção: um tipo só no banco é código morto que ninguém vai
  // manter, e um convite a proposta de tipo inventado.
  const doBanco = [...CHECK!.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
  for (const t of doBanco) {
    assert.ok(
      DOMINIO.includes(`"${t}"`),
      `o tipo "${t}" existe no check e não no domínio`
    );
  }
});
