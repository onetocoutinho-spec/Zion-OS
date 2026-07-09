// Worker da fila de otimização — SOMENTE SERVIDOR.
//
// Disparado pelo Vercel Cron (a cada minuto). Consome a
// fila_otimizacao_produto: pega os pendentes, roda a esteira (Gemini) e grava
// o anúncio. Usa a chave service_role (ignora RLS) porque não há sessão de
// usuário. Processa em pequenos grupos paralelos até acabar o orçamento de
// tempo da função.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { ESQUEMA_ANUNCIO, montarSystemPromptEsteira, type AnuncioGerado } from "@/lib/agentes/esteira";
import { chamarIAEstruturada, provedorConfigurado } from "@/lib/agentes/provedorIA";
import { montarContexto } from "@/lib/contexto";
import { produtoParaApp, anuncioGeradoParaBanco } from "@/lib/supabase/mappers";
import type { ProdutoRow } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300; // Vercel Pro
export const dynamic = "force-dynamic";

const CONCORRENCIA = 1; // 1 por vez — a esteira é pesada e a quota do Gemini é por minuto
const PAUSA_MS = 2_000; // respiro entre itens (suaviza o rate limit)
const ORCAMENTO_MS = 250_000; // para antes dos 300s
const MAX_TENTATIVAS = 3;
const STALE_MIN = 10; // "processando" preso volta pra fila

type Resultado = "ok" | "erro" | "rate";

/** Erro de quota/limite do provedor de IA (recuperável no próximo ciclo). */
function ehRateLimit(msg: string): boolean {
  return /429|resource_exhausted|quota|rate.?limit|exceeded/i.test(msg);
}

interface FilaRow {
  id: string;
  cliente_id: string;
  produto_id: string;
  tentativas: number;
}

function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem secret configurado, libera (dev)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function montarMensagem(contexto: string): string {
  return [
    "Dados cadastrados no Zion OS para este produto:",
    "",
    contexto,
    "",
    "---",
    "",
    "Briefing / instruções adicionais:",
    "Rode a esteira completa com base nos dados acima e entregue o anúncio pronto.",
  ].join("\n");
}

async function processarUm(admin: SupabaseClient, fila: FilaRow): Promise<Resultado> {
  try {
    const { data: prodRow } = await admin
      .from("produtos")
      .select("*, clientes(empresa)")
      .eq("id", fila.produto_id)
      .maybeSingle();
    if (!prodRow) throw new Error("Produto não encontrado.");

    const produto = produtoParaApp(prodRow as ProdutoRow);
    const { json } = await chamarIAEstruturada({
      system: montarSystemPromptEsteira(),
      mensagem: montarMensagem(montarContexto({ produto })),
      schema: ESQUEMA_ANUNCIO,
      maxTokens: 16000,
    });
    const anuncio = JSON.parse(json) as AnuncioGerado;
    const passouA10 = anuncio.vereditoA10 === "aprovado" && anuncio.pendencias.length === 0;

    const registro = anuncioGeradoParaBanco({
      clienteId: fila.cliente_id,
      produtoId: produto.id,
      produto: produto.nome,
      auditoriaId: null,
      marketplace: produto.marketplace ?? "Mercado Livre",
      origem: "esteira",
      tipoExecucao: "IA",
      notaDiagnostico: anuncio.notaDiagnostico,
      vereditoA10: anuncio.vereditoA10,
      qtdPendencias: anuncio.pendencias.length,
      anuncio,
      status: passouA10 ? "aguardando_aprovacao" : "rascunho",
      aprovadoPor: "",
      aprovadoEm: null,
      observacoes: "",
    });
    const { data: ins, error: erroIns } = await admin
      .from("anuncios_gerados")
      .insert(registro)
      .select("id")
      .single();
    if (erroIns) throw new Error(erroIns.message);

    await admin
      .from("fila_otimizacao_produto")
      .update({ status: "concluido", anuncio_id: ins?.id ?? null, erro: "" })
      .eq("id", fila.id);
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao otimizar.";
    // Rate limit: devolve pra fila SEM gastar tentativa — o próximo ciclo do
    // cron retoma quando a quota do minuto renovar.
    if (ehRateLimit(msg)) {
      await admin
        .from("fila_otimizacao_produto")
        .update({ status: "pendente", erro: msg.slice(0, 500) })
        .eq("id", fila.id);
      return "rate";
    }
    const novaTent = fila.tentativas + 1;
    // Retenta (volta pra "pendente") até MAX_TENTATIVAS; depois desiste ("erro").
    await admin
      .from("fila_otimizacao_produto")
      .update({
        status: novaTent >= MAX_TENTATIVAS ? "erro" : "pendente",
        erro: msg.slice(0, 500),
        tentativas: novaTent,
      })
      .eq("id", fila.id);
    return "erro";
  }
}

async function rodar(): Promise<Response> {
  if (!adminConfigurado()) {
    return Response.json({ erro: "SUPABASE_SERVICE_ROLE_KEY não configurada." }, { status: 503 });
  }
  if (!provedorConfigurado()) {
    return Response.json({ erro: "Nenhum provedor de IA configurado." }, { status: 503 });
  }
  const admin = getSupabaseAdmin();
  const inicio = Date.now();

  // Recupera itens presos em "processando" (worker anterior caiu).
  await admin
    .from("fila_otimizacao_produto")
    .update({ status: "pendente" })
    .eq("status", "processando")
    .lt("updated_at", new Date(Date.now() - STALE_MIN * 60_000).toISOString());

  let ok = 0;
  let falhas = 0;
  let rate = false;
  while (Date.now() - inicio < ORCAMENTO_MS) {
    const { data: pend } = await admin
      .from("fila_otimizacao_produto")
      .select("id, cliente_id, produto_id, tentativas")
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(CONCORRENCIA);

    const lote = (pend ?? []) as FilaRow[];
    if (lote.length === 0) break;

    // Trava o lote como "processando" (evita processamento duplo entre execuções).
    await admin
      .from("fila_otimizacao_produto")
      .update({ status: "processando" })
      .in("id", lote.map((f) => f.id));

    const res = await Promise.all(lote.map((f) => processarUm(admin, f)));
    for (const r of res) {
      if (r === "ok") ok++;
      else if (r === "erro") falhas++;
      else rate = true;
    }
    // Bateu na quota do Gemini: para este ciclo e deixa o próximo cron retomar
    // (o item já voltou pra fila). Evita queimar o resto todo com 429.
    if (rate) break;
    await new Promise((r) => setTimeout(r, PAUSA_MS));
  }

  return Response.json({ processados: ok, falhas, rate, ms: Date.now() - inicio });
}

export async function GET(req: Request) {
  if (!autorizado(req)) return new Response("unauthorized", { status: 401 });
  return rodar();
}

export async function POST(req: Request) {
  if (!autorizado(req)) return new Response("unauthorized", { status: 401 });
  return rodar();
}
