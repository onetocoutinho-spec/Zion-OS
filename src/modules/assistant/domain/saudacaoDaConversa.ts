// "Olá" não é uma pergunta mal formulada.
//
// ===========================================================================
// O QUE ACONTECEU
// ===========================================================================
//
// Em 05/08/2026 a primeira coisa digitada no chat foi "Olá". A resposta:
//
//     Não entendi a sua pergunta. Por favor, diga o que você precisa sobre a
//     operação da loja.
//
// O classificador acertou. A lista fechada de intenções não tem lugar para um
// cumprimento, então "Olá" caiu em `fora_do_alcance` — que é literalmente o
// certo pela regra que eu escrevi. O defeito não é do modelo: é que a regra não
// previa a primeira frase que qualquer pessoa escreve.
//
// E o custo é desproporcional ao tamanho: é o PRIMEIRO contato da lojista com o
// copiloto. Ser recebida com "não entendi" ensina que a ferramenta é difícil,
// antes de ela ter feito uma pergunta de verdade.
//
// ===========================================================================
// POR QUE ISTO NÃO PASSA PELO MODELO
// ===========================================================================
//
// Reconhecer "bom dia" não precisa de inteligência, e mandar ao modelo custaria
// uma chamada de rede, alguns segundos e a chance de errar — os mesmos segundos
// que, no esforço padrão, estouravam o tempo da rota e punham `<!DOCTYPE` na
// tela. Cumprimento é decidido aqui, de graça, antes de qualquer rede.
//
// A REGRA É A FRASE INTEIRA, e essa é a parte que importa. "Bom dia, quantos
// produtos estão sem peso?" NÃO é um cumprimento — é uma pergunta com educação
// na frente. Casar por prefixo faria o chat responder "olá!" e engolir a
// pergunta, que é pior que a recusa que estamos consertando: a recusa ao menos
// era visível.

/** Tira acento, pontuação e caixa. O que sobra são palavras separadas por espaço. */
function normalizar(frase: string): string {
  const semAcento = frase
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return n < 0x300 || n > 0x36f;
    })
    .join("");
  return semAcento
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * As palavras que só aparecem em cumprimento.
 *
 * Uma delas precisa estar presente. Sem isso, "tudo" ou "como vai" sozinhos
 * viravam cumprimento, e "como vai" é o começo de perguntas de verdade.
 */
const NUCLEO = new Set([
  "oi",
  "ola",
  "opa",
  "alo",
  "hey",
  "hi",
  "hello",
  "salve",
  "saudacoes",
  "bom",
  "boa",
  "tudo",
  "beleza",
  "blz",
  "eai",
  // "e aí" chega aqui como DOIS tokens, e nenhum dos dois era núcleo — o teste
  // pegou. "ai" sozinho é interjeição inofensiva, e o portão do
  // acompanhamento continua barrando "e aí, o que eu faço?" pela palavra "o".
  "ai",
]);

/**
 * Tudo que pode acompanhar o núcleo.
 *
 * NÃO tem artigo ("o", "a"), NÃO tem substantivo da operação ("loja", "peso",
 * "produto") e NÃO tem verbo de pedido. É o que impede uma pergunta real de ser
 * confundida com um cumprimento: basta UMA palavra fora desta lista para a
 * frase deixar de ser saudação. "Bom dia, e a loja?" tem "loja" — não casa.
 */
const ACOMPANHAMENTO = new Set([
  ...NUCLEO,
  "dia",
  "tarde",
  "noite",
  "bem",
  "e",
  "ai",
  "como",
  "vai",
  "vc",
  "voce",
  "ta",
  "tas",
  "esta",
  "estas",
  "prazer",
  "ola",
  "td",
]);

/**
 * A frase é UM CUMPRIMENTO e nada mais?
 *
 * `false` para frase vazia: quem não escreveu nada não cumprimentou, e a rota
 * já tem a mensagem certa para isso.
 */
export function ehSaudacao(frase: string): boolean {
  const limpa = normalizar(frase);
  if (!limpa) return false;
  const palavras = limpa.split(" ");
  // Um cumprimento é curto. O teto existe para que uma frase longa feita só de
  // palavras inocentes não vire saudação por acidente.
  if (palavras.length > 6) return false;
  if (!palavras.some((p) => NUCLEO.has(p))) return false;
  return palavras.every((p) => ACOMPANHAMENTO.has(p));
}

/**
 * A resposta ao cumprimento.
 *
 * Curta de propósito: quem escreveu "oi" quer saber que tem alguém do outro
 * lado, não ler um manual. A lista do que dá para perguntar vem junto porque é
 * exatamente o momento em que ela é útil — e é a MESMA lista que aparece na
 * recusa, para o vocabulário ser um só.
 */
export const RESPOSTA_DA_SAUDACAO =
  "Olá! Eu acompanho a sua operação e respondo com os números reais do seu catálogo.";
