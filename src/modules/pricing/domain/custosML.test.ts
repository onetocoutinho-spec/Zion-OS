// Testes dos custos do Mercado Livre.
//
// Os valores esperados aqui vêm da TABELA OFICIAL (ver tabelaEnvioML.ts), não
// de estimativa de terceiros. Se o ML mudar a tabela, estes testes quebram —
// que é exatamente o que deve acontecer.
// Rodar: npx tsx --test src/modules/pricing/domain/custosML.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  pesoCobravelGramas,
  custoDeEnvio,
  comissaoDoAnuncio,
  COMISSAO_MODA,
  LIMIAR_FRETE_GRATIS,
  nomeDoTipoDeAnuncio,
  reputacaoDoLevelId,
  tipoUnicoDosAnuncios,
} from "./custosML.ts";

// ── Peso cobrável: o maior entre real e cubado ───────────────────────────────

test("caixa volumosa e leve é cobrada pelo VOLUME, não pela balança", () => {
  // Caixa de chinelo: 30×20×10 = 6000 cm³ → 1000 g cubados contra 400 g reais.
  const cobravel = pesoCobravelGramas({
    pesoGramas: 400,
    alturaCm: 10,
    larguraCm: 20,
    comprimentoCm: 30,
  });
  assert.equal(cobravel, 1000);
});

test("produto denso e pequeno é cobrado pelo peso real", () => {
  const cobravel = pesoCobravelGramas({
    pesoGramas: 2000,
    alturaCm: 5,
    larguraCm: 10,
    comprimentoCm: 10,
  });
  assert.equal(cobravel, 2000); // cubado = 500/6000×1000 ≈ 83 g
});

test("sem medidas, o peso real prevalece — nunca se infla por falta de dado", () => {
  const cobravel = pesoCobravelGramas({
    pesoGramas: 350,
    alturaCm: 0,
    larguraCm: 0,
    comprimentoCm: 0,
  });
  assert.equal(cobravel, 350);
});

// ── Custo de envio: matriz peso × preço ──────────────────────────────────────

test("o envio incide TAMBÉM abaixo do limiar — não é zero lá", () => {
  // A página oficial: "se aplica a todas as vendas, mesmo que o comprador
  // pague pelo envio". O modelo anterior zerava isto e errava por baixo.
  const c = custoDeEnvio(300, 50);
  assert.ok(c !== null && c > 0, `esperado custo > 0 abaixo do limiar, veio ${c}`);
  assert.equal(c, 7.75); // 0,3 kg × faixa R$ 49 a R$ 78,99, tabela verde
});

test("no limiar o custo SALTA — é quando o frete grátis vira do vendedor", () => {
  const abaixo = custoDeEnvio(300, LIMIAR_FRETE_GRATIS - 0.01)!;
  const acima = custoDeEnvio(300, LIMIAR_FRETE_GRATIS)!;
  assert.equal(abaixo, 7.75);
  assert.equal(acima, 12.35);
  assert.ok(acima > abaixo * 1.5);
});

test("o MESMO peso custa mais quando o produto é mais caro", () => {
  // O preço entra duas vezes na conta: pela comissão e pela faixa de envio.
  assert.equal(custoDeEnvio(300, 90), 12.35);
  assert.equal(custoDeEnvio(300, 250), 20.95);
});

test("a caixa de chinelo cubada cai numa faixa de peso mais cara", () => {
  const peso = pesoCobravelGramas({
    pesoGramas: 400,
    alturaCm: 10,
    larguraCm: 20,
    comprimentoCm: 30,
  });
  assert.equal(custoDeEnvio(peso, 110), 16.15); // faixa "De 0,5 a 1 kg"
  // Se fosse pelo peso real de 400 g, cairia na faixa anterior e mais barata.
  assert.equal(custoDeEnvio(400, 110), 15.45);
});

test("reputação escolhe a tabela — laranja paga bem mais que verde", () => {
  const verde = custoDeEnvio(300, 110, "verde")!;
  const amarela = custoDeEnvio(300, 110, "amarela")!;
  const laranja = custoDeEnvio(300, 110, "laranja")!;
  assert.equal(verde, 14.35);
  assert.equal(amarela, 17.22);
  assert.equal(laranja, 28.7);
  assert.ok(verde < amarela && amarela < laranja);
});

