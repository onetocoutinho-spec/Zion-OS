// A FILA DE CORREÇÃO — os anúncios fora do ar, agrupados pelo MOTIVO do ML.
//
// ===========================================================================
// POR QUE ISTO PRECISOU EXISTIR
// ===========================================================================
//
// Medido em produção em 24/08/2026: de 792 anúncios no Mercado Livre, 303 não
// estavam no ar. Dentro deles, o maior bloco isolado eram 148 com
// `waiting_for_patch` — o ML apontou algo para consertar e ficou esperando.
// Nenhuma tela e nenhuma ferramenta do Zion trabalhava essa fila. O dado estava
// guardado desde a 051 e ninguém o perguntava.
//
// `anunciosNoAr` responde "quantos estão no ar". Este módulo responde a
// pergunta seguinte, que é a acionável: "e o que fazer com os que não estão".
//
// ===========================================================================
// A LINHA QUE ESTE ARQUIVO NÃO CRUZA
// ===========================================================================
//
// O ML diz QUE algo precisa mudar. Ele não diz aqui QUAL campo — o sub_status
// é uma palavra, não um laudo. O Zion hoje não lê o detalhe da moderação (não
// existe caminho escrito para isso; ver a auditoria de 24/08/2026).
//
// Então cada motivo carrega, além da contagem, o que o Zion CONSEGUE fazer com
// ele hoje — e quando não consegue, POR QUÊ e O QUE FALTARIA. Um "resolvo isso
// para você" sobre um motivo que ninguém sabe ler seria a mesma invenção que o
// A0 cometia. `CAPACIDADE_AUSENTE` é uma resposta honesta; silêncio não é.
//
// Puro.

import type { AnuncioLido } from "./anunciosNoAr";

/**
 * O que o Zion sabe fazer com um motivo, HOJE.
 *
 * Não é a lista do que seria bom fazer — é a lista do que tem caminho escrito.
 */
export type AcaoDoZion =
  /** Existe ferramenta e ela é reversível: `reativar_anuncio`. */
  | "reativar"
  /** Depende de estoque no marketplace. O Zion lê, não escreve. */
  | "repor_estoque"
  /** O ML está processando; ninguém precisa fazer nada além de esperar. */
  | "aguardar"
  /** Infração. Reativar seria reincidência — a trava existe e vale. */
  | "nunca_reativar"
  /** Sabemos o motivo e NÃO temos caminho para agir. Diz por quê. */
  | "capacidade_ausente"
  /** Nem o motivo conhecemos. Não fingir que sim. */
  | "motivo_desconhecido";

export interface ExplicacaoDoMotivo {
  /** O que a palavra do ML quer dizer, em português de lojista. */
  significa: string;
  acao: AcaoDoZion;
  /** O que fazer — ou, quando não dá, o que falta para dar. */
  oQueFazer: string;
}

/**
 * Os motivos que já apareceram nesta conta, com o que se sabe de cada um.
 *
 * Só entram motivos OBSERVADOS. Escrever aqui a lista inteira de sub_status do
 * ML, de memória, seria inventar documentação — e um significado errado numa
 * tela de correção manda a lojista consertar a coisa errada.
 */
