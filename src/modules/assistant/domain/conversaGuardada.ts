// A conversa que sobrevive ao recarregamento.
//
// Puro: entra e sai estrutura, e quem toca em `localStorage` é a camada de
// serviço. Isso permite provar aqui as duas coisas que importam — que uma
// conversa gravada por uma versão antiga não derruba a tela, e que ela não
// cresce para sempre.
//
// O painel e a página própria leem DAQUI, e é isso que faz as duas serem a
// mesma conversa em vez de duas paralelas. Sem esta peça, abrir a página
// depois de conversar no painel começaria do zero — e ninguém entende por quê.

/** Um turno, no formato que a tela desenha. */
export interface TurnoGuardado {
  pergunta: string;
  texto?: string;
  ferramentas?: readonly string[];
  /** O desfecho de uma proposta confirmada. A proposta em si NÃO é guardada. */
  desfecho?: { ok: boolean; mensagem: string };
}

export interface ConversaGuardada {
  /** Versão do formato. Muda quando o formato muda, e o antigo é descartado. */
  versao: number;
  turnos: readonly TurnoGuardado[];
  /** O histórico no dialeto do provedor — é o que mantém o fio vivo. */
  falas: readonly unknown[];
}

export const VERSAO_ATUAL = 1;

/**
 * Quantos turnos ficam guardados.
 *
 * O `localStorage` tem uns 5 MB por origem, e uma conversa longa com histórico
 * de ferramentas passa disso mais rápido do que parece. Cortar os mais antigos
 * é melhor que estourar a cota — quando ela estoura, a gravação falha em
 * silêncio e a pessoa perde a conversa inteira, não os pedaços velhos.
 */
export const TURNOS_GUARDADOS = 40;

export function chaveDaConversa(clienteId: string): string {
  return `zion:conversa:${clienteId}`;
}

/**
 * O que gravar. Já cortado, e sem a proposta pendente.
 *
 * A PROPOSTA NÃO ATRAVESSA de propósito. Ela é um convite a gravar no banco, e
 * um convite guardado em disco pode ser aceito amanhã, contra um produto que
 * mudou. Confirmação é coisa da sessão em que foi oferecida — recarregou,
 * pergunta de novo.
 */
export function paraGuardar(
  turnos: readonly TurnoGuardado[],
  falas: readonly unknown[]
): ConversaGuardada {
  return {
    versao: VERSAO_ATUAL,
    turnos: turnos.slice(-TURNOS_GUARDADOS).map((t) => ({
      pergunta: t.pergunta,
      ...(t.texto !== undefined ? { texto: t.texto } : {}),
      ...(t.ferramentas ? { ferramentas: [...t.ferramentas] } : {}),
      ...(t.desfecho ? { desfecho: { ok: t.desfecho.ok, mensagem: t.desfecho.mensagem } } : {}),
    })),
    falas: falas.slice(-TURNOS_GUARDADOS * 3),
  };
}

/**
 * O que foi lido do disco, se der para confiar nele.
 *
 * `null` para qualquer coisa que não seja exatamente o formato de hoje —
 * inclusive versão antiga, JSON quebrado e `null`. Uma conversa perdida é um
 * aborrecimento; uma tela que não abre porque o storage tem lixo de três meses
 * atrás é um chamado de suporte.
 */
export function lerGuardada(bruto: string | null): ConversaGuardada | null {
  if (!bruto) return null;
  let dados: unknown;
  try {
    dados = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (!dados || typeof dados !== "object") return null;
  const c = dados as Partial<ConversaGuardada>;
  if (c.versao !== VERSAO_ATUAL) return null;
  if (!Array.isArray(c.turnos) || !Array.isArray(c.falas)) return null;
  // Cada turno precisa ao menos da pergunta: sem ela a bolha aparece vazia e
  // quem lê não sabe o que perguntou.
  const turnos = c.turnos.filter(
    (t): t is TurnoGuardado => Boolean(t) && typeof (t as TurnoGuardado).pergunta === "string"
  );
  return { versao: VERSAO_ATUAL, turnos, falas: c.falas };
}
