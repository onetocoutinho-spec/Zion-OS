// O que o painel de preparação DECIDE — separado do que ele desenha.
//
// Mesmo motivo dos outros cartões: React não é testável neste repositório, e as
// decisões deste painel são as que não podem errar — quantos produtos podem
// virar anúncio, o que trava cada etapa, e quando existe botão.
//
// A REGRA: todo número vem do orquestrador (`preparacaoDoAnuncio`), que é
// domínio puro. A tela não soma nada, e o modelo não escreveu nenhum deles.

import type {
  EstadoDaPreparacao,
  EtapaDaPreparacao,
  Preparacao,
  SelecaoParaPreparar,
} from "../../publication/domain/preparacaoDoAnuncio";
import { escreverEstado } from "../../publication/domain/preparacaoDoAnuncio";

export interface PreparacaoNaTela {
  produto?: Preparacao;
  selecao?: SelecaoParaPreparar;
}

/** Como cada etapa aparece. Nome de gente, não de código. */
export const ROTULO_DA_ETAPA: Record<EtapaDaPreparacao, string> = {
  identidade: "Identidade (o que o ML exige)",
  conteudo: "Título e descrição",
  imagens: "Imagens",
  pricing: "Preço",
  publicacao: "Publicação",
};

export type EstadoDoPainelDePreparacao =
  /** Um produto: as etapas, o que falta, e se dá para propor a geração. */
  | {
      estado: "produto";
      nome: string;
      situacao: EstadoDaPreparacao;
      frase: string;
      etapas: readonly {
        etapa: EtapaDaPreparacao;
        rotulo: string;
        situacao: string;
        faltando: readonly string[];
      }[];
      /** Verdadeiro só quando nada impede gerar agora. */
      podePropor: boolean;
      jaTemAnuncio: boolean;
    }
  /** O catálogo: quantos podem, quantos não, e por quê. */
  | {
      estado: "lote";
      analisados: number;
      elegiveis: number;
      jaPreparados: number;
      travados: readonly { motivo: string; quantos: number; exemplos: readonly string[] }[];
      frase: string;
      aviso?: string;
    }
  | { estado: "vazio" };

/**
 * O estado do painel.
 *
 * `podePropor` é `estado === "apto_para_preparar"` e mais nada. Não é "quase
 * pronto" nem "só falta pouca coisa": gerar com dado faltando queima três
 * minutos e uma cota para devolver um anúncio com pendência, e essa política é
 * do domínio desde o PR #84.
 */
export function estadoDoPainelDePreparacao(p: PreparacaoNaTela): EstadoDoPainelDePreparacao {
  if (p.produto) {
    const d = p.produto;
    return {
      estado: "produto",
      nome: d.nome,
      situacao: d.estado,
      frase: `${d.nome}: ${escreverEstado(d.estado)}.`,
      etapas: d.etapas.map((e) => ({
        etapa: e.etapa,
        rotulo: ROTULO_DA_ETAPA[e.etapa],
        situacao: e.situacao,
        faltando: e.faltando,
      })),
      podePropor: d.estado === "apto_para_preparar",
      jaTemAnuncio: d.jaTemAnuncio,
    };
  }
  if (p.selecao) {
    const s = p.selecao;
    return {
      estado: "lote",
      analisados: s.analisados,
      elegiveis: s.elegiveis.length,
      jaPreparados: s.jaPreparados,
      travados: s.naoElegiveis,
      frase: fraseDoLote(s),
      ...(s.truncado
        ? { aviso: `Olhei ${s.analisados} de ${s.totalNoCatalogo} produtos.` }
        : {}),
    };
  }
  return { estado: "vazio" };
}

/**
 * A frase do lote.
 *
 * Começa pelo que PODE — é a resposta de "quais já podem virar anúncio?". O que
 * está travado vem depois, agrupado: uma lista de 200 nomes não ajuda ninguém a
 * decidir o que resolver primeiro.
 */
export function fraseDoLote(s: SelecaoParaPreparar): string {
  const partes: string[] = [];
  const n = s.elegiveis.length;
  partes.push(
    n === 0
      ? "Nenhum produto está pronto para virar anúncio agora."
      : `${n} produto${n > 1 ? "s" : ""} ${n > 1 ? "podem" : "pode"} virar anúncio agora.`
  );
  const travados = s.naoElegiveis.reduce((soma, t) => soma + t.quantos, 0);
  if (travados > 0) {
    partes.push(`${travados} ${travados > 1 ? "estão travados" : "está travado"}.`);
  }
  if (s.jaPreparados > 0) {
    partes.push(`${s.jaPreparados} já ${s.jaPreparados > 1 ? "têm" : "tem"} anúncio.`);
  }
  return partes.join(" ");
}

