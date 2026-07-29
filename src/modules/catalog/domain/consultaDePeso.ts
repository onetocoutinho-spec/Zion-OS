// Consultar o estado de peso em linguagem natural — puro, sem rede, sem React.
//
// POR QUE ISTO EXISTE
//
// A tela de peso já tem filtro e lista. Este módulo não cria uma resposta
// paralela: ele traduz uma frase no MESMO critério que os controles produzem,
// para que escrever e clicar sejam duas entradas da mesma superfície. Resposta
// do modelo em cima e tabela mostrando outra realidade seria pior que não ter.
//
// O QUE O MODELO PODE E O QUE ELE NÃO PODE
//
// O modelo lê linguagem e devolve CRITÉRIO. Nunca ids, nunca contagens, nunca
// classificação de estado. Quem resolve é o código, contra os dados reais.
//
// Provado no EXP-004, três rodadas: a extração de marca e estado acertou 39 de
// 39, e o resolvedor nunca errou com o critério que recebeu. O que falhou nas
// duas primeiras rodadas foi pedir ao modelo que julgasse o que o domínio
// conhece — responsabilidade que aqui é do Zion.
//
// A FRONTEIRA É PARTE DA RESPOSTA, NÃO UM ERRO
//
// "chinelo" não existe como atributo: `categoria` guarda código do ML
// (MLB273770) e a palavra só aparece no nome — onde ela convive com "tamanco" e
// "rasteira" no MESMO produto. Então o termo é declarado e NÃO filtra nada.
//
// Dizer "não existem chinelos" a partir de uma busca textual seria transformar
// ausência de evidência cadastral em evidência de ausência. O sistema diz o que
// sabe provar e nomeia o que não sabe.

import { pesoPendente, type EstadoDePeso } from "./familiaDeProduto.ts";

/** O que o modelo devolve. Sem id, sem contagem, sem estado calculado. */
export interface CriterioDePeso {
  entendeu: boolean;
  /** Preenchido quando `entendeu` é falso — o que perguntar de volta. */
  perguntar: string;
  /** Marca pedida. Validada contra a enumeração real; "" = nenhuma. */
  marca: string;
  estadoDePeso: "faltando" | "completo" | "nao_mencionado";
  /** Tipos e adjetivos citados, como vieram. O Zion decide o que sabe resolver. */
  termosDoProduto: string[];
  /** A frase reescrita, para a pessoa conferir o que foi entendido. */
  interpretacao: string;
}

export type DesfechoConsulta =
  /** Tudo que foi pedido é resolvível e há resultado. */
  | "encontrado"
  /** Tudo resolvível, conjunto vazio. É fato, não ambiguidade. */
  | "vazio"
  /** Marca fora da enumeração, ou frase não compreendida. */
  | "invalido"
  /** Resolveu o que sabe; sobrou termo que o domínio não representa. */
  | "com_fronteira";

export interface ResultadoConsulta {
  desfecho: DesfechoConsulta;
  /** Ids dos produtos que satisfazem a parte PROVÁVEL do pedido. */
  produtoIds: string[];
  /** Termos citados que o domínio não sabe classificar. Nunca filtram. */
  fronteira: string[];
  /** O que dizer à pessoa, montado pelo Zion a partir dos fatos. */
  mensagem: string;
}

/** O mínimo que a consulta precisa saber de um produto. */
export interface ProdutoConsultavel extends EstadoDePeso {
  id: string;
  marca: string;
}

/**
 * Palavras que só nomeiam o objeto consultado — não restringem nada.
 *
 * Enumeração FECHADA e deliberadamente curta. Ela existe porque a extração
 * ampla é o que preserva os termos que importam: no EXP-004, pedir ao modelo
 * que excluísse o genérico fez ele perder "chinelo" e "tênis" também. Recall é
 * do modelo; precisão é daqui.
 */
const GENERICOS = new Set(["produto", "produtos", "item", "itens", "coisa", "coisas"]);

