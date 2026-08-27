// Worker da fila de otimização — SOMENTE SERVIDOR.
//
// Disparado pelo Vercel Cron (a cada minuto). Consome a
// fila_otimizacao_produto: pega os pendentes, roda a esteira (Gemini) e grava
// o anúncio. Usa a chave service_role (ignora RLS) porque não há sessão de
// usuário. Processa em pequenos grupos paralelos até acabar o orçamento de
// tempo da função.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import {
  COLUNAS_DO_PERFIL,
  blocoDoPerfil,
  perfilDaLinha,
  type LinhaDoPerfil,
} from "@/modules/assistant/domain/perfilDeConteudo";
import { decidirAcessoDoCron, type DecisaoCron } from "@/lib/auth/autorizacaoDoCron";
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
  type ExigenciaDaCategoria,
} from "@/modules/publication/domain/atributosDoMarketplace";
import {
  obrigatoriosDoProduto,
  type ProcedenciaDosObrigatorios,
} from "@/modules/publication/domain/obrigatoriosDoProduto";
import { atributosObrigatorios } from "@/lib/marketplaces/mercadolivre";
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

// ZION-CRON-001: a decisão é pura e testada em src/lib/auth/autorizacaoDoCron.ts.
// Aqui só se liga o ambiente a ela. Em produção sem CRON_SECRET a resposta é
// 503 — o worker se declara desligado em vez de aberto.
function autorizado(req: Request): DecisaoCron {
  return decidirAcessoDoCron({
    authorization: req.headers.get("authorization"),
    segredo: process.env.CRON_SECRET,
    vercelEnv: process.env.VERCEL_ENV,
  });
}

