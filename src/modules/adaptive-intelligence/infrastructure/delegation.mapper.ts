// Mapper do Fato de Delegação (E5.10b) — bijeção FatoDelegacao ↔ DelegacaoRow.
// `id` injetado por Repository.salvar() (R-INF-001); append-only, sem update.

import type { DelegacaoRow } from "../../../lib/supabase/database.types.ts";
import type { FatoDelegacao } from "../domain/delegation.ts";
import type { AssinaturaDeSistema } from "../domain/system-authorship.ts";
import type { FotografiaMaturacao } from "../domain/knowledge.ts";

export function delegacaoParaApp(row: DelegacaoRow): FatoDelegacao {
  return {
    id: row.id,
    empresa: row.empresa,
    contexto: row.contexto,
    campo: row.campo,
    knowledgePatternId: row.knowledge_pattern_id,
    knowledgeVersao: row.knowledge_versao,
    valorDelegado: row.valor_delegado,
    tipo: row.tipo as FatoDelegacao["tipo"],
    delegadoPor: row.delegado_por,
    motivo: row.motivo,
    assinatura: row.assinatura as unknown as AssinaturaDeSistema,
    evidencias: row.evidencias as unknown as FotografiaMaturacao,
    ocorridoEm: row.ocorrido_em,
  };
}

export function delegacaoParaBanco(f: Partial<FatoDelegacao>): Partial<DelegacaoRow> {
  const r: Partial<DelegacaoRow> = {};
  if (f.empresa !== undefined) r.empresa = f.empresa;
  if (f.contexto !== undefined) r.contexto = f.contexto;
  if (f.campo !== undefined) r.campo = f.campo;
  if (f.knowledgePatternId !== undefined) r.knowledge_pattern_id = f.knowledgePatternId;
  if (f.knowledgeVersao !== undefined) r.knowledge_versao = f.knowledgeVersao;
  if (f.valorDelegado !== undefined) r.valor_delegado = f.valorDelegado;
  if (f.tipo !== undefined) r.tipo = f.tipo;
  if (f.delegadoPor !== undefined) r.delegado_por = f.delegadoPor;
  if (f.motivo !== undefined) r.motivo = f.motivo;
  if (f.assinatura !== undefined) r.assinatura = f.assinatura as unknown as Record<string, unknown>;
  if (f.evidencias !== undefined) r.evidencias = f.evidencias as unknown as Record<string, unknown>;
  if (f.ocorridoEm !== undefined) r.ocorrido_em = f.ocorridoEm;
  return r;
}
