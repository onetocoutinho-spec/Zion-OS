// AS VERSÕES DE IMAGEM — gerar, guardar no bucket privado, assinar a URL,
// aprovar (virar foto do produto). Tabela `imagens_versoes` e bucket
// `imagens-ia` (migração 070). ⚠️ Server-only.
//
// O ciclo que não existia: briefing → gerar → mostrar → feedback →
// gerar DE NOVO a partir da versão anterior, com o feedback como ordem →
// aprovar. Cada passo deixa uma linha; rejeitar não perde nada.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { gerarImagem, provedorDeImagemConfigurado } from "@/lib/agentes/provedorImagem";
import { cronometro, registrarExecucaoIA } from "@/lib/services/execucoesDeIA";
import { perfilDeConteudoNoServidor } from "@/lib/services/perfilDeConteudoNoServidor";
import { registrarDecisaoDoCopilot } from "@/lib/services/decisoesDoCopilot";
import {
  lerBriefing,
  montarBriefing,
  promptDoBriefing,
  type BriefingDeImagem,
  type SlotDeImagem,
} from "@/modules/assistant/domain/briefingDeImagem";

export const BUCKET_PRIVADO = "imagens-ia";
const BUCKET_PUBLICO = "produtos-imagens";
const VALIDADE_DA_URL_S = 60 * 60;
/** Teto de bytes para baixar uma fonte (foto real ou versão anterior). */
const MAXIMO_DA_FONTE = 15 * 1024 * 1024;

export interface VersaoDeImagem {
  id: string;
  clienteId: string;
  produtoId: string;
  paiId: string | null;
  slot: SlotDeImagem;
  briefing: BriefingDeImagem;
  feedback: string | null;
  status: "gerada" | "rejeitada" | "aprovada";
  caminho: string;
  mime: string;
  criadaEm: string;
}

interface Linha {
  id: string;
  cliente_id: string;
  produto_id: string;
  pai_id: string | null;
  slot: string;
  briefing: unknown;
  feedback: string | null;
  status: string;
  caminho: string;
  mime: string;
  criada_em: string;
}

function daLinha(l: Linha): VersaoDeImagem | null {
  const briefing = lerBriefing(l.briefing);
  if (!briefing) return null;
  return {
    id: l.id,
    clienteId: l.cliente_id,
    produtoId: l.produto_id,
    paiId: l.pai_id,
    slot: briefing.slot,
    briefing,
    feedback: l.feedback,
    status: l.status === "aprovada" ? "aprovada" : l.status === "rejeitada" ? "rejeitada" : "gerada",
    caminho: l.caminho,
    mime: l.mime,
    criadaEm: l.criada_em,
  };
}

const COLUNAS = "id, cliente_id, produto_id, pai_id, slot, briefing, feedback, status, caminho, mime, criada_em";

/** Com o tenant: versão de outra loja é `null`, igual a inexistente. */
export async function lerVersao(clienteId: string, id: string): Promise<VersaoDeImagem | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("imagens_versoes")
    .select(COLUNAS)
    .eq("cliente_id", clienteId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? daLinha(data as Linha) : null;
}