test("abaixo de R$ 19 o envio custa no máximo METADE do preço", () => {
  // Sem esse teto, um item de R$ 8 pagaria R$ 5,65 — 71% do próprio preço.
  assert.equal(custoDeEnvio(300, 8), 4);
  assert.equal(custoDeEnvio(300, 10), 5);
  // Em R$ 19 o teto já não vale: passa a valer a tabela cheia.
  assert.equal(custoDeEnvio(300, 19), 6.55);
});

test("peso acima de 150 kg cai na última faixa, sem estourar", () => {
  assert.equal(custoDeEnvio(200000, 250), 261.95);
});

test("preço zero não gera custo, e entrada inválida devolve null", () => {
  assert.equal(custoDeEnvio(300, 0), 0);
  assert.equal(custoDeEnvio(-1, 50), null);
  assert.equal(custoDeEnvio(300, -1), null);
});

// ── Comissão ─────────────────────────────────────────────────────────────────

test("Premium é o padrão do canal; Clássico é mais barato", () => {
  assert.equal(comissaoDoAnuncio(undefined), 19);
  assert.equal(comissaoDoAnuncio("Premium"), 19);
  assert.equal(comissaoDoAnuncio("Clássico"), 14);
  assert.equal(COMISSAO_MODA.premium, 19);
});

test("outra categoria entra como parâmetro, não como número solto", () => {
  assert.equal(comissaoDoAnuncio("Premium", { classico: 11, premium: 16 }), 16);
});

// ── Reputação vinda da API do ML ─────────────────────────────────────────────

test("level_id do ML escolhe a tabela de envio", () => {
  assert.equal(reputacaoDoLevelId("5_green"), "verde");
  assert.equal(reputacaoDoLevelId("4_light_green"), "verde");
  assert.equal(reputacaoDoLevelId("3_yellow"), "amarela");
  assert.equal(reputacaoDoLevelId("2_orange"), "laranja");
  assert.equal(reputacaoDoLevelId("1_red"), "laranja");
});

test("MercadoLíder entra na faixa verde qualquer que seja a cor", () => {
  assert.equal(reputacaoDoLevelId("3_yellow", "platinum"), "verde");
  assert.equal(reputacaoDoLevelId("1_red", "gold"), "verde");
  assert.equal(reputacaoDoLevelId(null, "silver"), "verde");
});

test("sem reputação é VERDE — regra do próprio ML para quem está começando", () => {
  assert.equal(reputacaoDoLevelId(null), "verde");
  assert.equal(reputacaoDoLevelId(""), "verde");
  assert.equal(reputacaoDoLevelId(undefined), "verde");
});

test("nível desconhecido cai na tabela MAIS CARA — nunca subestima o custo", () => {
  // Se o ML renomear os níveis, o piso não pode ficar abaixo do custo real.
  assert.equal(reputacaoDoLevelId("7_platinum_plus"), "laranja");
});

// ===========================================================================
// O TIPO DO ANÚNCIO — medido em 24/08/2026
// ===========================================================================
//
// A comissão da margem saía de `canais_marketplace.tipoAnuncio`: uma
// configuração DA LOJA INTEIRA, com padrão "Premium". O Mercado Livre informa
// o tipo ANÚNCIO POR ANÚNCIO no `listing_type_id`, e a importação descartava.
// Em Moda são 14% contra 19% — cinco pontos sobre o número que decide preço.

test("os DOIS dialetos chegam ao mesmo lugar: o do ML e o da configuração", () => {
  // `canais_marketplace` guarda "Premium"/"Clássico"; o ML manda
  // `gold_pro`/`gold_special`. Antes de hoje só o primeiro chegava aqui.
  assert.equal(nomeDoTipoDeAnuncio("Premium"), "Premium");
  assert.equal(nomeDoTipoDeAnuncio("gold_pro"), "Premium");
  assert.equal(nomeDoTipoDeAnuncio("Clássico"), "Clássico");
  assert.equal(nomeDoTipoDeAnuncio("classico"), "Clássico");
  assert.equal(nomeDoTipoDeAnuncio("gold_special"), "Clássico");
  assert.equal(nomeDoTipoDeAnuncio("GOLD_SPECIAL"), "Clássico");
});

