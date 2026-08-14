// O que o assistente da operação pode responder — e o que ele não pode.
//
// Este módulo é a metade do chat que NÃO conversa. Ele recebe uma intenção já
// extraída (pelo modelo, no servidor) e o estado real da loja (do banco, no
// cliente) e devolve a resposta. Nenhum número aqui vem do modelo: ele nunca vê
// as contagens, justamente para não poder inventá-las.
//
// A divisão é a mesma medida no EXP-004 (3 rodadas, 39 turnos): a extração de
// intenção acertou 39 de 39, e o resolvedor determinístico nunca errou com o
// critério que recebeu. As duas rodadas que falharam falharam por pedir ao
// modelo que julgasse o que o domínio já conhece.
//
//   Recall é do modelo, precisão é do código.
//
// Um termo a mais o código descarta de forma determinística. Um termo a menos é
// irrecuperável — por isso o modelo é instruído a não filtrar nada.

import type {
  AmostraDeNomes,
  CondicaoNomeavel,
  EstadoDaLoja,
  Lacuna,
  TipoLacuna,
} from "../../publication/domain/prontidaoDaLoja";
import { fraseDosNomes, lacunasDaLoja } from "../../publication/domain/prontidaoDaLoja";
import type { EstadoDoProduto, LacunaProduto } from "../../catalog/domain/lacunasDoProduto";
import { lacunasDoProduto } from "../../catalog/domain/lacunasDoProduto";

/**
 * O que o modelo devolve. Campos rasos de propósito — é o formato que os
 * provedores de saída estruturada respeitam com mais fidelidade, e o mesmo
 * usado na consulta de peso.
 *
 * `assunto` e `capacidade` são `string`, não os enums, DE PROPÓSITO. O que vem
 * do modelo é entrada não confiável, e tipá-la como se já estivesse validada
 * transforma uma checagem que o compilador poderia exigir numa suposição.
 *
 * Este arquivo já pagou por isso: a primeira versão usava `""` para "não se
 * aplica" e o Gemini recusou o schema inteiro — `enum` não aceita string
 * vazia. Com validação no código, a troca do sentinela (ou do provedor) não
 * volta a quebrar: o que não está na lista fechada é tratado como ausente.
 *
 *   Recall é do modelo, precisão é do código.
 */
export interface CriterioDaPergunta {
  entendeu: boolean;
  /** Quando não entendeu: o que perguntar de volta. */
  perguntar: string;
  intencao: string;
  assunto: string;
  capacidade: string;
  /** O que o modelo entendeu, em uma frase. Mostrado a quem perguntou. */
  interpretacao: string;
  // ---- Só usados quando a intenção é "preencher". Vivem no mesmo objeto
  // porque a rota devolve UM objeto: separar em dois tipos faria alguém montar
  // o segundo a partir do primeiro, e é aí que campo e valor se desencontram.
  // Quem os lê é `propostaDeCorrecao`, que os valida antes de propor qualquer
  // coisa. Aqui eles só trafegam.
  campo: string;
  valor: string;
  unidade: string;
  termosDoAlvo: string[];
}

/** O sentinela de "não se aplica". Um valor real porque `""` não é aceito. */
export const NENHUM = "nenhum";

const INTENCOES: readonly TipoDeIntencao[] = [
  "estado_geral",
  "contagem",
  "proximo_passo",
  "por_que_travado",
  "sobre_este_produto",
  "fora_do_alcance",
];

/** Exportada para o teste cobrar TODO assunto novo, não só os que eu lembrei. */
export const ASSUNTOS_CONTAVEIS_PARA_TESTE: readonly AssuntoContavel[] = [
  "peso",
  "custo",
  "foto",
  "anuncio",
  "aprovacao",
  "publicacao",
  "precificacao",
  "infracao",
];

const CAPACIDADES: readonly Capacidade[] = ["precificar", "anunciar", "publicar"];

