// Versionamento/histórico do Produto Mestre (001 §8).
//
// Toda mudança material (conteúdo, preço) gera uma ProdutoMestreVersao com o
// diff campo→(antes, depois) e o autor (humano ou agente A0–A12), permitindo
// auditoria e desfazer. `occurred_at` é injetado (o domínio não lê o relógio).

export type TipoAutor = "humano" | "agente";

export interface Autor {
  readonly tipo: TipoAutor;
  readonly id: string;
  /** Código do agente (A0..A12) quando tipo = "agente". */
  readonly agenteCodigo?: string;
  /** Confiança do agente (0..1) quando aplicável. */
  readonly confianca?: number;
}

export interface CampoDiff {
  readonly campo: string;
  readonly antes: unknown;
  readonly depois: unknown;
}

export interface ProdutoMestreVersao {
  readonly versao: number;
  readonly snapshot: Record<string, unknown>;
  readonly diff: readonly CampoDiff[];
  readonly autor: Autor;
  readonly occurred_at: string;
}

/** Diff raso entre dois snapshots (campos alterados/adicionados/removidos). */
export function calcularDiff(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): CampoDiff[] {
  const campos = new Set<string>([...Object.keys(antes), ...Object.keys(depois)]);
  const diffs: CampoDiff[] = [];
  for (const campo of campos) {
    if (antes[campo] !== depois[campo]) {
      diffs.push({ campo, antes: antes[campo], depois: depois[campo] });
    }
  }
  return diffs;
}
