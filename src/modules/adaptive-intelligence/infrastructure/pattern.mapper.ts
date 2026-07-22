// Mapper do Pattern — camada de persistência do Pattern Detector (R-PD-1).
//
// O MAPPER CONVERTE EXCLUSIVAMENTE ENTRE DOMÍNIO E PERSISTÊNCIA.
// Nenhuma regra de negócio, nenhuma geração de identidade, nenhuma alteração
// dos timestamps do domínio (primeira/última ocorrência), nenhuma mutação.
//
// É BIJETIVO sobre os campos do domínio: Padrao → PadraoRow → Padrao reconstrói
// uma entidade semanticamente idêntica (validado por round-trip). Convenções:
// `chave` ↔ `pattern_key` · `valorNovo` ↔ `valor` · `slotEstado` ↔ `estado_slot`
// · `decisoesDeSuporte` ↔ `decisoes_de_suporte`. O `id` (PatternId) NÃO é
// mapeado em paraBanco — Repository.salvar() o injeta (contrato R-INF-001).
//
// `updated_at` é METADADO DE PERSISTÊNCIA controlado pela aplicação (decisão da
// Etapa 1, sem trigger): carimbado aqui a cada materialização. Não é um
// timestamp do domínio e não participa da bijetividade (paraApp o ignora,
// como o mapper da R-DJ-3 ignora created_at).

import type { PadraoRow } from "../../../lib/supabase/database.types.ts";
import type {
  ConfidencePadrao,
  EstadoPadrao,
  EstadoSlot,
  Padrao,
} from "../domain/pattern.ts";

export function padraoParaApp(row: PadraoRow): Padrao {
  return {
    id: row.id,
    chave: row.pattern_key,
    empresa: row.empresa,
    contexto: row.contexto,
    campo: row.campo,
    valorNovo: row.valor,
    ocorrencias: row.ocorrencias,
    decisoesDeSuporte: row.decisoes_de_suporte,
    primeiraOcorrencia: row.primeira_ocorrencia,
    ultimaOcorrencia: row.ultima_ocorrencia,
    confidence: row.confidence as ConfidencePadrao,
    estado: row.estado as EstadoPadrao,
    slotEstado: row.estado_slot as EstadoSlot,
  };
}

export function padraoParaBanco(p: Partial<Padrao>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (p.chave !== undefined) r.pattern_key = p.chave;
  if (p.empresa !== undefined) r.empresa = p.empresa;
  if (p.contexto !== undefined) r.contexto = p.contexto;
  if (p.campo !== undefined) r.campo = p.campo;
  if (p.valorNovo !== undefined) r.valor = p.valorNovo;
  if (p.ocorrencias !== undefined) r.ocorrencias = p.ocorrencias;
  if (p.decisoesDeSuporte !== undefined) r.decisoes_de_suporte = [...p.decisoesDeSuporte];
  if (p.primeiraOcorrencia !== undefined) r.primeira_ocorrencia = p.primeiraOcorrencia;
  if (p.ultimaOcorrencia !== undefined) r.ultima_ocorrencia = p.ultimaOcorrencia;
  if (p.confidence !== undefined) r.confidence = p.confidence;
  if (p.estado !== undefined) r.estado = p.estado;
  if (p.slotEstado !== undefined) r.estado_slot = p.slotEstado;
  // Metadado de persistência (app-controlled, Etapa 1 — sem trigger no banco).
  r.updated_at = new Date().toISOString();
  return r;
}