const MOTIVOS: Readonly<Record<string, ExplicacaoDoMotivo>> = {
  waiting_for_patch: {
    significa: "O Mercado Livre pediu uma alteração no anúncio e está esperando ela ser feita.",
    acao: "capacidade_ausente",
    oQueFazer:
      "O Zion sabe QUE o ML pediu uma alteração, mas não lê QUAL campo ele quer — o sub_status é uma palavra, não um laudo, e não existe no Zion caminho até o detalhe da moderação. Para resolver hoje é preciso abrir o anúncio no Mercado Livre e ver o aviso lá. Para o Zion resolver, faltariam duas coisas: ler o detalhe da moderação e poder editar um anúncio publicado — nenhuma das duas existe.",
  },
  paused_by_seller: {
    significa: "Alguém da loja pausou este anúncio.",
    acao: "reativar",
    oQueFazer:
      "Dá para reativar pelo próprio assistente, um a um, com a ferramenta de reativar — ela confere antes se o anúncio é desta loja e se não foi cancelado por infração.",
  },
  out_of_stock: {
    significa: "O anúncio pausou porque o estoque no Mercado Livre chegou a zero.",
    acao: "repor_estoque",
    oQueFazer:
      "Volta sozinho quando o estoque for reposto no Mercado Livre. O Zion lê o estoque do marketplace, mas não o escreve — a reposição é feita no ML ou pelo ERP.",
  },
  picture_download_pending: {
    significa: "O Mercado Livre ainda está baixando as fotos do anúncio.",
    acao: "aguardar",
    oQueFazer: "É transitório e se resolve sozinho. Se persistir por dias, a foto de origem pode estar inacessível.",
  },
  forbidden: {
    significa: "O Mercado Livre cancelou o anúncio por infração.",
    acao: "nunca_reativar",
    oQueFazer:
      "NÃO reative: recolocar no ar o que o ML cancelou é reincidência e pode custar a conta. A infração precisa ser tratada no Mercado Livre.",
  },
  // MEDIDO EM 24/08/2026. Quinze anúncios da conta voltaram `inactive` com
  // `["deleted", "forbidden"]` — cancelados por infração E apagados. Eles
  // sumiram da busca do vendedor em 08/07 e ficaram invisíveis até a leitura
  // por id existir.
  //
  // Sem esta entrada, `deleted` caía em "motivo desconhecido" e a fila dizia
  // "não sei o que é isso" sobre a única coisa que estava clara. E o balde
  // ficava com número: 164 unidades de estoque ordenando trabalho que não
  // existe, porque anúncio apagado não se conserta — ele não está lá.
  deleted: {
    significa: "O anúncio foi APAGADO no Mercado Livre. Ele não existe mais lá.",
    acao: "nunca_reativar",
    oQueFazer:
      "Não há o que corrigir neste anúncio: ele não existe mais no Mercado Livre. O produto pode voltar a vender em um anúncio NOVO — mas se veio junto de `forbidden`, trate a infração antes, porque republicar o que o ML cancelou é reincidência.",
  },
};

/** O que se sabe sobre um motivo. Desconhecido devolve desconhecido. */
export function explicacaoDoMotivo(motivo: string): ExplicacaoDoMotivo {
  return (
    MOTIVOS[motivo] ?? {
      significa: `O Mercado Livre marcou este anúncio como "${motivo}". Este motivo ainda não foi estudado no Zion.`,
      acao: "motivo_desconhecido",
      oQueFazer:
        "Não sei o que este motivo exige. Abrir o anúncio no Mercado Livre mostra o aviso original — é a fonte, e é ela que manda.",
    }
  );
}

/** Os motivos que o Zion conhece — para o teste e para a tela dizerem. */
export function motivosConhecidos(): string[] {
  return Object.keys(MOTIVOS).sort();
}

export interface AnuncioParado {
  mlItemId: string;
  titulo: string;
  permalink: string | null;
  /** A palavra do ML para o ESTADO (paused, under_review…). */
  estado: string;
  produto: string | null;
  produtoId: string | null;
}

export interface GrupoDeCorrecao {
  /** A palavra do ML, sem tradução. */
  motivo: string;
  quantos: number;
  significa: string;
  acao: AcaoDoZion;
  oQueFazer: string;
  /** Onde o motivo se concentra — a loja resolve por produto, não por anúncio. */
  produtos: { produto: string; quantos: number }[];
  exemplos: AnuncioParado[];
}

export interface FilaDeCorrecao {
  /** Anúncios com MLB que NÃO estão no ar. */
  foraDoAr: number;
  /** Destes, quantos o ML explicou o porquê. */
  comMotivo: number;
  /** Fora do ar e SEM motivo declarado pelo ML. Não é "sem problema". */
  semMotivo: number;
  grupos: GrupoDeCorrecao[];
  /** Idade da leitura, em dias. `null` = sem data. Vai junto, sempre. */
  lidoHaDias: number | null;
}

/** Quantos exemplos e quantos produtos por grupo — o resto é contagem. */
export const EXEMPLOS_POR_GRUPO = 5;
export const PRODUTOS_POR_GRUPO = 5;

