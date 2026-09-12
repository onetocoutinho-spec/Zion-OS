// A jornada — de um produto até o anúncio no ar.
//
// A tela de otimização do cliente é um MENU de dez ferramentas: título, SEO,
// descrição, ficha técnica, tabela de medidas, imagens, auditoria, FAQ, plano.
// Cada uma devolve um pedaço de texto. Quem sabe em que ordem usá-las, e como
// costurar tudo num anúncio, é quem já conhece o processo — ou seja, a equipe.
// O lojista fica olhando dez portas sem saber qual abrir primeiro.
//
// Um menu não diz o que fazer agora. Uma jornada diz. Este módulo é o núcleo
// PURO dessa jornada: dado o estado real (produto, anúncio gerado, conexão,
// quota), ele responde em que etapa a pessoa está e qual é o próximo passo —
// incluindo por que um passo está bloqueado, quando estiver.
//
// Sem rede, sem React.

export type EtapaJornada = "produto" | "fotos" | "gerar" | "revisar" | "aprovar" | "publicar";

export type EstadoPasso = "feito" | "atual" | "futuro" | "bloqueado";

export interface PassoJornada {
  etapa: EtapaJornada;
  titulo: string;
  /** O que acontece nesta etapa, em uma linha. */
  descricao: string;
  estado: EstadoPasso;
  /** Preenchido só quando o estado é "bloqueado": o que falta, em concreto. */
  bloqueio?: string;
}

/** O anúncio gerado mais recente do produto, no mínimo que a jornada precisa. */
export interface AnuncioNaJornada {
  status: string;
  vereditoA10: string;
  qtdPendencias: number;
  mlItemId?: string | null;
  mlPermalink?: string | null;
}

export interface ContextoJornada {
  /** O produto escolhido. null = ainda não escolheu. */
  temProduto: boolean;
  /**
   * Fotos do produto. Sem nenhuma, o Mercado Livre recusa o anúncio — então
   * isto não é um detalhe estético, é um bloqueio de publicação. A jornada
   * pede as fotos LOGO, e não no último clique.
   */
  quantidadeFotos: number;
  /** O anúncio gerado mais recente para esse produto, se houver. */
  anuncio: AnuncioNaJornada | null;
  /** A conta do marketplace está conectada? */
  conectado: boolean;
  /** Otimizações restantes no plano. */
  quotaRestante: number;
  /**
   * Quantos anúncios DESTE PRODUTO já estão no ar no marketplace.
   *
   * ===========================================================================
   * MEDIDO EM 14/08/2026
   * ===========================================================================
   *
   * 88 rascunhos existem nesta conta. **86 deles nasceram DEPOIS de o produto
   * já estar no ar** — e nenhum é rascunho antigo que ficou para trás. A
   * esteira olhava só o rascunho aberto (`anuncio.mlItemId`) e não fazia ideia
   * de que o PRODUTO já tinha quarenta anúncios vendendo.
   *
   * Não vira bloqueio: criar um anúncio a mais é legítimo — cor nova, kit,
   * tamanho que faltava. Vira AVISO, porque a lojista que abre a esteira num
   * produto já publicado quase sempre quer MELHORAR o que está no ar, e a
   * esteira não melhora nada do que está no ar: ela cria mais um.
   *
   * Ausente (`undefined`) quando ainda não sabemos — e aí o aviso não aparece,
   * porque afirmar "nenhum no ar" sem ter contado é o defeito que este
   * repositório passou o mês arrancando.
   */
  anunciosNoArDoProduto?: number;
}

/**
 * O aviso de que a esteira vai CRIAR, não melhorar.
 *
 * `null` quando não há o que avisar: produto sem anúncio no ar, contagem
 * desconhecida, ou a jornada já terminada.
 */
export function avisoDeProdutoJaNoAr(ctx: ContextoJornada): string | null {
  const n = ctx.anunciosNoArDoProduto;
  if (typeof n !== "number" || n <= 0) return null;
  // Depois de publicado, o aviso é ruído: ela acabou de fazer o que o aviso
  // tentava explicar.
  if (ctx.anuncio?.mlItemId) return null;
  return (
    `Este produto já tem ${n} ${n === 1 ? "anúncio" : "anúncios"} no ar. ` +
    "O que sai daqui é um anúncio A MAIS — não muda os que já estão vendendo. " +
    "Para mexer nos que existem, use o assistente."
  );
}

const DESCRICOES: Record<EtapaJornada, { titulo: string; descricao: string }> = {
  produto: {
    titulo: "Escolha o produto",
    descricao: "Um produto da sua base, ou cadastre um novo agora.",
  },
  fotos: {
    titulo: "Adicione as fotos",
    descricao: "O Mercado Livre exige pelo menos uma imagem. A IA também pode gerar.",
  },
  gerar: {
    titulo: "A IA monta o anúncio",
    descricao: "Título com SEO, descrição que vende, ficha técnica e tabela de medidas.",
  },
  revisar: {
    titulo: "Você revisa",
    descricao: "Leia o que a IA escreveu. Se não gostou, é só refazer.",
  },
  aprovar: {
    titulo: "Você aprova",
    descricao: "Nada vai ao ar sem o seu aval.",
  },
  publicar: {
    titulo: "No ar no marketplace",
    descricao: "O anúncio entra na sua conta, com o preço e as fotos que você conferiu.",
  },
};

