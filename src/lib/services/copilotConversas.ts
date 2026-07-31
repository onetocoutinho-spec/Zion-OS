// Persistência da conversa do Copilot — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin. Nunca use no navegador.
//
// O `localStorage` continua existindo na tela, mas deixa de ser a VERDADE. Ele
// não atravessa dispositivo, não sobrevive à limpeza do navegador, e não sabe
// nada sobre tenant — três coisas que a fonte autoritativa de um histórico
// operacional precisa saber.
//
// A conversa é gravada pela ROTA, com o tenant vindo da sessão. A tela não
// escreve: se escrevesse, o histórico do lojista seria o que o navegador dele
// resolvesse afirmar.
//
// Falha de gravação NUNCA derruba a resposta. Perder o registro de um turno é
// ruim; perder a resposta que o lojista está esperando por causa disso é pior,
// e transformaria uma indisponibilidade de log numa indisponibilidade de
// produto.

import { getSupabaseAdmin } from "../supabase/admin";

export interface TurnoGravado {
  pergunta: string;
  resposta: string;
  ferramentas: readonly string[];
  tokens: number;
  /**
   * O que ESTA resposta apresentou — os ids e a ordem em que apareceram.
   *
   * É o que permite "o segundo" virar um id. Sem isto, a referência teria que
   * ser reinterpretada no turno seguinte, contra uma lista que pode ter mudado
   * de ordem. Ver `referenciasDaConversa`.
   */
  metadata?: Record<string, unknown> | null;
}

/**
 * Garante a conversa — cria na primeira mensagem, reusa nas seguintes.
 *
 * Devolve `null` quando não deu: quem chama segue sem histórico em vez de
 * falhar. O id vem do cliente para o fio sobreviver ao recarregamento, mas o
 * TENANT é conferido aqui: um id de conversa de outro cliente não é reusado,
 * é ignorado e uma nova é criada.
 */
export async function garantirConversa(
  clienteId: string,
  usuarioId: string | null,
  conversaId: string | null,
  contexto: { rota?: string; produtoId?: string | null }
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  try {
    if (conversaId) {
      const { data } = await admin
        .from("copilot_conversas")
        .select("id, cliente_id")
        .eq("id", conversaId)
        .maybeSingle();
      const linha = data as { id: string; cliente_id: string } | null;
      // Conversa de OUTRO cliente: não reusa e não conta por quê. Continuar
      // nela deixaria as mensagens deste lojista no histórico do outro.
      if (linha && linha.cliente_id === clienteId) {
        const { error } = await admin
          .from("copilot_conversas")
          .update({ atualizada_em: new Date().toISOString() })
          .eq("id", linha.id);
        // Falhar aqui NÃO invalida o reuso: o fio é a linha, não o carimbo. Mas
        // `atualizada_em` é o sinal que provou o INC-005 (8 conversas com
        // `atualizada_em = criada_em`), e um sinal que pode parar de avançar em
        // silêncio deixa de servir como evidência.
        if (error) console.error(`[copilot] falha ao tocar atualizada_em da conversa ${linha.id}:`, error);
        return linha.id;
      }
    }
    const { data, error } = await admin
      .from("copilot_conversas")
      .insert({
        cliente_id: clienteId,
        criada_por: usuarioId,
        rota: contexto.rota ?? null,
        produto_id: contexto.produtoId ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch (e) {
    console.error("[copilot] falha ao garantir conversa:", e);
    return null;
  }
}

/**
 * Grava o turno — pergunta e resposta, com o rastro de ferramentas.
 *
 * O rastro é o que permite responder "de onde veio esse número?" sem
 * reprocessar a conversa. Sem ele, o histórico guarda o que foi dito e perde
 * o que foi consultado — que é justamente a parte auditável.
 */
export async function gravarTurno(
  clienteId: string,
  conversaId: string,
  turno: TurnoGravado
): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("copilot_mensagens")
      .insert([
        {
          conversa_id: conversaId,
          cliente_id: clienteId,
          papel: "lojista",
          texto: turno.pergunta,
          // ---- AS DUAS LINHAS PRECISAM DAS MESMAS CHAVES. Ver INC-004.
          //
          // Vão no MESMO insert, e o PostgREST monta UMA lista de colunas com a
          // UNIÃO das chaves das duas. A chave que falta numa delas não recebe o
          // DEFAULT da coluna — recebe NULL EXPLÍCITO.
          //
          // `ferramentas` é NOT NULL DEFAULT '{}'. Sem esta linha, o NULL da
          // fala do lojista derrubava o insert INTEIRO com 23502, e nenhum turno
          // chegava a `copilot_mensagens` — em produção, todos.
          ferramentas: [],
          // Nulos por SIGNIFICADO, não por descuido: as duas colunas são
          // nuláveis, e tokens e apresentação pertencem à geração do assistente.
          // Zero diria "custou zero"; null diz "não se aplica a esta fala".
          tokens: null,
          metadata: null,
        },
        {
          conversa_id: conversaId,
          cliente_id: clienteId,
          papel: "assistente",
          texto: turno.resposta,
          ferramentas: turno.ferramentas,
          tokens: turno.tokens,
          metadata: turno.metadata ?? null,
        },
      ]);
    // ---- O CLIENTE NÃO LANÇA EM ERRO DE BANCO: devolve `{ data, error }`.
    //
    // Sem ler o `error`, o `catch` abaixo nunca é atingido por uma recusa do
    // Postgres — e foi assim que o 23502 acima ficou invisível em todo turno,
    // com a tela respondendo normalmente. As funções vizinhas deste arquivo já
    // conferem `error`; esta era a única que descartava o retorno.
    if (error) {
      console.error("[copilot] falha ao gravar turno em copilot_mensagens:", error);
    }
  } catch (e) {
    // Ver o cabeçalho: perder o registro é ruim, perder a resposta é pior.
    console.error("[copilot] falha ao gravar turno:", e);
  }
}

/**
 * O que a ÚLTIMA fala do assistente apresentou.
 *
 * Uma mensagem só, a mais recente do assistente. Buscar "a lista mais recente
 * que existir" acharia a de três turnos atrás e a trataria como corrente — e é
 * exatamente esse erro que a referência estruturada existe para impedir. Se a
 * última fala não mostrou lista, não há lista: "o segundo" não tem referente, e
 * a resposta certa é perguntar.
 *
 * O TENANT entra na consulta. Uma conversa de outro cliente não devolve
 * candidatos — devolve nada, que é indistinguível de não haver.
 */
export async function ultimaApresentacao(
  clienteId: string,
  conversaId: string
): Promise<{ papel: string; metadata: unknown }[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("copilot_mensagens")
      .select("papel, metadata")
      .eq("cliente_id", clienteId)
      .eq("conversa_id", conversaId)
      .eq("papel", "assistente")
      .order("criada_em", { ascending: false })
      .limit(1);
    if (error || !data) return [];
    return data as { papel: string; metadata: unknown }[];
  } catch (e) {
    console.error("[copilot] falha ao ler a última apresentação:", e);
    return [];
  }
}