/** A linha do banco, já com o produto que o serviço juntou. */
export interface LinhaDaFila extends AnuncioLido {
  produto: string | null;
  produtoId: string | null;
  /**
   * 074 — o que o Mercado Livre já dizia e a importação descartava.
   *
   * Vem na MESMA varredura de `anunciosNoArNoServidor`: "quantos estão no ar" e
   * "como está a saúde do catálogo" leem exatamente as mesmas linhas, e a
   * segunda pergunta nem existia porque o dado morria na importação.
   *
   * Opcionais porque a fila de correção não depende deles: quem só quer saber o
   * motivo de um anúncio estar fora do ar continua montando `LinhaDaFila` sem
   * nada disto. `null` = não lido — nunca zero, nunca false.
   */
  tipoAnuncioMl?: string | null;
  atualizadoEmMl?: string | null;
  vendidosMl?: number | null;
  saudeMl?: number | null;
  doCatalogoMl?: boolean | null;
  temDescricaoMl?: boolean | null;
}

function idadeEmDias(iso: string | null, agora: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((agora - t) / 86_400_000));
}

/**
 * A fila, agrupada por motivo — do maior bloco para o menor.
 *
 * Um anúncio com dois motivos entra nos DOIS grupos: os motivos não são
 * exclusivos no ML, e escolher um deles por conta própria esconderia o outro.
 * Por isso a soma dos grupos pode passar de `foraDoAr` — e por isso `foraDoAr`
 * é contado à parte, sobre anúncios, não sobre motivos.
 */
export function filaDeCorrecao(linhas: readonly LinhaDaFila[], agora: number = Date.now()): FilaDeCorrecao {
  const fora = linhas.filter((l) => {
    const estado = (l.statusMarketplace ?? "").trim().toLowerCase();
    // Sem MLB não é anúncio no marketplace. Sem leitura de estado não é "fora
    // do ar" — é desconhecido, e desconhecido não entra numa fila de conserto.
    return Boolean(l.mlItemId) && estado !== "" && estado !== "active";
  });

  const porMotivo = new Map<string, LinhaDaFila[]>();
  let semMotivo = 0;
  for (const l of fora) {
    const motivos = (l.subStatusMarketplace ?? []).map((m) => m.trim().toLowerCase()).filter(Boolean);
    if (motivos.length === 0) {
      semMotivo += 1;
      continue;
    }
    for (const m of new Set(motivos)) {
      const g = porMotivo.get(m);
      if (g) g.push(l);
      else porMotivo.set(m, [l]);
    }
  }

  const paraParado = (l: LinhaDaFila): AnuncioParado => ({
    mlItemId: l.mlItemId as string,
    titulo: l.titulo,
    permalink: l.permalink,
    estado: (l.statusMarketplace ?? "").trim().toLowerCase(),
    produto: l.produto,
    produtoId: l.produtoId,
  });

  const grupos: GrupoDeCorrecao[] = [...porMotivo.entries()]
    .map(([motivo, doMotivo]) => {
      const e = explicacaoDoMotivo(motivo);
      const contagem = new Map<string, number>();
      for (const l of doMotivo) {
        const nome = l.produto ?? "(sem produto vinculado)";
        contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
      }
      return {
        motivo,
        quantos: doMotivo.length,
        significa: e.significa,
        acao: e.acao,
        oQueFazer: e.oQueFazer,
        produtos: [...contagem.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, PRODUTOS_POR_GRUPO)
          .map(([produto, quantos]) => ({ produto, quantos })),
        exemplos: doMotivo.slice(0, EXEMPLOS_POR_GRUPO).map(paraParado),
      };
    })
    .sort((a, b) => b.quantos - a.quantos || a.motivo.localeCompare(b.motivo));

  const idades = fora
    .map((l) => idadeEmDias(l.statusMarketplaceEm, agora))
    .filter((d): d is number => d !== null);

  return {
    foraDoAr: fora.length,
    comMotivo: fora.length - semMotivo,
    semMotivo,
    grupos,
    // A leitura mais ANTIGA: é ela que decide se a fila inteira é atual.
    lidoHaDias: idades.length > 0 ? Math.max(...idades) : null,
  };
}
