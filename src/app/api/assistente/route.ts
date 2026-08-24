// Classificação da pergunta do operador sobre a própria operação.
//
// A rota devolve INTENÇÃO, nunca resposta. Ela não consulta o banco, não conta
// nada e não sabe quantos produtos existem — quem responde é
// `assistant/domain/perguntaDaOperacao`, contra o estado real, no cliente.
//
// Mandar as contagens para cá pareceria mais simples e seria a porta pela qual
// o número errado entra: um modelo que vê "43 sem custo" escreve "cerca de 40",
// "a maioria", "quase todos". Ele não vê, então não pode.
//
// Mesma divisão medida no EXP-004 (3 rodadas, 39 turnos): extração de intenção
// 39/39, resolvedor determinístico sem erro. As rodadas que falharam falharam
// por pedir ao modelo que julgasse o que o domínio já conhece.

import { chamarIAEstruturada, provedorConfigurado } from "@/lib/agentes/provedorIA";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { cobrarCota, reservaNoBanco, respostaCotaRecusada } from "@/lib/agentes/cotaDeIA";
import { adminConfigurado, getSupabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 30;

const ESQUEMA = {
  type: "object",
  properties: {
    entendeu: { type: "boolean" },
    perguntar: { type: "string" },
    intencao: {
      type: "string",
      enum: [
        "estado_geral",
        "contagem",
        "proximo_passo",
        "por_que_travado",
        "sobre_este_produto",
        "preencher",
        "fora_do_alcance",
      ],
    },
    // ---- Só para "preencher". Nada aqui é gravado direto: vira PROPOSTA, e
    // alguém confirma antes de qualquer escrita. Ver `propostaDeCorrecao`.
    campo: { type: "string", enum: ["peso", "custo", "nenhum"] },
    /** O número COMO FOI DITO — a vírgula decimal precisa sobreviver. */
    valor: { type: "string" },
    unidade: { type: "string" },
    /** O que a frase diz sobre QUAL produto. Sem filtrar — filtrar é do código. */
    termosDoAlvo: { type: "array", items: { type: "string" } },
    // "nenhum" e não "" para dizer "não se aplica": o Gemini recusa o schema
    // inteiro com `enum ... cannot be empty`, e o erro chegava aqui como um 502
    // genérico porque o catch abaixo engole a mensagem do provedor. Medido
    // contra a API real — o schema com "" passava no type-check e no teste.
    assunto: {
      type: "string",
      enum: [
        "peso",
        "custo",
        "foto",
        "anuncio",
        "aprovacao",
        "publicacao",
        "precificacao",
        // `infracao` ESTAVA FALTANDO AQUI, e o domínio inteiro já a atendia —
        // com o cuidado de distinguir "não li" de "não há". Com saída
        // estruturada o modelo não emite valor fora do enum, então o prompt
        // pedia `infracao`, o card de recusa ANUNCIAVA a pergunta
        // ("Quantas infrações o Mercado Livre registrou na sua conta") e ela era
        // a única que não tinha como ser respondida. Guardado por
        // `assuntoContavelAlcancavel.test.ts`.
        "infracao",
        "nenhum",
      ],
    },
    capacidade: { type: "string", enum: ["precificar", "anunciar", "publicar", "nenhum"] },
    interpretacao: { type: "string" },
  },
  required: [
    "entendeu",
    "perguntar",
    "intencao",
    "assunto",
    "capacidade",
    "campo",
    "valor",
    "unidade",
    "termosDoAlvo",
    "interpretacao",
  ],
  additionalProperties: false,
} as const;

function system(temProdutoAberto: boolean, nomeDoProduto: string): string {
  return `Você classifica a INTENÇÃO de uma frase de um lojista sobre a operação da própria loja. Você NÃO consulta dados, NÃO conta, NÃO estima, NÃO lista produtos e NÃO responde a pergunta. Outro sistema responde, com os números reais.

NUNCA escreva números, quantidades, percentuais ou palavras de quantidade ("muitos", "a maioria", "quase todos", "poucos") em nenhum campo. Você não tem acesso aos dados e qualquer número seu seria inventado.

${temProdutoAberto ? `CONTEXTO: há um produto aberto na tela — "${nomeDoProduto}". Perguntas sobre "este produto", "esse aqui", "o que falta nele" ou sem sujeito explícito enquanto se olha um produto são "sobre_este_produto".` : "CONTEXTO: nenhum produto aberto. Não use \"sobre_este_produto\"."}

"intencao", escolha uma:
- "contagem": quer saber QUANTOS estão em alguma condição. Preencha "assunto".
- "proximo_passo": quer saber por onde começar, o que fazer primeiro, qual a prioridade.
- "por_que_travado": quer saber por que algo não funciona ou não sai. Preencha "capacidade".
- "estado_geral": panorama do CADASTRO — o que falta preencher na loja no geral (peso, custo, foto, anúncio gerado). Um pedido sobre UM produto nomeado nunca é panorama da loja.
- "sobre_este_produto": quer saber o que falta no produto que está aberto.
- "preencher": o lojista está DITANDO UM VALOR para ser gravado — "o peso do chinelo zaxy é 300 gramas", "custo desse aqui 17,16", "põe 0,4 kg nesse". Preencha "campo", "valor", "unidade" e "termosDoAlvo".
- "fora_do_alcance": a pergunta não é nenhuma das acima. Inclui previsão de vendas, opinião de mercado, o que o concorrente faz, preço ideal de um item específico, e qualquer coisa que dependa de dado que a loja não tem. Em "interpretacao", diga em uma frase o que você não consegue responder, sem prometer que outro sistema consegue.

"assunto" (só para "contagem"), escolha um:
- "peso": peso, gramas, frete, medidas de envio
- "custo": custo, quanto pago, preço de compra
- "foto": foto, imagem
- "anuncio": anúncio gerado, produto sem anúncio. NÃO use para "otimizado" /
  "otimização": ter anúncio gerado e o anúncio TER SIDO OTIMIZADO pela IA são
  coisas diferentes, e responder uma pela outra afirma um trabalho que não
  aconteceu. Sem assunto que sirva, devolva "entendeu": false.
- "aprovacao": anúncio esperando aval, para aprovar, para revisar
- "publicacao": anúncio para publicar, para subir, para ir ao ar
- "precificacao": produtos prontos para precificar, com preço mínimo calculado
- "infracao": infração, punição, anúncio bloqueado ou pausado PELO Mercado Livre, moderação

"capacidade" (só para "por_que_travado"): "precificar", "anunciar" ou "publicar".

Campos de "preencher" (deixe "campo" como "nenhum", "valor" e "unidade" vazios e "termosDoAlvo" como lista vazia nas outras intenções):
- "campo": "peso" ou "custo".
- "valor": o número EXATAMENTE como apareceu na frase, incluindo a vírgula decimal. "0,3" é "0,3", nunca "0.3" nem "3". Só o número, sem unidade e sem "R$".
- "unidade": a unidade dita — "g", "kg", "reais". Se a frase não disser nenhuma, deixe vazio. NÃO invente uma: quem deduz é o código, e a dedução é mostrada ao lojista antes de gravar.
- "termosDoAlvo": as palavras que dizem QUAL produto — nome, marca, modelo, código. Copie como aparecem. Se a frase disser apenas "este", "esse aqui", "ele", deixe a lista VAZIA: o produto aberto na tela é o alvo. Não julgue se o produto existe e não omita termo nenhum.

DISTINÇÃO QUE IMPORTA: perguntar não é mandar. "quanto pesa o chinelo?" é uma pergunta ("fora_do_alcance", eu não sei peso de produto). "o chinelo pesa 300 g" é uma ordem de preenchimento ("preencher"). Na dúvida entre as duas, use "entendeu": false e pergunte.

Use "nenhum" em "assunto" e em "capacidade" quando não se aplicarem.

O QUE ESTA LISTA NÃO COBRE — devolva "entendeu": false, sem "perguntar": qualquer frase sobre ANÚNCIO, MERCADO LIVRE, VARIAÇÃO, AGRUPAMENTO, ATIVO/PAUSADO, VENDAS ou VISITAS — ou que nomeie um produto e peça uma análise dele. Outro sistema, com as ferramentas do Mercado Livre, responde melhor.

"entendeu": false também quando a frase é ambígua a ponto de duas classificações diferentes serem igualmente plausíveis. Nesse caso escreva em "perguntar" a pergunta curta que desfaz a dúvida. Quando a frase é clara, está dentro dos assuntos acima e ainda assim fora do alcance, "entendeu" é true e "intencao" é "fora_do_alcance".

"interpretacao": uma frase curta, em português, do que você entendeu. É mostrada ao lojista.`;
}

/** Uma frase a classificar. Acima disso não é pergunta, é carga. */
const MAXIMO_DA_FRASE = 1000;

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (!provedorConfigurado()) {
    return Response.json({ erro: "Nenhum provedor de IA configurado no servidor." }, { status: 503 });
  }

  let corpo: { frase?: string; produtoAberto?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const frase = (corpo?.frase ?? "").trim();
  // Só o NOME do produto atravessa — nunca custo, peso ou preço. O modelo
  // classifica a intenção; para isso o nome basta, e o resto seria dado exposto
  // sem ganho.
  const produtoAberto = (corpo?.produtoAberto ?? "").trim().slice(0, 120);
  if (!frase) return Response.json({ erro: "Escreva o que você quer saber." }, { status: 400 });
  if (frase.length > MAXIMO_DA_FRASE) {
    return Response.json({ erro: "A pergunta é longa demais. Resuma em uma frase." }, { status: 400 });
  }

  // ZION-COST-001: a cota é cobrada AQUI, antes do provedor. Esta rota ficou
  // de fora da 060 — a classificação é barata, mas é paga, e sem a cobrança o
  // limite por minuto (063) não alcançava o chat. Equipe e agência seguem sem
  // cota (ver cotaDeIA.ts).
  if (ctx.perfil.clienteId) {
    if (!adminConfigurado()) {
      return Response.json({ erro: "Cota de IA indisponível no momento." }, { status: 503 });
    }
    const cota = await cobrarCota(ctx, "intencao", reservaNoBanco(getSupabaseAdmin()));
    if (!cota.ok) return respostaCotaRecusada(cota);
  }

  try {
    const { json } = await chamarIAEstruturada({
      system: system(Boolean(produtoAberto), produtoAberto),
      mensagem: frase,
      schema: ESQUEMA,
      maxTokens: 400,
      // Classificar uma frase é a tarefa mais simples que este sistema pede a
      // um modelo. Esforço alto aqui não melhorava a classificação e estourava
      // o tempo da rota — ver `ChamadaIA.esforco`.
      //
      // Era `low`, e em 24/08/2026 virou `minimal` com modelo próprio: medido
      // em produção no gpt-5, `low` custou 9,5s e 630 tokens de saída — quase
      // todos de RACIOCÍNIO, para escolher entre valores que o schema já
      // enumera. A lojista esperava isso ANTES de o chat começar a responder.
      // `low` e não `minimal`: medido em 24/08/2026, com esforço mínimo o
      // classificador mandou "confere as variações da Papete, parece que os
      // anúncios não estão agrupados" para `estado_geral`, e a lojista leu
      // "sua loja está em dia" numa loja com 303 anúncios fora do ar. A
      // decisão entre sete intenções não é trivial como parecia; no mini,
      // `low` custa ~2,5 s — o barato aqui não vale a resposta errada.
      esforco: "low",
      tarefa: "classificacao",
      rastro: { origem: "intencao", clienteId: ctx.perfil.clienteId, usuarioId: ctx.usuario?.id ?? null },
    });
    return Response.json({ criterio: JSON.parse(json) });
  } catch (e) {
    // A mensagem do provedor NÃO vai na resposta: ela não ajuda quem digitou e
    // às vezes carrega configuração do servidor. Mas vai no log — este catch
    // já escondeu por horas um `enum ... cannot be empty` que era trivial de
    // corrigir, e "tente de novo em instantes" não era falso, era inútil.
    console.error("[assistente] falha ao classificar:", e);
    return Response.json(
      { erro: "Não consegui entender agora. Tente de novo em instantes." },
      { status: 502 }
    );
  }
}
