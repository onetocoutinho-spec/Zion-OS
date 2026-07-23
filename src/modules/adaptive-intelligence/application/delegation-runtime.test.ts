// Testes do Delegation Runtime (E5.10b).
//
// Cobrem os portões da ADR-002 Q8: sem Knowledge vigente → NUNCA (inclusive
// com confidence consistente — o teste anti-Confidence é explícito);
// contradição sinalizada bloqueia; rebaixamento revoga execução futura;
// versão divergente exige re-delegação humana; o fato de concessão carrega
// quem/knowledge/versão/autoridade/assinatura/evidências; a execução registra
// oferta assinada pelo runtime ANTES de devolver o valor; revogação não
// apaga o passado. 100% em memória.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/delegation-runtime.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { estadoConhecimento, type FatoMaturacao } from "../domain/knowledge.ts";
import { estadoDelegacao, execucaoPermitida, verificarDelegabilidade, type FatoDelegacao } from "../domain/delegation.ts";
import type { Oferta } from "../domain/offer.ts";
import {
  ASSINATURA_DELEGATION_RUNTIME,
  concederDelegacao,
  executarDelegacao,
  revogarDelegacao,
  type DepsDelegacao,
} from "./delegation-runtime.ts";
import type { VisaoConhecimento } from "./knowledge-maturation.ts";

const FOTO = {
  confidenceNoInstante: "consistente",
  suporteIndependente: 3,
  decisoesIndependentes: ["d1", "d2", "d3"],
  outcomesConsiderados: ["otc:1", "otc:2"],
  ultimoOutcomeStatus: "confirmed",
  readinessBloqueios: [],
} as const;

function promocao(versao: number, ocorridoEm: string): FatoMaturacao {
  return {
    id: `knw-${versao}`, patternId: "pat-a", empresa: "cli-01", contexto: "catalogo",
    campo: "categoriaMarketplace", valor: "MLB273770", tipo: "promocao", versao,
    autorHumano: "mantenedor@zion.com", motivo: `v${versao}`, fotografia: FOTO,
    versaoPolitica: "ADR-002 v1", ocorridoEm,
  };
}

function visaoConhecimento(fatos: FatoMaturacao[], sobContradicao = false): VisaoConhecimento {
  return {
    patternId: "pat-a",
    estado: estadoConhecimento(fatos),
    promovibilidade: { promovivel: false, condicoes: [] },
    sobContradicao,
  };
}

function deps(conhecimento: VisaoConhecimento | null, opts?: { autor?: string; fatos?: FatoDelegacao[] }) {
  const gravados: FatoDelegacao[] = [...(opts?.fatos ?? [])];
  const ofertas: Oferta[] = [];
  const d: DepsDelegacao & { gravados: FatoDelegacao[]; ofertasRegistradas: Oferta[] } = {
    gravados,
    ofertasRegistradas: ofertas,
    fatos: { listar: async () => [...gravados], salvar: async (f) => (gravados.push(f), f) },
    ofertas: { salvar: async (o) => (ofertas.push(o), o) },
    conhecimento: async () => conhecimento,
    autor: async () => opts?.autor ?? "mantenedor@zion.com",
  };
  return d;
}

const CTX = { empresa: "cli-01", contexto: "catalogo", campo: "categoriaMarketplace" };

test("ANTI-CONFIDENCE (ADR-002 Q8): consistente SEM Knowledge vigente → jamais delegável", () => {
  // O veredito não recebe confidence — recebe Knowledge. Sem vigente, nada delega.
  const v = verificarDelegabilidade(visaoConhecimento([]), "mantenedor@zion.com");
  assert.equal(v.delegavel, false);
  assert.match(v.condicoes[0].condicao, /jamais Confidence/);
});

test("conceder: exige Knowledge vigente + sem contradição + autoridade assinada", async () => {
  const semAssinatura = deps(visaoConhecimento([promocao(1, "2026-07-23T10:00:00.000Z")]), { autor: "" });
  assert.equal((await concederDelegacao("pat-a", "motivo", semAssinatura)).ok, false);

  const sobContradicao = deps(visaoConhecimento([promocao(1, "2026-07-23T10:00:00.000Z")], true));
  assert.equal((await concederDelegacao("pat-a", "motivo", sobContradicao)).ok, false);

  const ok = deps(visaoConhecimento([promocao(1, "2026-07-23T10:00:00.000Z")]));
  const r = await concederDelegacao("pat-a", "operação madura neste slot", ok);
  assert.ok(r.ok);
});

