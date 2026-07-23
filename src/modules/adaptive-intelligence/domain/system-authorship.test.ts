// Testes do System Authorship (E5.9).
//
// Cobrem: a forma da assinatura (autor canônico E5.8 + 4 versões), a
// assinatura vigente do Engine, componentes futuros (prefixo sistema:), a
// oferta gerada carregando a assinatura completa, o roundtrip do mapper com
// e sem versões (legado → null, jamais inventado) e a explicabilidade
// expondo as versões. Fecha a S-30: nenhuma ação automática sem assinatura.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/domain/system-authorship.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { autorDe } from "./author.ts";
import { VERSAO_CONTRATO_OFERTA, type Oferta } from "./offer.ts";
import {
  ASSINATURA_SUGGESTION_ENGINE,
  VERSAO_CONFIDENCE_VIGENTE,
  VERSAO_EXPLAINABILITY_VIGENTE,
  assinaturaDe,
} from "./system-authorship.ts";
import { ofertaParaApp, ofertaParaBanco } from "../infrastructure/offer.mapper.ts";
import type { OfertaRow } from "../../../lib/supabase/database.types.ts";
import type { Padrao } from "./pattern.ts";
import { gerarSugestao, type DepsEngine } from "../application/suggestion-engine.ts";

test("assinatura vigente do Engine: autor canônico + as 4 versões", () => {
  const a = ASSINATURA_SUGGESTION_ENGINE;
  assert.equal(a.autor, "suggestion-engine"); // id conhecido — SEM prefixo (compat E5.8)
  assert.equal(autorDe(a.autor).tipo, "sistema"); // e o VO o reconhece como sistema
  assert.equal(a.versaoEngine, "E4.2 (R-SE-1)");
  assert.equal(a.versaoContrato, VERSAO_CONTRATO_OFERTA);
  assert.equal(a.versaoConfidence, VERSAO_CONFIDENCE_VIGENTE);
  assert.equal(a.versaoExplainability, VERSAO_EXPLAINABILITY_VIGENTE);
});

test("componente FUTURO: nasce com o prefixo canônico e versões obrigatórias", () => {
  const a = assinaturaDe("delegation-runtime", "E5.10 v1");
  assert.equal(a.autor, "sistema:delegation-runtime");
  assert.equal(autorDe(a.autor).id, "delegation-runtime");
  assert.equal(a.versaoConfidence, VERSAO_CONFIDENCE_VIGENTE); // default vigente
});

test("a oferta gerada carrega a assinatura COMPLETA (fecha a S-30)", async () => {
  const elegivel: Padrao = {
    id: "pat-a",
    chave: JSON.stringify(["cli-01", "catalogo", "categoriaMarketplace", "MLB273770"]),
    empresa: "cli-01", contexto: "catalogo", campo: "categoriaMarketplace",
    valorNovo: "MLB273770", ocorrencias: 3, decisoesDeSuporte: ["d1"],
    primeiraOcorrencia: "2026-07-01T10:00:00.000Z", ultimaOcorrencia: "2026-07-20T10:00:00.000Z",
    confidence: "consistente", estado: "estabelecido", slotEstado: "consistente",
  };
  const gravadas: Oferta[] = [];
  const deps: DepsEngine = {
    leitura: {
      padroes: { listar: async () => [elegivel] },
      decisoes: { listar: async () => [] },
    },
    ofertas: { salvar: async (o) => (gravadas.push(o), o) },
  };
  const s = await gerarSugestao(
    { empresa: "cli-01", contexto: "catalogo", campo: "categoriaMarketplace" },
    deps
  );
  assert.ok(s);
  const o = gravadas[0];
  assert.equal(o.autorDaOferta, ASSINATURA_SUGGESTION_ENGINE.autor);
  assert.equal(o.versaoEngine, ASSINATURA_SUGGESTION_ENGINE.versaoEngine);
  assert.equal(o.versaoConfidence, VERSAO_CONFIDENCE_VIGENTE);
  assert.equal(o.versaoExplainability, VERSAO_EXPLAINABILITY_VIGENTE);
  assert.equal(o.versaoContrato, VERSAO_CONTRATO_OFERTA);
});

test("mapper: roundtrip com versões e SEM versões (legado → null, jamais inventado)", () => {
  const rowNova: OfertaRow = {
    id: "ofr-1", empresa: "cli-01", contexto: "catalogo", campo: "categoriaMarketplace",
    entidade_tipo: null, entidade_id: null, pattern_id: "pat-a",
    valor_oferecido: "MLB273770", confidence_utilizada: "consistente",
    ocorrencias_no_momento: 3, autor_da_oferta: "suggestion-engine",
    versao_contrato: VERSAO_CONTRATO_OFERTA, origem_explicacao: "explicarConfidence",
    versao_engine: "E4.2 (R-SE-1)", versao_confidence: VERSAO_CONFIDENCE_VIGENTE,
    versao_explainability: VERSAO_EXPLAINABILITY_VIGENTE,
    correlacao: null, oferecida_em: "2026-07-22T10:00:00.000Z",
  };
  const app = ofertaParaApp(rowNova);
  assert.equal(app.versaoEngine, "E4.2 (R-SE-1)");
  const banco = ofertaParaBanco(app);
  assert.equal(banco.versao_engine, "E4.2 (R-SE-1)");
  assert.equal(banco.versao_confidence, VERSAO_CONFIDENCE_VIGENTE);

  // Legado (pré-026): colunas null → domínio null; nada é inventado.
  const rowLegada = { ...rowNova, versao_engine: null, versao_confidence: null, versao_explainability: null };
  const legada = ofertaParaApp(rowLegada);
  assert.equal(legada.versaoEngine, null);
  assert.equal(legada.versaoConfidence, null);
  assert.equal(legada.versaoExplainability, null);
});
