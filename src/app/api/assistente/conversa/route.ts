// O laço de conversa: o modelo pede ferramenta, o servidor executa, ele
// continua — até ter o que dizer.
//
// A diferença para `/api/assistente` (a rota de intenção) não é de tamanho, é
// de natureza. Lá o modelo classifica UMA frase numa lista fechada. Aqui ele
// conversa, guarda o fio e encadeia passos. As duas vivem lado a lado de
// propósito: a de intenção custa ~400 tokens e resolve o caso comum; esta
// custa ~1.800 e resolve o que a outra não alcança.
//
// O QUE NÃO MUDA:
//
//   o modelo pode PROPOR qualquer coisa · só o clique de um humano GRAVA
//
// Nenhuma ferramenta escreve — a fronteira está no tipo `Efeito` e presa pelo
// compilador. Esta rota não é exceção: quando o modelo chama `propor_gravacao`,
// o que volta é um cartão para a tela mostrar. A gravação acontece depois, por
// `correcaoPeloChat`, quando alguém clica.
//
// O ESTADO VEM DO CLIENTE, medido lá contra o banco — mesma arquitetura da
// rota de intenção. O servidor recebe a loja e o catálogo, mas o MODELO nunca
// os vê: ele vê só o que uma ferramenta devolveu. É essa distância que impede
// "cerca de 40" quando são 43.

import {
  pedirTurnoEmFluxo,
  MAXIMO_DE_PASSOS,
  type Fala,
} from "@/lib/agentes/conversaComFerramentas";
import { FERRAMENTAS } from "@/modules/assistant/domain/ferramentasDoAssistente";
import {
  executarFerramenta,
  type ContextoDasFerramentas,
} from "@/modules/assistant/domain/executarFerramenta";
import type { Proposta } from "@/modules/assistant/domain/propostaDeCorrecao";
import type { PropostaDeAnuncio } from "@/modules/assistant/domain/propostaDeAnuncio";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { criarProposta } from "@/lib/services/copilotPropostas";
import { garantirConversa, gravarTurno } from "@/lib/services/copilotConversas";
import { precondicoesDaProposta } from "@/modules/assistant/domain/precondicoesDaProposta";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

function system(produtoAberto: string): string {
  return `Você é o assistente operacional do Zion OS. Ajuda um lojista a levar produtos do cadastro ao anúncio pronto para o Mercado Livre.

VOCÊ NÃO TEM ACESSO AOS DADOS. Toda quantidade, nome de produto e estado vem de ferramenta. NUNCA escreva um número que uma ferramenta não devolveu nesta conversa — nem aproximado, nem "muitos", nem "a maioria", nem "quase todos". Se precisar de um número, chame a ferramenta.

Para propor um preenchimento: primeiro ache o produto com achar_produto, confirme que o alvo é ÚNICO, e só então chame propor_gravacao. Se achar_produto devolver mais de um, PERGUNTE ao lojista qual — nunca escolha por conta própria. Nunca proponha um valor que o lojista não disse nesta conversa: se ele pedir para preencher algo sem dizer o número, pergunte o número.

Você não grava nada. propor_gravacao monta um cartão que o lojista confirma clicando. Diga isso quando for o caso, sem prometer que já está feito.

Perguntar não é mandar. "quanto pesa o chinelo?" é uma pergunta sobre um dado que você não tem — diga que não sabe. "o chinelo pesa 300 g" é o lojista informando um valor.

${produtoAberto ? `O lojista está com "${produtoAberto}" aberto na tela. Quando ele disser "este", "esse aqui" ou "ele", é deste produto que fala.` : ""}

COMO ESCREVER. Você fala com um lojista, não com um programador. Português do Brasil, direto, sem jargão.

Use markdown quando ele ajudar a ler: **negrito** no que importa, listas quando são itens, e TABELA quando estiver comparando coisas ou mostrando vários produtos com seus estados. Uma tabela de três produtos e o que falta em cada um se lê num relance; a mesma coisa em prosa vira parágrafo que ninguém termina.

Não seja telegráfico. Se a resposta tem contexto que muda a decisão, dê o contexto — mas não encha linguiça. Uma frase que não muda o que ele vai fazer é uma frase a menos.

Preserve as distinções que as ferramentas fazem. Quando a contagem distingue produtos SEM PESO NENHUM de produtos com peso em PARTE das variações, essa diferença importa: para os parciais o frete sai, e chamar os dois de "sem peso" é falso. Não resuma isso para um número só.

Conduza. Depois de responder, diga qual é o próximo passo útil — e, quando fizer sentido, ofereça fazer.`;
}