function montarMensagem(contexto: string, perfil: string[]): string {
  return [
    "Dados cadastrados no Zion OS para este produto:",
    "",
    contexto,
    // COMO ESTA LOJA VENDE — incluindo o que ela promete.
    //
    // A esteira era o único gerador que NÃO recebia o perfil: `agenteDeTitulo` e
    // `agenteDeDescricao` já o usavam. E é a esteira que roda em lote, sem
    // ninguém na tela — justamente onde uma promessa inventada passa despercebida.
    ...(perfil.length ? ["", ...perfil] : []),
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
  atributosDoProduto: readonly { nomeAtributo: string; valorAtributo: string }[],
  /** O bloco "como esta loja vende", já montado. Vazio quando não há perfil. */
  perfil: string[],
  /**
   * O que a CATEGORIA deste produto exige. Ver INC-011: o retrato de calçado
   * era cobrado de 118 anúncios que não são calçado, e em MLB23332 a exigência
   * de tipo de calçado é uma pendência sobre um campo que não existe lá.
   */
  obrigatorios: readonly ExigenciaDaCategoria[],
  /**
   * Se a lista acima foi MEDIDA na categoria ou é a suposição de calçado. O
   * briefing afirma coisas diferentes nos dois casos — e afirmava a forte nos
   * dois até 26/08/2026.
   */
  procedencia: ProcedenciaDosObrigatorios
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
      obrigatorios,
      atributosPorId(atributosDoProduto)
    ),
    procedencia
  );

  const mensagem = montarMensagem(
    [
      montarContexto({ produto, variantes, tabelasMedidas, atributosObrigatorios: briefingAtributos }),
      briefingDaGrade(grade),
    ].join("\n\n"),
    perfil
  );
  let ultimoParse = "";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const { json, uso } = await chamarIAEstruturada({
      system: montarSystemPromptEsteira(),
      mensagem,
      schema: ESQUEMA_ANUNCIO,
      maxTokens: 24000,
      // O RASTRO ENTRA AQUI, E A RAZÃO PARA ELE NÃO ESTAR ERA FALSA.
      //
      // `rastro` é opcional "porque nem todo chamador tem sessão (o worker do
      // cron, por exemplo)" — provedorIA.ts. Só que `ia_execucoes` nunca pediu
      // sessão: pede `cliente_id`, e aceita `usuario_id` nulo. O worker sempre
      // soube de quem é o produto.
      //
      // Medido em 27/08/2026, no staging: 12 anúncios gerados pela esteira e
      // ZERO linhas em `ia_execucoes`. A maior consumidora de IA do produto era
      // a única invisível para a tabela feita para responder "quanto custou".
      //
      // O `uso` que viaja no JSONB do anúncio (abaixo) não substitui isto: ele
      // só existe quando o parse dá certo, e some quando o anúncio é
      // regerado. As tentativas que falharam custaram e não apareciam em lugar
      // nenhum — inclusive as 3 do laço de retentativa.
      rastro: { origem: "esteira", clienteId: produto.clienteId, usuarioId: null },
    });
    try {
      const gerado = comAGradeDoCadastro(JSON.parse(json) as AnuncioDaIA, grade);
      // O CUSTO VIAJA COM O ANÚNCIO.
      //
      // Vai no próprio JSONB porque é o único lugar em que ele sobrevive sem
      // DDL — e sobreviver importa: em 03/08/2026 a pergunta "quanto custa um
      // dia de operação" só tinha metade da resposta. A SAÍDA dava para medir
      // no banco (4.198 bytes por anúncio); a ENTRADA era estimativa minha.
      //
      // `uso` é da TENTATIVA que deu certo. As tentativas que falharam no
      // parse também custaram, e ficam de fora — a conta sai otimista, e isso
      // está declarado aqui em vez de escondido.
      return { ...gerado, uso: uso ?? null };
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

    // A CATEGORIA MEDIDA, quando ela existe (INC-011).
    //
    // `anuncios_gerados.categoria_ml` guarda o `category_id` que o ML devolveu
    // na importação — é leitura de banco, sem rede, e cobre os produtos que já
    // têm anúncio no ar. Produto novo não tem, e cai no palpite de calçado, que
    // é exatamente o comportamento de antes.
    //
    // Falha do ML não derruba a esteira, pela mesma razão do enriquecimento
    // acima: `atributosObrigatorios` devolve [] quando não responde, e
    // `obrigatoriosDoProduto` trata [] como "não sei", não como "não exige".
    // A DECIDIDA DO PRODUTO VEM PRIMEIRO (migração 079).
    //
    // `anuncios_gerados.categoria_ml` só existe para quem já esteve no ar, e
    // produto vindo de planilha nunca esteve — era 100% do catálogo caindo no
    // palpite de calçado. `produtos.categoria_ml` é onde a decisão da lojista
    // mora, e decisão vence importação vence suposição.
    const { data: catRow } = await admin
      .from("anuncios_gerados")
      .select("categoria_ml")
      .eq("produto_id", fila.produto_id)
      .not("categoria_ml", "is", null)
      .limit(1)
      .maybeSingle();
    const categoria = (produto.categoriaMl ?? "").trim() || (catRow?.categoria_ml ?? "").trim();
    const daCategoria = categoria ? await atributosObrigatorios(categoria) : null;
    // O PERFIL DA LOJA, que carrega tom, palavras e as condições comerciais.
    //
    // Sem `error` checado, pela mesma regra do enriquecimento acima: perfil que
    // não chega deixa o briefing como era — pior contexto, nunca contexto errado.
    const { data: perfilRow } = await admin
      .from("perfis_de_conteudo")
      .select(COLUNAS_DO_PERFIL)
      .eq("cliente_id", fila.cliente_id)
      .maybeSingle();
    const perfil = blocoDoPerfil(perfilDaLinha((perfilRow as LinhaDoPerfil | null) ?? null));

    const { exigencias, procedencia } = obrigatoriosDoProduto(categoria, daCategoria);

    const anuncio = await gerarAnuncio(
      produto,
      variantes,
      tabelas,
      atributosDoProduto,
      perfil,
      exigencias,
      procedencia
    );
    const passouA10 = anuncio.vereditoA10 === "aprovado" && anuncio.pendencias.length === 0;

    const registro = anuncioGeradoParaBanco({
      clienteId: fila.cliente_id,
      produtoId: produto.id,
      produto: produto.nome,
      auditoriaId: null,
      marketplace: produto.marketplace ?? "Mercado Livre",
      // A CATEGORIA QUE SUSTENTOU ESTE ANÚNCIO FICA REGISTRADA NELE.
      //
      // Sem isto, `anuncios_gerados.categoria_ml` saía NULL mesmo quando a
      // esteira tinha uma categoria em mãos — e depois não havia como responder
      // "este anúncio foi feito cobrando os atributos de qual categoria?".
      // Quando não há categoria, continua null: nulo é "ninguém decidiu", e é a
      // resposta certa.
      categoriaMl: categoria || null,
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
  const acesso = autorizado(req);
  if (!acesso.ok) return Response.json({ erro: acesso.motivo }, { status: acesso.status });
  return rodar();
}

export async function POST(req: Request) {
  const acesso = autorizado(req);
  if (!acesso.ok) return Response.json({ erro: acesso.motivo }, { status: acesso.status });
  return rodar();
}
