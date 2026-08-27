// O PERFIL DE CONTEÚDO da loja — como ESTA loja gosta de vender.
//
// Puro: a forma do perfil, a validação do que a loja escreve e o bloco de
// prompt que os geradores de título e descrição recebem. Nada aqui é
// inferido — o que a loja não escreveu não existe, e o bloco diz isso ao
// modelo em vez de deixá-lo supor um tom. (Auditoria do Copilot, trilha 6.)

import { blocoDasTendencias } from "./tendenciasObservadas";

export interface PerfilDeConteudo {
  tom: string;
  publico: string;
  palavrasPreferidas: readonly string[];
  palavrasProibidas: readonly string[];
  observacoes: string;
  /**
   * O que a LOJA oferece de garantia, na língua dela. Vazio = ninguém escolheu.
   *
   * As regras-mãe afirmavam "garantia = 90 dias (fornecedor)" como default da
   * Zion, e isso saiu na primeira descrição gerada em 27/08/2026. Era regra da
   * era agência, quando a Zion operava as lojas e conhecia o acordo de cada uma
   * — hoje quem assina é uma loja que ninguém conhece, e a promessa sai no
   * anúncio DELA. Quem cobra é o comprador; quem paga é ela.
   */
  garantia: string;
  /** A loja embute o frete? `null` = ninguém escolheu, e o anúncio não afirma. */
  freteGratis: boolean | null;
  /**
   * O que se OBSERVOU nas aprovações da loja (ver `tendenciasObservadas`).
   * Não é escrito pela loja e não conta como perfil preenchido: é tendência.
   */
  observado?: readonly string[];
}

export const PERFIL_VAZIO: PerfilDeConteudo = {
  tom: "",
  publico: "",
  palavrasPreferidas: [],
  palavrasProibidas: [],
  observacoes: "",
  garantia: "",
  freteGratis: null,
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
    garantia: texto(bruto.garantia),
    // TRÊS ESTADOS, e o terceiro é o que importa: `null` = ninguém escolheu.
    // Qualquer coisa que não seja booleano vira `null` — inclusive `undefined`
    // de um formulário que não mostrou o campo. Silêncio não é "não".
    freteGratis: typeof bruto.freteGratis === "boolean" ? bruto.freteGratis : null,
  };
}

export function perfilEstaVazio(p: PerfilDeConteudo): boolean {
  // Garantia e frete contam: um perfil que só tem "12 meses pelo fabricante"
  // NÃO está vazio, e tratá-lo como vazio faria `blocoDoPerfil` sair cedo e
  // engolir a única coisa que a loja escolheu.
  return (
    !p.tom &&
    !p.publico &&
    !p.observacoes &&
    !p.garantia &&
    p.freteGratis === null &&
    p.palavrasPreferidas.length === 0 &&
    p.palavrasProibidas.length === 0
  );
}

/**
 * O bloco que entra no prompt dos geradores. Vazio quando não há perfil —
 * e aí o gerador segue como antes, sem inventar um tom.
 */
export function blocoDoPerfil(p: PerfilDeConteudo | null): string[] {
  if (!p) return [];
  const tendencias = blocoDasTendencias(p.observado ?? []);
  if (perfilEstaVazio(p)) return tendencias;
  const linhas = ["COMO ESTA LOJA VENDE (escrito pela própria loja; siga à risca):"];
  if (p.tom) linhas.push(`- Tom: ${p.tom}`);
  if (p.publico) linhas.push(`- Público: ${p.publico}`);
  if (p.palavrasPreferidas.length) linhas.push(`- Palavras que ela gosta de usar: ${p.palavrasPreferidas.join(", ")}`);
  if (p.palavrasProibidas.length) linhas.push(`- Palavras PROIBIDAS (nunca escreva): ${p.palavrasProibidas.join(", ")}`);
  if (p.observacoes) linhas.push(`- Observações: ${p.observacoes}`);
  // AS CONDIÇÕES COMERCIAIS SÓ ENTRAM QUANDO A LOJA AS ESCOLHEU.
  //
  // Ausente aqui não vira "sem garantia" nem "sem frete grátis": vira silêncio,
  // e as regras-mãe mandam o agente tratar silêncio como pendência. Afirmar por
  // conta própria é o defeito que estas duas linhas desfazem.
  if (p.garantia) linhas.push(`- Garantia que a loja oferece: ${p.garantia}`);
  if (p.freteGratis !== null) {
    linhas.push(
      p.freteGratis
        ? "- Frete: a loja embute o frete no preço (pode dizer \"frete grátis\")."
        : "- Frete: a loja NÃO embute o frete. NÃO escreva \"frete grátis\"."
    );
  }
  return [...linhas, ...(tendencias.length ? ["", ...tendencias] : [])];
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
  /** 081. `null` = ninguém escolheu. */
  garantia?: string | null;
  frete_gratis?: boolean | null;
}

export function perfilDaLinha(l: LinhaDoPerfil | null): PerfilDeConteudo {
  if (!l) return PERFIL_VAZIO;
  return normalizarPerfil({
    tom: l.tom ?? "",
    publico: l.publico ?? "",
    palavrasPreferidas: l.palavras_preferidas ?? [],
    palavrasProibidas: l.palavras_proibidas ?? [],
    observacoes: l.observacoes ?? "",
    garantia: l.garantia ?? "",
    // `?? null` e não `?? false`: a coluna nasce NULL, e falso diria "a loja
    // decidiu que não" sobre uma loja que não decidiu nada.
    freteGratis: typeof l.frete_gratis === "boolean" ? l.frete_gratis : null,
  });
}

export const COLUNAS_DO_PERFIL = "tom, publico, palavras_preferidas, palavras_proibidas, observacoes";

