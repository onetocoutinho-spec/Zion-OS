// Testes da moldura do portal.
//
// O menu tinha quinze itens e o dono do produto resumiu: "a plataforma está
// totalmente confusa, ela não sabe nem o que fazer primeiro". Cinco contextos,
// conforme docs/product/UX-010.
// Rodar: npx tsx --test src/modules/portal/domain/navegacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { AREAS, areaDaRota, telaAtiva, totalDeTelas } from "./navegacao.ts";

test("são CINCO áreas, na ordem da operação", () => {
  assert.deepEqual(
    AREAS.map((a) => a.contexto),
    ["hoje", "catalogo", "anuncios", "pulso", "zion"]
  );
});

test("toda área responde uma PERGUNTA, não um substantivo", () => {
  // É a pergunta que orienta quem não sabe por onde começar. "Catálogo" sozinho
  // não diz nada; "o que sabemos dos produtos?" diz.
  for (const a of AREAS) {
    assert.ok(a.pergunta.includes("?"), `${a.contexto} sem pergunta`);
    assert.ok(a.titulo.length > 0);
  }
});

test("nenhuma tela se perdeu na reorganização", () => {
  // As quinze rotas antigas continuam alcançáveis — a moldura mudou, o conteúdo
  // não. Perder uma no caminho seria a pior forma de "simplificar".
  const hrefs = AREAS.flatMap((a) => a.telas.map((t) => t.href));
  for (const antiga of [
    "/cliente",
    "/cliente/anunciar",
    "/cliente/vendas",
    "/cliente/produtos",
    "/cliente/anuncios",
    "/cliente/imagens",
    "/cliente/medidas",
    "/cliente/peso",
    "/cliente/otimizar",
    "/cliente/auditoria",
    "/cliente/precificacao",
    "/cliente/relatorios",
    "/cliente/pendencias",
    "/cliente/configuracoes",
    "/cliente/ajuda",
  ]) {
    assert.ok(hrefs.includes(antiga), `${antiga} sumiu da moldura`);
  }
});

test("nenhuma tela aparece em duas áreas", () => {
  // Duas casas para a mesma tela é a confusão de volta, só que disfarçada.
  const hrefs = AREAS.flatMap((a) => a.telas.map((t) => t.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(totalDeTelas(), hrefs.length);
});

test("a porta de cada área está DENTRO dela", () => {
  for (const a of AREAS) {
    assert.ok(
      a.telas.some((t) => t.href === a.principal),
      `${a.contexto}: principal aponta para fora da área`
    );
  }
});

// ---- Em qual área estou ----

test("casa pelo prefixo MAIS LONGO, não pelo primeiro que serve", () => {
  // "/cliente" é prefixo de tudo. Sem essa regra a pessoa estaria sempre em
  // "Hoje", e a moldura mentiria sobre onde ela está.
  assert.equal(areaDaRota("/cliente/produtos")?.contexto, "catalogo");
  assert.equal(areaDaRota("/cliente/precificacao")?.contexto, "catalogo");
  assert.equal(areaDaRota("/cliente/anunciar")?.contexto, "anuncios");
  assert.equal(areaDaRota("/cliente/vendas")?.contexto, "pulso");
  assert.equal(areaDaRota("/cliente/configuracoes")?.contexto, "zion");
  assert.equal(areaDaRota("/cliente")?.contexto, "hoje");
});

test("sub-rota fica na área do pai", () => {
  assert.equal(areaDaRota("/cliente/anuncios/abc-123")?.contexto, "anuncios");
  assert.equal(areaDaRota("/cliente/produtos/qualquer/coisa")?.contexto, "catalogo");
});

test("barra final e query string não confundem", () => {
  assert.equal(areaDaRota("/cliente/produtos/")?.contexto, "catalogo");
  assert.equal(areaDaRota("/cliente/anunciar?produto=abc")?.contexto, "anuncios");
});

test("rota desconhecida não destaca área nenhuma", () => {
  // Destacar a errada é pior que não destacar: a pessoa confia na moldura.
  assert.equal(areaDaRota("/outra-coisa"), null);
  assert.equal(areaDaRota("/ail/padroes"), null);
});

// ---- Qual tela está aberta ----

test('"/cliente" só acende em si mesma', () => {
  // Sendo prefixo de tudo, sem regra exata ficaria aceso o portal inteiro.
  assert.equal(telaAtiva("/cliente", "/cliente"), true);
  assert.equal(telaAtiva("/cliente/produtos", "/cliente"), false);
});

test("a tela acende na própria rota e nas filhas", () => {
  assert.equal(telaAtiva("/cliente/anuncios", "/cliente/anuncios"), true);
  assert.equal(telaAtiva("/cliente/anuncios/xyz", "/cliente/anuncios"), true);
  assert.equal(telaAtiva("/cliente/anunciar", "/cliente/anuncios"), false);
});

test('"anunciar" e "anuncios" não se confundem', () => {
  // Prefixo de texto puro casaria os dois. A regra exige a barra.
  assert.equal(telaAtiva("/cliente/anunciar", "/cliente/anunciar"), true);
  assert.equal(telaAtiva("/cliente/anuncios", "/cliente/anunciar"), false);
});
