// Toda migração ≥ 024 termina registrando a si mesma — e a lista de exceções
// só pode encolher.
//
// ===========================================================================
// A CONVENÇÃO, E COMO ELA VIROU FOLCLORE
// ===========================================================================
//
// A migração 024 criou o ledger e declarou a regra do programa:
//
//     "toda migração DEVE terminar com o próprio INSERT em
//      migracoes_aplicadas"
//
// Catorze não terminaram: 035–042 e 071–076. Ninguém percebeu por um ano,
// porque nada conferia — e o efeito só apareceu em 25/08/2026, quando o banco
// de produção estava na 076 e o ledger dele dizia 070 (INC-012).
//
// A leitura errada, na hora, foi "alguém esqueceu de registrar seis". A leitura
// certa é que os ARQUIVOS nunca registraram. O ledger contou fielmente o que
// lhe deram, e quem estava errado era a convenção que ninguém guardava.
//
// A 078 recuperou as catorze por baseline, com evidência. Este teste é o que
// impede a décima quinta.
//
// ===========================================================================
// POR QUE UMA LISTA CONGELADA, E NÃO UM CONSERTO NOS CATORZE
// ===========================================================================
//
// A própria 024 respondeu isso quando registrou 001–016: "migrações anteriores
// são DOCUMENTOS HISTÓRICOS — não são alteradas retroativamente". Editar os
// catorze faria os arquivos mentirem sobre o que rodou naquele dia, e não
// consertaria banco nenhum — arquivo não roda sozinho.
//
// Então elas ficam como estão, nomeadas aqui. A lista só pode ENCOLHER: um
// arquivo novo que não se registra reprova, e um nome que sai da lista sem o
// arquivo correspondente também.
//
// Rodar: npx tsx --test scripts/migracaoSeRegistra.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { lerFonte } from "../src/testing/lerFonte.ts";

const PASTA = fileURLToPath(new URL("../database/migrations", import.meta.url));

/**
 * As catorze de antes da guarda. Documentos históricos, recuperadas no ledger
 * pela baseline da 078. Nenhuma linha entra aqui: a lista só encolhe.
 */
const HISTORICAS = new Set([
  "035", "036", "037", "038", "039", "040", "041", "042",
  "071", "072", "073", "074", "075", "076",
]);

/** O número do arquivo: `054a-...` → `054a`, `035-...` → `035`. */
const numeroDe = (arquivo: string): string => arquivo.split("-")[0];

/**
 * Os arquivos de VERIFICAÇÃO não são migrações: eles provam, não criam, e
 * rodam em transação com rollback. O pre-commit já faz a mesma distinção.
 */
const ehMigracao = (arquivo: string): boolean =>
  arquivo.endsWith(".sql") && !/verificacao|verificacoes/.test(arquivo);

const migracoes = readdirSync(PASTA).filter(ehMigracao).sort();

/** De 024 em diante — a convenção não vale para trás. */
const daConvencao = migracoes.filter((f) => numeroDe(f) >= "024");

test("toda migração ≥ 024 registra a si mesma no ledger", () => {
  const semRegistro = daConvencao
    .filter((f) => !HISTORICAS.has(numeroDe(f)))
    .filter((f) => !lerFonte(join(PASTA, f), "utf8").includes("insert into public.migracoes_aplicadas"));

  assert.deepEqual(
    semRegistro,
    [],
    "migração sem o próprio INSERT em `migracoes_aplicadas`. A convenção é da 024, " +
      "e catorze arquivos já a ignoraram uma vez — o ledger parou na 070 com o banco " +
      "na 076, e ninguém viu por um ano (INC-012). Termine o arquivo com o registro."
  );
});

test("a lista de históricas só encolhe — nenhum nome sobra nela", () => {
  // Se uma histórica for renomeada ou removida e o nome ficar aqui, a lista
  // passa a proteger um arquivo que não existe — e a próxima migração com o
  // mesmo número entraria isenta sem ninguém decidir isso.
  const numerosNaPasta = new Set(migracoes.map(numeroDe));
  const orfas = [...HISTORICAS].filter((n) => !numerosNaPasta.has(n)).sort();
  assert.deepEqual(orfas, [], "nome na lista de históricas sem arquivo correspondente");
});

test("as catorze estão nomeadas, e são catorze", () => {
  // O número é dito em voz alta porque ele aparece no INC-012, na 078 e nos
  // comentários. Três lugares com o mesmo fato divergem no dia em que um muda.
  assert.equal(HISTORICAS.size, 14);
  const aindaSemRegistro = daConvencao.filter(
    (f) => !lerFonte(join(PASTA, f), "utf8").includes("insert into public.migracoes_aplicadas")
  );
  assert.deepEqual(
    aindaSemRegistro.map(numeroDe).sort(),
    [...HISTORICAS].sort(),
    "a lista de históricas tem que ser exatamente o conjunto que não se registra"
  );
});
