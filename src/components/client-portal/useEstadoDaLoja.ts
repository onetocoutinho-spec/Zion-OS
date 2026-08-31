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
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { listarTodasImagens } from "@/lib/services/imagensProduto";
import { listarResumoDeAnunciosDoCliente } from "@/lib/services/anunciosGerados";
import {
  retratoDasInfracoes,
  infracoesPorAnuncioDoCliente,
} from "@/lib/services/infracoesMarketplace";
import { pendenciasDaMemoria } from "@/lib/client-portal/pendenciasDaMemoria";
import { estadoDeOtimizacao } from "@/lib/client-portal/metrics";
import type { ContextoDaPergunta } from "@/modules/assistant/domain/perguntaDaOperacao";

/**
 * A CONTA vive no domínio (`modules/assistant/domain/estadoDaLoja`), porque o
 * servidor agora faz a mesma conta com o tenant da sessão. Reexportada daqui
 * para a home e as telas que já a importavam continuarem funcionando.
 */
import { montarEstadoDaLoja } from "@/modules/assistant/domain/estadoDaLoja";
export { montarEstadoDaLoja };

/**
 * O CARREGAMENTO, para as telas que ainda não têm os dados.
 *
 * `null` enquanto carrega — e quem chama trata isso em vez de receber zeros.
 * Devolver um estado zerado durante o carregamento faria o chat responder
 * "0 de 0 produtos" com toda a confiança do mundo, por meio segundo. Meio
 * segundo de número errado continua sendo número errado.
 */
export interface ContextoDoChat {
  /** `null` enquanto carrega. */
  contexto: ContextoDaPergunta | null;
  /**
   * O catálogo, para o CÓDIGO resolver de qual produto a frase fala.
   *
   * Vai junto do contexto e não numa consulta própria: são os mesmos produtos,
   * e duas listas carregadas em momentos diferentes divergem exatamente quando
   * alguém está gravando.
   */
  produtos: readonly ProdutoComPeso[];
}

export function useContextoDaPergunta(
  clienteId: string,
  produtoEmFoco?: string | null
): ContextoDoChat {
  // AS TABELAS DE CADA CONSULTA — verificadas uma a uma no serviço, não
  // deduzidas do nome. Esquecer uma não dá erro: dá uma tela que para de
  // atualizar quando aquele dado muda, em silêncio. E sem `tabelas`, o
  // oposto — recarrega a cada linha de QUALQUER tabela.
  //
  // `listarProdutosComPeso` faz `Promise.all([listarProdutosDoCliente,
  // listarTodasVariantes])` — o peso mora na variante, então as duas contam.
  const { data: produtos } = useLiveQuery(
    () => listarProdutosComPeso(clienteId),
    [clienteId],
    { tabelas: ["produtos", "produto_variantes"] }
  );
  // A CONSULTA LEVE, e a troca não é otimização.
  //
  // Isto trazia a linha INTEIRA de 880 anúncios — com o JSONB da esteira, que
  // são 1.055 kB dos 1.377 kB medidos em 03/08/2026 — para contar quantos
  // produtos têm anúncio. O chat nunca abre esse JSONB.
  //
  // Em 04/08 o assistente afirmou "0 dos seus 80 produtos têm anúncio gerado"
  // com os 80 tendo. A conta abaixo está certa; ela só devolve zero se a lista
  // chegar VAZIA — e a lista pesada é a única desta tela que pode não chegar.
  //
  // A consulta estreita é a MESMA que a tela de Produtos usa e que funciona.
  const { data: anuncios } = useLiveQuery(
    () => listarResumoDeAnunciosDoCliente(clienteId),
    [clienteId],
    { tabelas: ["anuncios_gerados"] }
  );
  const { data: imagens } = useLiveQuery(listarTodasImagens, [], {
    tabelas: ["imagens_produto"],
  });
  const { data: canal } = useLiveQuery(
    () => buscarCanal(clienteId, "Mercado Livre"),
    [clienteId],
    { tabelas: ["canais_marketplace"] }
  );
  // O que o Mercado Livre já apontou (migração 052). `undefined` enquanto a
  // consulta não volta — e `undefined` não vira zero lá dentro.
  const { data: infracoes } = useLiveQuery(
    () => retratoDasInfracoes(clienteId),
    [clienteId],
    // Quem escreve aqui é a sincronização com o ML, não a tela. E a tabela
    // nem está publicada no Realtime — então nenhum evento a alcança, e sem
    // esta anotação ela recarregava a cada linha de QUALQUER outra tabela.
    { tabelas: ["infracoes_marketplace"] }
  );
  // AS INFRACOES POR ANUNCIO — a mesma leitura que a Visao geral faz.
  //
  // E uma SEGUNDA consulta a mesma tabela da linha acima, e isso e escolha:
  // `retratoDasInfracoes` conta linhas com `related_item_id` e esta agrupa por
  // item. Derivar uma da outra parece economia e e suposicao sobre filtro — e
  // deduzir o que dava para medir ja gravou R$ 1,77 de piso nesta base.
  //
  // `pendenciasDaConta` precisa do MAPA, nao da contagem: sem ele o chat volta
  // a responder "nada travado" com 70 pendencias abertas.
  const { data: infracoesPorAnuncio } = useLiveQuery(
    () => infracoesPorAnuncioDoCliente(clienteId),
    [clienteId],
    { tabelas: ["infracoes_marketplace"] }
  );

  return useMemo((): ContextoDoChat => {
    if (!produtos || !anuncios) return { contexto: null, produtos: [] };

    // O MUNDO DEPOIS DA PUBLICACAO, pelas funcoes que ja sao a verdade dele.
    //
    // So entra quando as infracoes CHEGARAM: `pendenciasDaMemoria` sem o mapa
    // devolveria menos pendencias do que existem, e um numero baixo e pior que
    // numero nenhum — ele parece medido.
    const pend = infracoesPorAnuncio
      ? pendenciasDaMemoria(anuncios, infracoesPorAnuncio)
      : null;
    const semOtimizacao = [...estadoDeOtimizacao(anuncios).values()].filter(
      (e) => e === "No ar, sem otimização"
    ).length;
    const noAr = pend
      ? {
          pendenciasAbertas: pend.grupos.length,
          pecasParadas: pend.estoqueTravado,
          noArSemOtimizacao: semOtimizacao,
        }
      : null;

    const loja = montarEstadoDaLoja(
      produtos,
      anuncios,
      imagens ?? [],
      Boolean(canal?.ativo),
      infracoes ?? null,
      noAr
    );

    // O produto vem DESTA lista, não da que a tela já tinha: `Produto` não
    // carrega peso (ele vive nas variantes), e passar 0 faria o chat dizer
    // "falta peso" para quem tem. Sem o produto na lista, não há produto em
    // foco — melhor responder só sobre a loja do que sobre um peso inventado.
    const p = produtoEmFoco ? produtos.find((x) => x.id === produtoEmFoco) : undefined;
    if (!p) return { contexto: { loja }, produtos };

    const comFoto = new Set((imagens ?? []).map((i) => i.produtoId).filter(Boolean));
    const contexto: ContextoDaPergunta = {
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
    return { contexto, produtos };
  }, [produtos, anuncios, imagens, canal, infracoes, infracoesPorAnuncio, produtoEmFoco]);
}
