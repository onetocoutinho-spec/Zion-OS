// OS ESPECIALISTAS — a tabela que diz, para cada tipo de pedido, QUAIS
// ferramentas entram e QUE instrução extra o modelo recebe.
//
// O laço de conversa oferecia as 27 ferramentas com um prompt monolítico de
// ~2.000 tokens em TODA pergunta: "quantos sem peso?" pagava pela instrução
// de publicação, de imagem e de cadastro, e nada era testável isoladamente.
// (Auditoria do Copilot, trilha 2, P2.)
//
// Aqui a decisão é DECLARATIVA: uma linha por especialista. Quem classifica
// o pedido é uma chamada barata (esforço baixo, enum fechado); quem decide o
// que o especialista alcança é esta tabela, não o modelo. `geral` é a rede:
// tudo o que existe, como antes — e é para onde cai o que não se encaixa.
//
// LIGADO POR PADRÃO desde 24/08/2026, e o motivo foi medido no mesmo dia.
//
// O catálogo cresceu de 17 para 34 ferramentas, e ele viaja INTEIRO em toda
// chamada ao modelo: 26.297 caracteres, ~6.574 tokens de prefixo por chamada,
// até seis vezes por fala. No dia em que isso aconteceu, um turno atravessou o
// teto de 60 s da plataforma e morreu sem gravar nada — a lojista leu "a
// resposta foi interrompida no meio".
//
// Com o roteamento, cada especialista carrega entre 9 e 15 ferramentas: de 62%
// a 78% menos prefixo por chamada. O custo é uma classificação barata por
// turno (esforço baixo, enum fechado, ~1.400 tokens), paga uma vez contra até
// seis chamadas economizadas.
//
// `COPILOT_ROTEAMENTO=0` desliga e volta ao catálogo inteiro — o rollback
// continua sendo configuração, não deploy. Ver `scripts/medicoes/tamanhoDoCatalogo.ts`
// para refazer a conta quando o catálogo mudar.

export type Especialista =
  | "catalogo"
  | "preco"
  | "conteudo"
  | "imagem"
  | "vendas"
  | "publicacao"
  | "cadastro"
  | "agencia"
  | "geral";

export const ESPECIALISTAS: readonly Especialista[] = [
  "catalogo", "preco", "conteudo", "imagem", "vendas", "publicacao", "cadastro", "agencia", "geral",
];

/** As leituras que TODO especialista leva — sem elas "este produto" não resolve. */
const BASE: readonly string[] = [
  "achar_produto",
  "o_que_falta_no_produto",
  "contar",
  "estado_da_loja",
  "proximo_passo",
  // TRANSVERSAIS, desde 24/08/2026. Não são de assunto nenhum — são de todos:
  // `o_que_eu_consigo` é a conferência que evita a promessa falsa, e ela
  // precisa estar à mão exatamente quando o especialista NÃO tem a ferramenta
  // que a pessoa pediu. `investigar` porque qualquer assunto pode chegar
  // grande demais para um turno.
  "o_que_eu_consigo",
  "investigar",
];

interface DefinicaoDeEspecialista {
  /** O que classifica: a descrição que o classificador lê. */
  quando: string;
  /** As ferramentas além da BASE. `null` = todas (só o geral). */
  ferramentas: readonly string[] | null;
  /** A instrução extra, curta — o que o prompt base não diz. */
  instrucao: string;
}

