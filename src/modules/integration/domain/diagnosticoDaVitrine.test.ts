// As três regras do diagnóstico da vitrine, provadas.

import test from "node:test";
import assert from "node:assert/strict";
import {
  diagnosticarVitrine,
  urgenciaDoEstado,
  familiaDoRemedio,
  ORDEM_DA_URGENCIA,
  type AnuncioNaVitrine,
  type InfracaoDoAnuncio,
} from "./diagnosticoDaVitrine.ts";

const anuncio = (
  mlItemId: string | null,
  statusMarketplace: string | null,
  produto = "Chinelo"
): AnuncioNaVitrine => ({ mlItemId, statusMarketplace, produto });

const foto = (n = 1): InfracaoDoAnuncio[] =>
  Array.from({ length: n }, () => ({
    motivo: "A foto de capa não cumpre os requisitos.",
    remedio: "Corrija suas fotos: descumpre o tamanho mínimo, posição e proporção do produto.",
  }));

// ---------------------------------------------------------------------------
// REGRA 1 — conta-se ANÚNCIO, nunca infração
// ---------------------------------------------------------------------------

test("um anúncio com cinco infrações conta UMA vez", () => {
  // O erro registrado no próprio repositório: "1.060 lido como 1.060 anúncios
  // quando são 460". Na conta real a média é 2,3 infrações por anúncio.
  const d = diagnosticarVitrine([anuncio("MLB1", "active")], { MLB1: foto(5) });
  assert.equal(d.anuncios.length, 1);
  assert.equal(d.contagem.penalizado, 1);
  assert.equal(d.anuncios[0].quantasInfracoes, 5, "a contagem bruta continua visível");
});

test("o mesmo MLB repetido na entrada não vira duas linhas", () => {
  const d = diagnosticarVitrine(
    [anuncio("MLB1", "paused"), anuncio("MLB1", "paused")],
    { MLB1: foto() }
  );
  assert.equal(d.anuncios.length, 1);
});

test("anúncio sem MLB não entra — não está no ar", () => {
  const d = diagnosticarVitrine([anuncio(null, null), anuncio("  ", null)], {});
  assert.deepEqual(d.anuncios, []);
});

test("remédio repetido aparece uma vez só", () => {
  // Três vezes o mesmo texto não informa três vezes mais.
  const d = diagnosticarVitrine([anuncio("MLB1", "paused")], { MLB1: foto(3) });
  assert.equal(d.anuncios[0].remedios.length, 1);
});

// ---------------------------------------------------------------------------
// REGRA 2 — a causa vem do REMÉDIO, não do subgrupo
// ---------------------------------------------------------------------------

test("subgrupos diferentes com o mesmo remédio são a MESMA causa", () => {
  // Medido em 06/08: "FOTOS" e "PQT" são rótulos diferentes do ML para o mesmo
  // remédio — "A foto de capa não cumpre os requisitos". Agrupar por subgrupo
  // mostraria dois problemas onde há um.
  const d = diagnosticarVitrine(
    [anuncio("MLB1", "active"), anuncio("MLB2", "active")],
    { MLB1: foto(), MLB2: foto() }
  );
  assert.equal(d.causaDominante?.causa, "Fotos");
  assert.equal(d.causaDominante?.anuncios, 2);
  assert.equal(d.causaDominante?.pct, 100);
});

test("a família sai do texto do ML e cobre os casos reais da conta", () => {
  assert.equal(familiaDoRemedio("Corrija suas fotos: tem logos e/ou textos."), "Fotos");
  assert.equal(familiaDoRemedio("A foto de capa não cumpre os requisitos"), "Fotos");
  assert.equal(
    familiaDoRemedio("Ajuste o título e/ou substitua as fotos"),
    "Fotos",
    "quando o remédio cita foto E título, foto manda: é o que se refaz"
  );
  assert.equal(familiaDoRemedio("Verifique o produto de catálogo que sugerimos"), "Catálogo");
  assert.equal(familiaDoRemedio(""), "O ML não disse");
});

test("a causa dominante conta ANÚNCIOS, e a porcentagem é sobre os que têm infração", () => {
  // Quatro anúncios, dois com infração de foto. A causa é 100% dos PUNIDOS,
  // não 50% da vitrine — misturar as duas bases é como "59% do catálogo" vira
  // uma frase errada.
  const d = diagnosticarVitrine(
    [
      anuncio("MLB1", "active"),
      anuncio("MLB2", "active"),
      anuncio("MLB3", "active"),
      anuncio("MLB4", "active"),
    ],
    { MLB1: foto(), MLB2: foto() }
  );
  assert.equal(d.causaDominante?.anuncios, 2);
  assert.equal(d.causaDominante?.pct, 100);
});

test("sem nenhuma infração não há causa dominante — e não é 'Outros'", () => {
  const d = diagnosticarVitrine([anuncio("MLB1", "active")], {});
  assert.equal(d.causaDominante, null);
});