/** `null` para qualquer coisa fora da lista fechada — inclusive "", "nenhum" e lixo. */
function comoIntencao(x: string): TipoDeIntencao | null {
  return INTENCOES.find((i) => i === x) ?? null;
}
function comoAssunto(x: string): AssuntoContavel | null {
  return ASSUNTOS_CONTAVEIS_PARA_TESTE.find((a) => a === x) ?? null;
}
function comoCapacidade(x: string): Capacidade | null {
  return CAPACIDADES.find((c) => c === x) ?? null;
}

export type TipoDeIntencao =
  | "estado_geral"
  | "contagem"
  | "proximo_passo"
  | "por_que_travado"
  | "sobre_este_produto"
  | "fora_do_alcance";

/** As coisas que o Zion sabe contar. Lista fechada — o resto é `fora_do_alcance`. */
export type AssuntoContavel =
  | "peso"
  | "custo"
  | "foto"
  | "anuncio"
  | "aprovacao"
  | "publicacao"
  | "precificacao"
  | "infracao";

/** As coisas que a loja consegue (ou não) fazer hoje. */
export type Capacidade = "precificar" | "anunciar" | "publicar";

/**
 * O contexto contra o qual a pergunta é resolvida.
 *
 * `produto` só existe nas telas de cadastro e otimização. Quando existe, "o que
 * falta?" passa a ser sobre ELE — é o que a pessoa quer dizer com a tela aberta
 * num produto, e responder sobre a loja inteira ali seria mudar de assunto.
 */
export interface ContextoDaPergunta {
  loja: EstadoDaLoja;
  produto?: { id: string; nome: string; estado: EstadoDoProduto };
}

export type RespostaDaOperacao =
  | {
      tipo: "numero";
      frase: string;
      quantos: number;
      total: number;
      /** O que `quantos` conta, em palavras. Sem isto o número é invertível. */
      significado: string;
      /**
       * QUAIS são, quando sabemos. Ausente quando não levantamos os nomes —
       * nunca uma lista vazia fingindo que não há.
       */
      quais?: AmostraDeNomes;
      href?: string;
      cta?: string;
    }
  | { tipo: "lista"; frase: string; itens: readonly Lacuna[] }
  | { tipo: "passo"; frase: string; lacuna: Lacuna }
  | { tipo: "produto"; frase: string; nome: string; itens: readonly LacunaProduto[] }
  | { tipo: "nada_travado"; frase: string }
  | { tipo: "perguntar"; frase: string }
  | { tipo: "nao_sei"; frase: string; posso: readonly string[] }
  // Carrega a MESMA lista de `nao_sei`, e é um tipo diferente de propósito: a
  // moldura muda tudo. "Não entendi, mas sei isto" e "Olá, eu sei isto" têm o
  // mesmo conteúdo e ensinam coisas opostas sobre a ferramenta.
  | { tipo: "saudacao"; frase: string; posso: readonly string[] };

/**
 * O que este assistente sabe responder, em português de quem pergunta.
 *
 * Aparece quando ele não sabe. Dizer "não sei" e parar deixa a pessoa adivinhando
 * o vocabulário certo; dizer "não sei, mas sei isto" transforma a recusa em menu.
 */
export const POSSO_RESPONDER: readonly string[] = [
  "Quantos produtos estão sem peso, sem custo, sem foto ou sem anúncio",
  "O que resolver primeiro para destravar o resto",
  "Por que a precificação, o anúncio ou a publicação ainda não andam",
  "Quantas infrações o Mercado Livre registrou na sua conta",
  "Como está a loja hoje, no geral",
  "O que falta neste produto (nas telas de cadastro e otimização)",
];

