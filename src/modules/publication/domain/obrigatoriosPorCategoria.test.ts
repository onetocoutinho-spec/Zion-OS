// A preparação passa a exigir o que a CATEGORIA exige — e calçado não muda.
//
// ===========================================================================
// O QUE ESTES TESTES GUARDAM
// ===========================================================================
//
// O de-calçar tirou os obrigatórios de dentro de `resolverObrigatorios` e os
// transformou em parâmetro. Ficou honesto e ficou incompleto: os caminhos
// passavam `OBRIGATORIOS_CALCADO` à mão porque ninguém sabia a categoria.
//
// Agora quem sabe passa (`/api/ml/categoria` descobre e resolve), e quem não
// sabe continua com calçado. As duas metades precisam de prova:
//
//   1. um produto de MÓVEL com a lista de móvel é cobrado pelo que móvel exige,
//      e NÃO recebe pergunta de calçado;
//   2. um produto de CALÇADO sem lista sai IDÊNTICO ao de antes — são 80
//      produtos no ar, e a generalização não pode cobrar deles nada novo.

import { test } from "node:test";
import assert from "node:assert/strict";

import { avaliarPreparacao, type ProdutoParaPreparar } from "./preparacaoDoAnuncio.ts";
import { OBRIGATORIOS_CALCADO } from "./atributosDoMarketplace.ts";

/** Uma cama: sem gênero, sem tipo de calçado, e ninguém deveria perguntar. */
const CAMA: ProdutoParaPreparar = {
  id: "p1",
  nome: "Cama BELLA Casal",
  marca: "Bom Lar",
  modelo: "BL-BELLA",
  custo: 0,
  precoVenda: 0,
  pesoGramas: 0,
  alturaCm: 0,
  larguraCm: 0,
  comprimentoCm: 0,
  quantidadeImagens: 0,
  variantes: [],
};

/** O que a categoria de camas do ML exige — a forma que a rota devolve. */
const OBRIGATORIOS_CAMA = [
  { id: "BRAND", nome: "Marca" },
  { id: "MODEL", nome: "Modelo" },
  { id: "BED_SIZE", nome: "Tamanho da cama" },
  { id: "MATTRESS_INCLUDED", nome: "Inclui colchão" },
] as const;

function nomesExigidos(p: ProdutoParaPreparar, obrigatorios?: readonly { id: string; nome: string }[]) {
  return avaliarPreparacao(p, null, obrigatorios ? { obrigatorios } : {}).identidade.map(
    (a) => a.nome
  );
}

// ── Móvel ───────────────────────────────────────────────────────────────────

test("com a lista da categoria, a cama é cobrada pelo que CAMA exige", () => {
  const nomes = nomesExigidos(CAMA, OBRIGATORIOS_CAMA);
  assert.deepEqual(nomes, ["Marca", "Modelo", "Tamanho da cama", "Inclui colchão"]);
});

test("a cama NÃO recebe pergunta de calçado", () => {
  // O defeito que o de-calçar existia para matar: perguntar a um sofá qual é a
  // palmilha. Sem a lista da categoria ele voltaria — em silêncio.
  const resolvidos = avaliarPreparacao(CAMA, null, { obrigatorios: OBRIGATORIOS_CAMA }).identidade;
  const ids = resolvidos.map((a) => a.nome.toLowerCase()).join(" ");
  assert.ok(!/calçado|calcado/.test(ids), "tipo de calçado voltou para um móvel");
  assert.ok(!/gênero|genero/.test(ids), "gênero voltou para um móvel");
});

test("o que a categoria exige e ninguém preencheu sai AUSENTE, nunca chutado", () => {
  const resolvidos = avaliarPreparacao(CAMA, null, { obrigatorios: OBRIGATORIOS_CAMA }).identidade;
  const tamanho = resolvidos.find((a) => a.id === "BED_SIZE");
  assert.ok(tamanho);
  assert.equal(tamanho.origem, "ausente");
  // `ausente` é o que vira pergunta ao lojista. Um valor deduzido aqui seria
  // uma afirmação ao comprador, que é onde o ML pune esta conta.
  assert.ok(!tamanho.valor, "atributo desconhecido não pode nascer com valor");
});

test("marca e modelo continuam vindo do CADASTRO em qualquer categoria", () => {
  const resolvidos = avaliarPreparacao(CAMA, null, { obrigatorios: OBRIGATORIOS_CAMA }).identidade;
  assert.equal(resolvidos.find((a) => a.id === "BRAND")?.valor, "Bom Lar");
  assert.equal(resolvidos.find((a) => a.id === "MODEL")?.valor, "BL-BELLA");
});

// ── Calçado, que não pode mudar ─────────────────────────────────────────────

test("SEM lista, o comportamento é EXATAMENTE o de calçado — os 80 no ar não mudam", () => {
  const semLista = avaliarPreparacao(CAMA, null, {}).identidade;
  const comCalcado = avaliarPreparacao(CAMA, null, { obrigatorios: OBRIGATORIOS_CALCADO }).identidade;
  assert.deepEqual(semLista, comCalcado);
});

test("lista vazia não é 'não exige nada' — é o padrão de calçado", () => {
  // A escolha contraintuitiva de `?? OBRIGATORIOS_CALCADO`: uma lista vazia
  // vinda de uma consulta que falhou deixaria publicar sem ficha nenhuma.
  // Exigir demais custa um campo; exigir nada custa uma infração.
  const vazia = avaliarPreparacao(CAMA, null, { obrigatorios: [] }).identidade;
  assert.equal(vazia.length, 0, "lista vazia EXPLÍCITA é respeitada — quem a passa assumiu");
  const omitida = avaliarPreparacao(CAMA, null, {}).identidade;
  assert.equal(omitida.length, OBRIGATORIOS_CALCADO.length, "omitir cai no padrão");
});

// ── Frete fora do Mercado Envios ────────────────────────────────────────────

test("pacote grande demais NÃO vira 'margem impossível' na tela", () => {
  // Este texto errado existiu: `fora_do_me2` nasceu caindo no `else` genérico,
  // e a tela mandava a lojista mexer na MARGEM para consertar o TAMANHO da
  // caixa. Um motivo novo sem ramo próprio é pior que motivo nenhum.
  const cama: ProdutoParaPreparar = {
    ...CAMA,
    custo: 800,
    // 202 × 93 × 155: maior lado e soma acima do que o ME2 carrega.
    pesoGramas: 40_000,
    alturaCm: 202,
    larguraCm: 93,
    comprimentoCm: 155,
  };
  const pricing = avaliarPreparacao(cama, null, {}).etapas.find((e) => e.etapa === "pricing");
  assert.ok(pricing);
  assert.equal(pricing.situacao, "bloqueada");
  const texto = pricing.faltando.join(" ");
  assert.match(texto, /Mercado Envios/);
  assert.ok(!/margem/i.test(texto), "disse margem para um problema de tamanho");
  assert.ok(!/peso da embalagem/.test(texto), "disse falta peso para um pacote já medido");
});

test("pacote que CABE continua tendo preço mínimo calculado", () => {
  const caixa: ProdutoParaPreparar = {
    ...CAMA,
    custo: 50,
    pesoGramas: 800,
    alturaCm: 12,
    larguraCm: 20,
    comprimentoCm: 32,
  };
  const pricing = avaliarPreparacao(caixa, null, {}).etapas.find((e) => e.etapa === "pricing");
  assert.ok(pricing);
  assert.ok(
    !pricing.faltando.some((f) => /Mercado Envios/.test(f)),
    "caixa de sapato foi reprovada por tamanho"
  );
});
