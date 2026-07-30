// Persistência do cadastro em conversa — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin (service_role). Nunca no navegador.
//
// A DECISÃO é toda do domínio puro (`draftDeCadastro`), testada sem banco. Aqui
// está só o que precisa ser durável: a linha, a leitura por tenant, e a trava de
// escrita concorrente.
//
// A trava existe por um motivo concreto: o painel e a página do assistente são
// a mesma conversa em duas telas. Duas abas respondendo ao mesmo tempo gravariam
// dois Drafts derivados do mesmo estado, e o segundo apagaria os fatos do
// primeiro em silêncio — que é o pior jeito de perder o que o lojista digitou.

import { getSupabaseAdmin } from "../supabase/admin";
import {
  draftNovo,
  type DraftDeCadastro,
  type EstadoDoDraft,
} from "../../modules/assistant/domain/draftDeCadastro";

/** A forma do jsonb. Sobe quando o domínio mudar a estrutura dos fatos. */
export const FORMATO_ATUAL = 1;

/**
 * Quantos cadastros abertos atravessam para a retomada.
 *
 * Doze é mais do que qualquer lojista tem aberto de verdade, e o suficiente para
 * a lista de escolha nunca mentir por corte. Se um dia alguém tiver mais que
 * isso, o problema não é a lista.
 */
export const LIMITE_DE_ABERTOS = 12;

interface LinhaDeCadastro {
  id: string;
  cliente_id: string;
  conversa_id: string;
  criado_por: string | null;
  status: string;
  fatos: DraftDeCadastro["fatos"] | null;
  variantes: DraftDeCadastro["variantes"] | null;
  conflitos: DraftDeCadastro["conflitos"] | null;
  proposta_id: string | null;
  produto_id: string | null;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

function paraDominio(l: LinhaDeCadastro): DraftDeCadastro {
  return {
    id: l.id,
    clienteId: l.cliente_id,
    conversaId: l.conversa_id,
    criadoPor: l.criado_por,
    status: l.status as EstadoDoDraft,
    fatos: l.fatos ?? {},
    variantes: l.variantes ?? [],
    conflitos: l.conflitos ?? [],
    propostaId: l.proposta_id,
    produtoId: l.produto_id,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
    versao: Number(l.versao),
  };
}

function paraBanco(d: DraftDeCadastro): Record<string, unknown> {
  return {
    cliente_id: d.clienteId,
    conversa_id: d.conversaId,
    criado_por: d.criadoPor,
    status: d.status,
    fatos: d.fatos,
    variantes: d.variantes,
    conflitos: d.conflitos,
    formato: FORMATO_ATUAL,
    proposta_id: d.propostaId,
    produto_id: d.produtoId,
    versao: d.versao,
    atualizado_em: d.atualizadoEm,
  };
}

/**
 * Um Draft vazio, pronto para receber fatos.
 *
 * O ID nasce AQUI e não no banco: o domínio precisa dele para o Draft existir
 * como objeto durante o turno inteiro, antes de qualquer gravação. Um id gerado
 * no INSERT obrigaria a ferramenta a devolver "sem id ainda" no meio da conversa.
 */
export function novoDraft(
  clienteId: string,
  conversaId: string,
  criadoPor: string | null,
  agoraISO: string
): DraftDeCadastro {
  return draftNovo({
    id: crypto.randomUUID(),
    clienteId,
    conversaId,
    criadoPor,
    agoraISO,
  });
}

/**
 * Busca por id, SEM filtrar por cliente — de propósito.
 *
 * Quem compara o tenant é o domínio (`draftVisivelPara`), e ele distingue
 * "não encontrado" de "outro tenant" porque a auditoria precisa registrar a
 * TENTATIVA de acesso cruzado. Filtrar aqui apagaria a distinção e a tentativa
 * viraria um 404 silencioso. A frase devolvida ao lojista é a mesma nos dois
 * casos — é no log que a diferença serve.
 */
export async function buscarDraft(id: string): Promise<DraftDeCadastro | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("copilot_cadastros")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return paraDominio(data as LinhaDeCadastro);
  } catch (e) {
    console.error("[copilot] falha ao buscar cadastro:", e);
    return null;
  }
}

