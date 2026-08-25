// A CONTA do estado da loja — pura, para o navegador e o servidor fazerem a
// MESMA conta sobre os mesmos campos.
//
// Vivia em `components/client-portal/useEstadoDaLoja.ts`, junto do hook que
// carregava os dados pelo navegador. O Copilot recebia o resultado pelo corpo
// da requisição — quatro ferramentas (`contar`, `estado_da_loja`,
// `proximo_passo`, `o_que_impede`) respondiam a partir de um objeto que o
// navegador montava e podia reescrever, e que envelhecia desde a carga da
// tela. Agora o servidor mede com o tenant da sessão; o navegador continua
// medindo para a via rápida (a que não passa pelo modelo). Os dois chamam
// esta função, e é isso que impede as duas medidas de discordarem.
// (Auditoria do Copilot, 2026-08-22, P1.)

import { pesoPendente, situacaoDePeso, type EstadoDePeso } from "@/modules/catalog/domain/familiaDeProduto";
import type { EstadoDaLoja } from "@/modules/publication/domain/prontidaoDaLoja";

/** Só o que a conta LÊ de cada produto. */
export interface ProdutoParaContar extends EstadoDePeso {
  id: string;
  custo: number;
  /** O MAIOR entre as variantes, em gramas. 0 = nenhuma pesada. */
  pesoGramas: number;
}

export function montarEstadoDaLoja(
  produtos: readonly ProdutoParaContar[],
  /** Só o que esta conta lê: o produto de cada anúncio e o status dele. */
  anuncios: readonly { produtoId?: string | null; status: string }[],
  imagens: readonly { produtoId?: string | null }[],
  conectado: boolean,
  /**
   * As infrações já lidas do Mercado Livre (migração 052). `null` = ainda não
   * lemos, e é o padrão. Não vira `0`: dizer "nenhuma infração" sem ter olhado
   * é a afirmação que a AUD-001 passou o dia arrancando das telas.
   */
<<<<<<< Updated upstream
  infracoes: { infracoes: number; anuncios: number } | null = null
=======
  infracoes: { infracoes: number; anuncios: number } | null = null,
  /**
   * O MUNDO DEPOIS DA PUBLICAÇÃO — pendências do ML e produtos no ar sem IA.
   *
   * CHEGAM PRONTOS, e é a decisão principal deste parâmetro. Contar aqui
   * exigiria alargar o tipo de `anuncios` (estreito de propósito: o servidor e
   * o navegador buscam só `produtoId` e `status`) e — pior — escreveria uma
   * SEGUNDA regra para "sem otimização", que já existe em `estadoDeOtimizacao`
   * e já discordou de si mesma em três telas no dia 03/08/2026.
   *
   * Cada número segue com uma regra só, no módulo dela:
   *   pendências + peças paradas → `pendenciasDaMemoria` → `pendenciasDaConta`
   *   no ar sem otimização       → `estadoDeOtimizacao`
   *
   * `null` = não levantamos. Não vira zero: é a mesma regra de `infracoes`, e é
   * ela que impede a tela de afirmar "nada travado" sem ter olhado.
   */
  noAr: {
    pendenciasAbertas: number;
    pecasParadas: number;
    noArSemOtimizacao: number;
  } | null = null
>>>>>>> Stashed changes
): EstadoDaLoja {
  const produtosComAnuncio = new Set(anuncios.map((a) => a.produtoId).filter(Boolean));
  const comFoto = new Set(imagens.map((i) => i.produtoId).filter(Boolean));

  return {
    produtos: produtos.length,
    // COMPLETUDE, não "tem algum peso" (INC-001). O máximo entre as variantes
    // dizia que um produto com 1 de 39 preenchidas estava pronto.
    comPeso: produtos.filter((p) => !pesoPendente(p)).length,
    // Terceira condição, não meio-completo: para estes o frete SAI, e a frase
    // de "sem peso" seria factualmente falsa.
    comPesoIncompleto: produtos.filter((p) => situacaoDePeso(p) === "ausencia_parcial").length,
    comCusto: produtos.filter((p) => p.custo > 0).length,
    // CALCULABILIDADE, não completude: com uma variante pesada o frete já sai
    // e o preço mínimo existe.
    prontosParaPrecificar: produtos.filter((p) => p.custo > 0 && p.pesoGramas > 0).length,
    comFoto: produtos.filter((p) => comFoto.has(p.id)).length,
    comAnuncio: produtos.filter((p) => produtosComAnuncio.has(p.id)).length,
    aguardandoAprovacao: anuncios.filter((a) => a.status === "aguardando_aprovacao").length,
    aprovadosNaoPublicados: anuncios.filter((a) => a.status === "aprovado").length,
    conectadoAoMarketplace: conectado,
    ...(infracoes
      ? { infracoes: infracoes.infracoes, anunciosComInfracao: infracoes.anuncios }
      : {}),
<<<<<<< Updated upstream
=======
    // Espalhado, e não com `?? 0`: ausente tem que continuar ausente até o
    // domínio, senão `lacunasDaLoja` lê zero e a tela volta a dizer "em dia"
    // por não ter olhado — que é o defeito inteiro que isto conserta.
    ...(noAr
      ? {
          pendenciasAbertas: noAr.pendenciasAbertas,
          pecasParadas: noAr.pecasParadas,
          noArSemOtimizacao: noAr.noArSemOtimizacao,
        }
      : {}),
>>>>>>> Stashed changes
  } satisfies EstadoDaLoja;
}
