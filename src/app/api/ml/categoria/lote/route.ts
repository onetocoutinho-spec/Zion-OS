// A categoria do Mercado Livre para o CATÁLOGO INTEIRO, como proposta.
//
// ===========================================================================
// POR QUE EM LOTE, E POR QUE POR TIPO
// ===========================================================================
//
// A rota irmã (`/api/ml/categoria`) responde por um produto. Uma loja que
// acabou de importar tem mil, e perguntar mil vezes é a diferença entre uma
// tela que resolve e uma tela que ninguém termina.
//
// E o preditor do ML erra sozinho. Medido em 201 produtos de uma base real
// (26/08/2026): 7 viraram "Águas Minerais" e 19 caíram na categoria genérica
// "Calçados". Mas os erros não se repetem por TIPO — 11 dos 15 papetes acertam.
// Por isso a proposta sai do voto do grupo, em `categoriaPorTipo`.
//
// ===========================================================================
// SÓ UMA AMOSTRA POR TIPO
// ===========================================================================
//
// Se o grupo decide, não é preciso perguntar por todos: 15 votos bastam para o
// grupo de 245 papetes. Mil consultas viram cerca de 180, e o que se perde é
// nada — o voto seria o mesmo.
//
// ===========================================================================
// SEM TOKEN TAMBÉM FUNCIONA
// ===========================================================================
//
// `domain_discovery` respondeu HTTP 200 sem Authorization em 240+ consultas
// medidas em 26/08/2026. Então a loja que ainda NÃO conectou o Mercado Livre
// também recebe proposta — que é justamente quem mais precisa, porque é quem
// acabou de importar a base. Havendo token, ele é usado: autenticado costuma
// ter limite melhor.
//
// NÃO GRAVA. A resposta é proposta; quem decide é a lojista, na tela. É a mesma
// posição da rota irmã, e o motivo é o mesmo — gravar aqui apagaria o delta
// entre o que o ambiente propôs e o que a pessoa escolheu.

import {
  agruparPorTipo,
  grupoDoProduto,
  type PrevisaoDeCategoria,
} from "@/modules/catalog/domain/categoriaPorTipo";
import { lerCanalServidor, clienteDaCredencial } from "@/modules/integration/infrastructure/canalServidor";
import { renovarToken } from "@/lib/marketplaces/mercadolivre";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { lerTudoPaginado } from "@/lib/supabase/paginado";
import { respostaDeErro } from "@/lib/http/respostaDeErro";

export const maxDuration = 60;

/** Votos que bastam para um grupo. Medido: 11 de 15 papetes já é maioria clara. */
const AMOSTRA_POR_TIPO = 15;

/** Consultas simultâneas ao ML. Baixo de propósito: é a API de outra empresa. */
const SIMULTANEAS = 5;

const API = "https://api.mercadolibre.com";

interface Previsto {
  categoriaId: string;
  nomeCategoria: string;
}

async function preverPeloTitulo(titulo: string, token: string | null): Promise<Previsto> {
  const url = `${API}/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(titulo)}`;
  try {
    const r = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (!r.ok) return { categoriaId: "", nomeCategoria: "" };
    const j = (await r.json()) as { category_id?: string; category_name?: string }[];
    return { categoriaId: j?.[0]?.category_id ?? "", nomeCategoria: j?.[0]?.category_name ?? "" };
  } catch {
    // Rede falhando não é "não tem categoria": é "não sei", e o grupo decide.
    return { categoriaId: "", nomeCategoria: "" };
  }
}

/** Roda os pedidos em fila com largura fixa, sem depender de biblioteca. */
async function emLotes<T, R>(itens: T[], largura: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const i = proximo++;
      if (i >= itens.length) return;
      saida[i] = await f(itens[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(largura, itens.length) }, trabalhador));
  return saida;
}