/** Os cadastros abertos deste cliente, do mais recente para o mais antigo. */
export async function draftsAbertos(clienteId: string): Promise<DraftDeCadastro[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("copilot_cadastros")
      .select("*")
      .eq("cliente_id", clienteId)
      .in("status", ["ativo", "pronto_para_finalizar", "aguardando_confirmacao"])
      .order("atualizado_em", { ascending: false })
      .limit(LIMITE_DE_ABERTOS);
    if (error || !data) return [];
    return (data as LinhaDeCadastro[]).map(paraDominio);
  } catch (e) {
    console.error("[copilot] falha ao listar cadastros abertos:", e);
    return [];
  }
}

/**
 * O cadastro aberto DESTA conversa — o que o turno continua.
 *
 * O mais recente quando houver mais de um. Não existe unicidade no banco de
 * propósito (ver 037): um lojista pode cadastrar dois produtos no mesmo fio, e
 * uma constraint transformaria isso num erro sem saída.
 */
export async function draftAbertoDaConversa(
  clienteId: string,
  conversaId: string
): Promise<DraftDeCadastro | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("copilot_cadastros")
      .select("*")
      .eq("cliente_id", clienteId)
      .eq("conversa_id", conversaId)
      .in("status", ["ativo", "pronto_para_finalizar", "aguardando_confirmacao"])
      .order("atualizado_em", { ascending: false })
      .limit(1);
    const linhas = (data ?? []) as LinhaDeCadastro[];
    if (error || linhas.length === 0) return null;
    return paraDominio(linhas[0]);
  } catch (e) {
    console.error("[copilot] falha ao buscar cadastro da conversa:", e);
    return null;
  }
}

/**
 * Grava — e RECUSA gravar por cima de uma versão mais nova.
 *
 * `lt("versao", draft.versao)` é a trava: quem carregou a versão 4, mexeu e
 * tenta gravar a 5 só ganha se a linha ainda estiver em 4 ou menos. Se outra aba
 * já gravou a 6, o UPDATE não pega nenhuma linha, e devolvemos `false` em vez de
 * apagar o trabalho dela.
 *
 * O INSERT é a primeira gravação. Conflito de chave ali significa que a linha
 * apareceu no meio-tempo com versão maior — perdemos a corrida, e perder é o
 * comportamento certo.
 */
export async function salvarDraft(draft: DraftDeCadastro): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const linha = paraBanco(draft);
  try {
    const { data, error } = await admin
      .from("copilot_cadastros")
      .update(linha)
      .eq("id", draft.id)
      .eq("cliente_id", draft.clienteId)
      .lt("versao", draft.versao)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) > 0) return true;

    const { error: erroInsercao } = await admin
      .from("copilot_cadastros")
      .insert({ id: draft.id, criado_em: draft.criadoEm, ...linha });
    if (erroInsercao) {
      // A linha já existe com versão igual ou maior: outra aba gravou depois.
      console.warn("[copilot] cadastro não gravado (versão mais nova no banco):", draft.id);
      return false;
    }
    return true;
  } catch (e) {
    // Perder a gravação do rascunho é ruim; derrubar a resposta que o lojista
    // está esperando por causa disso é pior. Mesma regra de `gravarTurno`.
    console.error("[copilot] falha ao salvar cadastro:", e);
    return false;
  }
}

/**
 * Marca o Draft como criado, apontando para o produto real.
 *
 * Condicionada ao status: `aguardando_confirmacao` é o único estado de onde se
 * chega em `criado`. O CHECK da 037 garante o resto — `criado` sem produto não
 * entra.
 */
export async function marcarDraftCriado(
  id: string,
  clienteId: string,
  produtoId: string,
  agoraISO: string
): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from("copilot_cadastros")
      .update({ status: "criado", produto_id: produtoId, atualizado_em: agoraISO })
      .eq("id", id)
      .eq("cliente_id", clienteId)
      .eq("status", "aguardando_confirmacao");
  } catch (e) {
    // O produto JÁ existe neste ponto. Não reverter nada por causa do rótulo.
    console.error("[copilot] falha ao marcar cadastro como criado:", e);
  }
}
