// Mapper da Oferta (E4.2) — bijeção Oferta ↔ OfertaRow.
//
// O `id` (OfferId) NÃO é mapeado em paraBanco — Repository.salvar() o injeta
// (contrato R-INF-001: a identidade nasce no domínio e é preservada).
// `created_at` é metadado de persistência: paraApp o ignora (como nos mappers
// de Decision e Pattern). Log append-only: não existe caminho de update.

import type { OfertaRow } from "../../../lib/supabase/database.types.ts";
import type { Oferta } from "../domain/offer.ts";

export function ofertaParaApp(row: OfertaRow): Oferta {
  return {
    id: row.id,
    oferecidaEm: row.oferecida_em,
    empresa: row.empresa,
    contexto: row.contexto,
    campo: row.campo,
    entidade:
      row.entidade_tipo && row.entidade_id
        ? { tipo: row.entidade_tipo, id: row.entidade_id }
        : null,
    patternId: row.pattern_id,
    valorOferecido: row.valor_oferecido,
    confidenceUtilizada: row.confidence_utilizada,
    ocorrenciasNoMomento: row.ocorrencias_no_momento,
    autorDaOferta: row.autor_da_oferta,
    versaoContrato: row.versao_contrato,
    origemExplicacao: row.origem_explicacao,
    // E5.9: null = oferta anterior ao versionamento completo (leitura honesta).
    versaoEngine: row.versao_engine ?? null,
    versaoConfidence: row.versao_confidence ?? null,
    versaoExplainability: row.versao_explainability ?? null,
    correlacao: row.correlacao,
  };
}

export function ofertaParaBanco(o: Partial<Oferta>): Partial<OfertaRow> {
  const r: Partial<OfertaRow> = {};
  if (o.oferecidaEm !== undefined) r.oferecida_em = o.oferecidaEm;
  if (o.empresa !== undefined) r.empresa = o.empresa;
  if (o.contexto !== undefined) r.contexto = o.contexto;
  if (o.campo !== undefined) r.campo = o.campo;
  if (o.entidade !== undefined) {
    r.entidade_tipo = o.entidade?.tipo ?? null;
    r.entidade_id = o.entidade?.id ?? null;
  }
  if (o.patternId !== undefined) r.pattern_id = o.patternId;
  if (o.valorOferecido !== undefined) r.valor_oferecido = o.valorOferecido;
  if (o.confidenceUtilizada !== undefined) r.confidence_utilizada = o.confidenceUtilizada;
  if (o.ocorrenciasNoMomento !== undefined) r.ocorrencias_no_momento = o.ocorrenciasNoMomento;
  if (o.autorDaOferta !== undefined) r.autor_da_oferta = o.autorDaOferta;
  if (o.versaoContrato !== undefined) r.versao_contrato = o.versaoContrato;
  if (o.origemExplicacao !== undefined) r.origem_explicacao = o.origemExplicacao;
  if (o.versaoEngine !== undefined) r.versao_engine = o.versaoEngine;
  if (o.versaoConfidence !== undefined) r.versao_confidence = o.versaoConfidence;
  if (o.versaoExplainability !== undefined) r.versao_explainability = o.versaoExplainability;
  if (o.correlacao !== undefined) r.correlacao = o.correlacao;
  return r;
}
