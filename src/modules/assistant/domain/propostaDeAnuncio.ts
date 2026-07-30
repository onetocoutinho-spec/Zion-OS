// "Anuncia o chinelo zaxy" — do pedido até a proposta.
//
// A esteira roda NO NAVEGADOR e leva de dois a três minutos encadeando agentes.
// Uma ferramenta de servidor não tem como executá-la, e isso é uma sorte: o
// desenho que sobra é o certo.
//
//     a ferramenta PROPÕE · o lojista confirma · o navegador roda a esteira
//
// A mesma forma do `propor_gravacao`, pelo mesmo motivo. Gerar um anúncio gasta
// quota, leva minutos e produz texto que vai para o Mercado Livre — não é coisa
// que se dispara porque o modelo achou que era hora.
//
// O TRABALHO REAL DESTE MÓDULO é dizer NÃO antes de propor. Mandar a esteira
// rodar num produto sem foto, sem custo ou sem os atributos que o ML exige
// queima três minutos e devolve um anúncio que não publica. Aqui isso vira uma
// frase curta com o que falta — e é a diferença entre um assistente e um botão
// caro.
//
// Medido no PR #84: dos 73 produtos desta base, 47 já satisfaziam os seis
// atributos obrigatórios do ML. A conta não é hipotética.

import type { EstadoDoProduto } from "../../catalog/domain/lacunasDoProduto";
import {
  resolverObrigatorios,
  type AtributoResolvido,
  type DadosDoProduto,
} from "../../publication/domain/atributosDoMarketplace";
import { calcularBloqueiosParaGerar } from "../../publication/domain/preparacaoDoAnuncio";

export interface ProdutoParaAnunciar {
  id: string;
  nome: string;
  estado: EstadoDoProduto;
  /** O que o ML exige, resolvido do cadastro e do nome. */
  dados: DadosDoProduto;
  /** Já existe anúncio gerado para ele? Refazer é legítimo, mas se diz. */
  jaTemAnuncio: boolean;
}

export type PropostaDeAnuncio =
  | {
      tipo: "pronto";
      produtoId: string;
      nome: string;
      /** O que a pessoa lê antes de gastar três minutos e uma otimização. */
      resumo: string;
      /** true quando vai sobrescrever um anúncio que já existe. */
      refazendo: boolean;
      /** Os atributos que o ML exige, já resolvidos — para o cartão mostrar. */
      atributos: readonly AtributoResolvido[];
    }
  | {
      tipo: "falta_dado";
      produtoId: string;
      nome: string;
      /** O que impede, em português de lojista. */
      faltando: readonly string[];
      mensagem: string;
    }
  | { tipo: "sem_alvo"; mensagem: string };

/**
 * O que falta para este produto virar anúncio.
 *
 * Duas fontes, e as duas importam: o cadastro (custo, peso, foto) e o que o
 * MERCADO LIVRE exige (marca, modelo, gênero, cor, tamanho, tipo de calçado).
 *
 * A segunda lista veio de medir a API, não de imaginar: a IA vinha exigindo
 * "antiderrapante", "vegano" e "reciclado", que o ML não pede em lugar nenhum.
 */
export function oQueFaltaParaAnunciar(p: ProdutoParaAnunciar): string[] {
  // A REGRA MORA NO ORQUESTRADOR, uma vez só.
  //
  // Este módulo era o dono dela; virou uma PROJEÇÃO de
  // `preparacaoDoAnuncio.calcularBloqueiosParaGerar`. Não é reescrita: é a mesma
  // lista, com o mesmo corte (cadastro sem o preço, mais os obrigatórios do ML
  // ausentes), agora compartilhada com quem avalia as etapas.
  //
  // Duas cópias dela existiriam para divergir no dia em que uma mudasse — e a
  // divergência apareceria como o Copilot propondo geração para um produto que
  // o painel de preparação diz estar travado.
  return calcularBloqueiosParaGerar(p.estado, p.id, resolverObrigatorios(p.dados));
}

/**
 * A proposta — ou o motivo de não haver uma.
 *
 * Nunca propõe com dado faltando. Um anúncio gerado sem gênero volta com
 * pendência e a pessoa gastou três minutos para descobrir isso.
 */
export function montarPropostaDeAnuncio(p: ProdutoParaAnunciar | null): PropostaDeAnuncio {
  if (!p) {
    return {
      tipo: "sem_alvo",
      mensagem: "Não sei de qual produto você está falando. Diga o nome, ou abra o produto.",
    };
  }

  const faltando = oQueFaltaParaAnunciar(p);
  if (faltando.length > 0) {
    return {
      tipo: "falta_dado",
      produtoId: p.id,
      nome: p.nome,
      faltando,
      mensagem:
        faltando.length === 1
          ? `Falta ${faltando[0].toLowerCase()} em ${p.nome}. Sem isso o anúncio sai com pendência.`
          : `Faltam ${faltando.length} coisas em ${p.nome}: ${faltando.join(", ")}. Sem elas o anúncio sai com pendência.`,
    };
  }

  return {
    tipo: "pronto",
    produtoId: p.id,
    nome: p.nome,
    refazendo: p.jaTemAnuncio,
    atributos: resolverObrigatorios(p.dados),
    // O custo aparece na frase porque é o que a pessoa deve pesar antes de
    // confirmar: minutos de espera e uma otimização da cota mensal.
    resumo: p.jaTemAnuncio
      ? `Refazer o anúncio de ${p.nome}. O texto atual será substituído — leva alguns minutos e consome uma otimização.`
      : `Gerar o anúncio de ${p.nome}: título, descrição e ficha técnica. Leva alguns minutos e consome uma otimização.`,
  };
}
