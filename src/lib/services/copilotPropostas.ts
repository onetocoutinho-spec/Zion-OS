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

/** Marca o desfecho quando a execução reservada não deu certo. */
export async function marcarProposta(
  id: string,
  status: Extract<StatusProposta, "falhou" | "obsoleta" | "rejeitada" | "expirada">,
  erro?: string
): Promise<void> {
  await getSupabaseAdmin()
    .from("copilot_propostas")
    .update({
      status,
      decidida_em: new Date().toISOString(),
      ...(erro ? { erro: erro.slice(0, 500) } : {}),
    })
    .eq("id", id);
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
    await getSupabaseAdmin()
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
  } catch (e) {
    console.error("[copilot] falha ao auditar (a ação em si NÃO foi revertida):", e);
  }
}
