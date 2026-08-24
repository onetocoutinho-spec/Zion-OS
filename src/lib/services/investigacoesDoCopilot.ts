// AS INVESTIGAÇÕES do Copilot, no SERVIDOR. ⚠️ Server-only.
//
// Tabela `copilot_investigacoes` (migração 071). Escrita só por aqui, com o
// tenant da sessão — o navegador tem SELECT por RLS e nada mais, pelo mesmo
// motivo das outras tabelas do copiloto: um cliente que escreve o próprio
// contexto escreve o que o modelo vai ler.
//
// DEGRADAÇÃO DECLARADA: enquanto a 071 não for aplicada, toda função aqui
// devolve `null`/silêncio e avisa UMA vez no log. O chat continua funcionando
// exatamente como antes — sem investigação, com os seis passos de sempre. Uma
// funcionalidade nova que derruba o que já existia é pior que uma ausente.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  lerAchados,
  montarAchado,
  type Achado,
  type Investigacao,
} from "@/modules/assistant/domain/investigacao";

let avisouAusencia = false;

/** `true` quando o erro é "a tabela não existe" — a 071 não foi aplicada. */
function tabelaAusente(error: { code?: string } | null): boolean {
  if (error?.code !== "42P01") return false;
  if (!avisouAusencia) {
    avisouAusencia = true;
    console.error(
      "[copilot_investigacoes] a tabela não existe — aplique database/migrations/071-as-investigacoes-do-copilot.sql"
    );
  }
  return true;
}

interface LinhaDoBanco {
  id: string;
  cliente_id: string;
  conversa_id: string | null;
  pergunta: string;
  status: string;
  rodadas: number;
  achados: unknown;
  proximo_passo: string | null;
}

function paraDominio(l: LinhaDoBanco): Investigacao {
  return {
    id: l.id,
    clienteId: l.cliente_id,
    conversaId: l.conversa_id,
    pergunta: l.pergunta,
    status: l.status === "concluida" || l.status === "abandonada" ? l.status : "aberta",
    rodadas: typeof l.rodadas === "number" ? l.rodadas : 0,
    achados: lerAchados(l.achados),
    proximoPasso: l.proximo_passo ?? "",
  };
}

const CAMPOS = "id, cliente_id, conversa_id, pergunta, status, rodadas, achados, proximo_passo";

/** A investigação ABERTA desta conversa. `null` = não há (ou a 071 não foi aplicada). */
export async function investigacaoAberta(clienteId: string, conversaId: string | null): Promise<Investigacao | null> {
  if (!conversaId) return null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("copilot_investigacoes")
      .select(CAMPOS)
      .eq("cliente_id", clienteId)
      .eq("conversa_id", conversaId)
      .eq("status", "aberta")
      .maybeSingle();
    if (error) {
      if (!tabelaAusente(error)) console.error("[copilot_investigacoes] falha ao ler:", error);
      return null;
    }
    return data ? paraDominio(data as LinhaDoBanco) : null;
  } catch (e) {
    console.error("[copilot_investigacoes] falha ao ler:", e);
    return null;
  }
}

export interface AberturaDeInvestigacao {
  clienteId: string;
  usuarioId: string | null;
  conversaId: string | null;
  pergunta: string;
  proximoPasso: string;
}

/**
 * Abre uma investigação — ou devolve a que já está aberta nesta conversa.
 *
 * O índice único garante uma só aberta por conversa; aqui a corrida perdida
 * não vira erro na cara da lojista: relemos e seguimos com a que venceu. Duas
 * investigações no mesmo fio seriam duas memórias competindo.
 */
export async function abrirInvestigacao(a: AberturaDeInvestigacao): Promise<Investigacao | null> {
  const jaAberta = await investigacaoAberta(a.clienteId, a.conversaId);
  if (jaAberta) return jaAberta;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("copilot_investigacoes")
      .insert({
        cliente_id: a.clienteId,
        usuario_id: a.usuarioId,
        conversa_id: a.conversaId,
        pergunta: a.pergunta.slice(0, 1000),
        proximo_passo: a.proximoPasso.slice(0, 1000),
      })
      .select(CAMPOS)
      .maybeSingle();
    if (error) {
      if (tabelaAusente(error)) return null;
      // 23505 = o índice único pegou uma corrida: alguém abriu primeiro.
      if (error.code === "23505") return investigacaoAberta(a.clienteId, a.conversaId);
      console.error("[copilot_investigacoes] falha ao abrir:", error);
      return null;
    }
    return data ? paraDominio(data as LinhaDoBanco) : null;
  } catch (e) {
    console.error("[copilot_investigacoes] falha ao abrir:", e);
    return null;
  }
}

/**
 * Fecha a rodada: soma +1, guarda o achado e o que falta.
 *
 * O tenant vai no `WHERE` mesmo com o id em mãos — id de investigação de outra
 * loja não pode escrever aqui, e "não encontrada" é a resposta certa para as
 * duas situações.
 *
 * NUNCA lança: um achado perdido é ruim; um turno derrubado por causa dele é
 * pior — e o turno é justamente onde está a resposta da lojista.
 */
export async function fecharRodada(
  investigacao: Investigacao,
  achadoTexto: string,
  ferramentas: readonly string[],
  opcoes: { concluir?: boolean; proximoPasso?: string } = {}
): Promise<void> {
  const achado = montarAchado(investigacao.rodadas + 1, achadoTexto, ferramentas, new Date().toISOString());
  const achados: Achado[] = achado ? [...investigacao.achados, achado] : [...investigacao.achados];
  try {
    const { error } = await getSupabaseAdmin()
      .from("copilot_investigacoes")
      .update({
        rodadas: investigacao.rodadas + 1,
        achados,
        ...(opcoes.proximoPasso !== undefined ? { proximo_passo: opcoes.proximoPasso.slice(0, 1000) } : {}),
        ...(opcoes.concluir ? { status: "concluida" } : {}),
        atualizada_em: new Date().toISOString(),
      })
      .eq("id", investigacao.id)
      .eq("cliente_id", investigacao.clienteId);
    if (error && !tabelaAusente(error)) {
      console.error("[copilot_investigacoes] falha ao fechar rodada:", error);
    }
  } catch (e) {
    console.error("[copilot_investigacoes] falha ao fechar rodada:", e);
  }
}

/** Encerra a investigação sem gastar rodada — "deixa pra lá". */
export async function abandonarInvestigacao(clienteId: string, id: string): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("copilot_investigacoes")
      .update({ status: "abandonada", atualizada_em: new Date().toISOString() })
      .eq("id", id)
      .eq("cliente_id", clienteId);
    if (error && !tabelaAusente(error)) {
      console.error("[copilot_investigacoes] falha ao abandonar:", error);
    }
  } catch (e) {
    console.error("[copilot_investigacoes] falha ao abandonar:", e);
  }
}
