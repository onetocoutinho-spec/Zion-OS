// Mapper da Decision — camada de persistência do Decision Journal (R-DJ-3).
//
// O MAPPER CONVERTE EXCLUSIVAMENTE ENTRE DOMÍNIO E PERSISTÊNCIA.
// Nenhuma regra de negócio, nenhuma normalização, nenhum enriquecimento,
// nenhum valor padrão, nenhuma interpretação do domínio.
//
// É BIJETIVO: Decision → DecisaoRow → Decision reconstrói uma entidade
// semanticamente idêntica, sem perda de informação (validado por teste de
// round-trip). Convenções: `entidade` achatada em entidade_tipo/entidade_id;
// `timestamp` ↔ `decidido_em` (o instante da DECISÃO, do domínio — nunca
// confundir com created_at, que é o instante de persistência); `metadados`
// ausente ↔ null. O `id` NÃO é mapeado em paraBanco — Repository.salvar()
// o injeta, preservando a identidade do domínio (contrato R-INF-001).

import type { Decision } from "../domain/decision.ts";
import type { DecisaoRow } from "../../../lib/supabase/database.types.ts";

export function decisaoParaApp(row: DecisaoRow): Decision {
  return {
    id: row.id,
    empresa: row.empresa,
    autor: row.autor,
    contexto: row.contexto,
    entidade: { tipo: row.entidade_tipo, id: row.entidade_id },
    campo: row.campo,
    valorAnterior: row.valor_anterior,
    valorNovo: row.valor_novo,
    origem: row.origem,
    timestamp: row.decidido_em,
    correlacao: row.correlacao,
    ...(row.metadados ? { metadados: row.metadados } : {}),
  };
}

export function decisaoParaBanco(d: Partial<Decision>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (d.empresa !== undefined) r.empresa = d.empresa;
  if (d.autor !== undefined) r.autor = d.autor;
  if (d.contexto !== undefined) r.contexto = d.contexto;
  if (d.entidade !== undefined) {
    r.entidade_tipo = d.entidade.tipo;
    r.entidade_id = d.entidade.id;
  }
  if (d.campo !== undefined) r.campo = d.campo;
  if (d.valorAnterior !== undefined) r.valor_anterior = d.valorAnterior;
  if (d.valorNovo !== undefined) r.valor_novo = d.valorNovo;
  if (d.origem !== undefined) r.origem = d.origem;
  if (d.timestamp !== undefined) r.decidido_em = d.timestamp;
  if (d.correlacao !== undefined) r.correlacao = d.correlacao;
  if (d.metadados !== undefined) r.metadados = d.metadados;
  return r;
}