// ---------------------------------------------------------------------------
// REGRA 3 — `null` é "não sabemos", nunca "está ok"
// ---------------------------------------------------------------------------

test("estado ausente é 'não sabemos'", () => {
  // A lei da migração 050. São 99 anúncios da conta real, e chamá-los de
  // saudáveis seria a mentira que ela existe para impedir.
  assert.equal(urgenciaDoEstado(null, false), "nao_sabemos");
  assert.equal(urgenciaDoEstado("", false), "nao_sabemos");
  assert.equal(urgenciaDoEstado("   ", true), "nao_sabemos");
});

test("palavra NOVA do ML não é promovida a grave", () => {
  // Se o ML criar um estado amanhã, inventar gravidade a partir de uma palavra
  // que não reconhecemos é pior que dizer "não sei" — a tela mostra o texto
  // cru por `rotuloStatusMarketplace`.
  assert.equal(urgenciaDoEstado("payment_required", true), "nao_sabemos");
});

// ---------------------------------------------------------------------------
// A ORDEM — que é a resposta inteira do módulo
// ---------------------------------------------------------------------------

test("fora do ar vem antes de tudo", () => {
  // `paused` custa dinheiro AGORA: o anúncio não aparece para quem procura.
  // `penalizado` incomoda; fora do ar sangra.
  for (const estado of ["paused", "closed", "inactive"]) {
    assert.equal(urgenciaDoEstado(estado, false), "fora_do_ar", estado);
  }
  assert.equal(urgenciaDoEstado("under_review", false), "sob_revisao");
  assert.deepEqual([...ORDEM_DA_URGENCIA], [
    "fora_do_ar",
    "sob_revisao",
    "penalizado",
    "nao_sabemos",
  ]);
});

test("no ar SEM infração não é penalizado", () => {
  // Senão a lista de "resolva isto" incluiria os 491 anúncios saudáveis.
  assert.equal(urgenciaDoEstado("active", false), "nao_sabemos");
  assert.equal(urgenciaDoEstado("active", true), "penalizado");
});

test("a lista sai ordenada por urgência, e dentro dela pelo que dói mais", () => {
  const d = diagnosticarVitrine(
    [
      anuncio("MLB_ativo", "active", "saudável"),
      anuncio("MLB_revisao", "under_review", "em revisão"),
      anuncio("MLB_pausado_1", "paused", "pausado com 1"),
      anuncio("MLB_pausado_9", "paused", "pausado com 9"),
      anuncio("MLB_punido", "active", "punido no ar"),
    ],
    { MLB_pausado_1: foto(1), MLB_pausado_9: foto(9), MLB_punido: foto(2) }
  );
  assert.deepEqual(
    d.anuncios.map((a) => a.produto),
    ["pausado com 9", "pausado com 1", "em revisão", "punido no ar", "saudável"]
  );
});

test("a ordem é estável entre chamadas", () => {
  // Sem desempate a lista embaralha entre renderizações e a pessoa perde o
  // lugar onde estava — numa lista de 276, isso é o suficiente para desistir.
  const entrada = [anuncio("MLB_b", "paused"), anuncio("MLB_a", "paused")];
  const primeira = diagnosticarVitrine(entrada, {}).anuncios.map((a) => a.mlItemId);
  const segunda = diagnosticarVitrine([...entrada].reverse(), {}).anuncios.map((a) => a.mlItemId);
  assert.deepEqual(primeira, segunda);
});

// ---------------------------------------------------------------------------
// A CONTA REAL, em miniatura
// ---------------------------------------------------------------------------

test("a contagem reproduz a forma da conta medida em 03/08", () => {
  // 491 active · 155 under_review · 121 paused · 12 closed · 2 inactive · 99 sem
  // estado. Aqui em escala 1:100, com infração só nos punidos.
  const vitrine: AnuncioNaVitrine[] = [
    ...Array.from({ length: 5 }, (_, i) => anuncio(`A${i}`, "active")),
    ...Array.from({ length: 2 }, (_, i) => anuncio(`R${i}`, "under_review")),
    ...Array.from({ length: 1 }, (_, i) => anuncio(`P${i}`, "paused")),
    ...Array.from({ length: 1 }, (_, i) => anuncio(`F${i}`, "closed")),
    ...Array.from({ length: 1 }, (_, i) => anuncio(`S${i}`, null)),
  ];
  const d = diagnosticarVitrine(vitrine, { A0: foto(), A1: foto() });

  assert.equal(d.contagem.fora_do_ar, 2, "paused + closed");
  assert.equal(d.contagem.sob_revisao, 2);
  assert.equal(d.contagem.penalizado, 2, "active COM infração");
  assert.equal(d.contagem.nao_sabemos, 4, "3 active limpos + 1 sem estado");
  assert.equal(
    d.contagem.fora_do_ar + d.contagem.sob_revisao + d.contagem.penalizado + d.contagem.nao_sabemos,
    vitrine.length
  );
});
