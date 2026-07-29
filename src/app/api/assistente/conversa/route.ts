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

import { pedirTurno, MAXIMO_DE_PASSOS, type Fala } from "@/lib/agentes/conversaComFerramentas";
import { FERRAMENTAS } from "@/modules/assistant/domain/ferramentasDoAssistente";
import {
  executarFerramenta,
  type ContextoDasFerramentas,
} from "@/modules/assistant/domain/executarFerramenta";
import type { Proposta } from "@/modules/assistant/domain/propostaDeCorrecao";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

export const maxDuration = 60;

function system(produtoAberto: string): string {
  return `Você é o assistente operacional do Zion OS. Ajuda um lojista a levar produtos do cadastro ao anúncio pronto para o Mercado Livre.

VOCÊ NÃO TEM ACESSO AOS DADOS. Toda quantidade, nome de produto e estado vem de ferramenta. NUNCA escreva um número que uma ferramenta não devolveu nesta conversa — nem aproximado, nem "muitos", nem "a maioria", nem "quase todos". Se precisar de um número, chame a ferramenta.

Para propor um preenchimento: primeiro ache o produto com achar_produto, confirme que o alvo é ÚNICO, e só então chame propor_gravacao. Se achar_produto devolver mais de um, PERGUNTE ao lojista qual — nunca escolha por conta própria. Nunca proponha um valor que o lojista não disse nesta conversa: se ele pedir para preencher algo sem dizer o número, pergunte o número.

Você não grava nada. propor_gravacao monta um cartão que o lojista confirma clicando. Diga isso quando for o caso, sem prometer que já está feito.

Perguntar não é mandar. "quanto pesa o chinelo?" é uma pergunta sobre um dado que você não tem — diga que não sabe. "o chinelo pesa 300 g" é o lojista informando um valor.

${produtoAberto ? `O lojista está com "${produtoAberto}" aberto na tela. Quando ele disser "este", "esse aqui" ou "ele", é deste produto que fala.` : ""}

Seja breve — duas ou três frases. Conduza: depois de responder, diga qual é o próximo passo útil. Escreva em português do Brasil, como quem fala com um lojista, não com um programador.`;
}

export async function POST(request: Request) {
  try {
    await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ erro: "Nenhum provedor de IA configurado." }, { status: 503 });
  }

  let corpo: {
    mensagem?: string;
    falas?: Fala[];
    contexto?: ContextoDasFerramentas;
    produtoAberto?: string;
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
  };

  const historico: Fala[] = [
    ...(corpo.falas ?? []),
    { role: "user", parts: [{ text: mensagem }] },
  ];

  let tokens = 0;
  /** A última proposta montada. Só uma sobrevive: é a que a tela mostra. */
  let proposta: Proposta | undefined;
  const usadas: string[] = [];

  try {
    for (let passo = 0; passo < MAXIMO_DE_PASSOS; passo++) {
      const turno = await pedirTurno(system(corpo.produtoAberto ?? ""), historico, FERRAMENTAS);
      tokens += turno.tokens;

      if (turno.chamadas.length === 0) {
        historico.push({ role: "model", parts: [{ text: turno.texto }] });
        return Response.json({
          texto: turno.texto,
          falas: historico,
          ferramentas: usadas,
          tokens,
          ...(proposta ? { proposta } : {}),
        });
      }

      historico.push({
        role: "model",
        parts: turno.chamadas.map((c) => ({ functionCall: { name: c.nome, args: c.args } })),
      });
      const respostas = turno.chamadas.map((c) => {
        usadas.push(c.nome);
        const r = executarFerramenta({ nome: c.nome, args: c.args }, ctx);
        // A última proposta vence. Duas no mesmo turno seria o modelo se
        // corrigindo, e é a corrigida que o lojista deve ver.
        if (r.proposta) proposta = r.proposta;
        return { functionResponse: { name: c.nome, response: r.saida } };
      });
      historico.push({ role: "user", parts: respostas });
    }

    // Estourou o teto de passos. Dizer isso é melhor que devolver a última
    // resposta parcial como se fosse conclusão.
    return Response.json({
      texto: "Me perdi no meio do caminho. Pode reformular?",
      falas: historico,
      ferramentas: usadas,
      tokens,
    });
  } catch (e) {
    // A causa vai para o log — este mesmo catch, na outra rota, escondeu por
    // horas um erro de schema que era trivial de corrigir.
    console.error("[assistente/conversa] falha:", e);
    const msg = e instanceof Error ? e.message : "";
    // "sobrecarregado, tente de novo" é acionável para quem digitou; um erro de
    // schema não é, e ainda pode carregar configuração do servidor.
    const paraOUsuario = /sobrecarregado/.test(msg)
      ? msg
      : "Não consegui responder agora. Tente de novo em instantes.";
    return Response.json({ erro: paraOUsuario }, { status: 502 });
  }
}
