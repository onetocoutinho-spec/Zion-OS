// O que o cartão do cadastro DECIDE — separado do que ele desenha.
//
// Mesmo motivo do `cartaoDoLote`: React não é testável neste repositório, e as
// decisões deste cartão são as que não podem errar — quando existe botão de
// criar, quando o cadastro virou produto, e quando o catálogo mudou por baixo.
//
// A regra que atravessa: NENHUM estado crítico vem do texto do modelo. Status,
// prontidão e o botão saem do Draft e da Proposal, que são servidor.

import type { Procedencia } from "./fatosDoCadastro";
import type { EstadoDoDraft } from "./draftDeCadastro";

/** O cadastro como a tela o recebe. Tudo já escrito para leitura humana. */
export interface CadastroNaTela {
  draftId: string;
  status: EstadoDoDraft;
  rotulo: string;
  jaSei: readonly { campo: string; valor: string; procedencia: Procedencia }[];
  variantes: {
    total: number;
    porCor: readonly { cor: string; tamanhos: readonly string[] }[];
    semSku: number;
  };
  falta: readonly { o_que: string; porque: string; bloqueia: boolean }[];
  conflitos: readonly { campo: string; valorAtual: string; valorNovo: string }[];
  prontoParaCriar: boolean;
  /** Produtos que PODEM corresponder. Nunca identidade — ver `candidatosDoCadastro`. */
  candidatos?: readonly {
    produtoId: string;
    nome: string;
    marca?: string;
    referencia?: string;
    sku?: string;
    ean?: string;
    casamento: string;
  }[];
  candidatosMensagem?: string;
  /** A Proposal de criação. SEM ela não existe botão. */
  propostaId?: string;
  /** A frase que a pessoa lê antes de autorizar. */
  resumo?: string;
  /** O produto que nasceu, quando nasceu. */
  produtoId?: string;
  /** Vários cadastros em andamento: a escolha é do lojista. */
  escolhaDeCadastros?: readonly { ordem: number; id: string; rotulo: string }[];
}

export interface DesfechoDoCadastro {
  ok: boolean;
  mensagem: string;
  /** Verdadeiro quando o servidor recusou por o catálogo ter mudado. */
  stale?: boolean;
  produtoId?: string;
}

export type EstadoDoCartaoDeCadastro =
  /** Vários cadastros em andamento — escolher é do lojista, nunca do código. */
  | { estado: "escolha"; opcoes: readonly { ordem: number; id: string; rotulo: string }[] }
  /** Trabalho em andamento: o que já sei, a grade, e o que ainda falta. */
  | {
      estado: "coletando";
      titulo: string;
      falta: readonly { o_que: string; porque: string; bloqueia: boolean }[];
      bloqueios: number;
    }
  /** Completo, mas sem Proposal ainda: mostra o resumo, sem botão. */
  | { estado: "pronto"; titulo: string; resumo: string }
  /** Proposal persistida: AQUI existe botão, e ele diz o que vai acontecer. */
  | { estado: "proposta"; titulo: string; resumo: string; rotuloBotao: string }
  /** Já decidido — sucesso, stale ou recusa. Sem botão, em qualquer caso. */
  | { estado: "concluido"; ok: boolean; mensagem: string; produtoId?: string }
  /** O lojista desistiu deste cadastro. */
  | { estado: "cancelado"; mensagem: string };

/**
 * O estado do cartão.
 *
 * A ORDEM DAS CHECAGENS é a segurança da tela:
 *
 *   1. desfecho     — qualquer resultado já decidido tira o botão
 *   2. cancelado    — não volta a oferecer criação
 *   3. criado       — vira registro com o produto real
 *   4. escolha      — dois cadastros abertos param tudo até alguém escolher
 *   5. proposta     — só com `propostaId` existe botão
 *   6. pronto       — completo mas ainda sem autorização montada
 *   7. coletando    — o caso comum
 *
 * Trocar 1 por qualquer outro deixaria o "Criar produto" ativo depois de uma
 * criação que já aconteceu.
 */
export function estadoDoCartaoDeCadastro(
  c: CadastroNaTela,
  desfecho?: DesfechoDoCadastro
): EstadoDoCartaoDeCadastro {
  if (desfecho) {
    return {
      estado: "concluido",
      ok: desfecho.ok,
      mensagem: desfecho.mensagem,
      ...(desfecho.produtoId ? { produtoId: desfecho.produtoId } : {}),
    };
  }
  if (c.status === "cancelado") {
    return { estado: "cancelado", mensagem: "Cadastro cancelado. Nada foi criado." };
  }
  if (c.status === "criado") {
    return {
      estado: "concluido",
      ok: true,
      mensagem: `Produto criado: ${c.rotulo}.`,
      ...(c.produtoId ? { produtoId: c.produtoId } : {}),
    };
  }
  if (c.escolhaDeCadastros && c.escolhaDeCadastros.length > 1) {
    return { estado: "escolha", opcoes: c.escolhaDeCadastros };
  }

  const titulo = c.rotulo;
  if (c.propostaId && c.status === "aguardando_confirmacao") {
    return {
      estado: "proposta",
      titulo,
      resumo: c.resumo ?? "",
      // O botão DIZ o que faz. "Confirmar" sozinho não conta que um produto vai
      // nascer no catálogo do lojista.
      rotuloBotao:
        c.variantes.total > 1
          ? `Criar produto com ${c.variantes.total} variantes`
          : "Criar produto",
    };
  }
  if (c.prontoParaCriar) {
    return { estado: "pronto", titulo, resumo: c.resumo ?? "" };
  }
  return {
    estado: "coletando",
    titulo,
    falta: c.falta,
    bloqueios: c.falta.filter((f) => f.bloqueia).length,
  };
}

/**
 * O desfecho de uma confirmação de criação.
 *
 * "Já foi feito" é SUCESSO — o duplo clique encontrou o produto pronto. E
 * `obsoleta` ganha frase própria: dizer "não consegui" esconderia que o sistema
 * PROTEGEU o lojista de uma duplicata.
 */
export function desfechoDaCriacao(r: {
  ok: boolean;
  jaFeito?: boolean;
  motivo?: string;
  mensagem: string;
  produtoId?: string;
}): DesfechoDoCadastro {
  if (r.motivo === "obsoleta") {
    return {
      ok: false,
      stale: true,
      mensagem:
        "O catálogo mudou desde que eu preparei este cadastro. Não criei o produto — confira o que apareceu e peça de novo.",
    };
  }
  return {
    ok: r.ok || Boolean(r.jaFeito),
    mensagem: r.mensagem,
    ...(r.produtoId ? { produtoId: r.produtoId } : {}),
  };
}

/** A grade, escrita em uma linha por cor. É o que se lê num relance. */
export function escreverGrade(
  variantes: CadastroNaTela["variantes"]
): readonly string[] {
  return variantes.porCor.map((c) =>
    c.tamanhos.length > 0 ? `${c.cor}: ${c.tamanhos.join(", ")}` : c.cor
  );
}
