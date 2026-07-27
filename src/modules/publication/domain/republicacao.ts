// Republicação — o núcleo PURO da decisão. Sem rede, sem React, sem Supabase.
//
// O problema real: republicar é estratégia legítima do lojista (editar o título
// de um anúncio vivo reseta o histórico de relevância, então criar um anúncio
// novo e migrar do antigo é o caminho recomendado quando a indexação piorou).
// Mas manter DOIS anúncios ativos do mesmo produto, nas mesmas condições de
// venda, infringe a política do Mercado Livre — pode custar o anúncio e a conta.
//
// A fronteira entre as duas coisas não é técnica, é uma DECISÃO de quem vende.
// Por isso este módulo não decide nada: ele detecta a situação e monta a
// pergunta, com a consequência de cada caminho escrita por extenso. Quem escolhe
// é o lojista, e a escolha dele vira ação em `lib/services/migracaoAnuncio`.

/** Um anúncio já vivo no Mercado Livre para o mesmo produto. */
export interface AnuncioAtivo {
  registroId: string;
  mlItemId: string;
  mlPermalink: string | null;
  criadoEm: string;
}

/** Forma mínima de um registro para a detecção — evita acoplar ao tipo inteiro. */
export interface RegistroParaDeteccao {
  id: string;
  produtoId?: string | null;
  status: string;
  mlItemId?: string | null;
  mlPermalink?: string | null;
  criadoEm: string;
}

/**
 * Entre os registros conhecidos, quais já estão publicados no ML para este
 * produto — excluindo o registro que está sendo publicado agora.
 *
 * Só conta registro com mlItemId: sem o identificador do ML não há como afirmar
 * que existe anúncio vivo, e afirmar sem saber seria pior do que calar.
 */
export function anunciosAtivosDoProduto(
  registros: readonly RegistroParaDeteccao[],
  produtoId: string | null | undefined,
  registroAtualId: string
): AnuncioAtivo[] {
  if (!produtoId) return [];
  return registros
    .filter(
      (r) =>
        r.id !== registroAtualId &&
        r.produtoId === produtoId &&
        r.status === "publicado" &&
        typeof r.mlItemId === "string" &&
        r.mlItemId.trim() !== ""
    )
    .map((r) => ({
      registroId: r.id,
      mlItemId: (r.mlItemId as string).trim(),
      mlPermalink: r.mlPermalink ?? null,
      criadoEm: r.criadoEm,
    }));
}

/** Os três caminhos possíveis. Não existe um quarto. */
export type EscolhaRepublicacao = "migrar" | "coexistir" | "cancelar";

export interface OpcaoRepublicacao {
  escolha: EscolhaRepublicacao;
  rotulo: string;
  /** O que acontece de fato — dito antes de escolher, não depois. */
  consequencia: string;
  recomendada: boolean;
  /** Exige que o lojista afirme a diferença real antes de poder seguir. */
  exigeDeclaracao: boolean;
}

export interface MissaoRepublicacao {
  titulo: string;
  situacao: string;
  ativos: AnuncioAtivo[];
  opcoes: OpcaoRepublicacao[];
}

/** Texto da declaração que legitima a coexistência — a exceção prevista pelo ML. */
export const DECLARACAO_DIFERENCA =
  "Confirmo que este anúncio tem diferença real em relação ao que já está no ar (forma de envio, condição de pagamento ou benefício) — não é o mesmo produto nas mesmas condições.";

/**
 * Monta a Missão quando — e só quando — existe anúncio ativo do mesmo produto.
 * Devolve null quando não há nada a perguntar: publicar segue direto.
 */
export function montarMissaoRepublicacao(
  ativos: readonly AnuncioAtivo[]
): MissaoRepublicacao | null {
  if (ativos.length === 0) return null;

  const n = ativos.length;
  const situacao =
    n === 1
      ? `Este produto já tem um anúncio no ar no Mercado Livre (${ativos[0].mlItemId}). Publicar outro agora deixaria os dois ativos ao mesmo tempo.`
      : `Este produto já tem ${n} anúncios no ar no Mercado Livre. Publicar outro agora deixaria todos ativos ao mesmo tempo.`;

  const oAntigo = n === 1 ? "o anúncio antigo" : "os anúncios antigos";

  return {
    titulo: "Já existe anúncio ativo para este produto",
    situacao,
    ativos: [...ativos],
    opcoes: [
      {
        escolha: "migrar",
        rotulo: `Publicar o novo e encerrar ${oAntigo}`,
        consequencia: `O anúncio novo é publicado primeiro. Só depois de ele entrar no ar ${oAntigo} é encerrado — assim você nunca fica sem anúncio. Encerrar no Mercado Livre é definitivo: ${oAntigo} não volta.`,
        recomendada: true,
        exigeDeclaracao: false,
      },
      {
        escolha: "coexistir",
        rotulo: "Publicar e manter os dois no ar",
        consequencia:
          "Só é permitido quando os anúncios têm diferença real de envio, pagamento ou benefício. Se forem o mesmo produto nas mesmas condições, o Mercado Livre trata como duplicidade e pode derrubar o anúncio ou punir a conta.",
        recomendada: false,
        exigeDeclaracao: true,
      },
      {
        escolha: "cancelar",
        rotulo: "Não publicar agora",
        consequencia: "Nada muda. O anúncio novo continua aprovado, esperando.",
        recomendada: false,
        exigeDeclaracao: false,
      },
    ],
  };
}

/**
 * A escolha pode virar ação? Puro — a interface pergunta antes de habilitar o
 * botão, e o serviço confere de novo antes de agir (a regra mora aqui, uma vez).
 */
export function escolhaPodeSeguir(
  missao: MissaoRepublicacao,
  escolha: EscolhaRepublicacao | null,
  declarou: boolean
): boolean {
  if (!escolha) return false;
  const opcao = missao.opcoes.find((o) => o.escolha === escolha);
  if (!opcao) return false;
  return opcao.exigeDeclaracao ? declarou : true;
}