/**
 * Quantos produtos estão na condição perguntada, e de quantos. Só do estado.
 *
 * `significado` NÃO é enfeite — é o conserto de uma mentira medida.
 *
 * `quantos` significa coisas DIFERENTES conforme o assunto: em peso, custo,
 * foto e anúncio ele conta o que FALTA; em aprovação, publicação e
 * precificação conta o que ESTÁ. O número sozinho é ambíguo por construção.
 *
 * Em 03/08/2026, conferindo o assistente na conta real, o modo conversa
 * recebeu `{ quantos: 0, total: 80 }` para o assunto "anuncio" e escreveu:
 *
 *     "0 dos seus 80 produtos têm anúncio gerado"
 *
 * O verdadeiro é o oposto — 80 de 80 TÊM anúncio, e a `frase` ao lado dizia
 * isso corretamente ("0 ainda não têm"). O modelo preferiu o número cru e
 * inverteu o sentido. Não foi alucinação: foi campo sem rótulo.
 */
function contar(
  a: AssuntoContavel,
  e: EstadoDaLoja
): { quantos: number; total: number; frase: string; significado: string } {
  const t = e.produtos;
  switch (a) {
    case "peso":
      // Parcial é uma terceira condição, não meio-completo (INC-001). Some as
      // duas ausências: quem pergunta "quantos sem peso" quer o que falta
      // preencher, e o produto com 1 de 39 variações pesadas falta.
      return {
        quantos: t - e.comPeso,
        total: t,
        frase: frasePeso(e),
        significado: "produtos a que FALTA o peso da caixa (total ou parcial)",
      };
    case "custo":
      return {
        quantos: t - e.comCusto,
        total: t,
        frase: `${t - e.comCusto} de ${t} produto(s) estão sem custo.`,
        significado: "produtos a que FALTA o custo",
      };
    case "foto":
      return {
        quantos: t - e.comFoto,
        total: t,
        frase: `${t - e.comFoto} de ${t} produto(s) estão sem foto.`,
        significado: "produtos a que FALTA foto",
      };
    case "anuncio":
      return {
        quantos: t - e.comAnuncio,
        total: t,
        frase: `${t - e.comAnuncio} de ${t} produto(s) ainda não têm anúncio gerado.`,
        significado: "produtos que AINDA NÃO têm anúncio gerado — o resto JÁ TEM",
      };
    case "aprovacao":
      return {
        quantos: e.aguardandoAprovacao,
        total: t,
        frase: `${e.aguardandoAprovacao} anúncio(s) esperando o seu aval.`,
        significado: "anúncios que ESTÃO esperando aprovação",
      };
    case "publicacao":
      return {
        quantos: e.aprovadosNaoPublicados,
        total: t,
        frase: `${e.aprovadosNaoPublicados} anúncio(s) aprovados e ainda não publicados.`,
        significado: "anúncios que ESTÃO aprovados e ainda não publicados",
      };
    case "infracao":
      // undefined NÃO vira zero: "não lemos" e "não há" são respostas
      // diferentes, e só a segunda autoriza dizer que a conta está limpa.
      if (e.infracoes === undefined || e.anunciosComInfracao === undefined) {
        return {
          quantos: -1,
          total: t,
          frase:
            "Ainda não li as infrações desta conta. Abra Meus Produtos → Importar → \"Infrações da conta\" para eu passar a saber.",
          significado: "NÃO SEI — a leitura de infrações ainda não foi feita",
        };
      }
      return {
        quantos: e.anunciosComInfracao,
        total: t,
        frase: `${e.infracoes} infração(ões) do Mercado Livre, em ${e.anunciosComInfracao} anúncio(s).`,
        significado: "anúncios que TÊM ao menos uma infração registrada pelo Mercado Livre",
      };
    case "precificacao":
      return {
        quantos: e.prontosParaPrecificar,
        total: t,
        frase: `${e.prontosParaPrecificar} de ${t} produto(s) têm custo e peso — os únicos com preço mínimo calculado.`,
        significado: "produtos que JÁ TÊM custo e peso",
      };
  }
}

/**
 * A frase do peso separa ausência total de ausência parcial.
 *
 * Juntá-las já produziu duas mentiras opostas: "sem peso" para quem tem frete
 * saindo, e "completo" para quem tem 1 de 39 variações pesadas (INC-001).
 */
