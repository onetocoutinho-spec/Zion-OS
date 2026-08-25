export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/**
 * Com centavos. A tela de listagem arredonda de propósito (R$ 106 lê melhor que
 * R$ 105,90), mas conferência de custo é outra coisa: R$ 25 e R$ 25,13 são
 * números diferentes, e é olhando o centavo que se percebe a coluna trocada.
 */
export function formatBRLExato(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function isOverdue(iso: string): boolean {
  return iso < new Date().toISOString().slice(0, 10);
}

/**
 * Um instante, no fuso de quem lê.
 *
 * `comHora: false` dá só o dia — para tabela larga, onde "23/08/2026 14:32"
 * gasta 152px de coluna e a hora quase nunca decide nada. Quem precisa dela
 * continua tendo: o chamador põe o texto completo no `title`.
 *
 * POR QUE NÃO USAR `formatDate` PARA ISSO. Ela existe para data pura
 * (`2026-08-23`) e trabalha por `split("-")`; num timestamp o terceiro pedaço
 * viria "23T14:32:00.000Z". E, mesmo consertada, ela não converte fuso — na
 * mesma tela apareceria o dia em UTC ao lado de uma hora local, e perto da
 * meia-noite os dois discordariam.
 */
export function formatDateTime(iso: string | null, opcoes?: { comHora?: boolean }): string {
  if (!iso) return "—";
  const comHora = opcoes?.comHora ?? true;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(comHora ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
  });
}
