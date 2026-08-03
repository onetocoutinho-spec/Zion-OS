// A leitura estreita, e o detector de esquecimento.
//
// POR QUE ELA EXISTE
// ------------------
// Medido em 03/08/2026 na base real: a coluna `anuncio` (o JSONB da esteira) é
// **76,6% do peso da linha** — 1.055 kB de 1.377 kB em 880 anúncios. A tela de
// Produtos lê `mlItemId`, `produtoId`, `status`, `notaDiagnostico` e `criadoEm`,
// e nunca abre o JSONB; mesmo assim ele atravessava a rede a cada carga e a
// cada `notificarMudanca()`.
//
// O plano Free do Supabase dá 5 GB de tráfego por mês e o desenho atual põe o
// NAVEGADOR como operário. Esse é o muro mais próximo — mais perto que disco,
// que cota do ML, que os 60s da rota.
//
// POR QUE O TESTE É UM DETECTOR DE DRIFT, E NÃO UMA LISTA REPETIDA
// ---------------------------------------------------------------
// O PostgREST não tem "tudo menos uma coluna", então a lista é escrita à mão. E
// lista escrita à mão diverge no primeiro dia em que alguém acrescenta uma
// coluna — foi assim que `sub_status` passou a ser medido e descartado.
//
// Pior: o mapeador tolera coluna ausente de propósito (`row.anuncio ?? {}`),
// então a coluna esquecida NÃO quebra nada. Ela chega com o valor padrão, em
// silêncio, e a tela mostra zero onde havia dado. É o defeito mudo de sempre.
//
// Por isso este teste lê a DEFINIÇÃO da linha e cobra a lista contra ela.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COLUNAS_DO_RESUMO } from "./anunciosGerados.ts";

/** As colunas declaradas em `AnuncioGeradoRow`, lidas da própria definição. */
function colunasDaLinha(): string[] {
  const fonte = readFileSync(
    new URL("../supabase/database.types.ts", import.meta.url),
    "utf8"
  );
  const bloco = /export interface AnuncioGeradoRow \{([\s\S]*?)\n\}/.exec(fonte);
  assert.ok(bloco, "não achei a interface AnuncioGeradoRow — o teste precisa ser atualizado");
  return [...bloco[1].matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
}

/** As tabelas relacionadas não são colunas: vêm por join e já estão na seleção. */
const RELACIONAMENTOS = new Set(["clientes", "produtos"]);

/** A única coluna que o resumo OMITE — e é a razão de ele existir. */
const OMITIDA = "anuncio";

test("o resumo cobre TODAS as colunas da linha, menos o JSONB", () => {
  const declaradas = colunasDaLinha().filter((c) => !RELACIONAMENTOS.has(c) && c !== OMITIDA);
  assert.ok(declaradas.length > 10, "leitura da interface falhou — nenhuma coluna encontrada");

  const naSelecao = new Set(COLUNAS_DO_RESUMO.split(",").map((c) => c.trim()));
  const faltando = declaradas.filter((c) => !naSelecao.has(c));

  assert.deepEqual(
    faltando,
    [],
    `coluna(s) na linha e fora do resumo: ${faltando.join(", ")}. ` +
      "Como o mapeador tolera ausência, elas chegariam com o valor PADRÃO e " +
      "ninguém perceberia. Acrescente-as a COLUNAS_DO_RESUMO."
  );
});

test("o JSONB da esteira NÃO entra no resumo — é o ponto do resumo", () => {
  const naSelecao = COLUNAS_DO_RESUMO.split(",").map((c) => c.trim());
  assert.equal(
    naSelecao.includes(OMITIDA),
    false,
    "com `anuncio` na seleção, o resumo deixa de economizar 76,6% do peso da linha"
  );
});

test("os joins que a tela usa continuam na seleção", () => {
  // `cliente` e `produto` viram nome legível pelo mapeador. Sem os joins, a
  // tela mostraria "—" onde havia nome — silencioso, como sempre.
  assert.match(COLUNAS_DO_RESUMO, /clientes\(empresa\)/);
  assert.match(COLUNAS_DO_RESUMO, /produtos\(nome\)/);
});
