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
import { listarResumoDeAnunciosDoCliente } from "@/lib/services/anunciosGerados";
import {
  retratoDasInfracoes,
  infracoesPorAnuncioDoCliente,
} from "@/lib/services/infracoesMarketplace";
import { pendenciasDaMemoria } from "@/lib/client-portal/pendenciasDaMemoria";
import { estadoDeOtimizacao } from "@/lib/client-portal/metrics";
import type { AnuncioGeradoRegistro } from "@/lib/types";
import { amostraDeNomes, type EstadoDaLoja } from "@/modules/publication/domain/prontidaoDaLoja";
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
  /**
   * Só o que esta conta LÊ: o produto de cada anúncio e o status dele.
   *
   * O tipo era `AnuncioGeradoRegistro` — a linha inteira, com o JSONB da
   * esteira. Estreitar aqui não é gosto: é o que permite ao chamador buscar a
   * consulta leve, e o tipo passa a impedir que alguém volte a exigir o peso.
   */
  anuncios: readonly { produtoId?: string | null; status: string }[],
  imagens: readonly { produtoId?: string | null }[],
  conectado: boolean,
  /**
   * As infrações já lidas do Mercado Livre (migração 052).
   *
   * `null` = ainda não lemos, e é o padrão. Não vira `0`: dizer "nenhuma
   * infração" sem ter olhado é a afirmação que a AUD-001 passou o dia
   * arrancando das telas.
   */
  infracoes: { infracoes: number; anuncios: number } | null = null,
  /**
   * O MUNDO DEPOIS DA PUBLICAÇÃO — pendências do ML e anúncios no ar sem IA.
   *
   * CHEGAM PRONTOS, e isso é a decisão principal desta mudança. Contar aqui
   * exigiria alargar o tipo de `anuncios` (que é estreito de propósito, para o
   * chamador poder usar a consulta leve) e — pior — escreveria uma SEGUNDA
   * regra para "sem otimização", que já existe em `estadoDeOtimizacao` e já
   * discordou de si mesma em três telas no dia 03/08/2026.
   *
   * Então cada número continua com uma regra só, no módulo dela:
   *   pendências + peças paradas → `pendenciasDaMemoria` → `pendenciasDaConta`
   *   no ar sem otimização       → `estadoDeOtimizacao`
   *
   * `null` = não levantamos. Não vira zero: é a mesma regra de `infracoes`, e
   * é ela que impede a tela de afirmar "nada travado" sem ter olhado.
   */
  noAr: {
    pendenciasAbertas: number;
    pecasParadas: number;
    noArSemOtimizacao: number;
  } | null = null
): EstadoDaLoja {
  const produtosComAnuncio = new Set(anuncios.map((a) => a.produtoId).filter(Boolean));
  const comFoto = new Set(imagens.map((i) => i.produtoId).filter(Boolean));
  /** id → nome, para o anúncio poder ser chamado pelo produto dele. */
  const nomePorProduto = new Map(produtos.map((p) => [p.id, p.nome]));

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
    // OS NOMES, no mesmo passo em que os números saem.
    //
    // A lista já está aqui, inteira, na memória desta tela. Contar sem guardar
    // quem foi contado era jogar fora a resposta da pergunta seguinte — que é
    // sempre "quais?" — e mandar a lojista caçar numa tabela de 80 linhas.
    quaisSao: {
      peso: amostraDeNomes(produtos.filter((p) => pesoPendente(p)).map((p) => p.nome)),
      custo: amostraDeNomes(produtos.filter((p) => !(p.custo > 0)).map((p) => p.nome)),
      foto: amostraDeNomes(produtos.filter((p) => !comFoto.has(p.id)).map((p) => p.nome)),
      anuncio: amostraDeNomes(
        produtos.filter((p) => !produtosComAnuncio.has(p.id)).map((p) => p.nome)
      ),
      precificacao: amostraDeNomes(
        produtos.filter((p) => !(p.custo > 0 && p.pesoGramas > 0)).map((p) => p.nome)
      ),
      // Aqui a unidade é o anúncio, mas o NOME é o do produto: é assim que ela
      // fala dos seus itens, e o título otimizado não chega a esta lista.
      // Anúncio sem produtoId sai da amostra em vez de virar linha vazia.
      aprovacao: amostraDeNomes(
        anuncios
          .filter((a) => a.status === "aguardando_aprovacao")
          .map((a) => nomePorProduto.get(a.produtoId ?? "") ?? "")
      ),
      publicacao: amostraDeNomes(
        anuncios
          .filter((a) => a.status === "aprovado")
          .map((a) => nomePorProduto.get(a.produtoId ?? "") ?? "")
      ),
    },
    conectadoAoMarketplace: conectado,
    ...(infracoes
      ? { infracoes: infracoes.infracoes, anunciosComInfracao: infracoes.anuncios }
      : {}),
    // Espalhado, e não com `?? 0`: ausente tem que continuar ausente até o
    // domínio, senão `lacunasDaLoja` lê zero e a tela volta a dizer "em dia"
    // por não ter olhado — que é o defeito inteiro que esta mudança conserta.
    ...(noAr
      ? {
          pendenciasAbertas: noAr.pendenciasAbertas,
          pecasParadas: noAr.pecasParadas,
          noArSemOtimizacao: noAr.noArSemOtimizacao,
        }
      : {}),
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
  // deduzidas do nome. Esquecer uma aqui não dá erro: dá uma tela que para de
  // atualizar quando aquele dado muda, em silencio.
  //
  // `listarProdutosComPeso` faz `Promise.all([listarProdutosDoCliente,
  // listarTodasVariantes])` — o peso mora na variante, entao as duas contam.
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
    // Quem escreve aqui e a sincronizacao com o ML, nao a tela. E a tabela nem
    // esta publicada no Realtime — entao nenhum evento a alcanca, e sem esta
    // anotacao ela recarregava a cada linha de QUALQUER outra tabela.
    { tabelas: ["infracoes_marketplace"] }
  );
  // AS INFRAÇÕES POR ANÚNCIO — a mesma leitura que a Visão geral faz.
  //
  // É uma SEGUNDA consulta à mesma tabela da linha acima, e isso é escolha, não
  // descuido: `retratoDasInfracoes` conta linhas com `related_item_id` e esta
  // agrupa por item. Derivar uma da outra parece economia e é suposição sobre
  // filtro — e este arquivo inteiro existe porque deduzir o que dava para medir
  // já gravou R$ 1,77 de piso nesta base.
  //
  // `pendenciasDaConta` precisa do mapa, não da contagem: sem ele o chat volta
  // a responder "nada travado" com 70 pendências abertas.
  const { data: infracoesPorAnuncio } = useLiveQuery(
    () => infracoesPorAnuncioDoCliente(clienteId),
    [clienteId],
    { tabelas: ["infracoes_marketplace"] }
  );

  return useMemo((): ContextoDoChat => {
    if (!produtos || !anuncios) return { contexto: null, produtos: [] };

    // O MUNDO DEPOIS DA PUBLICAÇÃO, pelas funções que já são a verdade dele.
    //
    // Só entra quando as infrações CHEGARAM: `pendenciasDaMemoria` sem o mapa
    // devolveria menos pendências do que existem, e um número baixo é pior que
    // número nenhum — ele parece medido.
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
