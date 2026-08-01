// Worker da fila de otimização — SOMENTE SERVIDOR.
//
// Disparado pelo Vercel Cron (a cada minuto). Consome a
// fila_otimizacao_produto: pega os pendentes, roda a esteira (Gemini) e grava
// o anúncio. Usa a chave service_role (ignora RLS) porque não há sessão de
// usuário. Processa em pequenos grupos paralelos até acabar o orçamento de
// tempo da função.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import {
  ESQUEMA_ANUNCIO,
  comAGradeDoCadastro,
  montarSystemPromptEsteira,
  type AnuncioDaIA,
  type AnuncioGerado,
} from "@/lib/agentes/esteira";
import {
  briefingDaGrade,
  montarVariacoes,
} from "@/modules/publication/domain/variacoesDoAnuncio";
import {
  atributosPorId,
  briefingDosAtributos,
  resolverObrigatorios,
} from "@/modules/publication/domain/atributosDoMarketplace";
import { chamarIAEstruturada, provedorConfigurado } from "@/lib/agentes/provedorIA";
import { montarContexto } from "@/lib/contexto";
import {
  produtoParaApp,
  varianteParaApp,
  tabelaMedidaParaApp,
  anuncioGeradoParaBanco,
} from "@/lib/supabase/mappers";
import type {
  ProdutoRow,
  ProdutoVarianteRow,
  TabelaMedidaRow,
} from "@/lib/supabase/database.types";
import type { Produto, ProdutoVariante, TabelaMedida } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300; // Vercel Pro
export const dynamic = "force-dynamic";

const CONCORRENCIA = 1; // 1 por vez — a esteira é pesada e a quota do Gemini é por minuto
const PAUSA_MS = 2_000; // respiro entre itens (suaviza o rate limit)
const ORCAMENTO_MS = 250_000; // para antes dos 300s
const MAX_TENTATIVAS = 3;
const STALE_MIN = 10; // "processando" preso volta pra fila

type Resultado = "ok" | "erro" | "rate";

/**
 * A classe do INC-004, aqui.
 *
 * `supabase-js` NÃO LANÇA em erro de banco: devolve `{ data, error }`. Quem
 * escreve `await admin.from(...).update(...)` sem capturar o retorno recebe uma
 * Promise que resolve com sucesso mesmo quando o Postgres recusou a linha — e o
 * `try/catch` em volta nunca é atingido.
 *
 * Neste arquivo isso é pior do que no Copilot: o cron roda sozinho, de
 * madrugada, sem ninguém na tela. Uma escrita de status recusada não vira erro,
 * não vira log e não vira sintoma — vira anúncio duplicado três ciclos depois.
 *
 * A mensagem carrega a CONSEQUÊNCIA, não só a etapa: quem for ler isso às 3h da
 * manhã precisa saber o que já aconteceu, não em que linha estava.
 */
function erroDeEscrita(etapa: string, consequencia: string, erro: unknown): void {
  console.error(`[otimizar] ${etapa} — ${consequencia}:`, erro);
}

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

/**
 * Roda a esteira e devolve o anúncio. O Gemini às vezes corta o JSON no meio
 * ("Unterminated string") — como é não-determinístico, tentamos de novo antes
 * de desistir. Erros de rede/quota (429) NÃO são engolidos aqui: sobem para o
 * chamador tratar (backoff/requeue).
 */