export async function urlAssinada(caminho: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET_PRIVADO).createSignedUrl(caminho, VALIDADE_DA_URL_S);
  if (error) {
    console.error("[imagens_versoes] falha ao assinar URL:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Registra o feedback numa versão e a marca rejeitada. Com o tenant. */
export async function rejeitarVersao(clienteId: string, id: string, feedback: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("imagens_versoes")
    .update({ status: "rejeitada", feedback: feedback.trim().slice(0, 400) || null })
    .eq("cliente_id", clienteId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  // O feedback é o sinal mais rico que a loja dá sobre imagem: vira decisão.
  if (feedback.trim()) {
    await registrarDecisaoDoCopilot({
      clienteId, usuarioId: null, entidade: { tipo: "imagem_versao", id },
      campo: "imagem:feedback", valorAnterior: null, valorNovo: feedback.trim(), origem: "copilot:imagem:rejeitar",
    });
  }
}

async function baixar(url: string): Promise<{ base64: string; mime: string }> {
  const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ao baixar a fonte`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > MAXIMO_DA_FONTE) throw new Error("fonte acima do teto");
  return { base64: buf.toString("base64"), mime: r.headers.get("content-type") ?? "image/jpeg" };
}

/** A foto real do produto (a capa, ou a mais recente não pendente). Com o tenant. */
async function fotoDoProduto(clienteId: string, produtoId: string, imagemId?: string): Promise<{ id: string; url: string } | null> {
  let q = getSupabaseAdmin()
    .from("imagens_produto")
    .select("id, url, tipo_imagem, status")
    .eq("cliente_id", clienteId)
    .eq("produto_id", produtoId);
  if (imagemId) q = q.eq("id", imagemId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const fotos = ((data ?? []) as { id: string; url: string; tipo_imagem?: string; status?: string }[])
    .filter((i) => i.status !== "Pendente")
    .sort((a, b) => (a.tipo_imagem === "Principal" ? -1 : b.tipo_imagem === "Principal" ? 1 : 0));
  return fotos[0] ? { id: fotos[0].id, url: fotos[0].url } : null;
}

export type ResultadoDaGeracao =
  | { ok: true; versao: VersaoDeImagem; url: string | null }
  | { ok: false; mensagem: string };

/**
 * GERA uma versão: a fonte é a foto real (primeira da linhagem) ou a versão
 * anterior (quando há feedback). O resultado vai para o bucket PRIVADO, a
 * linha para `imagens_versoes`, e a execução para `ia_execucoes`.
 */
export async function gerarVersaoDeImagem(args: {
  clienteId: string;
  usuarioId: string | null;
  produtoId: string;
  produtoNome: string;
  slot: SlotDeImagem;
  instrucao?: string | null;
  /** A versão recusada da qual partir — o feedback dela entra no briefing. */
  paiId?: string | null;
  feedback?: string | null;
  beneficios?: string | null;
  propostaId?: string | null;
}): Promise<ResultadoDaGeracao> {
  const admin = getSupabaseAdmin();
  const provedor = provedorDeImagemConfigurado();
  if (!provedor) return { ok: false, mensagem: "A geração de imagem por IA não está configurada no servidor." };
  const modelo = provedor === "openai" ? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2" : process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

  // A FONTE. Com pai: a imagem do pai (e o feedback dele se acumula). Sem pai:
  // a foto real — a fidelidade parte dela, nunca de nada.
  let fonte: BriefingDeImagem["fonte"];
  let entrada: { base64: string; mime: string };
  let feedbackAnterior: string[] = [];
  if (args.paiId) {
    const pai = await lerVersao(args.clienteId, args.paiId);
    if (!pai) return { ok: false, mensagem: "Não achei a versão anterior desta imagem." };
    if (args.feedback?.trim()) await rejeitarVersao(args.clienteId, pai.id, args.feedback);
    const url = await urlAssinada(pai.caminho);
    if (!url) return { ok: false, mensagem: "Não consegui ler a versão anterior." };
    entrada = await baixar(url);
    fonte = { tipo: "versao", versaoId: pai.id };
    feedbackAnterior = [...pai.briefing.feedback, ...(pai.feedback ? [pai.feedback] : [])];
  } else {
    const foto = await fotoDoProduto(args.clienteId, args.produtoId);
    if (!foto) return { ok: false, mensagem: "Esse produto ainda não tem foto. A IA melhora uma foto real — ela não inventa o produto." };
    entrada = await baixar(foto.url);
    fonte = { tipo: "foto", imagemId: foto.id };
  }

  const briefing = montarBriefing({
    slot: args.slot,
    produtoNome: args.produtoNome,
    instrucao: args.instrucao,
    feedbackAnterior,
    feedbackNovo: args.paiId ? args.feedback : null,
    fonte,
    beneficios: args.beneficios,
  });
  const perfil = await perfilDeConteudoNoServidor(args.clienteId);
  const prompt = promptDoBriefing(briefing, perfil);

  const relogio = cronometro();
  let saida: { base64: string; mimeType: string };
  try {
    saida = await gerarImagem({ prompt, imagemBase64: entrada.base64, mimeType: entrada.mime });
  } catch (e) {
    await registrarExecucaoIA({
      clienteId: args.clienteId, usuarioId: args.usuarioId, origem: "imagem", provedor, modelo,
      ferramentas: [args.slot], ms: relogio.ms(), status: "erro", erro: e instanceof Error ? e.message : "desconhecido",
    });
    return { ok: false, mensagem: e instanceof Error ? e.message : "Falha ao gerar a imagem." };
  }
  await registrarExecucaoIA({
    clienteId: args.clienteId, usuarioId: args.usuarioId, origem: "imagem", provedor, modelo,
    ferramentas: [args.slot], ms: relogio.ms(), status: "ok",
  });

  // GUARDAR: primeiro o arquivo, depois a linha. Arquivo sem linha é lixo
  // recuperável; linha sem arquivo é uma imagem que não abre.
  const id = crypto.randomUUID();
  const ext = saida.mimeType.includes("jpeg") ? "jpg" : saida.mimeType.includes("webp") ? "webp" : "png";
  const caminho = `${args.clienteId}/${args.produtoId}/${id}.${ext}`;
  const { error: erroUpload } = await admin.storage
    .from(BUCKET_PRIVADO)
    .upload(caminho, Buffer.from(saida.base64, "base64"), { contentType: saida.mimeType, upsert: false });
  if (erroUpload) return { ok: false, mensagem: `Gerei a imagem, mas não consegui guardá-la: ${erroUpload.message}` };

  const { data, error } = await admin
    .from("imagens_versoes")
    .insert({
      id,
      cliente_id: args.clienteId,
      produto_id: args.produtoId,
      pai_id: args.paiId ?? null,
      slot: args.slot,
      briefing,
      status: "gerada",
      provedor,
      modelo,
      caminho,
      mime: saida.mimeType,
      proposta_id: args.propostaId ?? null,
      criada_por: args.usuarioId,
    })
    .select(COLUNAS)
    .single();
  if (error) return { ok: false, mensagem: `Gerei a imagem, mas não consegui registrar a versão: ${error.message}` };
  const versao = daLinha(data as Linha);
  if (!versao) return { ok: false, mensagem: "A versão foi gravada com um briefing ilegível." };
  return { ok: true, versao, url: await urlAssinada(caminho) };
}

/**
 * APROVAR: a versão vira foto do produto — copiada para o bucket PÚBLICO
 * (o Mercado Livre precisa baixar) e registrada em `imagens_produto`.
 */
export async function aprovarVersao(clienteId: string, id: string, comoCapa: boolean): Promise<{ ok: true; imagemId: string; url: string } | { ok: false; mensagem: string }> {
  const admin = getSupabaseAdmin();
  const v = await lerVersao(clienteId, id);
  if (!v) return { ok: false, mensagem: "Não achei essa versão." };
  if (v.status === "aprovada") return { ok: false, mensagem: "Essa versão já foi aprovada." };

  const { data: arquivo, error: erroLeitura } = await admin.storage.from(BUCKET_PRIVADO).download(v.caminho);
  if (erroLeitura || !arquivo) return { ok: false, mensagem: "Não consegui ler o arquivo da versão." };
  const ext = v.caminho.split(".").pop() ?? "png";
  const destino = `${clienteId}/${v.produtoId}/${Date.now()}-ia-${v.slot}.${ext}`;
  const { error: erroCopia } = await admin.storage
    .from(BUCKET_PUBLICO)
    .upload(destino, Buffer.from(await arquivo.arrayBuffer()), { contentType: v.mime, upsert: false });
  if (erroCopia) return { ok: false, mensagem: `Não consegui publicar a imagem: ${erroCopia.message}` };
  const url = admin.storage.from(BUCKET_PUBLICO).getPublicUrl(destino).data.publicUrl;

  // A foto nasce como a tela faria: capa promovida rebaixa a anterior.
  if (comoCapa) {
    await admin.from("imagens_produto").update({ tipo_imagem: "Secundária" }).eq("cliente_id", clienteId).eq("produto_id", v.produtoId).eq("tipo_imagem", "Principal");
  }
  const { data: foto, error: erroFoto } = await admin
    .from("imagens_produto")
    .insert({
      cliente_id: clienteId,
      produto_id: v.produtoId,
      url,
      tipo_imagem: comoCapa ? "Principal" : v.slot === "infografico" || v.slot === "beneficios" ? "Infográfico" : "Secundária",
      status: "Aprovada",
      observacoes: `Gerada pela IA (${v.slot}), versão ${v.id}`,
    })
    .select("id")
    .single();
  if (erroFoto || !foto) return { ok: false, mensagem: `Publiquei o arquivo, mas não consegui registrar a foto: ${erroFoto?.message ?? ""}` };
  await admin.from("imagens_versoes").update({ status: "aprovada", imagem_produto_id: foto.id }).eq("id", v.id).eq("cliente_id", clienteId);
  await registrarDecisaoDoCopilot({
    clienteId, usuarioId: null, entidade: { tipo: "produto", id: v.produtoId },
    campo: `imagem:aprovada:${v.slot}`, valorAnterior: null, valorNovo: v.id, origem: "copilot:imagem:aprovar",
    metadados: { feedbackDaLinhagem: v.briefing.feedback, comoCapa },
  });
  return { ok: true, imagemId: foto.id as string, url };
}
