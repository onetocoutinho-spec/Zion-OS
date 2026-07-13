// Capacidades declaradas (003 §Regras 1).
//
// Cada conector publica O QUE SABE FAZER; o runtime só chama capacidades que
// existem (ex.: um marketplace sem "atualizar_preco_estoque" nunca recebe essa
// operação). Isso permite conectores parciais sem quebrar o núcleo.

export const CAPACIDADES = [
  "conectar",
  "testar_conexao",
  "renovar_credencial",
  "sincronizar",
  "aplicar",
  // origem
  "ingerir",
  // erp
  "ler_estoque",
  "ler_custo",
  "propagar",
  // marketplace
  "publicar",
  "atualizar_preco_estoque",
  "pausar",
  "importar_anuncios",
  "processar_webhook",
  "mapear_categoria",
] as const;

export type Capacidade = (typeof CAPACIDADES)[number];
export type Capacidades = ReadonlySet<Capacidade>;

export function declararCapacidades(...caps: Capacidade[]): Capacidades {
  return new Set(caps);
}

export function suporta(capacidades: Capacidades, capacidade: Capacidade): boolean {
  return capacidades.has(capacidade);
}
