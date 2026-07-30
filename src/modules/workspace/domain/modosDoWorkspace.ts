// Os CINCO modos do workspace, e a regra que os governa.
//
// ===========================================================================
// DE ONDE VÊM OS CINCO
// ===========================================================================
//
// HIGGSFIELD-003 §3.4 partiu de 8 modos hipotéticos e chegou a 5 reais:
//
//   fila de decisões · triagem/tabela · pricing · Draft · preparação
//
// Os três que caíram, e onde passaram a viver:
//
//   conflito     -> TIPO DE CARTÃO dentro da fila de decisões. Dois valores, duas
//                   origens, uma escolha: é pequeno e de alta consequência. Um
//                   modo inteiro para ele seria abrir 580px para mostrar duas
//                   linhas e um botão.
//   proveniência -> DISCLOSURE dentro do cartão que já mostra o valor. Virar modo
//                   contradiz o pedido explícito de não abandonar o contexto:
//                   "de onde veio esse custo?" é uma pergunta SOBRE o que está na
//                   tela, e a resposta não pode substituir a tela.
//   prejuízo     -> o modo PRICING com resultado negativo, mais uma transição
//                   oferecida ("simula um preço sustentável"). Mesmo dado, mesma
//                   geometria, mesma ação — só o sinal do número muda.
//
// A regra para não voltar a oito: CARTÃO NÃO JUSTIFICA MODO. Um modo se justifica
// quando tem geometria própria e ação própria; um cartão vive dentro de um modo.
//
// ===========================================================================
// A REGRA APROVADA
// ===========================================================================
//
//     O WORKSPACE NUNCA TROCA DE MODO SOZINHO. SÓ A INTENÇÃO TROCA O MODO.
//
// A consequência aparece DENTRO do modo atual: a fila recomputa, o cartão atualiza,
// um convite aparece. Ela nunca sequestra o contexto. Peso resolvido desbloqueia
// pricing e a tela DIZ isso — mas quem troca para pricing é o clique.
//
// Isto está codificado abaixo em `aplicar`, que só aceita troca de modo vinda de
// `intencao`. Não é convenção documentada: é a única porta que existe.

import type { PrecisaDeTela } from "./valeATela";
import { valeATela } from "./valeATela";

export type ModoDoWorkspace =
  | "fila-de-decisoes"
  | "triagem"
  | "pricing"
  | "draft"
  | "preparacao";

export const MODOS: readonly ModoDoWorkspace[] = [
  "fila-de-decisoes",
  "triagem",
  "pricing",
  "draft",
  "preparacao",
] as const;

/**
 * O que NÃO é modo, e onde vive.
 *
 * Existe como dado — e com teste — porque é a lista que alguém vai querer
 * promover a modo em seis meses, sem lembrar por que não é.
 */
export const NAO_SAO_MODOS = {
  conflito: { vive: "cartao-na-fila-de-decisoes", modo: "fila-de-decisoes" },
  proveniencia: { vive: "disclosure-no-cartao", modo: null },
  prejuizo: { vive: "resultado-negativo-do-pricing", modo: "pricing" },
} as const;

/** A única coisa que pode trocar o modo: uma intenção do lojista. */
export interface Intencao {
  /** Para onde ele quis ir. `null` fecha o workspace e volta à conversa. */
  destino: ModoDoWorkspace | null;
  /** O que ele clicou/digitou. Vai para a auditoria, não para a decisão. */
  origem: "clique" | "frase" | "atalho";
}

/**
 * Uma consequência do sistema. NÃO carrega destino — por construção.
 *
 * Se tivesse um campo `destino`, alguém acabaria passando-o para `aplicar`, e a
 * regra viraria uma convenção que se lembra. Aqui ela é um tipo que não permite.
 */
export interface Consequencia {
  /** O que aconteceu, para a tela dizer. */
  resumo: string;
  /** Modos que passaram a ser possíveis — para OFERECER, nunca para ir. */
  desbloqueou: readonly ModoDoWorkspace[];
}

export interface EstadoDoWorkspace {
  modo: ModoDoWorkspace | null;
  /** Modos oferecidos ao lojista. Botão, não navegação. */
  oferecidos: readonly ModoDoWorkspace[];
  /** Profundidade do drill-down dentro do modo atual. Ver D5. */
  profundidade: 0 | 1;
}

export const ESTADO_INICIAL: EstadoDoWorkspace = {
  modo: null,
  oferecidos: [],
  profundidade: 0,
};

export type Evento =
  | { tipo: "intencao"; intencao: Intencao }
  | { tipo: "consequencia"; consequencia: Consequencia }
  | { tipo: "drill-down" }
  | { tipo: "voltar" };

/**
 * A transição. É aqui que a regra vive.
 *
 * `consequencia` só mexe em `oferecidos`. Ela NÃO pode tocar `modo` — e não é
 * disciplina de quem escreve: é o que este código faz.
 */
export function aplicar(estado: EstadoDoWorkspace, evento: Evento): EstadoDoWorkspace {
  switch (evento.tipo) {
    case "intencao":
      return {
        modo: evento.intencao.destino,
        // Ir para um modo consome a oferta dele; as outras continuam de pé.
        oferecidos: estado.oferecidos.filter((m) => m !== evento.intencao.destino),
        // Trocar de modo volta à raiz: manter profundidade traria o "voltar" de
        // um modo para dentro de outro.
        profundidade: 0,
      };

    case "consequencia": {
      // Oferecer o modo em que já se está seria um botão que não faz nada.
      const novos = evento.consequencia.desbloqueou.filter((m) => m !== estado.modo);
      return {
        ...estado,
        oferecidos: [...new Set([...estado.oferecidos, ...novos])],
      };
    }

    case "drill-down":
      // Sem modo não há do que dar drill-down. E a profundidade é 1 (ver D5).
      return estado.modo === null ? estado : { ...estado, profundidade: 1 };

    case "voltar":
      return estado.profundidade === 1
        ? { ...estado, profundidade: 0 }
        : { ...estado, modo: null };
  }
}

/**
 * D6 — quando o workspace deve aparecer.
 *
 * Duas condições, as duas necessárias:
 *
 *   1. HÁ MODO. Modo só se define por intenção (acima).
 *   2. O MODO VALE A TELA. Ver D7 / `valeATela`.
 *
 * A largura é decidida em `geometriaDoWorkspace` e não entra aqui: "cabe" e "vale"
 * são perguntas diferentes, e misturá-las produziria um workspace que abre em
 * monitor grande e não abre em pequeno para o mesmo conteúdo — troca de modo por
 * causa de janela, que é troca sozinho com outro nome.
 */
export function workspaceDeveAparecer(
  estado: EstadoDoWorkspace,
  conteudo: PrecisaDeTela
): boolean {
  if (estado.modo === null) return false;
  return valeATela(conteudo);
}
