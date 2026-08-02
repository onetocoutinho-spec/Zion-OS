// O que o Mercado Livre manda, e o que o Zion olha.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Em 01–02/08/2026, SETE defeitos tiveram a mesma forma: o ML informava e nós
// não líamos.
//
//   `paging.total`        o ML dizia quantos anúncios a conta tem   → descartado
//   `attributes`          a ficha inteira do lojista                 → 2 de 17,8 guardados
//   `status`              o estado real do anúncio                   → fixo em "publicado"
//   `sub_status`          POR QUE está fora do ar                    → nem pedido
//   `tags.required`       o que a categoria exige                    → nem pedido
//   `pictures[].max_size` o tamanho real da foto                     → descartado
//   `itens` da publicação todos os MLBs da família                   → só o primeiro
//
// Nenhum foi um erro de lógica. Todos foram campo não lido.
//
// ===========================================================================
// A LISTA BRANCA QUE PIORA ISSO
// ===========================================================================
//
// O multiget pede `?attributes=id,title,price,...`. Isso é uma LISTA BRANCA: o
// ML devolve SÓ o que está nela. Um campo que não esteja ali não chega nem
// para ser ignorado — ele não existe do ponto de vista do Zion, e nenhuma
// leitura de código revela o que está faltando.
//
// Só há um jeito honesto de saber: pedir o item SEM a lista e comparar. É o
// que esta função faz — o inventário sai da resposta do ML, não da memória de
// quem escreveu o código.

export interface InventarioDoItem {
  /** Campos que pedimos e o ML mandou. */
  usados: string[];
  /**
   * Campos que PEDIMOS e o ML não mandou.
   *
   * Um campo pedido e ausente é sinal de descontinuação — foi assim que o
   * `price` começou a sumir em favor de `/items/{id}/prices`.
   */
  pedidosEAusentes: string[];
  /**
   * O que o ML tem e nós nunca pedimos. É a lista que interessa.
   *
   * Cada linha aqui é um `sub_status` esperando para ser descoberto tarde.
   */
  ignorados: string[];
  /**
   * As chaves DENTRO dos objetos que já lemos. `max_size` estava aqui —
   * dentro de `pictures`, que nós pedíamos e líamos pela metade.
   */
  aninhados: Record<string, string[]>;
}

/** Os campos que a importação pede ao ML. Fonte única: o multiget. */
export function camposPedidos(whitelist: string): string[] {
  return whitelist
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function chavesDe(v: unknown): string[] {
  if (Array.isArray(v)) return v.length > 0 ? chavesDe(v[0]) : [];
  if (v && typeof v === "object") return Object.keys(v as Record<string, unknown>).sort();
  return [];
}

/**
 * Compara o que o ML devolveu com o que pedimos.
 *
 * `aninhados` só desce um nível, e só nos campos que já são objeto ou lista.
 * Descer mais viraria despejo — e o objetivo é que alguém LEIA o resultado.
 */
export function inventariarItem(
  item: Record<string, unknown> | null | undefined,
  whitelist: string
): InventarioDoItem {
  const pedidos = camposPedidos(whitelist);
  const presentes = item ? Object.keys(item).sort() : [];
  const setPedidos = new Set(pedidos);
  const setPresentes = new Set(presentes);

  const aninhados: Record<string, string[]> = {};
  for (const campo of presentes) {
    const chaves = chavesDe(item?.[campo]);
    if (chaves.length > 0) aninhados[campo] = chaves;
  }

  return {
    usados: pedidos.filter((c) => setPresentes.has(c)),
    pedidosEAusentes: pedidos.filter((c) => !setPresentes.has(c)),
    ignorados: presentes.filter((c) => !setPedidos.has(c)),
    aninhados,
  };
}
