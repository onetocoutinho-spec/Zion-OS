// QUEM PODE TER O TEXTO EDITADO NO MERCADO LIVRE — e quem não pode, com o motivo.
//
// ===========================================================================
// POR QUE ESTE MÓDULO EXISTE
// ===========================================================================
//
// Medido em 14/08/2026: o cliente do ML tem TRÊS operações de escrita em
// anúncio existente — encerrar, pausar/reativar e fotos. Nenhuma toca título
// ou descrição. Então todo o aparato de conteúdo do Zion (13 agentes da
// esteira, veredito A10, as propostas do chat) escrevia numa gaveta: o texto
// ia para o JSONB do nosso banco e os 780 anúncios no ar continuavam iguais.
//
// Abrir esse caminho é o que dá destino ao trabalho. Mas editar anúncio ativo
// não é gratuito, e as recusas abaixo são o que separa "melhorar a loja dela"
// de "derrubar a loja dela".
//
// ===========================================================================
// A RECUSA QUE NÃO SE NEGOCIA
// ===========================================================================
//
// Acusação de PROPRIEDADE INTELECTUAL não se resolve editando. O ML trata
// editar-e-republicar como REINCIDÊNCIA, e reincidência custa a conta — não o
// anúncio. São 7 anúncios desta lojista em `PI_FAKES`, em 2 produtos.
//
// O ramo é por PREFIXO (`PI_*`) e não pela string exata: uma categoria de PI
// nova entra pelo caminho grave por omissão, que é o lado certo para errar.
// Tratar PI desconhecido como edição de rotina é exatamente o defeito que este
// módulo existe para impedir.

import { LIMITE_DE_TITULO } from "../../publication/domain/preparacaoDoAnuncio";

export interface AnuncioParaEditar {
  mlb: string;
  /** O estado no ML, verbatim: active | paused | under_review | closed | inactive. */
  status: string;
  /** O texto que está no ar hoje. */
  tituloAtual: string;
  /** As categorias de infração deste anúncio — `filter_subgroup` do ML. */
  categoriasDeInfracao: readonly string[];
}

export type RecusaDeEdicao =
  | "propriedade-intelectual"
  | "encerrado"
  | "em-revisao"
  | "titulo-longo"
  | "sem-mudanca"
  | "titulo-vazio";

export type VeredictoDaEdicao =
  | { pode: true; mlb: string; de: string; para: string }
  | { pode: false; mlb: string; motivo: RecusaDeEdicao; explicacao: string };

/** `PI_*` — prefixo, não string exata. Ver o cabeçalho. */
export function temPropriedadeIntelectual(
  categorias: readonly string[]
): boolean {
  return categorias.some((c) => (c ?? "").trim().toUpperCase().startsWith("PI_"));
}

/**
 * Este anúncio pode receber o título novo?
 *
 * A ordem das recusas é a ordem da gravidade: PI antes de tudo, porque é a
 * única cujo custo é a conta inteira. Depois o que o ML nem aceitaria, e por
 * fim o que seria trabalho à toa.
 */
export function podeTrocarTitulo(
  a: AnuncioParaEditar,
  tituloNovo: string
): VeredictoDaEdicao {
  if (temPropriedadeIntelectual(a.categoriasDeInfracao)) {
    return {
      pode: false,
      mlb: a.mlb,
      motivo: "propriedade-intelectual",
      explicacao:
        "O Mercado Livre acusou propriedade intelectual neste anúncio. Editar e " +
        "republicar conta como reincidência e pode custar a conta — o caminho aqui " +
        "é comprovar a origem com nota fiscal, não trocar o texto.",
    };
  }

  const status = (a.status ?? "").trim().toLowerCase();
  if (status === "closed" || status === "inactive") {
    return {
      pode: false,
      mlb: a.mlb,
      motivo: "encerrado",
      explicacao: "Este anúncio está encerrado no Mercado Livre — não há o que editar.",
    };
  }
  if (status === "under_review") {
    // O ML está avaliando ESTE anúncio agora. Mexer no texto no meio da
    // avaliação troca o objeto avaliado e reinicia a fila — no melhor caso.
    return {
      pode: false,
      mlb: a.mlb,
      motivo: "em-revisao",
      explicacao:
        "O Mercado Livre está revisando este anúncio agora. Editar durante a " +
        "revisão atrasa o resultado — vale esperar o veredito.",
    };
  }

  const novo = (tituloNovo ?? "").trim();
  if (!novo) {
    return {
      pode: false,
      mlb: a.mlb,
      motivo: "titulo-vazio",
      explicacao: "Não há título novo para enviar.",
    };
  }
  if (novo.length > LIMITE_DE_TITULO) {
    return {
      pode: false,
      mlb: a.mlb,
      motivo: "titulo-longo",
      explicacao: `O título tem ${novo.length} caracteres e o Mercado Livre aceita ${LIMITE_DE_TITULO}.`,
    };
  }
  if (novo === (a.tituloAtual ?? "").trim()) {
    // Enviar o mesmo texto gasta uma escrita, pode reabrir revisão, e não muda
    // nada para quem compra.
    return {
      pode: false,
      mlb: a.mlb,
      motivo: "sem-mudanca",
      explicacao: "O título no ar já é esse.",
    };
  }

  return { pode: true, mlb: a.mlb, de: a.tituloAtual, para: novo };
}

export interface PlanoDeEdicao {
  editaveis: Extract<VeredictoDaEdicao, { pode: true }>[];
  recusados: Extract<VeredictoDaEdicao, { pode: false }>[];
}

/**
 * O plano para um conjunto de anúncios.
 *
 * Separa em vez de filtrar: a lojista precisa ver POR QUE cada um ficou de
 * fora. "7 de 12" sem os motivos é a mesma opacidade que este repositório
 * passou o mês inteiro arrancando.
 */
export function planejarEdicaoDeTitulo(
  anuncios: readonly AnuncioParaEditar[],
  tituloNovo: string
): PlanoDeEdicao {
  const editaveis: Extract<VeredictoDaEdicao, { pode: true }>[] = [];
  const recusados: Extract<VeredictoDaEdicao, { pode: false }>[] = [];
  for (const a of anuncios) {
    const v = podeTrocarTitulo(a, tituloNovo);
    if (v.pode) editaveis.push(v);
    else recusados.push(v);
  }
  return { editaveis, recusados };
}
