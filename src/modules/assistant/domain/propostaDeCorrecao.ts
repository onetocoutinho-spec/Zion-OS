// O cliente fala um valor; o Zion propõe a mudança; o cliente confirma; o
// código grava.
//
// A ordem importa e não é negociável: PROPOSTA NÃO É AÇÃO. O modelo classifica
// o que foi dito, o código monta uma mudança concreta e revisável — qual
// produto, qual campo, qual valor, quantas variações — e só depois de alguém
// olhar e confirmar é que algo é escrito.
//
// A tentação é pular a confirmação quando a frase parece clara. Não pulamos:
// "o peso do chinelo é 300" tem três formas de dar errado (qual chinelo, 300 do
// quê, o cliente falou do errado) e nenhuma delas se descobre depois de gravar
// em 39 variações. Esta base já recebeu R$ 1,77 de piso e R$ 30 milhões de
// custo por escrita que ninguém revisou.
//
// O alvo NUNCA é adivinhado. Dois candidatos viram pergunta, não sorteio.

import type { EstadoDePeso } from "./../../catalog/domain/familiaDeProduto";
import type { AutoridadeDoValor } from "./propostaPersistida";

/** O que o modelo devolve. `string` porque entrada de modelo é não confiável. */
export interface CriterioDeCorrecao {
  entendeu: boolean;
  perguntar: string;
  campo: string;
  /** O número como apareceu na frase — a vírgula decimal sobrevive. */
  valor: string;
  unidade: string;
  /** O que a frase diz sobre QUAL produto. Sem filtrar: filtrar é do código. */
  termosDoAlvo: string[];
  interpretacao: string;
}

export type CampoCorrigivel = "peso" | "custo";

const CAMPOS: readonly CampoCorrigivel[] = ["peso", "custo"];

/** O produto candidato, do jeito que a tela já o tem. */
export interface ProdutoAlvo extends EstadoDePeso {
  id: string;
  nome: string;
  marca: string;
  custo: number;
}

export type Proposta =
  | {
      tipo: "pronta";
      campo: CampoCorrigivel;
      alvo: { id: string; nome: string };
      /** Gramas para peso, reais para custo. Sempre a unidade canônica. */
      valor: number;
      /** Como o valor será mostrado a quem confirma. */
      valorEscrito: string;
      /** Quantas variações serão tocadas. 0 para custo (é do produto pai). */
      variacoes: number;
      /** A frase da confirmação. É ela que a pessoa lê antes de decidir. */
      resumo: string;
      /** Verdadeiro quando a unidade foi DEDUZIDA e não dita. */
      unidadeDeduzida: boolean;
      /**
       * De onde o Zion sabe que veio `valor`. Ver INC-008.
       *
       * ESTA FUNÇÃO SÓ CONSEGUE PRODUZIR `sem_autoridade`, e isso é uma
       * propriedade dela, não um descuido: ela monta a proposta a partir de um
       * `CriterioDeCorrecao`, cujo `valor` chega como argumento do modelo. Não há
       * nada aqui que ligue o número a uma fala do lojista nem a uma fonte do
       * domínio.
       *
       * Um caminho que DERIVE ou CALCULE o valor não deve passar por aqui — deve
       * declarar a própria autoridade na fronteira que conhece o fato, como
       * `preparar_resolucao` faz. Congelado em `autoridadeDaProposta.test.ts`.
       */
      autoridade: AutoridadeDoValor;
    }
  | { tipo: "ambigua"; candidatos: readonly { id: string; nome: string }[]; mensagem: string }
  | { tipo: "sem_alvo"; mensagem: string }
  | { tipo: "recusada"; mensagem: string };

/** Quantos candidatos cabem numa pergunta antes de ela virar uma lista inútil. */
const MAXIMO_CANDIDATOS = 6;

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * O número, do jeito brasileiro.
 *
 * "0,3" é três décimos, não três. Tratar a vírgula como separador de milhar
 * transformaria 0,3 kg em 3 kg — dez vezes o peso, e o frete junto.
 */
