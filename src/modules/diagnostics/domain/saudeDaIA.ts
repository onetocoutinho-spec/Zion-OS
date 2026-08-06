// Qual inteligência está atendendo a lojista, agora. Puro, sem rede.
//
// ===========================================================================
// POR QUE ISTO PRECISA EXISTIR
// ===========================================================================
//
// Nove pontos deste sistema chamam IA — a esteira, o chat, a classificação de
// pergunta, a extração de catálogo em PDF, a consulta de peso, a geração de
// imagem, o agente de título, o otimizador. Cada um decide o provedor lendo
// variáveis de ambiente, e NENHUMA TELA DIZ O QUE FOI DECIDIDO.
//
// O sintoma medido: com a chave ausente, a otimização devolve texto marcado
// `[SIMULAÇÃO]` e a lojista não tem como distinguir isso de um resultado real
// ruim. Antes disso, em 05/08/2026, o chat respondeu "nenhum provedor
// configurado" num servidor que tinha a chave da Anthropic — porque a rota
// barrava em `GEMINI_API_KEY`. Ninguém tinha onde olhar.
//
// Este módulo é o "onde olhar", e é PURO: recebe as variáveis, devolve o
// retrato. A rota faz a leitura do ambiente e, se pedirem, a sondagem de rede.
//
// ===========================================================================
// O QUE ELE NUNCA FAZ: MOSTRAR A CHAVE
// ===========================================================================
//
// Nem inteira, nem os últimos dígitos, nem o tamanho. "Existe" e "não existe" é
// tudo que uma tela de diagnóstico precisa, e é tudo que ela devolve — porque um
// diagnóstico que vaza credencial é um defeito pior que o que ele diagnostica.

/** Um provedor de texto, como o resto do sistema o nomeia. */
export type ProvedorDeTexto = "anthropic" | "gemini";
export type ProvedorDeImagem = "openai" | "gemini";

export interface RetratoDoProvedor {
  /** O nome, para a tela. */
  nome: string;
  /** A chave existe no servidor? NUNCA o valor dela. */
  temChave: boolean;
  /** Este é o escolhido para o trabalho? */
  ativo: boolean;
  /**
   * O caminho está ESCRITO?
   *
   * Separado de `temChave` de propósito. A distinção nasceu de um caso real: a
   * OpenAI passou um dia com chave aceita e caminho inexistente, porque o formato
   * da API não podia ser verificado deste ambiente. Em 06/08/2026 o caminho foi
   * escrito e o campo virou `true`.
   *
   * Continua separado porque colapsar os dois faria a tela prometer uma
   * capacidade que lança ao ser usada — o defeito que `provedorImagem` documenta
   * na queda silenciosa. O próximo provedor que entrar no tipo sem código escrito
   * cai exatamente aqui.
   */
  implementado: boolean;
  /** O modelo que este caminho usa, quando há um fixado. */
  modelo?: string;
}

export interface SaudeDaIA {
  texto: {
    ativo: ProvedorDeTexto | null;
    /** Por que não há nenhum. `null` quando há. */
    motivo: string | null;
    provedores: RetratoDoProvedor[];
  };
  imagem: {
    ativo: ProvedorDeImagem | null;
    motivo: string | null;
    provedores: RetratoDoProvedor[];
  };
  /**
   * O que a lojista veria HOJE se pedisse otimização.
   *
   * É a pergunta que a tela de configurações precisa responder em uma linha, e
   * a razão de este módulo existir: "IA real" ou "[SIMULAÇÃO]".
   */
  otimizacaoEhReal: boolean;
}

/** As variáveis que decidem tudo. Entram como dado para o módulo ser testável. */
export interface AmbienteDaIA {
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  IA_PROVEDOR?: string;
  IA_IMAGEM_PROVEDOR?: string;
  ANTHROPIC_MODELO_CONVERSA?: string;
  GEMINI_IMAGE_MODEL?: string;
}

/**
 * Os caminhos de imagem que existem de verdade.
 *
 * Espelha `IMPLEMENTADOS` de `lib/agentes/provedorImagem.ts`. São dois lugares e
 * isso é dívida conhecida — mas a alternativa era este módulo puro importar de
 * `lib/agentes`, que é código de servidor com SDK. Há um teste que compara as
 * duas listas lendo a fonte, então divergir reprova.
 */
const IMAGEM_IMPLEMENTADA: ReadonlySet<ProvedorDeImagem> = new Set<ProvedorDeImagem>([
  "gemini",
  "openai",
]);