const ORDEM: EtapaJornada[] = ["produto", "fotos", "gerar", "revisar", "aprovar", "publicar"];

/**
 * Em que etapa a pessoa está AGORA. Deriva do estado real, nunca de um
 * contador de cliques: quem sai da tela e volta reencontra o mesmo lugar.
 */
export function etapaAtual(ctx: ContextoJornada): EtapaJornada {
  if (!ctx.temProduto) return "produto";
  // Publicado é publicado — não se pede foto de quem já está no ar.
  if (ctx.anuncio?.status === "publicado") return "publicar";
  // Sem foto não existe publicação. Cobrar isso agora, e não depois de todo o
  // trabalho, é a diferença entre um passo e uma parede.
  if (ctx.quantidadeFotos <= 0) return "fotos";
  const a = ctx.anuncio;
  if (!a) return "gerar";
  if (a.status === "publicado") return "publicar";
  if (a.status === "aprovado") return "publicar";
  if (a.status === "rejeitado") return "gerar"; // recusado: o caminho é refazer
  // rascunho ou aguardando_aprovacao → o anúncio existe e espera o lojista
  return a.vereditoA10 === "aprovado" && a.qtdPendencias === 0 ? "aprovar" : "revisar";
}

/** A jornada inteira já concluída? */
export function concluida(ctx: ContextoJornada): boolean {
  return ctx.anuncio?.status === "publicado";
}

/**
 * O que impede a etapa de acontecer. null quando nada impede.
 *
 * Só devolve bloqueio para a etapa em questão — não antecipa impedimento de
 * etapa futura, que a pessoa ainda tem tempo de resolver.
 */
function bloqueioDe(etapa: EtapaJornada, ctx: ContextoJornada): string | null {
  if (etapa === "gerar" && ctx.quotaRestante <= 0) {
    return "Você usou todas as otimizações do seu plano neste mês.";
  }
  if (etapa === "aprovar") {
    const a = ctx.anuncio;
    if (a && a.qtdPendencias > 0) {
      return `A revisão final apontou ${a.qtdPendencias} ${
        a.qtdPendencias === 1 ? "pendência" : "pendências"
      }. Resolva ou refaça o anúncio antes de aprovar.`;
    }
    if (a && a.vereditoA10 !== "aprovado") {
      return "A revisão final não aprovou este anúncio. Refaça para tentar de novo.";
    }
  }
  if (etapa === "publicar" && !ctx.conectado) {
    return "Conecte sua conta do marketplace para publicar.";
  }
  return null;
}

/** Os cinco passos, com o estado de cada um. A trilha inteira, sempre visível. */
export function montarJornada(ctx: ContextoJornada): PassoJornada[] {
  const atual = etapaAtual(ctx);
  const fim = concluida(ctx);
  const iAtual = ORDEM.indexOf(atual);

  return ORDEM.map((etapa, i) => {
    const { titulo, descricao } = DESCRICOES[etapa];
    if (fim) return { etapa, titulo, descricao, estado: "feito" as const };
    if (i < iAtual) return { etapa, titulo, descricao, estado: "feito" as const };
    if (i > iAtual) return { etapa, titulo, descricao, estado: "futuro" as const };

    const bloqueio = bloqueioDe(etapa, ctx);
    return bloqueio
      ? { etapa, titulo, descricao, estado: "bloqueado" as const, bloqueio }
      : { etapa, titulo, descricao, estado: "atual" as const };
  });
}

export interface ProximaAcao {
  etapa: EtapaJornada;
  /** O texto do botão. Um verbo, nunca um substantivo. */
  rotulo: string;
  habilitada: boolean;
  /** Por que não dá para clicar. Presente só quando habilitada é false. */
  motivo?: string;
}

/**
 * A ÚNICA coisa a fazer agora. É isto que um menu de dez portas não consegue
 * dizer, e o que faz alguém sem treino conseguir terminar sozinho.
 */
export function proximaAcao(ctx: ContextoJornada): ProximaAcao | null {
  if (concluida(ctx)) return null; // acabou: não há próximo passo a empurrar

  const etapa = etapaAtual(ctx);
  const bloqueio = bloqueioDe(etapa, ctx);
  const rotulos: Record<EtapaJornada, string> = {
    produto: "Escolher produto",
    fotos: "Adicionar fotos",
    // Refazer e gerar são a mesma ação; o rótulo muda para não mentir sobre
    // o que aconteceu antes.
    gerar: ctx.anuncio?.status === "rejeitado" ? "Refazer anúncio" : "Gerar anúncio com IA",
    revisar: "Revisar anúncio",
    aprovar: "Aprovar anúncio",
    publicar: "Publicar no marketplace",
  };

  return {
    etapa,
    rotulo: rotulos[etapa],
    habilitada: bloqueio === null,
    ...(bloqueio ? { motivo: bloqueio } : {}),
  };
}