/**
 * O estado do produto lido do BANCO, para virar precondicao da proposta.
 *
 * NAO pode vir do corpo da requisicao. O contexto que a tela manda (produtos,
 * custos, contagens) serve para o modelo raciocinar — mas se ele virasse a
 * linha de base da revalidacao, o navegador mandaria um valor falso e a
 * checagem de staleness casaria com a propria mentira.
 *
 * A precondicao e uma promessa sobre o mundo. Quem le o mundo e o servidor.
 */
async function estadoDoProdutoNoBanco(
  produtoId: string,
  clienteId: string
): Promise<{ custo: number | null; variacoesSemPeso: number }> {
  const admin = getSupabaseAdmin();
  const [pai, variantes] = await Promise.all([
    admin.from("produtos").select("custo").eq("id", produtoId).eq("cliente_id", clienteId).maybeSingle(),
    admin.from("produto_variantes").select("peso").eq("produto_id", produtoId),
  ]);
  const custoBruto = (pai.data as { custo?: number | null } | null)?.custo;
  const linhas = (variantes.data ?? []) as { peso: number | null }[];
  return {
    custo: custoBruto === null || custoBruto === undefined ? null : Number(custoBruto),
    variacoesSemPeso: linhas.filter((v) => !v.peso || v.peso <= 0).length,
  };
}