export async function POST(request: Request) {
  let corpo: { clienteId?: string; marketplace?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  const clienteId = String(corpo.clienteId ?? "").trim();
  if (!clienteId) return Response.json({ erro: "clienteId ausente." }, { status: 400 });

  let ctx: Awaited<ReturnType<typeof exigirAcessoAoCliente>>;
  try {
    ctx = await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  // PAGINADO, e não é zelo: o corte silencioso do Supabase é 1.000 linhas, e a
  // base que motivou esta tela tem 1.003 produtos. Três produtos ficariam de
  // fora da proposta sem nada indicar que ficaram.
  let linhas: { id: string; nome: string }[];
  try {
    linhas = await lerTudoPaginado<{ id: string; nome: string }>(
      "produtos sem categoria",
      (de, ate) =>
        ctx.supabase!
          .from("produtos")
          .select("id, nome")
          .eq("cliente_id", clienteId)
          .is("categoria_ml", null)
          .order("id")
          .range(de, ate)
    );
  } catch (e) {
    // A causa inteira vai para o log, não para o navegador: mensagem de banco
    // conta o formato da consulta a quem estiver do outro lado.
    return respostaDeErro("ml/categoria/lote", e, "Não consegui ler os produtos.", 500);
  }
  const produtos = linhas.filter((p) => p.nome?.trim());
  if (produtos.length === 0) {
    return Response.json({ grupos: [], produtosSemCategoria: 0, consultas: 0, comToken: false });
  }

  // O token é bônus, não requisito — ver o cabeçalho.
  let token: string | null = null;
  try {
    const canal = await lerCanalServidor(
      clienteDaCredencial(),
      clienteId,
      corpo.marketplace ?? "Mercado Livre"
    );
    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;
    if (canal?.refreshToken && clientId && clientSecret) {
      token = (await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken }))
        .accessToken;
    }
  } catch {
    token = null;
  }

  // A amostra é DETERMINÍSTICA (ordem por nome): a mesma tela consultada duas
  // vezes tem que propor a mesma coisa, ou a proposta não é uma medição.
  const porTipo = new Map<string, { id: string; nome: string }[]>();
  for (const p of [...produtos].sort((a, b) => a.nome.localeCompare(b.nome))) {
    const t = grupoDoProduto(p.nome);
    const lista = porTipo.get(t) ?? [];
    lista.push(p);
    porTipo.set(t, lista);
  }

  // ESPALHADA PELO GRUPO, E NÃO OS PRIMEIROS DA ORDEM ALFABÉTICA.
  //
  // Pegar `slice(0, 15)` de uma lista ordenada por nome parece inofensivo e não
  // é: num catálogo de calçados os nomes começam pelo mesmo tipo, então os 15
  // primeiros são uma FAMÍLIA, não uma amostra. Medido em 27/08/2026 nos 321
  // chinelos — os 15 primeiros eram todos "Chinelo Baby ...", e o grupo inteiro
  // recebeu a proposta de bebê:
  //
  //     os 15 primeiros    MLB1400 (bebê) 12 · MLB273770 2 · outro 1
  //     1 a cada 21        MLB273770 11 · MLB1400 2 · MLB438492 2
  //
  // Um a cada N cobre o grupo inteiro e continua determinístico: mesma lista,
  // mesma amostra, mesma proposta.
  const amostra = [...porTipo.values()].flatMap((lista) => {
    const passo = Math.max(1, Math.ceil(lista.length / AMOSTRA_POR_TIPO));
    return lista.filter((_, i) => i % passo === 0).slice(0, AMOSTRA_POR_TIPO);
  });

  const nomesDaCategoria = new Map<string, string>();
  const previstos = await emLotes(amostra, SIMULTANEAS, async (p) => {
    const r = await preverPeloTitulo(p.nome, token);
    if (r.categoriaId && r.nomeCategoria) nomesDaCategoria.set(r.categoriaId, r.nomeCategoria);
    return { produtoId: p.id, nome: p.nome, categoriaId: r.categoriaId } as PrevisaoDeCategoria;
  });

  const grupos = agruparPorTipo(previstos).map((g) => ({
    tipo: g.tipo,
    categoriaId: g.categoriaId,
    nomeCategoria: nomesDaCategoria.get(g.categoriaId) ?? "",
    // O grupo INTEIRO, não só quem foi consultado: é o número que a lojista
    // está aprovando.
    total: porTipo.get(g.tipo)?.length ?? g.produtoIds.length,
    consultados: g.produtoIds.length,
    concordam: g.concordam,
    divergem: g.divergem,
    semResposta: g.semResposta,
    pequenoDemais: g.pequenoDemais,
  }));

  return Response.json({
    grupos,
    produtosSemCategoria: produtos.length,
    consultas: amostra.length,
    comToken: token !== null,
  });
}
