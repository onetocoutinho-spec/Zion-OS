import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { variantesInexistentes } from "@/modules/integration/domain/casarComProdutoExistente";

// A VARIANTE NÃO NASCE DUAS VEZES — nem em produto casado, nem em produto novo.
//
// ===========================================================================
// O CASO, MEDIDO NA BASE DE PRODUÇÃO EM 31/08/2026
// ===========================================================================
//
// `importarAnunciosML` monta as variantes de um grupo percorrendo TODOS os
// anúncios dele. Dois anúncios do mesmo produto que anunciem o mesmo par
// cor+tamanho — a regra, não a exceção, porque é assim que se anuncia a mesma
// sandália em duas fotos — produziam duas linhas.
//
// A guarda existia e era chamada só no ramo do produto CASADO:
//
//     variantes.push(...(casado ? variantesInexistentes(...) : doGrupo))
//
// O ramo do produto NOVO entrava cru. O que isso deixou na loja que vende:
//
//     132 grupos (produto + EAN) com mais de uma linha
//     142 linhas excedentes, em 17 produtos
//     1.171 peças de estoque contadas duas vezes
//
// A assinatura não deixa dúvida sobre a causa: as duas linhas têm `created_at`
// igual até o microssegundo — mesmo insert, mesmo lote. E os 17 afetados têm
// 22,1 anúncios de média contra 9,1 dos 55 sãos: quanto mais anúncios num
// produto, maior a chance de dois colidirem no mesmo tamanho.
//
// ===========================================================================
// POR QUE A SENTINELA LÊ O FONTE
// ===========================================================================
//
// `variantesInexistentes` sempre esteve certa, e os testes dela sempre
// passaram — inclusive o que prova que ela deduplica dentro do lote. O defeito
// nunca esteve na função: estava em NÃO CHAMÁ-LA. Um teste de unidade da função
// não podia pegar isso, e `importarAnunciosML` não tem teste de integração
// porque escreve no banco.
//
// Então a sentinela guarda o ponto de chamada: se o ternário voltar, ela cai.

const FONTE = readFileSync(new URL("./importarAnunciosML.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/\s+/g, " ");

test("produto novo passa pela mesma deduplicação que o casado", () => {
  assert.ok(
    // `[^;]` e não `[^)]`: o ramo do ternário tinha `.get(prod.id)` dentro, e um
    // `[^)]*` para no primeiro parêntese aninhado — a asserção passava sempre,
    // inclusive no código defeituoso. Conferido contra as duas versões.
    !/casado\s*\?[^;]{0,200}:\s*doGrupo/.test(CODIGO),
    "voltou o ternário: produto novo entrando com doGrupo cru duplica a variante " +
      "quando dois anúncios do grupo trazem o mesmo cor+tamanho (142 linhas em 31/08/2026)"
  );
  assert.match(
    CODIGO,
    /variantes\.push\(\s*\.\.\.variantesInexistentes\(\s*doGrupo,/,
    "o push das variantes deixou de passar por variantesInexistentes"
  );
});

// O QUE A GUARDA PRECISA FAZER, e que a sentinela acima não prova sozinha: com
// a lista de já-existentes VAZIA — que é o caso do produto novo — ela ainda tem
// de deduplicar dentro do lote. Se um dia essa metade sumir, o ponto de chamada
// continuaria certo e o defeito voltaria em silêncio.
test("com lista vazia, a guarda ainda deduplica dentro do lote", () => {
  const doGrupo = [
    { sku: "", cor: "Preto", tamanho: "33 BR" },
    { sku: "", cor: "Preto", tamanho: "33 BR" }, // o segundo anúncio, mesmo par
    { sku: "", cor: "Preto", tamanho: "39 BR" },
  ];
  assert.equal(
    variantesInexistentes(doGrupo, []).length,
    2,
    "produto novo com dois anúncios no mesmo tamanho voltou a gerar duas linhas"
  );
});