export async function POST(request: Request) {
  let ctxAuth;
  try {
    ctxAuth = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  // O TENANT VEM DAQUI — nunca do corpo. Tudo que for persistido nesta
  // requisicao (conversa, mensagens, propostas) usa este valor. Antes o
  // resultado da autenticacao era DESCARTADO: a rota so checava que havia
  // sessao, e o `clienteId` chegava no corpo, escolhido pelo navegador.
  const clienteDaSessao = ctxAuth.perfil.clienteId;
  if (!clienteDaSessao) {
    return Response.json({ erro: "Sessao sem cliente associado." }, { status: 403 });
  }
  const usuarioId = ctxAuth.usuario?.id ?? null;
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ erro: "Nenhum provedor de IA configurado." }, { status: 503 });
  }

  let corpo: {
    mensagem?: string;
    falas?: Fala[];
    contexto?: ContextoDasFerramentas;
    produtoAberto?: string;
    /** O fio, para a conversa continuar a mesma linha no banco. */
    conversaId?: string;
    rota?: string;
  };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const mensagem = (corpo.mensagem ?? "").trim();
  if (!mensagem) return Response.json({ erro: "Escreva o que você quer." }, { status: 400 });
  if (!corpo.contexto?.pergunta?.loja) {
    return Response.json({ erro: "Contexto da loja ausente." }, { status: 400 });
  }
  const ctx: ContextoDasFerramentas = {
    pergunta: corpo.contexto.pergunta,
    produtos: corpo.contexto.produtos ?? [],
    produtoAberto: corpo.contexto.produtoAberto ?? null,
    // Os dados que a checagem de anuncio exige. Sem eles `propor_anuncio`
    // recusa em vez de propor — melhor que gerar um anuncio que volta com
    // pendencia depois de tres minutos.
    paraAnunciar: corpo.contexto.paraAnunciar ?? [],
  };

  // A conversa vive no BANCO. O `localStorage` da tela continua existindo, mas
  // como cache de UI — ele nao atravessa dispositivo, nao sobrevive a limpeza
  // do navegador e nao sabe nada sobre tenant.
  const conversaId = await garantirConversa(clienteDaSessao, usuarioId, corpo.conversaId ?? null, {
    rota: corpo.rota,
    produtoId: ctx.produtoAberto?.id ?? null,
  });

  const historico: Fala[] = [
    ...(corpo.falas ?? []),
    { role: "user", parts: [{ text: mensagem }] },
  ];

  /**
   * A resposta vai em EVENTOS, uma linha de JSON cada.
   *
   * Não é enfeite: com ferramentas, uma resposta leva de 2 a 8 segundos, e
   * nesse tempo a tela mostrava "Lendo os seus dados…" e nada mais. Aqui o
   * lojista vê a ferramenta ser chamada e o texto sendo escrito. É a diferença
   * entre uma caixa que responde e uma conversa.
   *
   * Linhas de JSON e não SSE puro porque quem lê é o nosso próprio código, e
   * `split("\n") + JSON.parse` é tudo que ele precisa.
   */
  const fluxo = new ReadableStream({
    async start(controlador) {
      const cod = new TextEncoder();
      const mandar = (e: unknown) => controlador.enqueue(cod.encode(JSON.stringify(e) + "\n"));

      let tokens = 0;
      /** A última proposta montada. Só uma sobrevive: é a que a tela mostra. */
      let proposta: Proposta | undefined;
      /** A proposta de GERAR ANUNCIO. Separada: a tela poe outro botao nela. */
      let propostaDeAnuncio: PropostaDeAnuncio | undefined;
      /** O escopo de um lote, quando a proposta atinge mais de um alvo. */
      let escopoDoLote: NonNullable<ReturnType<typeof executarFerramenta>["escopo"]> | undefined;
      const usadas: string[] = [];

      try {
        for (let passo = 0; passo < MAXIMO_DE_PASSOS; passo++) {
          const turno = await pedirTurnoEmFluxo(
            system(corpo.produtoAberto ?? ""),
            historico,
            FERRAMENTAS,
            (pedaco) => mandar({ tipo: "texto", delta: pedaco })
          );
          tokens += turno.tokens;

          if (turno.chamadas.length === 0) {
            historico.push({ role: "model", parts: [{ text: turno.texto }] });
            // A PROPOSTA VIRA REGISTRO antes de chegar na tela. O que a tela
            // recebe e um ID — nao um objeto que ela poderia reescrever e
            // devolver como "o que o lojista aprovou".
            let propostaId: string | null = null;
            // ---- LOTE: persiste os IDS CONCRETOS aprovados, nunca o filtro.
            // Um criterio e uma promessa sobre o futuro; uma lista e um fato
            // sobre o presente. Reexecutar o filtro na confirmacao deixaria o
            // escopo crescer entre a leitura e o clique.
            if (escopoDoLote && conversaId && escopoDoLote.incluidos.length > 0) {
              try {
                const alvos = escopoDoLote.incluidos.map((c) => c.id);
                // Uma precondicao POR ALVO. A chave carrega o id, entao o
                // `podeExecutar` existente compara alvo a alvo sem mudar de
                // forma — e um alvo preenchido por outro caminho invalida a
                // proposta inteira, que e o comportamento pedido: nao alterar
                // 39 quando o lojista aprovou 47.
                const precondicoes = escopoDoLote.incluidos.map((c) => ({
                  campo: `variacoesSemPeso:${c.id}`,
                  valorNaCriacao: c.unidadesSemDado,
                }));
                const gravada = await criarProposta({
                  clienteId: clienteDaSessao,
                  conversaId,
                  criadaPor: usuarioId,
                  tipo: escopoDoLote.campo,
                  alvos,
                  valor: escopoDoLote.valor,
                  resumo: escopoDoLote.resumo,
                  precondicoes,
                });
                propostaId = gravada.id;
              } catch (e) {
                console.error("[copilot] falha ao persistir proposta em lote:", e);
              }
            } else if (proposta?.tipo === "pronta" && conversaId) {
              try {
                const gravada = await criarProposta({
                  clienteId: clienteDaSessao,
                  conversaId,
                  criadaPor: usuarioId,
                  tipo: proposta.campo,
                  alvos: [proposta.alvo.id],
                  valor: proposta.valor,
                  resumo: proposta.resumo,
                  precondicoes: precondicoesDaProposta(
                    proposta.campo,
                    await estadoDoProdutoNoBanco(proposta.alvo.id, clienteDaSessao)
                  ),
                });
                propostaId = gravada.id;
              } catch (e) {
                // Sem proposta persistida NAO ha confirmacao possivel — e
                // melhor a tela nao mostrar botao do que mostrar um que grava
                // sem registro.
                console.error("[copilot] falha ao persistir proposta:", e);
              }
            }
            if (conversaId) {
              void gravarTurno(clienteDaSessao, conversaId, {
                pergunta: mensagem,
                resposta: turno.texto,
                ferramentas: usadas,
                tokens,
              });
            }
            mandar({
              tipo: "fim",
              texto: turno.texto,
              falas: historico,
              ferramentas: usadas,
              tokens,
              ...(conversaId ? { conversaId } : {}),
              // A proposta so vai com ID. Sem ID, a tela nao oferece botao.
              ...(proposta && propostaId ? { proposta, propostaId } : {}),
              ...(escopoDoLote && propostaId
                ? {
                    escopo: {
                      campo: escopoDoLote.campo,
                      valor: escopoDoLote.valor,
                      resumo: escopoDoLote.resumo,
                      produtosAfetados: escopoDoLote.incluidos.length,
                      variacoesAfetadas: escopoDoLote.unidadesAfetadas,
                      naoAlterados: escopoDoLote.jaTemDado.length,
                      // AMOSTRA, nao a lista: com 2.000 alvos o cartao viraria
                      // uma parede. Os ids ficam na Proposal, no servidor.
                      amostra: escopoDoLote.incluidos.slice(0, 8).map((c) => c.nome),
                    },
                    propostaId,
                  }
                : {}),
              ...(propostaDeAnuncio ? { propostaDeAnuncio } : {}),
            });
            controlador.close();
            return;
          }

          historico.push({
            role: "model",
            parts: turno.chamadas.map((c) => ({ functionCall: { name: c.nome, args: c.args } })),
          });
          const respostas = turno.chamadas.map((c) => {
            usadas.push(c.nome);
            // O aviso sai ANTES de executar: é o que aparece na tela enquanto a
            // ferramenta roda, no lugar do silêncio.
            mandar({ tipo: "ferramenta", nome: c.nome });
            const r = executarFerramenta({ nome: c.nome, args: c.args }, ctx);
            // A última proposta vence. Duas no mesmo turno seria o modelo se
            // corrigindo, e é a corrigida que o lojista deve ver.
            if (r.proposta) proposta = r.proposta;
            if (r.propostaDeAnuncio) propostaDeAnuncio = r.propostaDeAnuncio;
            if (r.escopo) escopoDoLote = r.escopo;
            return { functionResponse: { name: c.nome, response: r.saida } };
          });
          historico.push({ role: "user", parts: respostas });
        }

        // Estourou o teto de passos. Dizer isso é melhor que entregar a última
        // resposta parcial como se fosse conclusão.
        mandar({
          tipo: "fim",
          texto: "Me perdi no meio do caminho. Pode reformular?",
          falas: historico,
          ferramentas: usadas,
          tokens,
        });
        controlador.close();
      } catch (e) {
        // A causa vai para o log — este mesmo catch, na outra rota, escondeu
        // por horas um erro de schema que era trivial de corrigir.
        console.error("[assistente/conversa] falha:", e);
        const msg = e instanceof Error ? e.message : "";
        // "sobrecarregado, tente de novo" é acionável para quem digitou; um
        // erro de schema não é, e ainda pode carregar configuração do servidor.
        mandar({
          tipo: "erro",
          erro: /sobrecarregado/.test(msg)
            ? msg
            : "Não consegui responder agora. Tente de novo em instantes.",
        });
        controlador.close();
      }
    },
  });

  return new Response(fluxo, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Alguns proxies bufferizam a resposta inteira e matam o streaming — o
      // texto chegaria de uma vez só, no fim, exatamente como antes.
      "X-Accel-Buffering": "no",
    },
  });
}
