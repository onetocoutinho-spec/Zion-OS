// ModoOperacao — como o Produto Mestre nasce (001 §5).
//   - "revenda"           → origem terceira (fornecedor/distribuidor/importador),
//                           pode ter Catálogo/Compra.
//   - "fabricacao_propria"→ origem interna (fabricante/marca própria),
//                           sem Catálogo/Compra obrigatórios.

export const MODOS_OPERACAO = ["revenda", "fabricacao_propria"] as const;
export type ModoOperacao = (typeof MODOS_OPERACAO)[number];

export function ehModoOperacao(valor: string): valor is ModoOperacao {
  return (MODOS_OPERACAO as readonly string[]).includes(valor);
}
