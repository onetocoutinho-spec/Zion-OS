// A execução de uma ferramenta pedida pelo modelo.
//
// Puro: recebe o pedido e o estado, devolve o resultado. Nenhuma rede, nenhum
// banco, nenhum React — e é isso que permite provar aqui, sem provedor, que
// `contar("custo")` numa loja de 73 com 30 custos devolve 43 e não "cerca de
// 40".
//
// Nada aqui é novo. Toda ferramenta é um empacotamento de domínio que já
// existe e já foi provado:
//
//   contar, proximo_passo, estado_da_loja, o_que_impede -> perguntaDaOperacao
//   o_que_falta_no_produto                              -> lacunasDoProduto
//   achar_produto, propor_gravacao                      -> propostaDeCorrecao
//
// O modelo NUNCA vê o estado. Ele vê o que estas funções devolvem — e é essa
// distância que impede o número inventado.

import { responder, type ContextoDaPergunta } from "./perguntaDaOperacao";
import {
  candidatos,
  montarProposta,
  type ProdutoAlvo,
  type Proposta,
} from "./propostaDeCorrecao";
import { lacunasDoProduto } from "../../catalog/domain/lacunasDoProduto";
import {
  montarPropostaDeAnuncio,
  type ProdutoParaAnunciar,
  type PropostaDeAnuncio,
} from "./propostaDeAnuncio";

export interface ContextoDasFerramentas {
  pergunta: ContextoDaPergunta;
  produtos: readonly ProdutoAlvo[];
  produtoAberto?: { id: string; nome: string } | null;
  /**
   * Os produtos com os dados que a checagem de anúncio exige — marca, modelo,
   * cores, tamanhos.
   *
   * Separado de `produtos` porque `ProdutoAlvo` não carrega isso, e inflar
   * aquele tipo faria toda tela que usa o chat pagar por um dado que só uma
   * ferramenta consulta.
   */
  paraAnunciar?: readonly ProdutoParaAnunciar[];
}

/**
 * O resultado de uma ferramenta.
 *
 * `proposta` vem separada do `saida` porque ela não é só texto para o modelo
 * ler — é o objeto que a tela vai mostrar e que, se alguém confirmar, vai para
 * `executarProposta`. Misturá-la no resultado genérico faria a rota ter que
 * adivinhar qual chamada produziu um cartão.
 */
export interface ResultadoDaFerramenta {
  saida: unknown;
  proposta?: Proposta;
  /**
   * Uma proposta de GERAR ANÚNCIO — separada da de gravação porque a tela faz
   * coisas diferentes com cada uma: uma grava um campo, a outra dispara a
   * esteira. Um campo só, com união, faria o cartão adivinhar qual botão pôr.
   */
  propostaDeAnuncio?: PropostaDeAnuncio;
}

/** Um pedido do modelo, ainda não validado. */
export interface PedidoDeFerramenta {
  nome: string;
  args: Record<string, unknown>;
}

function texto(args: Record<string, unknown>, chave: string): string {
  const v = args[chave];
  return typeof v === "string" ? v : "";
}

/**
 * Executa — ou recusa, dizendo por quê.
 *
 * Recusa em vez de lançar: o erro volta ao modelo como resultado da ferramenta,
 * e ele corrige no passo seguinte. Uma exceção mataria a conversa inteira por
 * um argumento errado que o próprio modelo consegue consertar.
 */