export const DEFINICOES: Readonly<Record<Especialista, DefinicaoDeEspecialista>> = {
  catalogo: {
    quando: "pendências, o que falta, o que travou, peso, custo, foto, medidas, preencher um dado, resolver o que der",
    ferramentas: ["o_que_impede", "pendencias", "tabela_de_medidas", "procedencia", "propor_gravacao", "preparar_resolucao", "propor_tarefas", "diagnostico_de_agrupamento"],
    instrucao: "Foque no cadastro: o que falta, por quê, e o que você prepara sozinho. Números só de ferramenta.",
  },
  preco: {
    quando: "preço, margem, lucro, prejuízo, por quanto vender, custos do lojista, simular um preço",
    ferramentas: ["pricing", "meus_custos", "propor_preco", "procedencia"],
    instrucao: "Foque no preço: a decomposição vem do motor financeiro, você só apresenta. Confira os custos do lojista antes de julgar uma margem.",
  },
  conteudo: {
    quando: "título, descrição, palavras-chave, SEO, texto do anúncio, deixar mais curto, mais premium, melhorar o anúncio, corrigir o título do anúncio que está no ar",
    ferramentas: ["preparacao_de_anuncio", "diagnostico_do_anuncio", "propor_titulo", "propor_titulo_no_anuncio", "propor_descricao", "propor_palavras_chave", "propor_anuncio", "meu_perfil_de_conteudo"],
    instrucao: "Foque no texto do anúncio. Respeite o perfil de conteúdo da loja. 'Otimiza esse anúncio' começa por diagnostico_do_anuncio — título só se o eixo for exposição. Ajuste pedido sobre um texto já proposto vai em `instrucao`.",
  },
  imagem: {
    quando: "foto, imagem, capa, infográfico, gerar imagem, não gostei da imagem, fundo branco, produto maior",
    ferramentas: ["propor_imagem", "preparacao_de_anuncio"],
    instrucao: "Foque na imagem. 'Não gostei' de uma versão vira propor_imagem com paiVersaoId e o feedback dele. Nunca descreva uma imagem que não foi gerada.",
  },
  vendas: {
    quando: "vendas, faturamento, quanto vendi, por que caíram, o que vende mais, comparar períodos",
    ferramentas: ["vendas_da_loja", "diagnostico_do_anuncio", "pendencias", "pricing", "propor_tarefas", "anuncios_ativos", "diagnostico_de_agrupamento"],
    instrucao: "Foque nas vendas: três blocos — o que os números mostram, o que isso sugere (como hipótese), o que você não sabe. Proponha tarefas quando ele aceitar um plano.",
  },
  publicacao: {
    quando: "publicar, subir o anúncio, colocar no ar, reativar, pausado, infração, Mercado Livre recusou, quais anúncios estão ativos, o que está parado, o que preciso corrigir, as variações não estão agrupadas",
    ferramentas: ["preparacao_de_anuncio", "propor_publicacao", "reativar_anuncio", "o_que_impede", "anuncios_ativos", "anuncios_a_corrigir", "diagnostico_de_agrupamento", "propor_titulo_no_anuncio"],
    instrucao: "Foque em colocar no ar. Publicar é proposta com ensaio; reativar tem trava de posse e de infração. Nunca afirme que está no ar sem a palavra do Mercado Livre.",
  },
  cadastro: {
    quando: "cadastrar produto novo, criar produto, importar, adicionar variação, esse produto já existe?",
    ferramentas: ["gerenciar_cadastro", "propor_gravacao"],
    instrucao: "Foque no cadastro novo: extraia campo a campo, nunca deduza custo, preço, SKU, EAN ou peso; mostre candidatos antes de criar.",
  },
  agencia: {
    quando: "comparar lojas, qual loja está mais atrasada, panorama das lojas, todas as lojas",
    ferramentas: ["comparar_lojas", "pendencias", "anuncios_ativos"],
    instrucao: "Foque na comparação entre lojas: uma por linha, mesma régua, aponte a mais atrasada e o primeiro passo nela.",
  },
  geral: {
    quando: "qualquer outra coisa, saudação, dúvida sobre o sistema, pedido que mistura vários assuntos",
    ferramentas: null,
    instrucao: "",
  },
};

/**
 * As ferramentas que o especialista alcança, dentro do catálogo que o PAPEL
 * já liberou (a restrição por papel vem antes e nunca é afrouxada aqui).
 */
export function ferramentasDoEspecialista<T extends { nome: string }>(e: Especialista, catalogoDoPapel: readonly T[]): readonly T[] {
  const def = DEFINICOES[e];
  if (!def.ferramentas) return catalogoDoPapel;
  const permitidas = new Set([...BASE, ...def.ferramentas]);
  const filtradas = catalogoDoPapel.filter((f) => permitidas.has(f.nome));
  // Um especialista sem leitura não passa do passo 0 — cai para o geral.
  return filtradas.length > 0 ? filtradas : catalogoDoPapel;
}

export function instrucaoDoEspecialista(e: Especialista): string {
  return DEFINICOES[e].instrucao;
}

/** O texto do classificador: uma linha por especialista, com o "quando". */
export function descricaoParaClassificar(): string {
  return ESPECIALISTAS.map((e) => `- ${e}: ${DEFINICOES[e].quando}`).join("\n");
}

export function lerEspecialista(bruto: unknown): Especialista {
  return ESPECIALISTAS.includes(bruto as Especialista) ? (bruto as Especialista) : "geral";
}
