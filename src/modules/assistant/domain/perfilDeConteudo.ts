// O PERFIL DE CONTEÚDO da loja — como ESTA loja gosta de vender.
//
// Puro: a forma do perfil, a validação do que a loja escreve e o bloco de
// prompt que os geradores de título e descrição recebem. Nada aqui é
// inferido — o que a loja não escreveu não existe, e o bloco diz isso ao
// modelo em vez de deixá-lo supor um tom. (Auditoria do Copilot, trilha 6.)

export interface PerfilDeConteudo {
  tom: string;
  publico: string;
  palavrasPreferidas: readonly string[];
  palavrasProibidas: readonly string[];
  observacoes: string;
}

export const PERFIL_VAZIO: PerfilDeConteudo = {
  tom: "",
  publico: "",
  palavrasPreferidas: [],
  palavrasProibidas: [],
  observacoes: "",
};

export const LIMITES = { texto: 600, palavras: 40, palavra: 40 } as const;

/** Limpa e limita o que veio do formulário. Lista vira lista; vazio vira vazio. */
export function normalizarPerfil(bruto: Partial<Record<keyof PerfilDeConteudo, unknown>>): PerfilDeConteudo {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, LIMITES.texto) : "");
  const lista = (v: unknown): string[] => {
    const itens = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;\n]/) : [];
    const limpos = itens.map((x) => String(x ?? "").trim().slice(0, LIMITES.palavra)).filter(Boolean);
    return [...new Set(limpos)].slice(0, LIMITES.palavras);
  };
  return {
    tom: texto(bruto.tom),
    publico: texto(bruto.publico),
    palavrasPreferidas: lista(bruto.palavrasPreferidas),
    palavrasProibidas: lista(bruto.palavrasProibidas),
    observacoes: texto(bruto.observacoes),
  };
}

export function perfilEstaVazio(p: PerfilDeConteudo): boolean {
  return !p.tom && !p.publico && !p.observacoes && p.palavrasPreferidas.length === 0 && p.palavrasProibidas.length === 0;
}

/**
 * O bloco que entra no prompt dos geradores. Vazio quando não há perfil —
 * e aí o gerador segue como antes, sem inventar um tom.
 */
export function blocoDoPerfil(p: PerfilDeConteudo | null): string[] {
  if (!p || perfilEstaVazio(p)) return [];
  const linhas = ["COMO ESTA LOJA VENDE (escrito pela própria loja; siga à risca):"];
  if (p.tom) linhas.push(`- Tom: ${p.tom}`);
  if (p.publico) linhas.push(`- Público: ${p.publico}`);
  if (p.palavrasPreferidas.length) linhas.push(`- Palavras que ela gosta de usar: ${p.palavrasPreferidas.join(", ")}`);
  if (p.palavrasProibidas.length) linhas.push(`- Palavras PROIBIDAS (nunca escreva): ${p.palavrasProibidas.join(", ")}`);
  if (p.observacoes) linhas.push(`- Observações: ${p.observacoes}`);
  return linhas;
}

/** As palavras proibidas que um texto gerado contém — para o juiz recusar antes do cartão. */
export function proibidasPresentes(texto: string, p: PerfilDeConteudo | null): string[] {
  if (!p) return [];
  const t = texto.toLowerCase();
  return p.palavrasProibidas.filter((w) => w && t.includes(w.toLowerCase()));
}

// ---- A LINHA DO BANCO (a forma de `perfis_de_conteudo`, 068) ----
// Aqui, e não no serviço, para o servidor e o navegador lerem a mesma forma
// sem um importar o cliente do outro.

export interface LinhaDoPerfil {
  tom: string | null;
  publico: string | null;
  palavras_preferidas: string[] | null;
  palavras_proibidas: string[] | null;
  observacoes: string | null;
}

export function perfilDaLinha(l: LinhaDoPerfil | null): PerfilDeConteudo {
  if (!l) return PERFIL_VAZIO;
  return normalizarPerfil({
    tom: l.tom ?? "",
    publico: l.publico ?? "",
    palavrasPreferidas: l.palavras_preferidas ?? [],
    palavrasProibidas: l.palavras_proibidas ?? [],
    observacoes: l.observacoes ?? "",
  });
}

export const COLUNAS_DO_PERFIL = "tom, publico, palavras_preferidas, palavras_proibidas, observacoes";