export function lerNumero(bruto: string): number | null {
  const limpo = bruto.trim().replace(/\s/g, "");
  if (!limpo) return null;
  // Vírgula é decimal. Ponto só é decimal quando não há vírgula.
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * Gramas, a partir do número e da unidade dita.
 *
 * Quando a unidade NÃO foi dita, deduzimos — e a dedução vai escrita na
 * proposta, para quem confirma ler "300 g" e não um número solto. É a
 * confirmação que torna a dedução segura; sem ela, isto seria adivinhação.
 *
 * O corte em 30 é empírico e conservador: nenhum calçado pesa 30 g, e ninguém
 * informa 30 kg de caixa. Abaixo disso o cliente está falando em quilos.
 */
export function paraGramas(
  n: number,
  unidade: string
): { gramas: number; deduzida: boolean } | null {
  const u = semAcento(unidade);
  if (u === "kg" || u.startsWith("quilo") || u.startsWith("kilo")) {
    return { gramas: Math.round(n * 1000), deduzida: false };
  }
  if (u === "g" || u.startsWith("grama")) return { gramas: Math.round(n), deduzida: false };
  if (n <= 0) return null;
  return n < 30
    ? { gramas: Math.round(n * 1000), deduzida: true }
    : { gramas: Math.round(n), deduzida: true };
}

/**
 * Os produtos que a frase pode estar citando.
 *
 * Casamento por TODOS os termos, sem acento e sem caixa. Um termo que não
 * aparece elimina o candidato — o contrário (qualquer termo serve) devolveria
 * meio catálogo para uma frase específica.
 */
export function candidatos(
  termos: readonly string[],
  produtos: readonly ProdutoAlvo[]
): readonly ProdutoAlvo[] {
  const limpos = termos.map((t) => semAcento(t.trim())).filter(Boolean);
  if (limpos.length === 0) return [];
  return produtos.filter((p) => {
    const alvo = semAcento(`${p.nome} ${p.marca}`);
    return limpos.every((t) => alvo.includes(t));
  });
}

/**
 * A proposta — ou o motivo de não haver uma.
 *
 * `produtoAberto` é o produto que a tela já tem em foco. Quando ele existe e a
 * frase não nomeia outro, ele É o alvo: com um produto aberto, "o peso é 300"
 * não é ambíguo para quem digitou, e perguntar de volta seria burocracia.
 */
export function montarProposta(
  criterio: CriterioDeCorrecao,
  produtos: readonly ProdutoAlvo[],
  produtoAberto?: { id: string; nome: string } | null
): Proposta {
  if (!criterio.entendeu) {
    return {
      tipo: "recusada",
      mensagem: criterio.perguntar.trim() || "Não entendi. Pode dizer de outro jeito?",
    };
  }

  const campo = CAMPOS.find((c) => c === criterio.campo);
  if (!campo) {
    return {
      tipo: "recusada",
      mensagem:
        "Por enquanto eu só preencho peso e custo pelo chat. O resto tem tela própria.",
    };
  }

  const numero = lerNumero(criterio.valor);
  if (numero === null || numero <= 0) {
    // Zero não é peso nem custo: é a ausência deles. Gravado como número, o
    // frete sai da faixa mais barata e o preço mínimo fica abaixo do que se
    // paga — a pendência é mais honesta que o zero.
    return {
      tipo: "recusada",
      mensagem: `Não consegui ler "${criterio.valor}" como um valor. Escreva o número, por exemplo "300 g" ou "R$ 17,16".`,
    };
  }

  // O ALVO. Termos ditos vencem o produto aberto: quem nomeia outro produto
  // está falando dele, mesmo com um terceiro na tela.
  const achados = candidatos(criterio.termosDoAlvo, produtos);
  let alvo: ProdutoAlvo | undefined;

  if (achados.length === 1) {
    alvo = achados[0];
  } else if (achados.length > 1) {
    return {
      tipo: "ambigua",
      candidatos: achados.slice(0, MAXIMO_CANDIDATOS).map((p) => ({ id: p.id, nome: p.nome })),
      mensagem:
        achados.length > MAXIMO_CANDIDATOS
          ? `${achados.length} produtos batem com isso. Diga o nome com mais precisão, ou escolha um destes:`
          : "Qual destes?",
    };
  } else if (criterio.termosDoAlvo.filter((t) => t.trim()).length > 0) {
    // A frase nomeou algo e nada bateu. Cair no produto aberto seria gravar
    // num produto que a pessoa não citou.
    return {
      tipo: "sem_alvo",
      mensagem: `Não achei nenhum produto que bata com "${criterio.termosDoAlvo.join(" ")}".`,
    };
  } else if (produtoAberto) {
    alvo = produtos.find((p) => p.id === produtoAberto.id);
  }

  if (!alvo) {
    return {
      tipo: "sem_alvo",
      mensagem: "Não sei de qual produto você está falando. Diga o nome, ou abra o produto.",
    };
  }

  if (campo === "custo") {
    const reais = Math.round(numero * 100) / 100;
    return {
      tipo: "pronta",
      campo,
      alvo: { id: alvo.id, nome: alvo.nome },
      valor: reais,
      valorEscrito: `R$ ${reais.toFixed(2).replace(".", ",")}`,
      variacoes: 0,
      unidadeDeduzida: false,
      autoridade: "sem_autoridade",
      resumo:
        alvo.custo > 0
          ? `Trocar o custo de ${alvo.nome} de R$ ${alvo.custo.toFixed(2).replace(".", ",")} para R$ ${reais.toFixed(2).replace(".", ",")}.`
          : `Gravar R$ ${reais.toFixed(2).replace(".", ",")} de custo em ${alvo.nome}.`,
    };
  }

  const emGramas = paraGramas(numero, criterio.unidade);
  if (!emGramas) {
    return { tipo: "recusada", mensagem: `Não consegui ler "${criterio.valor}" como peso.` };
  }

  // Quantas variações isto toca — o número que faz alguém parar e conferir
  // antes de confirmar. 39 variações é diferente de 1.
  const variacoes = alvo.quantidadeVariantes || 1;
  return {
    tipo: "pronta",
    campo,
    alvo: { id: alvo.id, nome: alvo.nome },
    valor: emGramas.gramas,
    valorEscrito: `${emGramas.gramas} g`,
    variacoes,
    unidadeDeduzida: emGramas.deduzida,
    autoridade: "sem_autoridade",
    resumo:
      `Gravar ${emGramas.gramas} g de peso em ${alvo.nome}` +
      (variacoes > 1 ? ` — todas as ${variacoes} variações.` : "."),
  };
}
