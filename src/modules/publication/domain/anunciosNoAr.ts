// QUAIS ANÚNCIOS ESTÃO NO AR — a leitura da loja inteira, por estado.
//
// ===========================================================================
// POR QUE ISTO PRECISOU EXISTIR
// ===========================================================================
//
// Medido em produção em 24/08/2026: a lojista perguntou "quais são os anúncios
// ativos hoje?" e o Copilot respondeu, corretamente, que NÃO SABIA — das 16
// ferramentas de leitura, nenhuma olhava a loja inteira. Dava para perguntar
// produto a produto (`preparacao_de_anuncio`, `diagnostico_do_anuncio`) e nada
// respondia "e no geral?".
//
// O dado já existia: a 050 deu a coluna `status_marketplace`, a 051 o
// `sub_status`, e a importação já os preenche. O que faltava era a pergunta.
//
// ===========================================================================
// A LINHA QUE ESTE ARQUIVO NÃO CRUZA
// ===========================================================================
//
// `statusMarketplace: null` significa NÃO SABEMOS, e nunca "está no ar". Esta
// é a mesma regra que a 050 escreveu, e ela tem preço medido: em 01/08/2026,
// 104 dos 511 anúncios que o Zion dizia publicados NÃO estavam no ar — 52 em
// revisão, 38 pausados, 12 encerrados, 2 inativos. Se o desconhecido virasse
// "ativo" para arredondar a resposta, este módulo repetiria aquele erro com
// mais confiança.
//
// Por isso a saída tem TRÊS eixos, nunca dois:
//   ativos        — o ML disse `active`, e nós lemos quando.
//   outros        — o ML disse outra coisa; a palavra dele, sem tradução.
//   semLeitura    — nunca medimos. Não é "inativo", é "não sei".
//
// E o QUANDO acompanha: um `active` lido há três semanas é palpite vestido de
// fato. O módulo devolve a idade da leitura para a resposta poder dizer isso.
//
// Puro.

export interface AnuncioLido {
  /** O id do anúncio no ML (MLB...). `null` = nunca publicado por aqui. */
  mlItemId: string | null;
  /** O título do anúncio, ou o nome do produto quando o anúncio não tem. */
  titulo: string;
  permalink: string | null;
  /** A palavra do ML: `active`, `paused`, `under_review`, `closed`, `inactive`. */
  statusMarketplace: string | null;
  /** ISO. Quando aprendemos o estado acima. `null` = nunca. */
  statusMarketplaceEm: string | null;
  /** POR QUE não está no ar, na palavra do ML. */
  subStatusMarketplace: string[] | null;
}

export interface AnuncioNoAr {
  mlItemId: string;
  titulo: string;
  permalink: string | null;
  /** Há quantos dias esta leitura foi feita. `null` = sem data. */
  lidoHaDias: number | null;
}

export interface GrupoDeEstado {
  /** A palavra do ML, sem tradução — ver `StatusMarketplace`. */
  estado: string;
  quantos: number;
  /** Até três exemplos, para a resposta poder citar sem listar tudo. */
  exemplos: AnuncioNoAr[];
  /** Os motivos que o ML deu, quando deu. Vazio ≠ "sem motivo". */
  motivos: string[];
}

export interface RetratoDosAnuncios {
  /** Quantos anúncios com MLB a loja tem — o universo desta leitura. */
  comMlb: number;
  ativos: AnuncioNoAr[];
  /** Quantos ativos ao todo (pode ser maior que `ativos.length`, que é recortado). */
  totalAtivos: number;
  /** Os outros estados, do mais numeroso ao menos. */
  outros: GrupoDeEstado[];
  /** Nunca medimos o estado destes. NÃO é "inativo". */
  semLeitura: number;
  /** Dos que têm leitura, quantos foram lidos há mais de `DIAS_PARA_ENVELHECER`. */
  desatualizados: number;
  /** A leitura mais antiga entre as que existem, em dias. `null` = nenhuma. */
  leituraMaisAntigaEmDias: number | null;
}

/** Depois de quantos dias uma leitura de estado deixa de ser "hoje". */
export const DIAS_PARA_ENVELHECER = 7;

/** Quantos ativos a ferramenta devolve por extenso. O resto vira contagem. */
export const ATIVOS_LISTADOS = 20;
const EXEMPLOS_POR_ESTADO = 3;

/** A palavra que o ML usa para "está no ar". */
export const ESTADO_ATIVO = "active";

function idadeEmDias(iso: string | null, agora: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((agora - t) / 86_400_000));
}

function paraNoAr(a: AnuncioLido, agora: number): AnuncioNoAr {
  return {
    mlItemId: a.mlItemId as string,
    titulo: a.titulo,
    permalink: a.permalink,
    lidoHaDias: idadeEmDias(a.statusMarketplaceEm, agora),
  };
}

/**
 * O retrato da loja: quem está no ar, quem não está (e por quê), e de quem não
 * sabemos.
 *
 * `agora` entra como parâmetro para o módulo continuar puro e testável — a
 * idade da leitura é metade da resposta, e ela não pode depender do relógio de
 * quem chama.
 */
export function retratoDosAnuncios(
  linhas: readonly AnuncioLido[],
  agora: number = Date.now()
): RetratoDosAnuncios {
  // Sem MLB não há anúncio no marketplace — é produto sem publicação, e isso
  // outra ferramenta já responde (`estado_da_loja`, `pendencias`).
  const comMlb = linhas.filter((l) => Boolean(l.mlItemId));

  const ativos: AnuncioLido[] = [];
  const porEstado = new Map<string, AnuncioLido[]>();
  let semLeitura = 0;

  for (const l of comMlb) {
    const estado = (l.statusMarketplace ?? "").trim().toLowerCase();
    if (!estado) {
      semLeitura += 1;
      continue;
    }
    if (estado === ESTADO_ATIVO) {
      ativos.push(l);
      continue;
    }
    const grupo = porEstado.get(estado);
    if (grupo) grupo.push(l);
    else porEstado.set(estado, [l]);
  }

  const idades = comMlb
    .map((l) => idadeEmDias(l.statusMarketplaceEm, agora))
    .filter((d): d is number => d !== null);

  const outros: GrupoDeEstado[] = [...porEstado.entries()]
    .map(([estado, linhasDoEstado]) => ({
      estado,
      quantos: linhasDoEstado.length,
      exemplos: linhasDoEstado.slice(0, EXEMPLOS_POR_ESTADO).map((l) => paraNoAr(l, agora)),
      // Os motivos, sem repetir: é o que transforma "38 pausados" em
      // "38 pausados, 6 por infração de propriedade intelectual".
      motivos: [...new Set(linhasDoEstado.flatMap((l) => l.subStatusMarketplace ?? []))].sort(),
    }))
    .sort((a, b) => b.quantos - a.quantos || a.estado.localeCompare(b.estado));

  return {
    comMlb: comMlb.length,
    ativos: ativos.slice(0, ATIVOS_LISTADOS).map((l) => paraNoAr(l, agora)),
    totalAtivos: ativos.length,
    outros,
    semLeitura,
    desatualizados: idades.filter((d) => d > DIAS_PARA_ENVELHECER).length,
    leituraMaisAntigaEmDias: idades.length > 0 ? Math.max(...idades) : null,
  };
}
