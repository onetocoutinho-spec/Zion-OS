// O que vai ao ar, dito para quem vende — não para quem depura.
//
// A equipe revisa o payload do ML em JSON, e isso está certo para a equipe. O
// lojista não. Ele precisa ver o título que vai aparecer, o preço que vai
// cobrar, quantas fotos vão junto — e, principalmente, o que impede a
// publicação ANTES de clicar, não uma mensagem de erro do ML depois.
//
// Puro: recebe o payload já montado (montarPreviewML) e devolve leitura humana.

export interface ResumoPublicacao {
  titulo: string;
  /** null quando não há preço utilizável — preço é obrigatório. */
  preco: number | null;
  quantidadeFotos: number;
  /** Soma do estoque (do item ou das variações). */
  estoque: number;
  quantidadeVariacoes: number;
  temDescricao: boolean;
  freteGratis: boolean;
  /** null quando a categoria será prevista pelo título no envio. */
  categoriaId: string | null;
}

export interface Impedimento {
  campo: string;
  texto: string;
  /** bloqueia = o ML recusa ou o anúncio nasce inválido. aviso = sai pior, mas sai. */
  gravidade: "bloqueia" | "aviso";
}

function numero(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function resumirPublicacao(payload: Record<string, unknown>): ResumoPublicacao {
  const variacoes = Array.isArray(payload.variations) ? (payload.variations as Record<string, unknown>[]) : [];
  const fotos = Array.isArray(payload.pictures) ? payload.pictures : [];
  const descricao = payload.description as { plain_text?: string } | undefined;
  const envio = payload.shipping as { free_shipping?: boolean } | undefined;

  const estoque = variacoes.length
    ? variacoes.reduce((soma, v) => soma + numero(v.available_quantity), 0)
    : numero(payload.available_quantity);

  const precoBruto = numero(payload.price);
  const categoria = typeof payload.category_id === "string" ? payload.category_id.trim() : "";

  return {
    titulo: typeof payload.title === "string" ? payload.title : "",
    preco: precoBruto > 0 ? precoBruto : null,
    quantidadeFotos: fotos.length,
    estoque,
    quantidadeVariacoes: variacoes.length,
    temDescricao: Boolean(descricao?.plain_text?.trim()),
    freteGratis: envio?.free_shipping === true,
    categoriaId: categoria || null,
  };
}

/**
 * O que impede — ou piora — a publicação. Ordenado: bloqueios primeiro.
 *
 * A categoria NÃO é bloqueio: quando vem vazia, o servidor a prevê pelo título
 * no momento do envio. Dizer "falta categoria" seria assustar sem motivo.
 */
export function impedimentosDaPublicacao(payload: Record<string, unknown>): Impedimento[] {
  const r = resumirPublicacao(payload);
  const itens: Impedimento[] = [];

  if (!r.titulo.trim()) {
    itens.push({ campo: "titulo", texto: "Sem título — o anúncio não pode ir ao ar.", gravidade: "bloqueia" });
  }
  if (r.preco === null) {
    itens.push({
      campo: "preco",
      texto: "Sem preço de venda. Defina o preço antes de publicar.",
      gravidade: "bloqueia",
    });
  }
  if (r.quantidadeFotos === 0) {
    itens.push({
      campo: "fotos",
      texto: "Sem fotos. O Mercado Livre exige pelo menos uma imagem do produto.",
      gravidade: "bloqueia",
    });
  }
  if (r.estoque <= 0) {
    itens.push({
      campo: "estoque",
      texto: "Estoque zerado — o anúncio entraria pausado e não venderia.",
      gravidade: "bloqueia",
    });
  }
  if (!r.temDescricao) {
    itens.push({
      campo: "descricao",
      texto: "Sem descrição. O anúncio vai ao ar, mas converte menos.",
      gravidade: "aviso",
    });
  }
  return itens;
}

/** Puro: dá para publicar? Falso quando há qualquer bloqueio. */
export function podePublicar(payload: Record<string, unknown>): boolean {
  return !impedimentosDaPublicacao(payload).some((i) => i.gravidade === "bloqueia");
}