/**
 * O termo repete um eixo que o Zion JÁ resolveu?
 *
 * Medido na tela, não suposto: para "Quais Havaianas estão sem peso?" o modelo
 * devolveu `marca: "Havaianas"` E `termosDoProduto: ["Havaiana"]`. A contagem
 * saiu certa e o termo não filtrou nada — mas a mensagem anunciava que o
 * catálogo "não classifica Havaiana", sobre um eixo que ele conhece.
 *
 * Fronteira falsa é pior que fronteira ausente: ela ensina a pessoa a ignorar o
 * aviso, e o aviso é justamente o que separa o que o Zion prova do que não sabe.
 *
 * Comparação por radical porque o operador fala no singular e no plural
 * ("Havaiana", "Havaianas") e a marca não muda por isso.
 */
function repeteEixoConhecido(termo: string, marcaExtraida: string): boolean {
  const t = semAcento(termo);
  if (t.length < 4) return false;
  if (t.includes("peso")) return true; // o estado já é campo próprio
  const m = semAcento(marcaExtraida);
  if (!m) return false;
  const radical = (a: string, b: string) => a.startsWith(b.slice(0, Math.min(5, b.length)));
  return radical(t, m) || radical(m, t);
}

const semAcento = (s: string): string =>
  s
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return n < 0x300 || n > 0x36f;
    })
    .join("")
    .toLowerCase()
    .trim();

/**
 * Resolve o critério contra os produtos reais.
 *
 * NENHUM termo do produto filtra — nem os que "parecem" resolvíveis. O domínio
 * não tem classificação de tipo, e inventar uma aqui seria a inferência
 * probabilística virando dado cadastral, que é exatamente o defeito que a
 * importação de planilha e a esteira já cometeram neste projeto.
 */
export function resolverConsulta(
  criterio: CriterioDePeso,
  produtos: readonly ProdutoConsultavel[],
  marcasConhecidas: readonly string[]
): ResultadoConsulta {
  const marcaValida = criterio.marca === "" || marcasConhecidas.includes(criterio.marca);

  if (!criterio.entendeu || !marcaValida) {
    return {
      desfecho: "invalido",
      produtoIds: [],
      fronteira: [],
      mensagem:
        criterio.perguntar.trim() ||
        `Não reconheci "${criterio.marca}" entre as marcas do seu catálogo.`,
    };
  }

  const fronteira = (criterio.termosDoProduto ?? [])
    .map((t) => t.trim())
    .filter((t) => t && !GENERICOS.has(semAcento(t)))
    // Eixo já resolvido não vira fronteira — ver `repeteEixoConhecido`.
    .filter((t) => !repeteEixoConhecido(t, criterio.marca));

  let set = produtos.filter((p) => (criterio.marca ? p.marca === criterio.marca : true));
  if (criterio.estadoDePeso === "faltando") set = set.filter(pesoPendente);
  if (criterio.estadoDePeso === "completo") {
    set = set.filter((p) => p.quantidadeVariantes > 0 && !pesoPendente(p));
  }

  const produtoIds = set.map((p) => p.id);
  const variacoes = set.reduce((a, p) => a + p.variacoesSemPeso, 0);

  // Vazio PRECEDE fronteira: sem nada para mostrar, declarar o termo
  // desconhecido é ruído. Não há candidato a oferecer.
  if (produtoIds.length === 0) {
    return {
      desfecho: "vazio",
      produtoIds,
      fronteira: [],
      mensagem: "Nenhum produto atende a essa consulta.",
    };
  }

  const base =
    criterio.estadoDePeso === "faltando"
      ? `${produtoIds.length} produto(s) · ${variacoes} variação(ões) sem peso.`
      : `${produtoIds.length} produto(s).`;

  if (fronteira.length === 0) {
    return { desfecho: "encontrado", produtoIds, fronteira, mensagem: base };
  }

  return {
    desfecho: "com_fronteira",
    produtoIds,
    fronteira,
    mensagem:
      `${base} Você também pediu "${fronteira.join('", "')}" — o catálogo não classifica ` +
      `esse termo de forma confiável, então ele NÃO foi usado para incluir nem excluir nada.`,
  };
}

/** O evento de uso, sem a frase. Guardar texto livre exige decisão própria. */
export interface UsoDaConsulta {
  /** "texto" quando veio do campo; "filtro" quando veio dos controles. */
  origem: "texto" | "filtro";
  desfecho: DesfechoConsulta | null;
  produtos: number;
  temFronteira: boolean;
  /** ISO. Serve para saber se a pessoa repetiu a consulta logo em seguida. */
  em: string;
}
