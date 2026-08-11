// Persistência da Proposal do Copilot — SERVIDOR APENAS.
//
// ⚠️ Este arquivo importa o cliente admin (service_role) e NUNCA pode ser
// importado por código de navegador. É deliberado: o cliente do portal tem
// apenas SELECT nas tabelas `copilot_*`. Dar-lhe UPDATE em `copilot_propostas`
// seria deixá-lo marcar a própria proposta como executada e pular a
// revalidação inteira.
//
// A DECISÃO de executar é do domínio puro (`propostaPersistida`), testada sem
// banco. Aqui está só o que precisa ser durável e atômico — e a atomicidade é
// o ponto: a idempotência não mora num `if`, mora numa transição de status que
// o Postgres arbitra.

import { getSupabaseAdmin } from "../supabase/admin";
import {
  expiraEm,
  RISCO_POR_TIPO,
  type AutoridadeDoValor,
  type Precondicao,
  type PropostaPersistida,
  type StatusProposta,
  type TipoDeProposta,
} from "../../modules/assistant/domain/propostaPersistida";

interface LinhaProposta {
  id: string;
  cliente_id: string;
  conversa_id: string;
  criada_por: string | null;
  tipo: string;
  risco: string;
  status: string;
  alvos: string[];
  valor: number;
  resumo: string;
  precondicoes: Precondicao[] | null;
  criada_em: string;
  expira_em: string;
  draft_id?: string | null;
  texto?: string | null;
  autoridade?: string | null;
}

function paraDominio(l: LinhaProposta): PropostaPersistida {
  return {
    id: l.id,
    clienteId: l.cliente_id,
    conversaId: l.conversa_id,
    criadaPor: l.criada_por ?? "",
    tipo: l.tipo as TipoDeProposta,
    risco: l.risco as PropostaPersistida["risco"],
    status: l.status as StatusProposta,
    alvos: l.alvos ?? [],
    valor: Number(l.valor),
    resumo: l.resumo,
    precondicoes: l.precondicoes ?? [],
    criadaEm: l.criada_em,
    expiraEm: l.expira_em,
    ...(l.draft_id ? { draftId: l.draft_id } : {}),
    ...(l.texto ? { texto: l.texto } : {}),
    // AUSENTE e NULL viram a MESMA coisa: `autoridade: null`, que significa NAO
    // REGISTRADA. Nao se transforma em `sem_autoridade` aqui — seria inventar
    // proveniencia para toda proposta anterior a migracao 044. Ver INC-008.
    autoridade: (l.autoridade as PropostaPersistida["autoridade"]) ?? null,
  };
}

export interface NovaProposta {
  clienteId: string;
  conversaId: string;
  criadaPor: string | null;
  tipo: TipoDeProposta;
  alvos: readonly string[];
  valor: number;
  resumo: string;
  precondicoes: readonly Precondicao[];
  /** Reenvio antes da primeira resposta cai na mesma linha, não em duas. */
  chaveIdempotencia?: string | null;
  /**
   * O cadastro em conversa que esta proposta materializa, quando é de criação.
   *
   * `alvos` já carrega o mesmo id, porque a coluna exige pelo menos um alvo. A
   * coluna existe além disso para a auditoria não depender de INTERPRETAR um
   * array de uuids: com ela, "que cadastro virou esse produto?" é um join.
   */
  draftId?: string | null;
  /** O conteúdo proposto quando ele é texto (título). Só neste tipo. */
  texto?: string | null;
  /**
   * De onde o valor veio, segundo quem o produziu.
   *
   * NASCE NA FRONTEIRA QUE CONHECE O FATO — a ferramenta — e chega aqui pronta.
   * Nunca é deduzida do resumo, do `comoVeio`, do nome da ferramenta nem do
   * próprio valor: deduzir depois seria reconstruir por aparência a informação
   * que se perdeu, que é o defeito do INC-008 com outra roupa.
   *
   * Omitir grava NULL — desconhecido —, e é o que deve acontecer com qualquer
   * caminho que ainda não saiba responder.
   */
  autoridade?: AutoridadeDoValor | null;
}