/**
 * A MESMA ordem de `provedorConfigurado()` em `lib/agentes/provedorIA.ts`.
 *
 * Repetida aqui pelo mesmo motivo acima, e guardada pelo mesmo teste: se a
 * preferência mudar lá e não aqui, a tela de diagnóstico passa a mentir sobre
 * quem está atendendo — que é exatamente o defeito que ela existe para acabar.
 */
export function textoAtivo(env: AmbienteDaIA): ProvedorDeTexto | null {
  const forcado = env.IA_PROVEDOR?.toLowerCase();
  const temGemini = Boolean(env.GEMINI_API_KEY);
  const temAnthropic = Boolean(env.ANTHROPIC_API_KEY);
  if (forcado === "gemini" && temGemini) return "gemini";
  if (forcado === "anthropic" && temAnthropic) return "anthropic";
  if (temAnthropic) return "anthropic";
  if (temGemini) return "gemini";
  return null;
}

/** A MESMA ordem de `provedorDeImagemConfigurado()`. Mesmo teste guarda. */
export function imagemAtiva(env: AmbienteDaIA): ProvedorDeImagem | null {
  const forcado = env.IA_IMAGEM_PROVEDOR?.toLowerCase();
  const temOpenai = Boolean(env.OPENAI_API_KEY);
  const temGemini = Boolean(env.GEMINI_API_KEY);
  if (forcado === "openai" && temOpenai) return "openai";
  if (forcado === "gemini" && temGemini) return "gemini";
  if (temGemini) return "gemini";
  if (temOpenai) return "openai";
  return null;
}

export function retratoDaIA(env: AmbienteDaIA): SaudeDaIA {
  const ativoTexto = textoAtivo(env);
  const ativoImagem = imagemAtiva(env);

  const texto: RetratoDoProvedor[] = [
    {
      nome: "Anthropic (Claude)",
      temChave: Boolean(env.ANTHROPIC_API_KEY),
      ativo: ativoTexto === "anthropic",
      implementado: true,
      modelo: env.ANTHROPIC_MODELO_CONVERSA ?? "claude-sonnet-5",
    },
    {
      nome: "Google (Gemini)",
      temChave: Boolean(env.GEMINI_API_KEY),
      ativo: ativoTexto === "gemini",
      implementado: true,
    },
  ];

  const imagem: RetratoDoProvedor[] = [
    {
      nome: "Google (Gemini)",
      temChave: Boolean(env.GEMINI_API_KEY),
      ativo: ativoImagem === "gemini",
      implementado: true,
      modelo: env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image",
    },
    {
      nome: "OpenAI",
      temChave: Boolean(env.OPENAI_API_KEY),
      ativo: ativoImagem === "openai",
      // Lido da lista, não fixado: foi `false` por um dia (chave sem caminho) e
      // virou `true` quando a chamada foi escrita com o formato medido.
      implementado: IMAGEM_IMPLEMENTADA.has("openai"),
    },
  ];

  return {
    texto: {
      ativo: ativoTexto,
      motivo:
        ativoTexto === null
          ? "Nenhuma chave de IA de texto no servidor (ANTHROPIC_API_KEY ou GEMINI_API_KEY). A otimização vai devolver [SIMULAÇÃO]."
          : null,
      provedores: texto,
    },
    imagem: {
      ativo: ativoImagem,
      motivo: motivoDaImagem(ativoImagem),
      provedores: imagem,
    },
    // A pergunta que a tela responde em uma linha. Depende SÓ do texto: é a
    // esteira que produz o `[SIMULAÇÃO]`, e ela não gera imagem.
    otimizacaoEhReal: ativoTexto !== null,
  };
}

function motivoDaImagem(ativo: ProvedorDeImagem | null): string | null {
  if (ativo === null) {
    return "Nenhum provedor de imagem configurado (GEMINI_API_KEY ou OPENAI_API_KEY).";
  }
  if (!IMAGEM_IMPLEMENTADA.has(ativo)) {
    // Genérico: em 06/08/2026 os dois caminhos passaram a existir, então esta
    // linha só é alcançada por um provedor NOVO que entrou no tipo sem caminho
    // escrito. Nomear a OpenAI aqui virou mentira no dia em que ela funcionou.
    return `O caminho de imagem "${ativo}" está escolhido e não foi implementado. Configure outro provedor, ou escreva o caminho dele.`;
  }
  return null;
}