test("TIPO NOVO DO ML NÃO VIRA CLÁSSICO EM SILÊNCIO", () => {
  // O ML pode criar um tipo amanhã. Ele não pode cair num dos dois por
  // omissão: quem lê a resposta decide preço com ela.
  assert.equal(nomeDoTipoDeAnuncio("gold_platinum"), null);
  assert.equal(nomeDoTipoDeAnuncio("free"), null);
  assert.equal(nomeDoTipoDeAnuncio(""), null);
  assert.equal(nomeDoTipoDeAnuncio(null), null);
  assert.equal(nomeDoTipoDeAnuncio(undefined), null);
});

test("O CÓDIGO CRU DO ML passa a produzir a comissão certa", () => {
  // ESTE era o defeito. `gold_special` não é a string "Clássico", então a
  // comparação antiga caía no default e cobrava 19% de um anúncio que paga 14%.
  assert.equal(comissaoDoAnuncio("gold_special"), 14);
  assert.equal(comissaoDoAnuncio("gold_pro"), 19);
  // E o comportamento antigo continua: sem tipo, Premium.
  assert.equal(comissaoDoAnuncio(null), 19);
  assert.equal(comissaoDoAnuncio("Clássico"), 14);
});

test("tipo NÃO RECONHECIDO cai em Premium — a direção que não infla a margem", () => {
  // Premium é a comissão MAIOR: supô-la faz a margem parecer PIOR do que é.
  // O contrário — inflar a margem — é o defeito que este modelo mais repetiu.
  assert.equal(comissaoDoAnuncio("gold_platinum"), 19);
});

test("produto com anúncios de tipos DIFERENTES não tem UMA comissão", () => {
  // Um produto de calçado tem um anúncio por numeração. Quando eles divergem,
  // escolher um deles produziria um número com cara de exato sobre uma
  // pergunta que não tem resposta única.
  assert.equal(tipoUnicoDosAnuncios(["gold_pro", "gold_pro", "gold_pro"]), "Premium");
  assert.equal(tipoUnicoDosAnuncios(["gold_special", "gold_pro"]), null);
  // Anúncio sem tipo lido é IGNORADO — ausência não é divergência.
  assert.equal(tipoUnicoDosAnuncios(["gold_pro", null, undefined, ""]), "Premium");
  // Nada lido = não sei.
  assert.equal(tipoUnicoDosAnuncios([null, null]), null);
  assert.equal(tipoUnicoDosAnuncios([]), null);
  // Os dois dialetos concordando NÃO são divergência.
  assert.equal(tipoUnicoDosAnuncios(["gold_pro", "Premium"]), "Premium");
});

test("a PROCEDÊNCIA distingue 'do anúncio' de 'da tabela'", () => {
  // "19%" sozinho não deixa a lojista conferir. E dizer "do anúncio" quando
  // não se sabe o tipo daria uma garantia que não existe.
  const svc = readFileSync(
    new URL("../../../lib/services/precificacaoDoCopilot.ts", import.meta.url),
    "utf8"
  );
  assert.match(svc, /comissao: tipoVeioDoAnuncio \? "anuncio" : "tabela"/);
  assert.match(svc, /tipoUnicoDosAnuncios\(/, "o serviço parou de resolver o tipo pelos anúncios");
  assert.match(svc, /\.eq\("cliente_id", clienteId\)/, "a leitura do tipo perdeu a fronteira de tenant");
  // A lista inteira só é "do anúncio" quando TODOS os produtos têm tipo.
  assert.match(svc, /linhas\.every\(\(p\) => \(tipoPorProduto\.get\(p\.id\) \?\? null\) !== null\)/);
});

test("a frase da comissão DIZ o tipo — sem ele a lojista não confere", () => {
  const conv = readFileSync(
    new URL("./conversaDePreco.ts", import.meta.url),
    "utf8"
  );
  const fn = /export function escreverComissao\([\s\S]*?\n\}/.exec(conv);
  assert.ok(fn, "não achei `escreverComissao`");
  assert.match(fn[0], /case "anuncio":/);
  assert.match(fn[0], /nomeDoTipoDeAnuncio\(e\.taxas\.tipoAnuncio\)/);
  // A frase de "tabela" continua dizendo que é estimativa.
  assert.match(fn[0], /estimativa da tabela de Moda/);
});