export function executarFerramenta(
  pedido: PedidoDeFerramenta,
  ctx: ContextoDasFerramentas
): ResultadoDaFerramenta {
  const { nome, args } = pedido;

  switch (nome) {
    case "contar": {
      const r = responder(
        {
          entendeu: true,
          perguntar: "",
          intencao: "contagem",
          assunto: texto(args, "assunto"),
          capacidade: "",
          interpretacao: "",
          campo: "",
          valor: "",
          unidade: "",
          termosDoAlvo: [],
        },
        ctx.pergunta
      );
      // O modelo recebe o número e a frase pronta. A frase importa: ela carrega
      // a distinção entre ausência total e parcial do peso (INC-001), que o
      // número sozinho apagaria.
      return {
        saida:
          r.tipo === "numero"
            ? { quantos: r.quantos, total: r.total, frase: r.frase, onde: r.href ?? null }
            : { erro: "Não sei contar isso.", frase: r.frase },
      };
    }

    case "proximo_passo":
    case "estado_da_loja": {
      const r = responder(
        {
          entendeu: true,
          perguntar: "",
          intencao: nome === "proximo_passo" ? "proximo_passo" : "estado_geral",
          assunto: "",
          capacidade: "",
          interpretacao: "",
          campo: "",
          valor: "",
          unidade: "",
          termosDoAlvo: [],
        },
        ctx.pergunta
      );
      if (r.tipo === "passo") {
        return {
          saida: {
            titulo: r.lacuna.titulo,
            porque: r.lacuna.trava,
            onde: r.lacuna.href,
            bloqueiaTudo: r.lacuna.bloqueiaTudo,
          },
        };
      }
      if (r.tipo === "lista") {
        return {
          saida: {
            pontos: r.itens.map((l) => ({
              titulo: l.titulo,
              porque: l.trava,
              onde: l.href,
              bloqueiaTudo: l.bloqueiaTudo,
            })),
          },
        };
      }
      return { saida: { nadaTravado: true, frase: r.frase } };
    }

    case "o_que_impede": {
      const r = responder(
        {
          entendeu: true,
          perguntar: "",
          intencao: "por_que_travado",
          assunto: "",
          capacidade: texto(args, "capacidade"),
          interpretacao: "",
          campo: "",
          valor: "",
          unidade: "",
          termosDoAlvo: [],
        },
        ctx.pergunta
      );
      if (r.tipo === "passo") {
        return { saida: { impedimento: r.lacuna.titulo, porque: r.lacuna.trava, onde: r.lacuna.href } };
      }
      return { saida: { nadaImpede: r.tipo === "nada_travado", frase: r.frase } };
    }

    case "achar_produto": {
      const termos = texto(args, "termos").split(/\s+/).filter(Boolean);
      const achados = candidatos(termos, ctx.produtos);
      // Um teto para o modelo não receber (nem repetir) meio catálogo. O total
      // vai junto: sem ele, "achei 6" com 43 batendo seria mentira por omissão.
      return {
        saida: {
          total: achados.length,
          achados: achados.slice(0, 8).map((p) => ({
            id: p.id,
            nome: p.nome,
            marca: p.marca,
            variacoes: p.quantidadeVariantes,
          })),
          ...(achados.length === 0 ? { aviso: "Nenhum produto bate com esses termos." } : {}),
          ...(achados.length > 1
            ? { aviso: "Mais de um produto bate. Pergunte ao lojista qual, sem escolher." }
            : {}),
        },
      };
    }

    case "o_que_falta_no_produto": {
      const p = ctx.produtos.find((x) => x.id === texto(args, "produtoId"));
      if (!p) return { saida: { erro: "produtoId desconhecido. Use achar_produto antes." } };
      const falta = lacunasDoProduto(
        {
          custo: p.custo,
          precoVenda: 0,
          // Aqui a pergunta é "dá para calcular frete?", e para isso uma
          // variante pesada basta. Ver INC-001.
          pesoGramas: p.variacoesSemPeso < p.quantidadeVariantes ? 1 : 0,
          temFoto: true,
        },
        p.id
      );
      return {
        saida: {
          nome: p.nome,
          completo: falta.length === 0,
          falta: falta.map((l) => ({ o_que: l.rotulo, impede: l.impede, onde: l.href ?? null })),
        },
      };
    }

    case "propor_gravacao": {
      const proposta = montarProposta(
        {
          entendeu: true,
          perguntar: "",
          campo: texto(args, "campo"),
          valor: texto(args, "valor"),
          unidade: texto(args, "unidade"),
          // O ALVO vem do produtoId, não de termos: a esta altura o modelo já
          // chamou `achar_produto` e sabe qual é. Reabrir a busca por texto aqui
          // daria a ele uma segunda chance de acertar o produto errado.
          termosDoAlvo: [],
          interpretacao: "",
        },
        ctx.produtos,
        alvoPeloId(texto(args, "produtoId"), ctx.produtos)
      );
      return {
        proposta,
        // O modelo recebe só o RESUMO, nunca o objeto. Ele descreve a proposta
        // ao lojista; quem a executa é o clique, com o objeto que a tela tem.
        saida:
          proposta.tipo === "pronta"
            ? { montada: true, resumo: proposta.resumo, unidadeDeduzida: proposta.unidadeDeduzida }
            : { montada: false, motivo: mensagemDaRecusa(proposta) },
      };
    }

    case "propor_anuncio": {
      const id = texto(args, "produtoId");
      // A checagem de prontidão precisa de marca, modelo, cores e tamanhos —
      // que não cabem em `ProdutoAlvo`. Quem tem isso é a tela, e ela manda
      // separado. Sem os dados, dizemos que não sabemos em vez de propor uma
      // geração que vai voltar com pendência.
      const p = ctx.paraAnunciar?.find((x) => x.id === id);
      if (!p) {
        return {
          saida: {
            erro: "Não tenho os dados deste produto para conferir se ele está pronto. Use achar_produto antes.",
          },
        };
      }
      const proposta = montarPropostaDeAnuncio(p);
      return {
        propostaDeAnuncio: proposta,
        // O modelo recebe o VEREDITO e o que falta — nunca o objeto. Ele
        // explica ao lojista; quem dispara é o clique, com o objeto da tela.
        saida:
          proposta.tipo === "pronto"
            ? {
                pronto: true,
                resumo: proposta.resumo,
                refazendo: proposta.refazendo,
                atributos: proposta.atributos.map((a) => ({
                  nome: a.nome,
                  valor: a.valor,
                  origem: a.origem,
                })),
              }
            : proposta.tipo === "falta_dado"
              ? { pronto: false, faltando: proposta.faltando, motivo: proposta.mensagem }
              : { pronto: false, motivo: proposta.mensagem },
      };
    }

    default:
      return { saida: { erro: `Ferramenta desconhecida: ${nome}` } };
  }
}

function alvoPeloId(
  id: string,
  produtos: readonly ProdutoAlvo[]
): { id: string; nome: string } | null {
  const p = produtos.find((x) => x.id === id);
  return p ? { id: p.id, nome: p.nome } : null;
}

function mensagemDaRecusa(p: Proposta): string {
  if (p.tipo === "pronta") return "";
  if (p.tipo === "ambigua") return p.mensagem;
  return p.mensagem;
}