/**
 * Cria a proposta e devolve o que a tela precisa: o ID.
 *
 * O RISCO é atribuído aqui, a partir do tipo — nunca vem de fora. Deixar o
 * proponente declarar o próprio risco seria pedir a quem escreve a frase que
 * avalie a consequência dela.
 */
export async function criarProposta(nova: NovaProposta): Promise<PropostaPersistida> {
  const agora = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("copilot_propostas")
    .insert({
      cliente_id: nova.clienteId,
      conversa_id: nova.conversaId,
      criada_por: nova.criadaPor,
      tipo: nova.tipo,
      risco: RISCO_POR_TIPO[nova.tipo],
      status: "pendente",
      alvos: nova.alvos,
      valor: nova.valor,
      resumo: nova.resumo,
      precondicoes: nova.precondicoes,
      criada_em: agora,
      expira_em: expiraEm(agora),
      chave_idempotencia: nova.chaveIdempotencia ?? null,
      draft_id: nova.draftId ?? null,
      texto: nova.texto ?? null,
      autoridade: nova.autoridade ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Não consegui registrar a proposta: ${error?.message ?? ""}`);
  return paraDominio(data as LinhaProposta);
}

/**
 * Busca por id. SEM filtrar por cliente de propósito.
 *
 * Quem compara o tenant é o domínio (`podeExecutar`), e ele distingue
 * "não encontrada" de "outro tenant" — porque a auditoria precisa registrar a
 * TENTATIVA de acesso cruzado. Filtrar aqui apagaria essa distinção e a
 * tentativa viraria um 404 silencioso.
 *
 * A mensagem devolvida ao usuário é a mesma nos dois casos. A diferença fica no
 * log, que é onde ela serve.
 */
export async function buscarProposta(id: string): Promise<PropostaPersistida | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("copilot_propostas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return paraDominio(data as LinhaProposta);
}

/**
 * A transição atômica: `pendente` → `executada`.
 *
 * AQUI mora a idempotência. O `eq("status", "pendente")` faz o Postgres
 * arbitrar quem chegou primeiro — duplo clique, retry e refresh disputam a
 * mesma linha, um ganha e os outros recebem ZERO linhas afetadas.
 *
 * Devolve `false` para quem perdeu. Quem perdeu não executa e responde "já foi
 * feito" — nunca um segundo INSERT no banco do lojista.
 *
 * A reserva acontece ANTES da escrita real: se a gravação falhar depois, a
 * proposta é marcada como `falhou` e ninguém a executa de novo às cegas. O
 * contrário — gravar e depois marcar — deixaria a janela em que duas
 * requisições gravam e só uma marca.
 */
export async function reservarParaExecucao(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("copilot_propostas")
    .update({ status: "executada", executada_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id");
  if (error) throw new Error(`Não consegui reservar a proposta: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * O DESFECHO DA EXECUÇÃO ATÔMICA DE PESO — migração 045.
 *
 * `ok`             gravou, e a proposta já está `executada` (mesma transação)
 * `nada_gravado`   nenhuma linha elegível; a proposta CONTINUA `pendente`
 * qualquer outro   recusa; nada foi gravado e o status não mudou
 */
export type DesfechoDoPesoAtomico =
  | "ok"
  | "nada_gravado"
  | "ja_executada"
  | "status_invalido"
  | "outro_tenant"
  | "nao_encontrada"
  | "tipo_invalido"
  | "sem_alvos";

/**
 * Executa uma Proposal de PESO em UMA transação: trava a proposta, grava e só
 * então marca `executada`.
 *
 * ===========================================================================
 * POR QUE ISTO NÃO É `reservarParaExecucao` + `gravar`
 * ===========================================================================
 *
 * Aquele par marcava `executada` ANTES de gravar, em transação separada. Uma
 * morte no intervalo deixava a proposta consumida, o catálogo intacto e o
 * lojista sendo informado de que a gravação ocorreu — ver INC-002, camada 5.
 *
 * Aqui a transição de status é a ÚLTIMA escrita da MESMA transação que faz a
 * mutação. `executada` passa a implicar mutação commitada, por construção.
 *
 * ===========================================================================
 * DOIS PARÂMETROS, E SÓ
 * ===========================================================================
 *
 * `valor`, `alvos` e `idsAprovados` NÃO viajam daqui: a função os lê da linha
 * persistida, sob lock. Mandá-los permitiria combinar "esta proposta com outro
 * peso" — a autorização passaria a ser o argumento em vez do objeto aprovado.
 *
 * `clienteId` é a exceção obrigatória: vem da SESSÃO e é CONFERIDO contra a
 * proposta. Ele não autoriza; ele recusa.
 */
export async function executarPesoAtomico(
  propostaId: string,
  clienteId: string
): Promise<{ motivo: DesfechoDoPesoAtomico; afetados: number; elegiveis: number }> {
  const { data, error } = await getSupabaseAdmin().rpc("copilot_executar_peso", {
    p_proposta: propostaId,
    p_cliente: clienteId,
  });
  // Erro de RPC NÃO vira desfecho de negócio. Lançar é o certo: quem chama tem
  // `catch` e a transação do banco já reverteu tudo — inclusive o status.
  if (error) throw new Error(`Não consegui executar a proposta de peso: ${error.message}`);
  const linha = (Array.isArray(data) ? data[0] : data) as
    | { motivo: string; afetados: number; elegiveis: number }
    | null
    | undefined;
  if (!linha) throw new Error("A execução de peso não devolveu desfecho.");
  return {
    motivo: linha.motivo as DesfechoDoPesoAtomico,
    afetados: Number(linha.afetados ?? 0),
    elegiveis: Number(linha.elegiveis ?? 0),
  };
}

/**
 * O desfecho da execução atômica de CUSTO — migração 046.
 *
 * Mesmas classes da 045, sem `elegiveis`: custo atinge um produto e SUBSTITUI.
 * Não há predicado de "só se estiver vazio", logo não há parcialidade a relatar.
 */
export type DesfechoDoCustoAtomico =
  | "ok"
  | "nada_gravado"
  | "ja_executada"
  | "status_invalido"
  | "outro_tenant"
  | "nao_encontrada"
  | "tipo_invalido"
  | "sem_alvos";

/**
 * Executa uma Proposal de CUSTO em UMA transação: trava a proposta, grava e só
 * então marca `executada`. Mesma forma da 045 — ver `executarPesoAtomico`.
 *
 * `valor` e `alvos` são lidos da linha persistida sob lock; `clienteId` vem da
 * SESSÃO e é conferido contra a proposta.
 */
export async function executarCustoAtomico(
  propostaId: string,
  clienteId: string
): Promise<{ motivo: DesfechoDoCustoAtomico; afetados: number }> {
  const { data, error } = await getSupabaseAdmin().rpc("copilot_executar_custo", {
    p_proposta: propostaId,
    p_cliente: clienteId,
  });
  if (error) throw new Error(`Não consegui executar a proposta de custo: ${error.message}`);
  const linha = (Array.isArray(data) ? data[0] : data) as
    | { motivo: string; afetados: number }
    | null
    | undefined;
  if (!linha) throw new Error("A execução de custo não devolveu desfecho.");
  return { motivo: linha.motivo as DesfechoDoCustoAtomico, afetados: Number(linha.afetados ?? 0) };
}

/**
 * O desfecho da execução atômica de PREÇO — migração 047.
 *
 * Mesmas classes de custo. `elegiveis` não se aplica: um produto, uma linha.
 */
export type DesfechoDoPrecoAtomico = DesfechoDoCustoAtomico;

/**
 * Executa uma Proposal de PREÇO em UMA transação.
 *
 * ===========================================================================
 * O TERCEIRO PARÂMETRO, E POR QUE ELE NÃO ABRE A BRECHA QUE A 045 FECHOU
 * ===========================================================================
 *
 * A escrita toca DUAS colunas — `preco_venda` e `margem` — e a margem NÃO está
 * na Proposal. Ela é `margemLiquida(custo, preco, taxas)`, calculada em
 * TypeScript sobre o modelo de tarifas do ML. Portar isso para SQL criaria duas
 * implementações da mesma conta.
 *
 * `valor` e `alvos` continuam vindo da Proposal, sob lock. A distinção é:
 *
 *   `valor`  é o FATO AUTORIZADO — o lojista aprovou aquele preço. Passá-lo por
 *            parâmetro permitiria "esta proposta com outro preço".
 *   `margem` NÃO é autorizada por ninguém. É subproduto do cálculo, não é
 *            precondição, não é revalidada, e não decide nada — nem aqui nem na
 *            função SQL, onde aparece uma única vez, no SET do UPDATE.
 *
 * `null` é legítimo: a margem nem sempre é calculável, e a coluna aceita.
 */
export async function executarPrecoAtomico(
  propostaId: string,
  clienteId: string,
  margem: number | null
): Promise<{ motivo: DesfechoDoPrecoAtomico; afetados: number }> {
  const { data, error } = await getSupabaseAdmin().rpc("copilot_executar_preco", {
    p_proposta: propostaId,
    p_cliente: clienteId,
    p_margem: margem,
  });
  if (error) throw new Error(`Não consegui executar a proposta de preço: ${error.message}`);
  const linha = (Array.isArray(data) ? data[0] : data) as
    | { motivo: string; afetados: number }
    | null
    | undefined;
  if (!linha) throw new Error("A execução de preço não devolveu desfecho.");
  return { motivo: linha.motivo as DesfechoDoPrecoAtomico, afetados: Number(linha.afetados ?? 0) };
}

/**
 * O desfecho da execução atômica de TÍTULO — migração 048.
 *
 * `sem_texto` é próprio deste tipo: uma proposta de título sem título não é
 * executável, e o caminho antigo lançava. Aqui vira desfecho, e a proposta
 * continua `pendente` em vez de queimar.
 */
export type DesfechoDoTituloAtomico = DesfechoDoCustoAtomico | "sem_texto";

/**
 * Executa uma Proposal de TÍTULO em UMA transação.
 *
 * Dois parâmetros, como as 045 e 046: o título proposto está na Proposal, em
 * `texto`, e o alvo em `alvos[0]` — que aqui é o ID DO ANÚNCIO, não do produto.
 *
 * O merge do jsonb acontece no banco (`jsonb_set` numa chave de topo), que é a
 * mesma substituição que `{ ...atual, tituloOtimizado: titulo }` fazia. Não é
 * porte de regra de negócio: é a mesma operação estrutural, escrita onde o dado
 * mora.
 */
/**
 * A execução atômica do TEXTO do anúncio — descrição e palavras-chave.
 *
 * Uma função para os dois, como a do banco: eles gravam na mesma linha e
 * percorrem a mesma transição. Qual chave do jsonb é tocada, a função decide
 * pelo `tipo` da proposta persistida — não por parâmetro daqui, que poderia
 * divergir do que a lojista confirmou.
 */
export async function executarTextoAtomico(
  propostaId: string,
  clienteId: string
): Promise<{ motivo: DesfechoDoTituloAtomico; afetados: number }> {
  const { data, error } = await getSupabaseAdmin().rpc("copilot_executar_texto_do_anuncio", {
    p_proposta: propostaId,
    p_cliente: clienteId,
  });
  if (error) throw new Error(`Não consegui executar a proposta de texto: ${error.message}`);
  const linha = (Array.isArray(data) ? data[0] : data) as
    | { motivo: string; afetados: number }
    | null
    | undefined;
  if (!linha) throw new Error("A execução de texto não devolveu desfecho.");
  return { motivo: linha.motivo as DesfechoDoTituloAtomico, afetados: Number(linha.afetados ?? 0) };
}

export async function executarTituloAtomico(
  propostaId: string,
  clienteId: string
): Promise<{ motivo: DesfechoDoTituloAtomico; afetados: number }> {
  const { data, error } = await getSupabaseAdmin().rpc("copilot_executar_titulo", {
    p_proposta: propostaId,
    p_cliente: clienteId,
  });
  if (error) throw new Error(`Não consegui executar a proposta de título: ${error.message}`);
  const linha = (Array.isArray(data) ? data[0] : data) as
    | { motivo: string; afetados: number }
    | null
    | undefined;
  if (!linha) throw new Error("A execução de título não devolveu desfecho.");
  return { motivo: linha.motivo as DesfechoDoTituloAtomico, afetados: Number(linha.afetados ?? 0) };
}

/** Marca o desfecho quando a execução reservada não deu certo. */
export async function marcarProposta(
  id: string,
  status: Extract<StatusProposta, "falhou" | "obsoleta" | "rejeitada" | "expirada">,
  erro?: string
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("copilot_propostas")
    .update({
      status,
      decidida_em: new Date().toISOString(),
      ...(erro ? { erro: erro.slice(0, 500) } : {}),
    })
    .eq("id", id);
  // NÃO LANÇA, de propósito: quem chama isto já recusou ou já falhou, e uma
  // exceção aqui trocaria uma recusa correta por um 500. Mas o desfecho precisa
  // aparecer: sem esta linha, uma proposta que deveria ficar `expirada` seguia
  // `pendente` para sempre, e nada em lugar nenhum dizia por quê.
  if (error) console.error(`[copilot] falha ao marcar proposta ${id} como ${status}:`, error);
}

// ---------- auditoria ----------

export interface AcaoDoCopilot {
  clienteId: string;
  conversaId: string | null;
  propostaId: string | null;
  executadaPor: string | null;
  ferramenta: string;
  alvos: readonly string[];
  antes: unknown;
  depois: unknown;
  resultado: "sucesso" | "parcial" | "falhou" | "recusada";
  afetados: number;
  erro?: string;
}

/**
 * Registra a ação — inclusive as RECUSADAS.
 *
 * Uma recusa é informação de segurança: proposta de outro tenant, proposta
 * obsoleta e confirmação duplicada só aparecem no rastro se forem gravadas.
 * Auditar só o sucesso registraria exatamente o que não precisa ser
 * investigado.
 *
 * Nunca lança: um erro de auditoria não pode derrubar uma gravação que já
 * aconteceu, nem transformar uma recusa correta em erro de servidor. Falha vai
 * para o log do servidor, onde é vista.
 */
export async function registrarAcao(a: AcaoDoCopilot): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("copilot_acoes")
      .insert({
        cliente_id: a.clienteId,
        conversa_id: a.conversaId,
        proposta_id: a.propostaId,
        executada_por: a.executadaPor,
        ferramenta: a.ferramenta,
        alvos: a.alvos,
        antes: a.antes ?? null,
        depois: a.depois ?? null,
        resultado: a.resultado,
        afetados: a.afetados,
        erro: a.erro?.slice(0, 500) ?? null,
      });
    // O comentário acima prometia o log e o `catch` não podia cumprir: erro de
    // banco vem em `{ error }`, não como exceção. Uma escrita consumada podia
    // ficar SEM linha de auditoria sem que nada registrasse a ausência — numa
    // tabela cuja razão de existir é ser a prova de que algo aconteceu.
    if (error) console.error("[copilot] falha ao auditar (a ação em si NÃO foi revertida):", error);
  } catch (e) {
    console.error("[copilot] falha ao auditar (a ação em si NÃO foi revertida):", e);
  }
}