async function gerarAnuncio(
  produto: Produto,
  variantes: ProdutoVariante[],
  tabelasMedidas: TabelaMedida[],
  atributosDoProduto: readonly { nomeAtributo: string; valorAtributo: string }[]
): Promise<AnuncioGerado> {
  // A grade sai do CADASTRO, não do modelo. Este caminho é o do lote — o mais
  // silencioso dos quatro: ninguém está olhando a tela quando ele roda.
  const grade = montarVariacoes(variantes, produto.precoVenda);

  // Os 6 obrigatórios do ML, resolvidos — DES-002 D6.
  //
  // O worker NÃO recebia este briefing; só `/cliente/anunciar` recebia. Era
  // justamente o caminho silencioso rodando com menos contexto que o da tela.
  //
  // E agora eles são resolvidos também contra `produto_atributos`, o que a
  // lojista informou ao ML. Antes gênero e tipo de calçado só podiam ser
  // adivinhados do NOME do produto; agora há valor medido, e medido vence
  // adivinhado.
  const briefingAtributos = briefingDosAtributos(
    resolverObrigatorios(
      {
        nome: produto.nome,
        marca: produto.marca,
        modelo: produto.modelo,
        cores: [...new Set(variantes.map((v) => v.cor).filter(Boolean))],
        tamanhos: [...new Set(variantes.map((v) => v.tamanho).filter(Boolean))],
      },
      atributosPorId(atributosDoProduto)
    )
  );

  const mensagem = montarMensagem(
    [
      montarContexto({ produto, variantes, tabelasMedidas, atributosObrigatorios: briefingAtributos }),
      briefingDaGrade(grade),
    ].join("\n\n")
  );
  let ultimoParse = "";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const { json } = await chamarIAEstruturada({
      system: montarSystemPromptEsteira(),
      mensagem,
      schema: ESQUEMA_ANUNCIO,
      maxTokens: 24000,
    });
    try {
      return comAGradeDoCadastro(JSON.parse(json) as AnuncioDaIA, grade);
    } catch (e) {
      ultimoParse = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`IA devolveu JSON inválido após 3 tentativas: ${ultimoParse}`);
}

/** Tabelas de medidas do cliente, com cache por cliente dentro da execução. */
async function tabelasDoCliente(
  admin: SupabaseClient,
  clienteId: string,
  cache: Map<string, TabelaMedida[]>
): Promise<TabelaMedida[]> {
  const emCache = cache.get(clienteId);
  if (emCache) return emCache;
  const { data } = await admin.from("tabelas_medidas").select("*").eq("cliente_id", clienteId);
  const tabelas = ((data ?? []) as TabelaMedidaRow[]).map(tabelaMedidaParaApp);
  cache.set(clienteId, tabelas);
  return tabelas;
}

