// Linha de base da R10 — Conhecimento de medidas por marca.
// Puros, sem rede/banco. Rodar: node --test src/lib/data/tabelasMedidas.test.ts
//
// Estes testes registram o comportamento ATUAL do módulo, não o desejado.
// Servem de linha de base para a migração de R10 para modules/catalog
// (Release 008 prevista). Nenhum código de produção foi alterado.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PADRAO_BR,
  TABELAS_MARCA,
  COMO_MEDIR,
  MODELOS_PADRAO,
  medidasDaMarca,
  montarTabelaMedidas,
} from "./tabelasMedidas.ts";

// ---- Dados exportados ----

test("PADRAO_BR cobre infantil e adulto com os valores-âncora do guia", () => {
  assert.equal(Object.keys(PADRAO_BR).length, 25);
  assert.equal(PADRAO_BR["21"], 14.0); // menor infantil
  assert.equal(PADRAO_BR["33"], 21.5); // fronteira infantil/adulto
  assert.equal(PADRAO_BR["38"], 25.0); // âncora adulto
  assert.equal(PADRAO_BR["45"], 30.0); // maior adulto
});

test("TABELAS_MARCA expõe as 14 chaves e nenhuma tabela vazia", () => {
  const chaves = Object.keys(TABELAS_MARCA);
  assert.equal(chaves.length, 14);
  for (const c of chaves) {
    assert.ok(Object.keys(TABELAS_MARCA[c]).length > 0, `tabela vazia: ${c}`);
  }
});

test("TABELAS_MARCA compartilha a MESMA tabela entre marcas do mesmo grupo", () => {
  // Beira Rio e Modare são o mesmo grupo; Ipanema/Grendha/Grendene/Zaxy idem.
  assert.equal(TABELAS_MARCA["beira rio"], TABELAS_MARCA["modare"]);
  assert.equal(TABELAS_MARCA["grendha"], TABELAS_MARCA["ipanema"]);
  assert.equal(TABELAS_MARCA["grendene"], TABELAS_MARCA["ipanema"]);
  assert.equal(TABELAS_MARCA["zaxy"], TABELAS_MARCA["ipanema"]);
  assert.equal(TABELAS_MARCA["molekinha"], TABELAS_MARCA["molekinho"]);
  assert.equal(TABELAS_MARCA["yvate"], TABELAS_MARCA["azaleia"]);
});

test("COMO_MEDIR mantém as instruções que a publicação repassa ao comprador", () => {
  assert.ok(COMO_MEDIR.startsWith("Como medir:"));
  assert.ok(COMO_MEDIR.includes("folha A4"));
  assert.ok(COMO_MEDIR.includes("use o MAIOR"));
  assert.ok(COMO_MEDIR.length > 150);
});

test("MODELOS_PADRAO gera um modelo por marca, nomeado e com linhas ordenadas", () => {
  assert.equal(MODELOS_PADRAO.length, Object.keys(TABELAS_MARCA).length);

  const havaianas = MODELOS_PADRAO.find((m) => m.marca === "Havaianas");
  assert.ok(havaianas, "modelo da Havaianas ausente");
  assert.equal(havaianas.nome, "Havaianas");
  assert.equal(havaianas.comoMedir, COMO_MEDIR);
  // Ordenação pelo primeiro número do rótulo: infantil 21/22 antes do adulto.
  assert.deepEqual(havaianas.linhas[0], { rotulo: "21/22", valor: "14,1 cm" });
  assert.equal(havaianas.linhas.at(-1)?.rotulo, "47/48");

  // Nome de exibição com acento/caixa vem de NOMES_MARCA, não da chave.
  assert.ok(MODELOS_PADRAO.some((m) => m.marca === "Beira Rio"));
});

// ---- medidasDaMarca (consumida por mlUserProducts.ts) ----

test("medidasDaMarca devolve a grade da marca conhecida", () => {
  const h = medidasDaMarca("Havaianas");
  assert.equal(h["35/36"], 23.2);
  assert.equal(h["47/48"], 31.0);
});

test("medidasDaMarca normaliza acento, caixa e pontuação da marca", () => {
  const alvo = TABELAS_MARCA["beira rio"];
  assert.equal(medidasDaMarca("Beira-Rio"), alvo);
  assert.equal(medidasDaMarca("  BEIRA   RIO  "), alvo);
  assert.equal(medidasDaMarca("Azaléia"), TABELAS_MARCA["azaleia"]);
});

// A REFERÊNCIA DEIXOU DE SER SÓ A METADE ADULTA — 28/08/2026.
//
// O corte em 33 vinha de `bdaa5c3` (09/07), e o commit diz por quê: "marca sem
// tabela (Vizzano/Moleca/Actvitta) usa grade padrão BR ADULTO". As três são
// marcas adultas — o corte foi ajustado ao catálogo daquele dia, não a uma
// regra sobre infantil ser desconhecível.
//
// Hoje quem cai na referência inclui Cartago, Klin, Rider, Pegada, Zaxynina e
// Grendene Kids, que são infantis. Medido no catálogo do T1: a metade adulta
// tornava 11 anúncios impublicáveis por "nenhuma variação com tamanho
// publicável", com a resposta parada na outra metade da MESMA fonte.
//
// O que este teste guarda agora é o que sempre importou: a referência é o
// `PADRAO_BR` inteiro e nada além dele, e marca CONHECIDA continua sozinha com
// a tabela dela.
test("medidasDaMarca cai na grade de referência BR INTEIRA para marca desconhecida", () => {
  const ref = medidasDaMarca("Marca Que Nao Existe");
  assert.deepEqual(ref, PADRAO_BR, "a referência deixou de ser exatamente o padrão BR");
  assert.equal(ref["21"], PADRAO_BR["21"], "o infantil voltou a ficar de fora");
  assert.equal(ref["45"], PADRAO_BR["45"]);
});

