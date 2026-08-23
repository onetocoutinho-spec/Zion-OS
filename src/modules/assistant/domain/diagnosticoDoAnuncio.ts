// O DIAGNÓSTICO de um anúncio — por que ele não vende, a partir do que o
// Mercado Livre sabe: visitas, vendas, saúde, estoque, estado.
//
// "Otimiza esse anúncio" reescrevia o título sem olhar nada. Com visitas e
// vendas dá para separar as duas causas que se confundem: NINGUÉM VÊ
// (exposição — saúde, estado, categoria) de VEEM E NÃO COMPRAM (conversão —
// preço, fotos, descrição). Sem isso, toda recomendação era chute.
// (Auditoria do Copilot, trilha 4 / LATER: loop de performance.)
//
// Puro. Os números entram; sai uma leitura com o EIXO e o que ela não cobre.

export interface SinaisDoAnuncio {
  status: string;
  subStatus: readonly string[];
  /** `null` = o ML não informou. Nunca zero por ausência. */
  visitasNoPeriodo: number | null;
  periodoDias: number;
  vendidosNaVida: number | null;
  estoque: number | null;
  saude: number | null;
  fotos: number;
  preco: number | null;
  /** O preço mínimo calculado pelo Zion, quando existe. */
  precoMinimo?: number | null;
  /** Clássico tem menos exposição que Premium — entra como hipótese. */
  tipoAnuncioEhClassico?: boolean;
}

export type EixoDoDiagnostico = "fora_do_ar" | "sem_estoque" | "exposicao" | "conversao" | "saudavel" | "sem_dado";

export interface DiagnosticoDoAnuncio {
  eixo: EixoDoDiagnostico;
  /** A frase que nomeia o problema, para o lojista. */
  leitura: string;
  /** O que os números mostram — só fatos. */
  fatos: string[];
  /** O que fazer primeiro, em ordem. Hipóteses ditas como hipóteses. */
  recomendacoes: string[];
  /** O que não se sabe e mudaria a leitura. */
  oQueNaoSei: string[];
}

/** Abaixo disto, num período de 30 dias, a leitura é "ninguém vê". Medido por loja, não universal — ver teste. */
export const VISITAS_BAIXAS_POR_DIA = 1;
/** Saúde abaixo disto o ML reduz exposição. A faixa vem da documentação do health (0..1). */
export const SAUDE_BAIXA = 0.6;

