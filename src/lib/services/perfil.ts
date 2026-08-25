// Perfil do usuário logado (equipe x cliente) + leituras read-only do Portal.
//
// Sem Supabase (modo demo) → sempre equipe (o portal é recurso do Supabase).
// A segurança real está nas políticas RLS e nas funções portal_* do banco
// (migração 005); aqui é só o consumo.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerPapel, type PapelPerfil } from "../auth/roteamentoPapel";
import { argumentoDaLoja } from "../contexto/lojaEmOperacao";

export interface Perfil {
  papel: PapelPerfil;
  clienteId: string | null;
  /** Preenchido só quando `papel === "agencia"`. */
  agenciaId?: string | null;
  nome: string;
}

const EQUIPE: Perfil = { papel: "equipe", clienteId: null, agenciaId: null, nome: "" };

/**
 * Perfil do usuário logado. NEGA POR PADRÃO (R1):
 *   * modo demo (sem Supabase)         -> equipe (não há login no demo)
 *   * sem sessão / sem perfil / inativo -> null (SEM ACESSO)
 *   * erro real de banco/rede           -> propaga (o AuthGate trata),
 *     NUNCA vira "equipe" silenciosamente.
 *
 * O corte de acesso de verdade é o RLS (migração 016); aqui é só a leitura
 * para a casca decidir qual portal mostrar (e barrar quem não tem perfil).
 */
export async function meuPerfil(): Promise<Perfil | null> {
  if (!supabaseConfigurado) return EQUIPE; // demo: sem Auth, tudo é equipe
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null; // não autenticado = sem acesso
  const { data, error } = await sb
    .from("perfis")
    .select("papel, cliente_id, agencia_id, nome, ativo")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error; // erro real sobe — não vira acesso indevido
  if (!data) return null; // sem perfil = SEM ACESSO (antes era equipe)
  if (data.ativo === false) return null; // perfil inativo = SEM ACESSO
  // Papel irreconhecível = SEM ACESSO, pela mesma regra das duas linhas acima.
  // Antes ele virava "equipe" — o mais privilegiado. Ver `lerPapel`.
  const papel = lerPapel(data.papel);
  if (!papel) return null;
  return {
    papel,
    clienteId: (data.cliente_id as string | null) ?? null,
    agenciaId: (data.agencia_id as string | null) ?? null,
    nome: (data.nome as string | null) ?? "",
  };
}

/**
 * Resultado DETALHADO da carga do perfil, para o AuthGate distinguir os
 * estados (A-01): sem sessão × sem perfil × inativo × ok. **Lança** em erro
 * real (rede/banco) — o chamador classifica como "erro temporário", nunca
 * como "sem acesso". Não confunde falha com ausência de permissão.
 */
export type CargaPerfil =
  | { tipo: "sem_sessao" }
  | { tipo: "sem_perfil" }
  | { tipo: "inativo" }
  | { tipo: "ok"; perfil: Perfil };

export async function carregarPerfil(): Promise<CargaPerfil> {
  if (!supabaseConfigurado) return { tipo: "ok", perfil: EQUIPE }; // demo
  const sb = getSupabase();
  const { data: auth, error: erroAuth } = await sb.auth.getUser();
  if (erroAuth) throw erroAuth; // erro de auth (rede/servidor) → temporário
  if (!auth.user) return { tipo: "sem_sessao" }; // sessão ausente/expirada
  const { data, error } = await sb
    .from("perfis")
    .select("papel, cliente_id, agencia_id, nome, ativo")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error; // erro de banco → temporário (não "sem acesso")
  if (!data) return { tipo: "sem_perfil" };
  if (data.ativo === false) return { tipo: "inativo" };
  // Papel irreconhecível cai no MESMO desfecho de "sem perfil": o AuthGate já
  // sabe desenhar essa tela, e inventar um estado novo aqui só adiaria a
  // decisão. Ver `lerPapel` — antes isto virava "equipe".
  const papel = lerPapel(data.papel);
  if (!papel) return { tipo: "sem_perfil" };
  return {
    tipo: "ok",
    perfil: {
      papel,
      clienteId: (data.cliente_id as string | null) ?? null,
      agenciaId: (data.agencia_id as string | null) ?? null,
      nome: (data.nome as string | null) ?? "",
    },
  };
}

