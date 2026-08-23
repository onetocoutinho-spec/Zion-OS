// O histórico da conversa, traduzido para o dialeto da Anthropic. PURO.
//
// ===========================================================================
// POR QUE TRADUZIR EM VEZ DE TROCAR O FORMATO
// ===========================================================================
//
// `Fala`/`Parte` atravessa a rede (o navegador manda `falas` no corpo), volta
// no SSE a cada passo e fica GRAVADO nas conversas do copiloto. Trocar o
// formato quebraria toda conversa já salva, e por um ganho nenhum: o formato
// serve bem como dialeto neutro do projeto.
//
// Então ele fica onde está, e a tradução mora aqui — num arquivo puro, que dá
// para testar sem rede e sem chave.
//
// ===========================================================================
// O QUE A ANTHROPIC EXIGE E O GEMINI NÃO EXIGIA
// ===========================================================================
//
// 1. TODA chamada de ferramenta tem `id`, e a resposta dela referencia esse id.
//    O dialeto antigo casava por NOME — não há id em `Parte` nenhuma, nem nas
//    conversas já gravadas. Os ids são criados aqui, e o casamento é FIFO por
//    nome, que é exatamente o que o formato antigo fazia.
//
// 2. Um `tool_result` sem o `tool_use` correspondente é 400. Isso não é
//    hipótese: `FALAS_MANTIDAS` corta o histórico por FALA, e o corte pode cair
//    ENTRE a chamada e a resposta — deixando a resposta órfã na cabeça da
//    janela. O Gemini engolia; a Anthropic recusa a conversa inteira.
//
// 3. A primeira mensagem precisa ser do usuário, e conteúdo vazio é inválido.
//
// Cada uma dessas três vira uma limpeza aqui. Nenhuma delas apaga informação
// que o modelo poderia usar: o que sai é sempre um pedaço solto de um par que
// o corte da janela já tinha partido ao meio.

import type Anthropic from "@anthropic-ai/sdk";
import type { Fala } from "./conversaComFerramentas";

/** O id que a Anthropic exige, derivado da posição — determinístico. */
function idDaChamada(indiceDaFala: number, indiceDaParte: number): string {
  return `toolu_${indiceDaFala}_${indiceDaParte}`;
}

function texto(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v ?? null);
  } catch {
    // Objeto com ciclo. Melhor uma marca honesta do que derrubar o turno.
    return '"[resposta não serializável]"';
  }
}

/**
 * O histórico como a Anthropic quer receber.
 *
 * A ordem é preservada e nada é reordenado: o que sai daqui conta a mesma
 * história que entrou, sem os pedaços que ficariam pendurados.
 */
export function mensagensDaConversa(
  falas: readonly Fala[]
): Anthropic.MessageParam[] {
  // Chamadas ainda sem resposta, por nome. FIFO — a primeira chamada de um
  // nome casa com a primeira resposta daquele nome, que é como o dialeto
  // antigo já se comportava.
  const pendentes = new Map<string, string[]>();
  const mensagens: Anthropic.MessageParam[] = [];

  falas.forEach((fala, i) => {
    const blocos: Anthropic.ContentBlockParam[] = [];

    (fala.parts ?? []).forEach((parte, j) => {
      if (typeof parte.text === "string" && parte.text.trim()) {
        blocos.push({ type: "text", text: parte.text });
        return;
      }

      if (parte.functionCall?.name) {
        const id = idDaChamada(i, j);
        const fila = pendentes.get(parte.functionCall.name);
        if (fila) fila.push(id);
        else pendentes.set(parte.functionCall.name, [id]);
        blocos.push({
          type: "tool_use",
          id,
          name: parte.functionCall.name,
          input: parte.functionCall.args ?? {},
        });
        return;
      }

      if (parte.functionResponse?.name) {
        const fila = pendentes.get(parte.functionResponse.name);
        const id = fila?.shift();
        // Órfã: a chamada dela ficou fora da janela. Mandá-la assim é 400 na
        // conversa inteira — some, e o modelo apenas não vê um resultado cuja
        // pergunta ele também não vê.
        if (!id) return;
        blocos.push({
          type: "tool_result",
          tool_use_id: id,
          content: texto(parte.functionResponse.response),
        });
      }
    });

    // Fala que não produziu bloco nenhum não vira mensagem: conteúdo vazio é
    // recusado pela API, e uma fala só de partes órfãs é exatamente isso.
    if (blocos.length === 0) return;
    mensagens.push({ role: fala.role === "model" ? "assistant" : "user", content: blocos });
  });

  return semParesPartidos(mensagens);
}

/**
 * Tira o que sobrou partido nas duas pontas.
 *
 * NA CABEÇA: mensagens do assistente antes da primeira do usuário. A API exige
 * que a conversa comece com o usuário, e a janela deslizante pode começar no
 * meio de uma resposta do modelo.
 *
 * NO RABO: uma chamada de ferramenta sem resposta. Ela só aparece se o turno
 * anterior morreu no meio, e mandá-la de volta é 400 — a API espera o resultado
 * de toda chamada que o histórico afirma ter sido feita.
 */
