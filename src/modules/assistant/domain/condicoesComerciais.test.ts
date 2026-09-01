// Frete e garantia são escolha da LOJA, e o silêncio dela não é um "sim".
//
// ===========================================================================
// O QUE SAIU NA PRIMEIRA DESCRIÇÃO GERADA — 27/08/2026
// ===========================================================================
//
// O primeiro anúncio que a esteira produziu com categoria medida trazia, sem
// ninguém ter pedido:
//
//     "Frete grátis já embutido no preço"
//     "Garantia: 90 dias (fornecedor)"
//
// Não era invenção do modelo. Estava nas regras-mãe como "Defaults Zion (usar
// automático, NÃO é pendência)" — regra da era agência, quando a Zion operava
// as lojas e conhecia o acordo de cada uma.
//
// A agência acabou. Quem assina agora é uma loja que ninguém conhece, e a
// promessa sai no anúncio DELA: quem cobra é o comprador, quem paga é ela.
//
// Rodar: npx tsx --test src/modules/assistant/domain/condicoesComerciais.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PERFIL_VAZIO,
  blocoDoPerfil,
  normalizarPerfil,
  perfilDaLinha,
  perfilEstaVazio,
} from "./perfilDeConteudo.ts";
import { lerFonte } from "../../../testing/lerFonte.ts";

test("perfil sem escolha não afirma nada sobre frete nem garantia", () => {
  assert.equal(PERFIL_VAZIO.garantia, "");
  assert.equal(PERFIL_VAZIO.freteGratis, null);
  assert.deepEqual(blocoDoPerfil(PERFIL_VAZIO), []);
});

test("a garantia sai com as palavras da loja, não com as nossas", () => {
  const p = normalizarPerfil({ garantia: "12 meses pelo fabricante" });
  assert.match(blocoDoPerfil(p).join("\n"), /12 meses pelo fabricante/);
});

test("frete escolhido como SIM autoriza a frase; como NÃO, proíbe", () => {
  const sim = blocoDoPerfil(normalizarPerfil({ freteGratis: true })).join("\n");
  assert.match(sim, /embute o frete/);

  const nao = blocoDoPerfil(normalizarPerfil({ freteGratis: false })).join("\n");
  assert.match(nao, /NÃO escreva/);
  assert.match(nao, /frete grátis/);
});

test("`null` é 'ninguém escolheu', e não é o mesmo que `false`", () => {
  // Falso diria "a loja decidiu que não". Nulo diz "a loja não decidiu", e é a
  // diferença entre proibir a frase e simplesmente não ter resposta.
  const indeciso = normalizarPerfil({ freteGratis: undefined });
  assert.equal(indeciso.freteGratis, null);
  assert.equal(blocoDoPerfil(indeciso).join("\n").includes("frete"), false);
});

test("valor que não é booleano nunca vira decisão", () => {
  assert.equal(normalizarPerfil({ freteGratis: "sim" }).freteGratis, null);
  assert.equal(normalizarPerfil({ freteGratis: 1 }).freteGratis, null);
});

test("a coluna NULL do banco vira 'não escolheu', não vira 'não'", () => {
  const p = perfilDaLinha({
    tom: null, publico: null, palavras_preferidas: null,
    palavras_proibidas: null, observacoes: null, garantia: null, frete_gratis: null,
  });
  assert.equal(p.garantia, "");
  assert.equal(p.freteGratis, null);
});

test("perfil que SÓ tem garantia não é um perfil vazio", () => {
  // `blocoDoPerfil` sai cedo quando o perfil está vazio. Se garantia não
  // contasse, a única coisa que a loja escolheu seria engolida.
  const p = normalizarPerfil({ garantia: "90 dias pela loja" });
  assert.equal(perfilEstaVazio(p), false);
  assert.match(blocoDoPerfil(p).join("\n"), /90 dias pela loja/);
});

test("perfil que SÓ decidiu o frete também não é vazio", () => {
  assert.equal(perfilEstaVazio(normalizarPerfil({ freteGratis: false })), false);
});

// ---------------------------------------------------------------------------
// As duas pontas: a regra no prompt, e a esteira recebendo o perfil
// ---------------------------------------------------------------------------

test("as regras-mãe NÃO carregam mais o default da Zion", () => {
  const fonte = lerFonte("src/lib/agentes/catalogo.ts");
  assert.doesNotMatch(
    fonte,
    /Defaults Zion.*garantia = 90 dias/,
    "o default de garantia/frete voltou às regras-mãe — ele promete em nome de uma loja que não escolheu"
  );
  assert.match(fonte, /NUNCA afirme condição comercial por conta própria/);
});

test("a esteira recebe o perfil da loja", () => {
  // Ela era o único gerador sem perfil, e é a que roda em lote, sem ninguém na
  // tela — onde uma promessa inventada passa despercebida.
  const fonte = lerFonte("src/app/api/otimizar/worker/route.ts");
  assert.match(fonte, /blocoDoPerfil\(perfilDaLinha\(/);
  assert.match(fonte, /perfis_de_conteudo/);
});
