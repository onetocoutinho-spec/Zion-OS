// Testes do modelo puro do Pattern (Etapa 0 da R-PD-1).
//
// Cobrem, no nível de DOMÍNIO (sem infraestrutura), os cenários das RFCs:
// - RFC-AIL-003 §4.2 (forma canônica), §4.4/§5 (elegibilidade), §6 (exemplos
//   a–e: mesma chave, concorrentes no slot, contextos distintos, degenerada,
//   sem delta) e o PatternId determinístico derivado da chave;
// - RFC-AIL-004 §4.3/§4.4 (escada de Confidence e estados do slot, incluindo o
//   rebaixamento por disputa do cenário 4 do §8 e o isolamento por empresa do
//   cenário 7, no nível da chave).
// 100% puro: nenhum I/O, nenhum banco, nenhum Repository, nenhum Mapper.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/domain/pattern-domain.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "./decision.ts";
import {
  BOUNDED_CONTEXTS,
  canonicalizarValor,
  chaveCanonica,
  chaveDe,
  patternIdDe,
  slotCanonico,
} from "./pattern-key.ts";
import { confidenceDe, estadoDe, estadoDoSlot } from "./pattern.ts";

function decisao(over: Partial<Decision> = {}): Decision {
  return {
    id: "d-1",
    empresa: "cli-03",
    autor: "",
    contexto: "catalogo",
    entidade: { tipo: "pendencia", id: "pen-01" },
    campo: "informacaoPendente",
    valorAnterior: null,
    valorNovo: "Enviar acesso do TikTok Shop",
    origem: "pendencias.resolverPendencia",
    timestamp: "2026-07-22T12:00:00.000Z",
    correlacao: null,
    ...over,
  };
}

// ── Forma canônica (RFC-AIL-003 §4.2) ────────────────────────────────────────

test("canonicalização estrutural: bordas aparadas, espaços internos colapsados, NFC", () => {
  // "ç" composto por c + cedilha combinante (NFD) deve igualar o "ç" pré-composto.
  const decomposto = "Informação   de   custo ".normalize("NFD");
  const a = canonicalizarValor(decomposto, "informacaoPendente");
  const b = canonicalizarValor("informação de custo", "informacaoPendente");
  assert.equal(a, b);
});

test("política de caixa por campo: texto livre dobra; padrão preserva (ids)", () => {
  assert.equal(
    canonicalizarValor("ENVIAR Planilha", "informacaoPendente"),
    "enviar planilha"
  ); // campo publicado como texto livre → case-fold
  assert.equal(canonicalizarValor("MLB273770", "categoria"), "MLB273770"); // padrão: exata
});

// ── Elegibilidade (RFC-AIL-003 §4.4/§5) ──────────────────────────────────────

test("a Decision canônica da R-DJ-3 é ELEGÍVEL e produz a chave esperada", () => {
  const chave = chaveDe(decisao());
  assert.ok(chave);
  assert.deepEqual(chave, {
    empresa: "cli-03",
    contexto: "catalogo",
    campo: "informacaoPendente",
    valorNovo: "enviar acesso do tiktok shop",
  });
});

test("contexto fora dos Bounded Contexts é INELEGÍVEL (exemplo d — 'pendencia')", () => {
  assert.equal(BOUNDED_CONTEXTS.size, 7);
  assert.equal(chaveDe(decisao({ contexto: "pendencia" })), null);
});

test("sem delta é INELEGÍVEL (exemplo e — anterior === novo na forma canônica)", () => {
  assert.equal(
    chaveDe(decisao({ valorAnterior: "Premium", valorNovo: " premium " })),
    null
  ); // dobrado e aparado, é o mesmo valor → não é correção
});

test("valorNovo vazio/só espaços e empresa ausente são INELEGÍVEIS", () => {
  assert.equal(chaveDe(decisao({ valorNovo: "   " })), null);
  assert.equal(chaveDe(decisao({ empresa: " " })), null);
});

// ── Igualdade de chave e slot (RFC-AIL-003 §6, exemplos a–c) ─────────────────

test("(a) mesma quádrupla → MESMA chave e MESMO PatternId (autor/data não importam)", async () => {
  const c1 = chaveDe(decisao({ id: "d-1", autor: "ana", timestamp: "2026-07-01T00:00:00Z" }));
  const c2 = chaveDe(decisao({ id: "d-2", autor: "léo", timestamp: "2026-07-09T00:00:00Z" }));
  assert.ok(c1 && c2);
  assert.equal(chaveCanonica(c1), chaveCanonica(c2));
  assert.equal(await patternIdDe(c1), await patternIdDe(c2));
});

test("(b) valorNovo diferente → chaves DISTINTAS no MESMO slot (concorrentes)", () => {
  const c1 = chaveDe(decisao({ valorNovo: "Enviar planilha de custos" }));
  const c2 = chaveDe(decisao({ valorNovo: "Enviar acesso do TikTok Shop" }));
  assert.ok(c1 && c2);
  assert.notEqual(chaveCanonica(c1), chaveCanonica(c2));
  assert.equal(slotCanonico(c1), slotCanonico(c2));
});

test("(c) empresa ou contexto distintos → nem o slot é compartilhado (isolamento)", () => {
  const a = chaveDe(decisao({ empresa: "cli-03" }));
  const b = chaveDe(decisao({ empresa: "cli-07" }));
  const c = chaveDe(decisao({ contexto: "publicacao", campo: "tipoAnuncio", valorNovo: "Premium" }));
  assert.ok(a && b && c);
  assert.notEqual(slotCanonico(a), slotCanonico(b)); // tenant nunca cruza
  assert.notEqual(slotCanonico(a), slotCanonico(c));
});

// ── PatternId (identidade derivada — determinística) ─────────────────────────

test("PatternId: SHA-256 hex de 64 chars, determinístico, distinto por chave", async () => {
  const c1 = chaveDe(decisao());
  const c2 = chaveDe(decisao({ valorNovo: "Outra informação" }));
  assert.ok(c1 && c2);
  const id1a = await patternIdDe(c1);
  const id1b = await patternIdDe(c1);
  const id2 = await patternIdDe(c2);
  assert.match(id1a, /^[0-9a-f]{64}$/);
  assert.equal(id1a, id1b); // mesma chave → mesmo id, sempre
  assert.notEqual(id1a, id2);
});

// ── Escada de Confidence e slots (RFC-AIL-004 §4.3/§4.4) ─────────────────────

test("escada canônica: 1→observado; 2→recorrente; 3 com slot consistente→consistente", () => {
  assert.equal(confidenceDe(1, "emergente"), "observado");
  assert.equal(confidenceDe(2, "consistente"), "recorrente");
  assert.equal(confidenceDe(3, "consistente"), "consistente");
});

test("cenário 4 (§8): disputa REBAIXA — suporte 3 em slot em_disputa fica recorrente", () => {
  assert.equal(confidenceDe(3, "em_disputa"), "recorrente");
  assert.equal(estadoDe(confidenceDe(3, "em_disputa")), "emergente");
  assert.equal(estadoDe("consistente"), "estabelecido");
});

test("estado do slot: nenhum recorrente→emergente; um→consistente; dois+→em_disputa", () => {
  assert.equal(estadoDoSlot([1, 1]), "emergente");
  assert.equal(estadoDoSlot([2, 1]), "consistente");
  assert.equal(estadoDoSlot([3]), "consistente");
  assert.equal(estadoDoSlot([2, 2]), "em_disputa");
  assert.equal(estadoDoSlot([3, 2, 1]), "em_disputa");
});