test("MARCA CONHECIDA NÃO É MISTURADA com a referência", () => {
  // É o cuidado que sobrou do corte, e o único que era doutrina: completar a
  // grade de uma marca com a genérica é misturar grades, e a diferença entre a
  // Modare (22,3 em 34) e o padrão (22,5) é o milímetro que este módulo se
  // recusa a inventar.
  const modare = medidasDaMarca("Modare");
  assert.equal(modare["34"], 22.3);
  assert.equal(modare["21"], undefined, "a referência vazou para dentro de uma marca conhecida");
});

test("medidasDaMarca trata marca vazia como desconhecida, sem lançar", () => {
  assert.deepEqual(medidasDaMarca(""), PADRAO_BR);
});

// ---- montarTabelaMedidas (consumida por contexto.ts e produtos/page.tsx) ----

test("montarTabelaMedidas: override vence tudo e é sempre oficial", () => {
  const r = montarTabelaMedidas({
    marca: "Havaianas",
    tamanhos: ["35/36"],
    override: "  Minha tabela  ",
    tabelasCliente: [{ marca: "Havaianas", linhas: [{ rotulo: "35/36", valor: "23,2 cm" }] }],
  });
  assert.equal(r.fonte, "override");
  assert.equal(r.tabela, "Minha tabela"); // aparado
  assert.equal(r.confiavel, true);
  assert.equal(r.oficial, true);
  assert.equal(r.comoMedir, COMO_MEDIR);
});

test("montarTabelaMedidas: tabela do cliente vence a tabela hardcoded da marca", () => {
  const r = montarTabelaMedidas({
    marca: "Havaianas",
    tamanhos: ["35/36"],
    tabelasCliente: [
      { marca: "havaianas", comoMedir: "Meça assim.", linhas: [{ rotulo: "35/36", valor: "23,2 cm" }] },
    ],
  });
  assert.equal(r.fonte, "marca");
  assert.equal(r.tabela, "Tamanho\tMedida\n35/36\t23,2 cm");
  assert.equal(r.comoMedir, "Meça assim.");
  assert.equal(r.oficial, true);

  // Tabela de cliente sem linhas é ignorada: cai na hardcoded.
  const vazia = montarTabelaMedidas({
    marca: "Havaianas",
    tamanhos: ["35/36"],
    tabelasCliente: [{ marca: "havaianas", linhas: [] }],
  });
  assert.ok(vazia.tabela.startsWith("Numeração\tComprimento do pé"));
});

test("montarTabelaMedidas: marca conhecida rende a grade completa; oficial só para as do cliente", () => {
  const oficial = montarTabelaMedidas({ marca: "Modare", tamanhos: ["38"] });
  assert.equal(oficial.fonte, "marca");
  assert.equal(oficial.confiavel, true);
  assert.equal(oficial.oficial, true);
  assert.equal(oficial.tabela, "Numeração\tComprimento do pé\n34\t22,3 cm\n35\t23,0 cm\n36\t23,7 cm\n37\t24,4 cm\n38\t25,1 cm\n39\t25,8 cm\n40\t26,5 cm");

  // Ipanema tem tabela, mas é referência — não está em MARCAS_OFICIAIS.
  const referencia = montarTabelaMedidas({ marca: "Ipanema", tamanhos: ["37/38"] });
  assert.equal(referencia.fonte, "marca");
  assert.equal(referencia.confiavel, true);
  assert.equal(referencia.oficial, false);
});

test("montarTabelaMedidas: marca desconhecida com numeração de calçado usa o padrão BR", () => {
  const r = montarTabelaMedidas({ marca: "Marca Nova", tamanhos: ["37", "38"] });
  assert.equal(r.fonte, "padrao");
  assert.equal(r.confiavel, false);
  assert.equal(r.oficial, false);
  // Começa em 21 desde 28/08: a referência é o PADRAO_BR inteiro, não a metade
  // adulta. Ver o comentário do teste `... BR INTEIRA` acima.
  assert.ok(r.tabela.startsWith("Numeração\tComprimento do pé\n21\t14,0 cm"));
});

test("montarTabelaMedidas: numeração que não é de calçado devolve tabela vazia", () => {
  const r = montarTabelaMedidas({ marca: "Marca Nova", tamanhos: ["P", "M", "G"] });
  assert.equal(r.fonte, "vazio");
  assert.equal(r.tabela, "");
  assert.equal(r.confiavel, false);
  assert.equal(r.oficial, false);
  // Era `COMO_MEDIR` — e `COMO_MEDIR` manda pisar numa folha A4 e medir o pé
  // descalço. Este ramo é exatamente o "não é calçado": mandar instrução de pé
  // para um P/M/G (ou para um móvel, que é o caso que apareceu em 05/08/2026)
  // é afirmar sobre o produto uma coisa que a linha acima acabou de negar.
  assert.equal(r.comoMedir, "", "instrução de medir o pé vazou para não-calçado");
});
