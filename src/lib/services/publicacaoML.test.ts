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
  publicarNoML,
  JaPublicadoError,
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

// ── Guarda contra publicação ACIDENTAL ───────────────────────────────────────
// O ML proíbe o mesmo produto, nas mesmas condições, em mais de um anúncio — a
// infração custa o anúncio e pode custar a conta. Mas republicar deliberadamente
// (criar novo e migrar) é estratégia legítima do lojista. A guarda separa as duas
// coisas: barra o ACIDENTE (duplo clique, retry após timeout) e nunca o dry-run.
// Nenhum destes testes toca a rede: a guarda decide ANTES de qualquer fetch.

const ANUNCIO = { titulo: "T", descricao: "D", fichaTecnica: [], atributos: [], categoriaId: "MLB1" };

const publicado = {
  id: "ang-pub", clienteId: "cli-01", produtoId: null, anuncio: ANUNCIO,
  status: "publicado", mlItemId: "MLB123456789", mlPermalink: "https://x/MLB123456789",
} as unknown as Parameters<typeof publicarNoML>[0];

const aprovado = {
  id: "ang-apr", clienteId: "cli-01", produtoId: null,
  status: "aprovado", mlItemId: null, mlPermalink: null,
  anuncio: { titulo: "T", descricao: "D", atributos: [], categoriaId: "MLB1" },
} as unknown as Parameters<typeof publicarNoML>[0];

test("guarda: registro já publicado NÃO republica por acidente", async () => {
  await assert.rejects(() => publicarNoML(publicado, true), (e: Error) => {
    assert.equal(e.name, "JaPublicadoError");
    assert.equal((e as JaPublicadoError).mlItemId, "MLB123456789");
    assert.match(e.message, /não permite|duplicado/i); // explica a consequência
    return true;
  });
});

test("guarda: registro com mlItemId barra mesmo que o status não tenha sido gravado", async () => {
  const comMlb = { ...publicado, status: "aprovado" } as typeof publicado;
  await assert.rejects(() => publicarNoML(comMlb, true), (e: Error) => e.name === "JaPublicadoError");
});

test("guarda NÃO bloqueia o dry-run: preview de anúncio publicado nunca é barrado pela guarda", async () => {
  // O dry-run pode falhar por outros motivos (payload incompleto neste fixture),
  // mas JAMAIS pela guarda: inspecionar o preview de um anúncio já publicado é
  // legítimo e não cria nada no Mercado Livre.
  const erro = await publicarNoML(publicado, false).then(() => null, (e: Error) => e);
  assert.notEqual(erro?.name, "JaPublicadoError");
});

test("guarda: duplo clique simultâneo — a 2ª chamada é barrada enquanto a 1ª está em voo", async () => {
  // A 1ª vai até a rede e falha (sem fetch no ambiente de teste); o que importa
  // é que a 2ª, disparada ANTES de a 1ª terminar, seja recusada pela guarda.
  const primeira = publicarNoML(aprovado, true).catch((e: Error) => e);
  const segunda = publicarNoML(aprovado, true).catch((e: Error) => e);
  const [, e2] = await Promise.all([primeira, segunda]);
  assert.equal((e2 as Error).name, "JaPublicadoError");
});

test("guarda libera o registro após a tentativa: falha de rede não deixa o anúncio travado", async () => {
  await publicarNoML(aprovado, true).catch(() => {});
  // a 2ª tentativa não pode ser recusada pela guarda de concorrência —
  // só falharia pela rede, nunca por "já em voo".
  const erro = await publicarNoML(aprovado, true).catch((e: Error) => e);
  assert.notEqual((erro as Error).name, "JaPublicadoError");
});
