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

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