/**
 * A cor semântica de uma etapa. Sem inventar um sexto estado na tela.
 *
 * `nao_se_aplica` conta como neutra: um produto cujo comprador paga o frete não
 * tem etapa de peso travada — ela simplesmente não existe para ele, e pintá-la
 * de vermelho cobraria um dado que nunca vai ser usado.
 */
export function tomDaEtapa(situacao: string): "boa" | "atencao" | "neutra" {
  if (situacao === "pronta") return "boa";
  if (situacao === "bloqueada") return "atencao";
  return "neutra";
}

// ---------------------------------------------------------------------------
// título
// ---------------------------------------------------------------------------

export interface TituloNaTela {
  /**
   * A troca é no ANÚNCIO PUBLICADO, não no catálogo do Zion.
   *
   * Muda o que o COMPRADOR vê agora, e por isso a tela precisa dizer. Um botão
   * idêntico para consequências diferentes é a armadilha que este campo evita.
   */
  noMarketplace?: boolean;
  /** O anúncio no Mercado Livre, quando a troca é lá. */
  mlb?: string;
  nome: string;
  tituloAtual: string;
  tituloProposto: string;
  justificativa: string;
}

/** O cartão do TEXTO do anúncio — descrição ou palavras-chave. */
export interface TextoNaTela {
  campo: "descricao" | "palavras_chave";
  nome: string;
  atual: string;
  proposto: string;
  justificativa: string;
}

export type EstadoDoCartaoDeTexto =
  | {
      estado: "pendente";
      /** O verbo do botão. É onde substituir e acrescentar se distinguem. */
      rotuloBotao: string;
      /** O que a troca faz, em uma linha, antes do clique. */
      efeito: string;
    }
  | { estado: "concluido"; ok: boolean; mensagem: string };

/**
 * O estado do cartão de texto.
 *
 * O VERBO MUDA COM O CAMPO, e essa é a única coisa que não pode ser genérica:
 * descrição SUBSTITUI o que existe; palavras-chave ACRESCENTAM ao que existe.
 * Um botão "Aplicar" nos dois casos deixaria a lojista achar que as palavras
 * atuais seriam trocadas — e ela recusaria uma melhoria que não tira nada.
 *
 * Sem `propostaId` não há botão: uma proposta que não foi persistida não tem
 * como ser confirmada, e mostrar o botão prometeria o que a rota recusaria.
 */
export function estadoDoCartaoDeTexto(
  t: TextoNaTela,
  propostaId?: string,
  desfecho?: { ok: boolean; mensagem: string }
): EstadoDoCartaoDeTexto {
  if (desfecho) return { estado: "concluido", ok: desfecho.ok, mensagem: desfecho.mensagem };
  const ehDescricao = t.campo === "descricao";
  return {
    estado: "pendente",
    rotuloBotao: propostaId
      ? ehDescricao
        ? "Trocar a descrição"
        : "Acrescentar as palavras-chave"
      : "",
    efeito: ehDescricao
      ? "A descrição atual será substituída por esta."
      : "Estas ACRESCENTAM às que já existem. Nenhuma palavra atual é removida.",
  };
}

export type EstadoDoCartaoDeTitulo =
  | { estado: "pendente"; caracteresAtual: number; caracteresProposto: number; rotuloBotao: string }
  | { estado: "concluido"; ok: boolean; mensagem: string };

/**
 * O cartão do título.
 *
 * As DUAS contagens aparecem porque o limite de 60 é a razão de o agente
 * existir, e porque um título mais curto nem sempre é melhor — quem decide vê
 * os dois números junto dos dois textos.
 */
export function estadoDoCartaoDeTitulo(
  t: TituloNaTela,
  propostaId?: string,
  desfecho?: { ok: boolean; mensagem: string }
): EstadoDoCartaoDeTitulo {
  if (desfecho) return { estado: "concluido", ok: desfecho.ok, mensagem: desfecho.mensagem };
  // Sem id persistido não há o que confirmar — e um botão ali ofereceria uma
  // ação que o servidor vai recusar.
  if (!propostaId) {
    return {
      estado: "concluido",
      ok: false,
      mensagem: "Não consegui registrar essa proposta. Peça de novo.",
    };
  }
  return {
    estado: "pendente",
    caracteresAtual: t.tituloAtual.length,
    caracteresProposto: t.tituloProposto.length,
    rotuloBotao: "Usar o título novo",
  };
}