export function diagnosticarAnuncio(s: SinaisDoAnuncio): DiagnosticoDoAnuncio {
  const fatos: string[] = [];
  const naoSei: string[] = [];
  if (s.visitasNoPeriodo === null) naoSei.push(`visitas dos últimos ${s.periodoDias} dias (o Mercado Livre não respondeu)`);
  else fatos.push(`${s.visitasNoPeriodo} visita(s) nos últimos ${s.periodoDias} dias`);
  if (s.vendidosNaVida === null) naoSei.push("unidades vendidas");
  else fatos.push(`${s.vendidosNaVida} unidade(s) vendida(s) desde que o anúncio existe`);
  if (s.saude === null) naoSei.push("a nota de saúde do Mercado Livre");
  else fatos.push(`saúde ${Math.round(s.saude * 100)}% na régua do Mercado Livre`);
  if (s.estoque !== null) fatos.push(`${s.estoque} em estoque`);
  fatos.push(`${s.fotos} foto(s)`);
  if (s.preco !== null) fatos.push(`preço R$ ${s.preco.toFixed(2)}`);
  naoSei.push("o que os concorrentes da mesma busca estão cobrando", "a posição do anúncio na busca");

  if (s.status !== "active") {
    return {
      eixo: "fora_do_ar",
      leitura: `O anúncio não está ativo (${s.status}${s.subStatus.length ? `: ${s.subStatus.join(", ")}` : ""}). Antes de qualquer otimização, ele precisa voltar ao ar.`,
      fatos,
      recomendacoes: [
        s.subStatus.some((x) => /infraction|forbidden|moderation/i.test(x))
          ? "Resolver a infração no painel do Mercado Livre — republicar sem resolver é reincidência."
          : "Reativar o anúncio (se foi pausado por você) ou conferir o motivo no Mercado Livre.",
      ],
      oQueNaoSei: naoSei,
    };
  }
  if (s.estoque !== null && s.estoque <= 0) {
    return {
      eixo: "sem_estoque",
      leitura: "O anúncio está ativo mas sem estoque: ninguém consegue comprar, e o Mercado Livre reduz a exposição de quem não tem unidade.",
      fatos,
      recomendacoes: ["Repor o estoque no anúncio — ou pausá-lo até repor, para não gastar reputação."],
      oQueNaoSei: naoSei,
    };
  }

  const visitasPorDia = s.visitasNoPeriodo === null ? null : s.visitasNoPeriodo / Math.max(1, s.periodoDias);
  const saudeBaixa = s.saude !== null && s.saude < SAUDE_BAIXA;

  if (visitasPorDia === null) {
    return {
      eixo: "sem_dado",
      leitura: "Sem as visitas não dá para separar 'ninguém vê' de 'veem e não compram'. O que dá para dizer está nos fatos.",
      fatos,
      recomendacoes: [
        ...(saudeBaixa ? ["A saúde está baixa: complete o que o Mercado Livre aponta (ficha técnica, fotos, descrição) — isso é exposição, não chute."] : []),
        ...(s.fotos < 3 ? ["Menos de três fotos é pouco para quem compara no celular."] : []),
      ],
      oQueNaoSei: naoSei,
    };
  }

  if (visitasPorDia < VISITAS_BAIXAS_POR_DIA || saudeBaixa) {
    return {
      eixo: "exposicao",
      leitura: "O problema é EXPOSIÇÃO: o anúncio quase não é visto. Mexer no título ajuda a ser encontrado; mexer no preço não ajuda quem ninguém vê.",
      fatos,
      recomendacoes: [
        ...(saudeBaixa ? ["Subir a saúde: ficha técnica completa, todas as fotos que o Mercado Livre pede, descrição preenchida."] : []),
        "Revisar o título com a palavra-chave que o comprador digita na frente (a ferramenta de título faz isso).",
        "Conferir a categoria: anúncio em categoria errada não aparece para quem busca.",
        ...(s.tipoAnuncioEhClassico ? ["Premium tem mais exposição que Clássico — vale a conta se a margem permitir."] : []),
      ],
      oQueNaoSei: naoSei,
    };
  }

  const vendidos = s.vendidosNaVida ?? 0;
  const precoAbaixoDoMinimo = s.preco !== null && s.precoMinimo != null && s.preco < s.precoMinimo;
  if (vendidos === 0 || (s.visitasNoPeriodo !== null && s.visitasNoPeriodo >= 30 && vendidos < 1)) {
    return {
      eixo: "conversao",
      leitura: "O problema é CONVERSÃO: as pessoas veem e não compram. Aqui preço, fotos e descrição pesam — título não.",
      fatos,
      recomendacoes: [
        "Comparar o preço com os anúncios da mesma busca (a ferramenta de preço mostra a margem; o que o concorrente cobra eu não sei).",
        ...(s.fotos < 3 ? ["Pôr mais fotos: capa com fundo branco e pelo menos um detalhe e uma em uso."] : []),
        "Revisar a descrição: o comprador que chegou até aqui está procurando um motivo para decidir.",
        ...(precoAbaixoDoMinimo ? ["O preço está ABAIXO do mínimo calculado — vender mais assim é vender no prejuízo."] : []),
      ],
      oQueNaoSei: naoSei,
    };
  }

  return {
    eixo: "saudavel",
    leitura: "Nada nos números pede intervenção: o anúncio é visto e vende. Mexer agora é risco sem motivo.",
    fatos,
    recomendacoes: precoAbaixoDoMinimo ? ["O preço está abaixo do mínimo calculado: vende, mas no prejuízo — revisar."] : [],
    oQueNaoSei: naoSei,
  };
}