function semParesPartidos(
  mensagens: readonly Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  const blocos = (m: Anthropic.MessageParam): Anthropic.ContentBlockParam[] =>
    Array.isArray(m.content) ? (m.content as Anthropic.ContentBlockParam[]) : [];

  // O COMEÇO É UM TURNO DE VERDADE, não qualquer mensagem `user`.
  //
  // Neste dialeto o `tool_result` viaja como mensagem de papel `user` — é a
  // forma da API. Procurar só por `role === "user"` acha o CARREGADOR de
  // resultado e começa ali, deixando o `tool_use` que o gerou do lado de fora.
  //
  // Medido em produção em 10/08/2026: a conversa inteira voltava 400 —
  // "unexpected tool_use_id found in tool_result blocks: toolu_0_0" — e a
  // lojista lia "Não consegui responder agora". Bastava a janela deslizante
  // parar num par chamada→resposta, o que acontece em toda conversa longa o
  // bastante.
  //
  // A limpeza de órfãos acima não pega este caso: lá o `tool_use` ESTAVA na
  // janela e foi casado; quem o descartou foi este corte, depois.
  const inicio = mensagens.findIndex(
    (m) => m.role === "user" && !blocos(m).some((b) => b.type === "tool_result")
  );
  if (inicio < 0) return [];
  let fim = mensagens.length;

  // Anda de trás para frente enquanto a última mensagem for do assistente com
  // chamada pendente. Mais de uma pode estar pendurada se o turno morreu no
  // meio de um encadeamento.
  while (fim > inicio) {
    const ultima = mensagens[fim - 1];
    if (ultima.role !== "assistant") break;
    if (!blocos(ultima).some((b) => b.type === "tool_use")) break;
    fim -= 1;
  }

  return mensagens.slice(inicio, fim);
}

/** As ferramentas no formato da Anthropic. `parametros` já é JSON Schema. */
export function ferramentasDaAnthropic(
  fs: readonly { nome: string; descricao: string; parametros: Record<string, unknown> }[]
): Anthropic.Tool[] {
  return fs.map((f) => ({
    name: f.nome,
    description: f.descricao,
    input_schema: f.parametros as Anthropic.Tool.InputSchema,
  }));
}

// ===========================================================================
// O MESMO HISTÓRICO, NO DIALETO DA OPENAI (Responses API)
// ===========================================================================
//
// Desde 23/08/2026 o chat fala com o ChatGPT. O dialeto neutro do projeto
// continua `Fala`/`Parte` — pelo mesmo motivo de sempre: ele está gravado nas
// conversas. A tradução para a OpenAI vive aqui, ao lado da da Anthropic, e
// obedece às MESMAS três regras (id por chamada, órfã some, começo no turno
// do usuário), porque a Responses API recusa exatamente os mesmos pares
// partidos: um `function_call_output` sem o `function_call` dele é 400.

import type { FerramentaDaOpenAI, ItemDeEntrada } from "./openai";

function idDaChamadaOpenAI(indiceDaFala: number, indiceDaParte: number): string {
  return `call_${indiceDaFala}_${indiceDaParte}`;
}

/** O histórico como a Responses API quer receber. */
export function entradaDaConversaOpenAI(falas: readonly Fala[]): ItemDeEntrada[] {
  const pendentes = new Map<string, string[]>();
  const itens: ItemDeEntrada[] = [];

  falas.forEach((fala, i) => {
    const papel = fala.role === "model" ? "assistant" : "user";
    (fala.parts ?? []).forEach((parte, j) => {
      if (typeof parte.text === "string" && parte.text.trim()) {
        itens.push(
          papel === "assistant"
            ? { role: "assistant", content: [{ type: "output_text", text: parte.text }] }
            : { role: "user", content: [{ type: "input_text", text: parte.text }] }
        );
        return;
      }
      if (parte.functionCall?.name) {
        const id = idDaChamadaOpenAI(i, j);
        const fila = pendentes.get(parte.functionCall.name);
        if (fila) fila.push(id);
        else pendentes.set(parte.functionCall.name, [id]);
        itens.push({
          type: "function_call",
          call_id: id,
          name: parte.functionCall.name,
          arguments: JSON.stringify(parte.functionCall.args ?? {}),
        });
        return;
      }
      if (parte.functionResponse?.name) {
        const id = pendentes.get(parte.functionResponse.name)?.shift();
        if (!id) return; // órfã — ver o cabeçalho
        itens.push({ type: "function_call_output", call_id: id, output: texto(parte.functionResponse.response) });
      }
    });
  });

  return semParesPartidosOpenAI(itens);
}

function semParesPartidosOpenAI(itens: readonly ItemDeEntrada[]): ItemDeEntrada[] {
  // O começo é um turno de verdade do usuário — nem resultado de ferramenta,
  // nem fala do assistente que a janela deslizante deixou na cabeça.
  const inicio = itens.findIndex((it) => "role" in it && it.role === "user");
  if (inicio < 0) return [];
  let fim = itens.length;
  // No rabo: chamadas sem resposta (o turno anterior morreu no meio).
  while (fim > inicio) {
    const ultimo = itens[fim - 1];
    if (!("type" in ultimo) || ultimo.type !== "function_call") break;
    fim -= 1;
  }
  // Uma fala do assistente pendurada no fim é válida; só a chamada sem
  // resposta não é. Mas se, depois do corte, o último item for uma fala do
  // assistente seguida de nada, tudo bem — a API aceita.
  return itens.slice(inicio, fim);
}

/** As ferramentas no formato da OpenAI. `parametros` já é JSON Schema. */
export function ferramentasDaOpenAI(
  fs: readonly { nome: string; descricao: string; parametros: Record<string, unknown> }[]
): FerramentaDaOpenAI[] {
  return fs.map((f) => ({
    type: "function",
    name: f.nome,
    description: f.descricao,
    parameters: f.parametros,
    strict: false,
  }));
}