// ---- Leituras do Portal (via funções portal_* do banco) ----

export interface PortalResumo {
  cliente: string | null;
  proximaAcao: string | null;
  totalProdutos: number;
  emProducao: number;
  aprovados: number;
  publicados: number;
}

export interface PortalAcao {
  tarefa: string;
  proxima_acao: string;
  status: string;
  prazo: string | null;
}

export interface PortalAnuncio {
  titulo: string;
  status: string;
  criado_em: string;
}

export async function portalResumo(): Promise<PortalResumo | null> {
  const { data } = await getSupabase().rpc("portal_resumo");
  return (data as PortalResumo) ?? null;
}

export async function portalProximasAcoes(): Promise<PortalAcao[]> {
  const { data } = await getSupabase().rpc("portal_proximas_acoes");
  return (data as PortalAcao[]) ?? [];
}

export async function portalAnuncios(): Promise<PortalAnuncio[]> {
  const { data } = await getSupabase().rpc("portal_anuncios");
  return (data as PortalAnuncio[]) ?? [];
}

// ---- Cota mensal da esteira (self-service) ----

export interface QuotaEsteira {
  limite: number;
  usado: number;
  restante: number;
}

/**
 * A cota do mês — ou `null` quando NÃO CONSEGUIMOS LER.
 *
 * ===========================================================================
 * O DEFEITO QUE ESTA ASSINATURA CONSERTA — medido em 17/08/2026
 * ===========================================================================
 *
 * O `catch` devolvia `{limite:0, usado:0, restante:0}`. A tela de otimização
 * calculava `semCota = Boolean(quota) && restante <= 0`, e um objeto verdadeiro
 * com restante zero dava `true`: uma falha de rede mostrava "você usou todas as
 * otimizações do seu plano este mês", **bloqueava o botão Gerar** e mandava a
 * lojista falar com a Zion.
 *
 * Falha de leitura virava parede comercial. `null` é a única resposta honesta
 * quando não se leu, e quem consome decide — ver `estadoDaCota`, que é
 * fail-open de propósito.
 *
 * ===========================================================================
 * O `clienteId` VEIO DA OUTRA PONTA, NA MESCLA DE 24/08/2026
 * ===========================================================================
 *
 * Ele é a sobrecarga da 064: agência e equipe operam a cota de OUTRA loja, e
 * `argumentoDaLoja` decide entre a chamada com loja e a de sempre.
 *
 * As duas convivem porque respondem a perguntas diferentes — uma é a ENTRADA
 * (de qual loja é a cota), a outra é a honestidade da SAÍDA. Ficar com um lado
 * só apagaria um conserto que tem teste vivo e domínio construído em cima.
 */
export async function quotaEsteira(clienteId?: string | null): Promise<QuotaEsteira | null> {
  if (!supabaseConfigurado) return { limite: 30, usado: 0, restante: 30 };
  try {
    // Com loja em operação (agência/equipe), a sobrecarga da 064; senão a de sempre.
    const { data, error } = await getSupabase().rpc("quota_esteira", argumentoDaLoja(clienteId));
    // `error` sem exceção também é falha: o Supabase devolve o erro no objeto,
    // e ignorá-lo era a metade silenciosa do mesmo defeito.
    if (error) return null;
    const limite = Number((data as { limite?: number })?.limite ?? NaN);
    const usado = Number((data as { usado?: number })?.usado ?? NaN);
    if (!Number.isFinite(limite) || !Number.isFinite(usado)) return null;
    return { limite, usado, restante: Math.max(0, limite - usado) };
  } catch {
    return null;
  }
}