function frasePeso(e: EstadoDaLoja): string {
  const faltando = e.produtos - e.comPeso;
  if (faltando === 0) return `Todos os ${e.produtos} produto(s) estão com o peso completo.`;
  if (e.comPesoIncompleto === 0) {
    return `${faltando} de ${e.produtos} produto(s) estão sem peso nenhum.`;
  }
  return (
    `${faltando} de ${e.produtos} produto(s) estão com o peso incompleto — ` +
    `destes, ${e.comPesoIncompleto} têm peso em parte das variações (o frete sai, mas nem toda variação).`
  );
}

/**
 * De qual lacuna cada assunto fala — para o "resolver aqui" apontar o lugar certo.
 *
 * Mapa explícito e não casamento por substring: `"para_aprovar".includes("aprovacao")`
 * é `false`, e a versão esperta teria passado no teste devolvendo link nenhum.
 */
const LACUNA_DO_ASSUNTO: Record<AssuntoContavel, readonly TipoLacuna[]> = {
  peso: ["sem_peso", "peso_incompleto"],
  custo: ["sem_custo"],
  foto: ["sem_foto"],
  anuncio: ["sem_anuncio"],
  aprovacao: ["para_aprovar"],
  publicacao: ["para_publicar", "sem_conexao"],
  // A precificação não tem lacuna própria: ela é o RESULTADO de custo e peso.
  // O link honesto é o do que falta preencher, e quem decide isso é a ordem da
  // lista — por isso os dois, na ordem em que `lacunasDaLoja` já os devolve.
  precificacao: ["sem_peso", "peso_incompleto", "sem_custo"],
  // Infração não é lacuna do catálogo: o que falta não está na nossa base, está
  // no painel do Mercado Livre. Sem link inventado — a lista de Pendências já
  // leva a lojista ao trabalho, e apontar para outro lugar seria palpite.
  infracao: [],
};

/** Qual lacuna impede esta capacidade hoje. `null` quando nada impede. */
function oQueImpede(c: Capacidade, lista: readonly Lacuna[]): Lacuna | null {
  const porCapacidade: Record<Capacidade, readonly string[]> = {
    precificar: ["sem_produtos", "sem_peso", "peso_incompleto", "sem_custo"],
    anunciar: ["sem_produtos", "sem_foto", "sem_anuncio"],
    publicar: ["sem_produtos", "sem_conexao", "para_aprovar", "para_publicar"],
  };
  const relevantes = porCapacidade[c];
  return lista.find((l) => relevantes.includes(l.tipo)) ?? null;
}

const NOME_DA_CAPACIDADE: Record<Capacidade, string> = {
  precificar: "a precificação",
  anunciar: "a geração de anúncios",
  publicar: "a publicação",
};

/**
 * A resposta. Determinística: mesmo critério e mesmo estado, mesma resposta.
 *
 * Onde falta dado, o resultado diz que falta — nunca estima.
 */
