// CACHE DE UI da conversa — não a fonte autoritativa.
//
// Desde a migração 035 a verdade do histórico vive em `copilot_conversas` e
// `copilot_mensagens`, gravadas pela ROTA com o tenant vindo da sessão. Este
// módulo continua existindo porque redesenhar a conversa instantaneamente ao
// abrir o painel é bom, e esperar uma ida ao banco para isso não é.
//
// A diferença que importa: se este cache discordar do banco, o BANCO está
// certo. Ele não atravessa dispositivo, não sobrevive à limpeza do navegador e
// não sabe nada sobre tenant — três coisas que a fonte de um histórico
// operacional precisa saber.
//
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
  /**
   * A resposta do caminho barato (o cartão), serializada.
   *
   * FALTAVA, e o defeito era visível: `resposta` não era guardada, então toda
   * resposta da rota de intenção sumia ao recarregar. A pergunta voltava sem
   * resposta nenhuma e a tela renderizava "Lendo os seus dados…" PARA SEMPRE —
   * um spinner afirmando um carregamento que não existe.
   *
   * Conferido no print da conta real em 03/08/2026: quatro perguntas travadas
   * no spinner, e só a resposta do modo conversa (que vive em `texto`)
   * sobreviveu.
   *
   * `unknown` porque o formato é da camada de domínio do assistente e este
   * módulo só o transporta — validar aqui duplicaria o contrato.
   */
  resposta?: unknown;
  ferramentas?: readonly string[];
  /** O desfecho de uma proposta confirmada. A proposta em si NÃO é guardada. */
  desfecho?: { ok: boolean; mensagem: string };
  /**
   * A falha do turno. TAMBÉM FALTAVA — o mesmo defeito de `resposta`, um campo
   * ao lado, e visível no mesmo lugar: o print da conta real.
   *
   * Um turno que falha recebe uma mensagem que diz o que aconteceu ("A resposta
   * foi interrompida no meio", ou o que o provedor devolveu). Ela vivia só em
   * memória, então o primeiro recarregamento a trocava pela linha cinza "A
   * resposta desta pergunta não chegou" — que não diz nada e manda a lojista
   * digitar tudo de novo.
   *
   * Pior para quem conserta: a mensagem que explicava a falha era exatamente a
   * que desaparecia. Em 05/08/2026 quatro perguntas apareceram com a linha
   * cinza e o diagnóstico foi feito por eliminação, porque a evidência já tinha
   * sido apagada pelo próprio cache.
   */
  erro?: string;
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
 * A chave da CONVERSA ATIVA — a identidade que agrupa os turnos no banco.
 *
 * Duas chaves porque são dois conceitos com tempos de vida diferentes (INC-005):
 *
 *   histórico local   turnos + falas    localStorage    morre no logout
 *   conversa ativa    conversaId        sessionStorage  morre ao fechar a aba
 *
 * O `conversaId` NÃO entra em `ConversaGuardada`. Aquele objeto vive em
 * `localStorage`, que é compartilhado por todas as abas — guardar a identidade
 * ali faria duas abas independentes emitirem turnos para a MESMA conversa do
 * banco. `sessionStorage` é por aba, e é isso que se quer aqui.
 *
 * A consequência aceita: fechar a aba encerra a conversa ativa. O histórico
 * local sobrevive e continua alimentando o modelo — "mesmo contexto do modelo"
 * não implica "mesma linha de conversa no banco".
 */
export function chaveDoFio(clienteId: string): string {
  return `zion:conversa-id:${clienteId}`;
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
      ...(t.resposta !== undefined ? { resposta: t.resposta } : {}),
      ...(t.ferramentas ? { ferramentas: [...t.ferramentas] } : {}),
      ...(t.desfecho ? { desfecho: { ok: t.desfecho.ok, mensagem: t.desfecho.mensagem } } : {}),
      ...(t.erro ? { erro: t.erro } : {}),
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
  const turnos = c.turnos
    .filter(
      (t): t is TurnoGuardado => Boolean(t) && typeof (t as TurnoGuardado).pergunta === "string"
    )
    .map(marcarInterrompido);
  return { versao: VERSAO_ATUAL, turnos, falas: c.falas };
}

/**
 * O que dizer de um turno que o recarregamento pegou no meio do voo.
 *
 * A gravação roda a cada mudança, então a pergunta entra no disco ANTES de
 * existir resposta. Se a aba fecha, recarrega ou navega naquele intervalo, o
 * turno volta sem resposta e sem erro — e ficava com a linha cinza para sempre,
 * culpando a PERGUNTA por algo que aconteceu com a PÁGINA.
 */
export const INTERROMPIDO =
  "Esta pergunta ficou sem resposta: a página saiu do ar antes de a resposta chegar. Pergunte de novo.";

/**
 * Um turno lido do disco que não terminou.
 *
 * Na GRAVAÇÃO isto é indecidível — o turno pode completar um segundo depois. Na
 * LEITURA é certo: um turno que terminou tem texto, resposta ou erro. Não ter
 * nenhum dos três só acontece de um jeito.
 *
 * `texto: ""` conta como terminado (`!== undefined`), e é de propósito: o modelo
 * que responde só com um cartão não deixou de responder.
 */
function marcarInterrompido(t: TurnoGuardado): TurnoGuardado {
  const terminou = t.texto !== undefined || t.resposta !== undefined || Boolean(t.erro);
  return terminou ? t : { ...t, erro: INTERROMPIDO };
}
