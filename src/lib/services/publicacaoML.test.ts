// Testes do Learning Loop de publicação (PR-006).
//
// publicarNoML depende de rede (fetch da rota) — a lógica do loop vive em
// builders PUROS testados aqui: (1) montarCapturaCategoriaPublicada (par
// proposta-do-ambiente → escolha) + guardas do capturarDecisao; (2)
// comporObservacoesComFalha (veredito preservado SEM destruir marcadores).
// Rodar: npx tsx --test src/lib/services/publicacaoML.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  comporObservacoesComFalha,
  montarCapturaCategoriaPublicada,
} from "./publicacaoML.ts";
import { capturarDecisao } from "../../modules/adaptive-intelligence/decision-journal.ts";
import { InMemoryDecisionJournal } from "../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

const registro = { id: "ang-01", clienteId: "cli-01" };

test("par completo: ambiente propôs X, humano usou Y → Decision canônica", () => {
  const captura = montarCapturaCategoriaPublicada(registro, "MLB111111", "MLB273770");
  assert.ok(captura);
  assert.equal(captura.contexto, "catalogo");
  assert.equal(captura.campo, "categoriaMarketplace"); // mesmo slot do agregado Produto
  assert.equal(captura.valorAnterior, "MLB111111"); // a proposta do ambiente
  assert.equal(captura.valorNovo, "MLB273770"); // a escolha consumada
  assert.equal(captura.empresa, "cli-01");
  assert.deepEqual(captura.entidade, { tipo: "anuncio", id: "ang-01" });
  assert.equal(captura.origem, "api/ml/publicar");
});

test("sem categoria usada → não há decisão consumada (null)", () => {
  assert.equal(montarCapturaCategoriaPublicada(registro, "MLB111111", null), null);
  assert.equal(montarCapturaCategoriaPublicada(registro, "MLB111111", ""), null);
});

test("DoD: capturarDecisao só dispara quando a categoria MUDA", () => {
  const journal = new InMemoryDecisionJournal();

  // ambiente propôs e o humano ACEITOU (prevista === usada) → sem delta → nada
  const igual = montarCapturaCategoriaPublicada(registro, "MLB273770", "MLB273770");
  assert.ok(igual);
  capturarDecisao(igual, journal);
  assert.equal(journal.recebidas.length, 0);

  // ambiente propôs A, humano usou B → delta → memória
  const diferente = montarCapturaCategoriaPublicada(registro, "MLB111111", "MLB273770");
  assert.ok(diferente);
  capturarDecisao(diferente, journal);
  assert.equal(journal.recebidas.length, 1);

  // ambiente não propôs (null) → ausente→valor é delta válido
  const semProposta = montarCapturaCategoriaPublicada(registro, null, "MLB273770");
  assert.ok(semProposta);
  capturarDecisao(semProposta, journal);
  assert.equal(journal.recebidas.length, 2);
});

test("autoria (E4.2.3): o spread do wiring leva o autor até a Decision", () => {
  // publicarNoML faz `capturarDecisao({ ...captura, autor: await autorAtual() })`
  // — quem publicou é quem decidiu. Cobre o caminho real com o builder real.
  const journal = new InMemoryDecisionJournal();
  const captura = montarCapturaCategoriaPublicada(registro, "MLB111111", "MLB273770");
  assert.ok(captura);
  capturarDecisao({ ...captura, autor: "equipe@zion.com" }, journal);
  assert.equal(journal.recebidas.length, 1);
  assert.equal(journal.recebidas[0].autor, "equipe@zion.com");
});

test("veredito da rejeição: anexado sem destruir observações existentes", () => {
  assert.equal(
    comporObservacoesComFalha("", "attribute GTIN is required"),
    "[Publicação ML rejeitada] attribute GTIN is required"
  );
  // o marcador "Importado do " (usado pela reimportação) permanece no PREFIXO
  const composto = comporObservacoesComFalha(
    "Importado do ML (2026-07-01)",
    "chart_name_unavailable"
  );
  assert.ok(composto.startsWith("Importado do ML (2026-07-01)"));
  assert.ok(composto.endsWith("[Publicação ML rejeitada] chart_name_unavailable"));
});
