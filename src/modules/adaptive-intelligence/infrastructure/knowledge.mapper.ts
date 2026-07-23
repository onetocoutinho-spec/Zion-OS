// Mapper do Fato de Maturação (E5.10a) — bijeção FatoMaturacao ↔ ConhecimentoRow.
//
// O `id` NÃO é mapeado em paraBanco — Repository.salvar() o injeta (R-INF-001).
// `created_at` é metadado de persistência (paraApp o ignora). Append-only:
// não existe caminho de update.

import type { ConhecimentoRow } from "../../../lib/supabase/database.types.ts";
import type { FatoMaturacao, FotografiaMaturacao } from "../domain/knowledge.ts";

export function conhecimentoParaApp(row: ConhecimentoRow): FatoMaturacao {
  return {
    id: row.id,
    patternId: row.pattern_id,
    empresa: row.empresa,
    contexto: row.contexto,
    campo: row.campo,
    valor: row.valor,
    tipo: row.tipo as FatoMaturacao["tipo"],
    versao: row.versao,
    autorHumano: row.autor_humano,
    motivo: row.motivo,
    fotografia: row.fotografia as unknown as FotografiaMaturacao,
    versaoPolitica: row.versao_politica,
    ocorridoEm: row.ocorrido_em,
  };
}

export function conhecimentoParaBanco(f: Partial<FatoMaturacao>): Partial<ConhecimentoRow> {
  const r: Partial<ConhecimentoRow> = {};
  if (f.patternId !== undefined) r.pattern_id = f.patternId;
  if (f.empresa !== undefined) r.empresa = f.empresa;
  if (f.contexto !== undefined) r.contexto = f.contexto;
  if (f.campo !== undefined) r.campo = f.campo;
  if (f.valor !== undefined) r.valor = f.valor;
  if (f.tipo !== undefined) r.tipo = f.tipo;
  if (f.versao !== undefined) r.versao = f.versao;
  if (f.autorHumano !== undefined) r.autor_humano = f.autorHumano;
  if (f.motivo !== undefined) r.motivo = f.motivo;
  if (f.fotografia !== undefined) r.fotografia = f.fotografia as unknown as Record<string, unknown>;
  if (f.versaoPolitica !== undefined) r.versao_politica = f.versaoPolitica;
  if (f.ocorridoEm !== undefined) r.ocorrido_em = f.ocorridoEm;
  return r;
}