async function processarUm(
  admin: SupabaseClient,
  fila: FilaRow,
  cacheTabelas: Map<string, TabelaMedida[]>
): Promise<Resultado> {
  try {
    const { data: prodRow } = await admin
      .from("produtos")
      .select("*, clientes(empresa)")
      .eq("id", fila.produto_id)
      .maybeSingle();
    if (!prodRow) throw new Error("Produto não encontrado.");

    const produto = produtoParaApp(prodRow as ProdutoRow);
    const { data: varRows } = await admin
      .from("produto_variantes")
      .select("*")
      .eq("produto_id", fila.produto_id);
    const variantes = ((varRows ?? []) as ProdutoVarianteRow[]).map(varianteParaApp);
    const tabelas = await tabelasDoCliente(admin, fila.cliente_id, cacheTabelas);

    // A ficha que veio do marketplace (DES-002). Sem `error` checado de
    // propósito: um atributo que não chega deixa o briefing como era antes —
    // pior contexto, nunca contexto errado. Falhar a esteira inteira por causa
    // de um enriquecimento ausente seria trocar um bom anúncio por nenhum.
    const { data: atrRows } = await admin
      .from("produto_atributos")
      .select("nome_atributo, valor_atributo")
      .eq("produto_id", fila.produto_id);
    const atributosDoProduto = ((atrRows ?? []) as { nome_atributo: string; valor_atributo: string | null }[])
      .map((r) => ({ nomeAtributo: r.nome_atributo, valorAtributo: r.valor_atributo ?? "" }));

    const anuncio = await gerarAnuncio(produto, variantes, tabelas, atributosDoProduto);
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

    const { error: erroConcluir } = await admin
      .from("fila_otimizacao_produto")
      .update({ status: "concluido", anuncio_id: ins?.id ?? null, erro: "" })
      .eq("id", fila.id);
    // A pior das cinco. O anúncio JÁ foi inserido; se o carimbo de concluído não
    // grava, o item fica em `processando`, a reciclagem de 10 min o devolve à
    // fila e a esteira roda de novo — anúncio DUPLICADO e quota queimada, sem
    // uma linha dizendo por quê.
    if (erroConcluir) {
      erroDeEscrita(
        "marcar concluido",
        `o anúncio ${ins?.id ?? "?"} foi criado mas o item segue \`processando\`: a reciclagem vai devolvê-lo à fila e gerar um anúncio duplicado`,
        erroConcluir
      );
    }
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao otimizar.";
    // Rate limit: devolve pra fila SEM gastar tentativa — o próximo ciclo do
    // cron retoma quando a quota do minuto renovar.
    if (ehRateLimit(msg)) {
      const { error: erroRequeue } = await admin
        .from("fila_otimizacao_produto")
        .update({ status: "pendente", erro: msg.slice(0, 500) })
        .eq("id", fila.id);
      // A mais branda: o item fica `processando` até a reciclagem de 10 min
      // pegá-lo. É atraso, não perda — mas invisível, e some no meio de uma
      // fila que parece estar andando.
      if (erroRequeue) {
        erroDeEscrita(
          "devolver à fila (rate limit)",
          "o item fica `processando` até a reciclagem de 10 min: atraso, não perda",
          erroRequeue
        );
      }
      return "rate";
    }
    const novaTent = fila.tentativas + 1;
    // Retenta (volta pra "pendente") até MAX_TENTATIVAS; depois desiste ("erro").
    const { error: erroTentativa } = await admin
      .from("fila_otimizacao_produto")
      .update({
        status: novaTent >= MAX_TENTATIVAS ? "erro" : "pendente",
        erro: msg.slice(0, 500),
        tentativas: novaTent,
      })
      .eq("id", fila.id);
    // Se ESTA falha, `tentativas` não incrementa. O item volta pela reciclagem,
    // falha de novo, e nunca alcança MAX_TENTATIVAS: retenta para sempre, com
    // um produto que provavelmente não tem conserto.
    if (erroTentativa) {
      erroDeEscrita(
        "registrar tentativa",
        `\`tentativas\` continua em ${fila.tentativas}: o item retenta indefinidamente sem nunca chegar a MAX_TENTATIVAS`,
        erroTentativa
      );
    }
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
  const { error: erroReciclar } = await admin
    .from("fila_otimizacao_produto")
    .update({ status: "pendente" })
    .eq("status", "processando")
    .lt("updated_at", new Date(Date.now() - STALE_MIN * 60_000).toISOString());
  // Esta é a rede de segurança de todas as outras. Se ela falha calada, os itens
  // travados ficam travados para sempre e a fila para de andar — sem erro,
  // sem alarme, só um número que não sobe.
  if (erroReciclar) {
    erroDeEscrita(
      "reciclar presos",
      "itens travados em `processando` continuam travados: a fila para de andar em silêncio",
      erroReciclar
    );
  }

  let ok = 0;
  let falhas = 0;
  let rate = false;
  const cacheTabelas = new Map<string, TabelaMedida[]>();
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
    //
    // Esta trava é LOAD-BEARING, e mais do que parece: o orçamento é de 250s e o
    // cron dispara a cada 60s — até quatro execuções se sobrepõem. Sem a trava,
    // todas selecionam os mesmos `pendente` e rodam a esteira sobre o mesmo
    // produto.
    //
    // Por isso, aqui, avisar não basta: se a trava não pegou, este ciclo PARA.
    // Os itens continuam `pendente` e o próximo cron os retoma — nada se perde.
    // É `break` e não `continue` de propósito: `continue` reselecionaria os
    // mesmos itens e giraria até o orçamento acabar.
    const { error: erroTravar } = await admin
      .from("fila_otimizacao_produto")
      .update({ status: "processando" })
      .in("id", lote.map((f) => f.id));
    if (erroTravar) {
      erroDeEscrita(
        "travar o lote",
        "sem a trava, execuções sobrepostas do cron pegariam os mesmos itens e gerariam anúncios duplicados — este ciclo para aqui",
        erroTravar
      );
      break;
    }

    const res = await Promise.all(lote.map((f) => processarUm(admin, f, cacheTabelas)));
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
