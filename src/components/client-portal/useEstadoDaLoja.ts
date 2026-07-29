"use client";

/**
 * O estado da loja, medido do banco — uma vez, para todas as telas que o usam.
 *
 * Nasceu extraído da home, onde vivia inline. Copiar o cálculo para a segunda
 * tela seria criar duas verdades sobre a mesma loja, e a divergência entre elas
 * é exatamente a classe de defeito que o INC-001 documentou: a tela dizia
 * "peso completo" enquanto o banco tinha 12 variações vazias.
 *
 * Tudo aqui é MEDIDO, nunca deduzido. `prontosParaPrecificar` não é o menor
 * entre "com custo" e "com peso" — os conjuntos podem não se sobrepor, e
 * deduzir já gravou R$ 1,77 de piso nesta base.
 */

import { useMemo } from "react";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutosComPeso, type ProdutoComPeso } from "@/lib/services/pesoDeProduto";
import { pesoPendente, situacaoDePeso } from "@/modules/catalog/domain/familiaDeProduto";
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { listarTodasImagens } from "@/lib/services/imagensProduto";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import type { AnuncioGeradoRegistro } from "@/lib/types";
import type { EstadoDaLoja } from "@/modules/publication/domain/prontidaoDaLoja";
import type { ContextoDaPergunta } from "@/modules/assistant/domain/perguntaDaOperacao";

/**
 * A CONTA, separada do carregamento.
 *
 * Existe separada porque a home já carrega estes quatro conjuntos para outras
 * coisas — usar o hook lá faria a mesma consulta duas vezes. Quem já tem os
 * dados chama esta função; quem não tem usa o hook abaixo. A conta é uma só,
 * e é isso que impede as duas telas de discordarem sobre a mesma loja.
 */
export function montarEstadoDaLoja(
  produtos: readonly ProdutoComPeso[],
  anuncios: readonly AnuncioGeradoRegistro[],
  imagens: readonly { produtoId?: string | null }[],
  conectado: boolean
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
      // e o preço mínimo existe. Um produto pode estar com o cadastro de peso
      // incompleto E pronto para precificar — perguntas diferentes.
      prontosParaPrecificar: produtos.filter((p) => p.custo > 0 && p.pesoGramas > 0).length,
      comFoto: produtos.filter((p) => comFoto.has(p.id)).length,
      comAnuncio: produtos.filter((p) => produtosComAnuncio.has(p.id)).length,
    aguardandoAprovacao: anuncios.filter((a) => a.status === "aguardando_aprovacao").length,
    aprovadosNaoPublicados: anuncios.filter((a) => a.status === "aprovado").length,
    conectadoAoMarketplace: conectado,
  } satisfies EstadoDaLoja;
}

/**
 * O CARREGAMENTO, para as telas que ainda não têm os dados.
 *
 * `null` enquanto carrega — e quem chama trata isso em vez de receber zeros.
 * Devolver um estado zerado durante o carregamento faria o chat responder
 * "0 de 0 produtos" com toda a confiança do mundo, por meio segundo. Meio
 * segundo de número errado continua sendo número errado.
 */
export function useContextoDaPergunta(
  clienteId: string,
  produtoEmFoco?: string | null
): ContextoDaPergunta | null {
  const { data: produtos } = useLiveQuery(() => listarProdutosComPeso(clienteId), [clienteId]);
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: imagens } = useLiveQuery(listarTodasImagens);
  const { data: canal } = useLiveQuery(() => buscarCanal(clienteId, "Mercado Livre"), [clienteId]);

  return useMemo(() => {
    if (!produtos || !anuncios) return null;
    const loja = montarEstadoDaLoja(produtos, anuncios, imagens ?? [], Boolean(canal?.ativo));

    // O produto vem DESTA lista, não da que a tela já tinha: `Produto` não
    // carrega peso (ele vive nas variantes), e passar 0 faria o chat dizer
    // "falta peso" para quem tem. Sem o produto na lista, não há produto em
    // foco — melhor responder só sobre a loja do que sobre um peso inventado.
    const p = produtoEmFoco ? produtos.find((x) => x.id === produtoEmFoco) : undefined;
    if (!p) return { loja };

    const comFoto = new Set((imagens ?? []).map((i) => i.produtoId).filter(Boolean));
    return {
      loja,
      produto: {
        id: p.id,
        nome: p.nome,
        estado: {
          custo: p.custo,
          precoVenda: p.precoVenda,
          // O MAIOR entre as variantes: aqui a pergunta é "dá para calcular
          // frete?", e para isso uma variante pesada basta. Ver INC-001.
          pesoGramas: p.pesoGramas,
          temFoto: comFoto.has(p.id),
          // `vendedorPagaFrete` fica de fora: esta lista não o carrega, e o
          // domínio já assume que o vendedor paga quando não se sabe —
          // supor o contrário dispensaria o peso e inflaria a margem.
        },
      },
    };
  }, [produtos, anuncios, imagens, canal, produtoEmFoco]);
}
