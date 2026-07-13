// Helpers puros de consulta para os repositórios Supabase.
//
// Modelam apenas filtros de IGUALDADE (suficiente para busca por id / cliente /
// sku_origem / ean). Sem I/O. `paraMatch` traduz para o objeto do `.match()` do
// PostgREST; `casa` avalia em memória (usado pelo adaptador real e pelos fakes).

export interface Filtro {
  readonly coluna: string;
  readonly valor: unknown;
}

export function igual(coluna: string, valor: unknown): Filtro {
  return { coluna, valor };
}

/** Converte filtros → objeto de igualdade do PostgREST (`.match({...})`). */
export function paraMatch(filtros: ReadonlyArray<Filtro>): Record<string, unknown> {
  const criterio: Record<string, unknown> = {};
  for (const f of filtros) criterio[f.coluna] = f.valor;
  return criterio;
}

/** Avalia se uma linha satisfaz TODOS os filtros de igualdade. */
export function casa(linha: Record<string, unknown>, filtros: ReadonlyArray<Filtro>): boolean {
  return filtros.every((f) => linha[f.coluna] === f.valor);
}