export function responder(
  criterio: CriterioDaPergunta,
  ctx: ContextoDaPergunta
): RespostaDaOperacao {
  if (!criterio.entendeu) {
    return {
      tipo: "perguntar",
      frase: criterio.perguntar.trim() || "Não entendi. Pode dizer de outro jeito?",
    };
  }

  const lista = lacunasDaLoja(ctx.loja);
  const intencao = comoIntencao(criterio.intencao);

  // Intenção fora da lista fechada não vira palpite. Um modelo que devolve
  // "resumo_geral" em vez de "estado_geral" recebe o menu, não uma resposta
  // parecida — e quem lê descobre o que dá para perguntar.
  if (!intencao) {
    return {
      tipo: "nao_sei",
      frase: criterio.interpretacao.trim() || "Não consegui classificar essa pergunta.",
      posso: POSSO_RESPONDER,
    };
  }

  switch (intencao) {
    case "sobre_este_produto": {
      // Sem produto em foco a pergunta não tem sujeito. Cair para o estado da
      // loja seria responder outra coisa e parecer que respondeu.
      if (!ctx.produto) {
        return {
          tipo: "nao_sei",
          frase: "Essa pergunta é sobre um produto, e não há nenhum aberto aqui. Abra o produto e pergunte de novo.",
          posso: POSSO_RESPONDER,
        };
      }
      const itens = lacunasDoProduto(ctx.produto.estado, ctx.produto.id);
      return {
        tipo: "produto",
        nome: ctx.produto.nome,
        itens,
        frase: itens.length
          ? `Falta ${itens.length === 1 ? "1 coisa" : `${itens.length} coisas`} em ${ctx.produto.nome}:`
          : `${ctx.produto.nome} está completo — custo, peso e foto preenchidos.`,
      };
    }

    case "contagem": {
      const assunto = comoAssunto(criterio.assunto);
      if (!assunto) {
        return { tipo: "nao_sei", frase: "Não sei contar isso.", posso: POSSO_RESPONDER };
      }
      const { quantos, total, frase, significado } = contar(assunto, ctx.loja);
      const lacuna = lista.find((l) => LACUNA_DO_ASSUNTO[assunto].includes(l.tipo));
      // OS NOMES ENTRAM AQUI, num lugar só.
      //
      // "23 produtos sem peso" é honesto e inútil sozinho: a pergunta seguinte
      // é sempre QUAIS, e até 14/08/2026 a resposta era mandar a lojista caçar
      // numa tabela de 80 linhas.
      //
      // Fica no ponto de saída, e não espalhado pelos oito ramos do `contar`,
      // porque a regra é uma: quando sabemos os nomes, dizemos; quando não
      // sabemos, calamos. Oito cópias divergiriam no primeiro ajuste — foi o
      // que aconteceu com a regra da capa, em quatro lugares.
      const quais = ctx.loja.quaisSao?.[assunto as CondicaoNomeavel];
      return {
        tipo: "numero",
        // A amostra entra na FRASE, com o corte declarado. Só no objeto, ela
        // dependeria de cada tela lembrar de mostrá-la.
        frase: frase + fraseDosNomes(quantos > 0 ? quais : undefined),
        quantos,
        significado,
        total,
        ...(quais && quantos > 0 ? { quais } : {}),
        ...(lacuna ? { href: lacuna.href, cta: lacuna.cta } : {}),
      };
    }

    case "proximo_passo": {
      const primeira = lista[0];
      if (!primeira) {
        return { tipo: "nada_travado", frase: "Nada travado. Não há próximo passo pendente." };
      }
      return {
        tipo: "passo",
        lacuna: primeira,
        frase: primeira.bloqueiaTudo
          ? `Comece por aqui — enquanto isso não for resolvido, o resto não anda.`
          : `O próximo passo que produz resultado:`,
      };
    }

    case "por_que_travado": {
      const capacidade = comoCapacidade(criterio.capacidade);
      if (!capacidade) {
        return { tipo: "nao_sei", frase: "Não sei o que está travado.", posso: POSSO_RESPONDER };
      }
      const impedimento = oQueImpede(capacidade, lista);
      const nome = NOME_DA_CAPACIDADE[capacidade];
      if (!impedimento) {
        return { tipo: "nada_travado", frase: `Nada impede ${nome} hoje.` };
      }
      return { tipo: "passo", lacuna: impedimento, frase: `O que impede ${nome}:` };
    }

    case "estado_geral": {
      if (lista.length === 0) {
        return { tipo: "nada_travado", frase: "Nada travado. Sua loja está em dia." };
      }
      return {
        tipo: "lista",
        itens: lista,
        frase: `${lista.length} ponto(s) a resolver, na ordem em que destravam o resto:`,
      };
    }

    case "fora_do_alcance":
      return {
        tipo: "nao_sei",
        frase: criterio.interpretacao.trim() || "Isso está fora do que eu consigo provar com os seus dados.",
        posso: POSSO_RESPONDER,
      };
  }
}