test("o fato de concessão carrega TUDO: quem/knowledge/versão/autoridade/assinatura/evidências", async () => {
  const d = deps(visaoConhecimento([promocao(1, "2026-07-23T10:00:00.000Z")]));
  const r = await concederDelegacao("pat-a", "operação madura", d);
  assert.ok(r.ok);
  const f = (r as { fato: FatoDelegacao }).fato;
  assert.equal(f.delegadoPor, "mantenedor@zion.com"); // quem delegou (autoridade)
  assert.equal(f.knowledgePatternId, "pat-a"); // qual Knowledge
  assert.equal(f.knowledgeVersao, 1); // qual versão
  assert.deepEqual(f.assinatura, ASSINATURA_DELEGATION_RUNTIME); // assinatura E5.9
  assert.equal(f.assinatura.autor, "sistema:delegation-runtime");
  assert.deepEqual(f.evidencias, FOTO); // evidências que sustentaram
});

test("executar: registra a OFERTA assinada ANTES de devolver o valor (fato antes da fala)", async () => {
  const conhecimento = visaoConhecimento([promocao(1, "2026-07-23T10:00:00.000Z")]);
  const d = deps(conhecimento);
  await concederDelegacao("pat-a", "ok", d);
  const e = await executarDelegacao(CTX, d);
  assert.ok(e);
  assert.equal(e.valor, "MLB273770");
  assert.equal(d.ofertasRegistradas.length, 1);
  const oferta = d.ofertasRegistradas[0];
  assert.equal(oferta.id, e.offerId);
  assert.equal(oferta.autorDaOferta, "sistema:delegation-runtime"); // executor assinado
  assert.equal(oferta.versaoEngine, "E5.10b v1");
  assert.match(oferta.correlacao ?? "", /^delegacao:/); // reconstrução: oferta → delegação
  assert.match(e.explanation, /delegou o slot/); // explicabilidade completa
});

test("rebaixamento do Knowledge REVOGA a execução futura (Q8) — sem apagar o passado", async () => {
  const fatosK = [promocao(1, "2026-07-23T10:00:00.000Z")];
  const d = deps(visaoConhecimento(fatosK));
  await concederDelegacao("pat-a", "ok", d);

  // Knowledge rebaixado depois da concessão:
  const rebaixado: FatoMaturacao = { ...promocao(1, "2026-07-23T11:00:00.000Z"), id: "knw-r", tipo: "rebaixamento" };
  d.conhecimento = async () => visaoConhecimento([...fatosK, rebaixado]);
  assert.equal(await executarDelegacao(CTX, d), null); // silêncio, nunca erro
  assert.equal(d.gravados.length, 1); // a concessão passada permanece (append-only)
});

test("versão divergente: delegação sobre v1 NÃO executa sobre v2 (re-delegar é humano)", () => {
  const concessaoV1: FatoDelegacao = {
    id: "dlg-1", empresa: "cli-01", contexto: "catalogo", campo: "categoriaMarketplace",
    knowledgePatternId: "pat-a", knowledgeVersao: 1, valorDelegado: "MLB273770",
    tipo: "concessao", delegadoPor: "m@zion.com", motivo: "ok",
    assinatura: ASSINATURA_DELEGATION_RUNTIME, evidencias: FOTO,
    ocorridoEm: "2026-07-23T10:30:00.000Z",
  };
  const estadoD = estadoDelegacao([concessaoV1]);
  const estadoK = estadoConhecimento([
    promocao(1, "2026-07-23T10:00:00.000Z"),
    promocao(2, "2026-07-23T12:00:00.000Z"), // nova versão vigente
  ]);
  const v = execucaoPermitida(estadoD, estadoK);
  assert.equal(v.permitida, false);
  assert.match(v.motivo, /re-delegar é decisão humana/);
});

test("revogar: fecha a torneira futura; histórico completo preservado", async () => {
  const conhecimento = visaoConhecimento([promocao(1, "2026-07-23T10:00:00.000Z")]);
  const d = deps(conhecimento);
  await concederDelegacao("pat-a", "ok", d);
  const r = await revogarDelegacao("pat-a", "pausa operacional", d);
  assert.ok(r.ok);
  assert.equal(await executarDelegacao(CTX, d), null); // futura: fechada
  assert.equal(d.gravados.length, 2); // concessão + revogação — nada apagado
  assert.equal(estadoDelegacao(d.gravados).situacao, "revogada");
});

test("sem delegação vigente no slot → execução silenciosa (null), nunca erro", async () => {
  const d = deps(visaoConhecimento([promocao(1, "2026-07-23T10:00:00.000Z")]));
  assert.equal(await executarDelegacao(CTX, d), null);
  assert.equal(d.ofertasRegistradas.length, 0); // silêncio não registra fato
});
