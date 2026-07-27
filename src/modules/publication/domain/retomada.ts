// Onde a jornada retoma — puro, sem React, sem storage.
//
// A jornada deriva a ETAPA do estado dos dados: quem volta encontra o mesmo
// passo. Mas QUAL PRODUTO ela estava tratando vivia só na memória da tela, e
// isso bastava para o lojista sair, voltar e ver tudo pedindo para começar do
// zero — mesmo com o anúncio já gerado e aprovado.
//
// Este módulo decide o produto de retomada a partir de três origens, e a ordem
// entre elas é a regra de verdade.

export interface OrigensDeRetomada {
  /** Veio no endereço (?produto=…). Intenção EXPLÍCITA desta navegação. */
  daUrl?: string | null;
  /** O último produto que o lojista tratou, guardado localmente. */
  ultimoUsado?: string | null;
  /** Os produtos que existem hoje — o resto só vale se estiver aqui. */
  disponiveis: readonly string[];
}

/**
 * O produto com que a jornada deve abrir. null quando não há retomada legítima.
 *
 * A URL vence a memória: quem chegou por um link pediu AQUELE produto, e
 * sobrepor com o último usado seria ignorar o que a pessoa fez agora.
 *
 * E os dois só valem se o produto ainda existir. Um id apagado ou de outro
 * cliente não retoma nada — retomar num produto que sumiu é pior que abrir
 * limpo, porque a tela mostraria uma jornada sobre coisa nenhuma.
 */
export function produtoParaRetomar(o: OrigensDeRetomada): string | null {
  const existe = new Set(o.disponiveis);
  const daUrl = (o.daUrl ?? "").trim();
  if (daUrl && existe.has(daUrl)) return daUrl;
  // URL presente mas inválida: NÃO cai no último usado. A pessoa pediu um
  // produto específico; abrir outro no lugar seria trocar a intenção dela.
  if (daUrl) return null;

  const ultimo = (o.ultimoUsado ?? "").trim();
  return ultimo && existe.has(ultimo) ? ultimo : null;
}

/** A chave de storage é por cliente: dois lojistas no mesmo navegador não se misturam. */
export function chaveUltimoProduto(clienteId: string): string {
  return `zion:jornada:ultimoProduto:${clienteId || "sem-cliente"}`;
}
