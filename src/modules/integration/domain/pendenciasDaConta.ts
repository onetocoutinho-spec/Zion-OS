// O que o Mercado Livre está cobrando da conta — em ordem de fazer.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Em 02/08/2026 a leitura completa da conta produziu, pela primeira vez, um
// retrato honesto:
//
//     28 vendas no total
//     533 anúncios no ar sem vender nenhuma      (de 544 ativos)
//     535 de 781 capas fora do padrão do ML      (68%)
//     7 anúncios bloqueados por política
//
// E tudo isso apareceu numa FAIXA DE UMA LINHA que some quando a tela recarrega.
// Números agregados, sem ordem, sem link, sem dizer por onde começar. A lojista
// lia "535 capas fora do padrão" e não tinha o que fazer com a frase.
//
// ===========================================================================
// A ORDEM É O PRODUTO
// ===========================================================================
//
// 535 fotos é trabalho de semanas. Os vinte que concentram estoque são trabalho
// de uma tarde. Sem a ordem, ela não começa — e uma lista de 535 linhas em
// ordem alfabética é tão inútil quanto o número sozinho.
//
// Três níveis, e a razão de cada um:
//
//   conta    o que pode custar a CONTA, não o anúncio. Bloqueio é política, e
//            reincidência é o que pesa. Vem primeiro mesmo sendo o menor grupo.
//   receita  o que está impedindo de vender AGORA, ordenado por estoque parado.
//   atencao  o que ela precisa saber e não é urgente.
//
// ===========================================================================
// O QUE ESTA FUNÇÃO NÃO FAZ
// ===========================================================================
//
// Não conserta nada, não escreve nada, e não afirma causa. Que foto fora do
// padrão CAUSE a falta de venda é a explicação mais simples para três números
// medidos — não é prova, e o texto não diz que é.

import { lerMaxSize, LADO_MINIMO_DA_CAPA } from "./capaForaDoPadrao";

export type Gravidade = "conta" | "receita" | "atencao";

/**
 * O que o ML JÁ DISSE sobre este anúncio — migração 052.
 *
 * Até 03/08/2026 esta função inferia a pendência de foto de uma regra NOSSA:
 * capa quadrada e lado ≥ 1200. A leitura completa das infrações permitiu
 * conferir a regra contra a fonte, e o resultado condena a inferência:
 *
 *                       ML reclama    ML não reclama
 *   nossa regra reprova       139               373
 *   nossa regra aprova        166                80
 *
 * Concordância: 219 de 758 anúncios — 29%. De cada quatro anúncios que
 * mandávamos refotografar, três o Mercado Livre nunca reclamou; e 166 que ele
 * pune passavam como bons.
 *
 * A premissa "o ML quer capa quadrada de 1200" era minha, e ele nunca a
 * enunciou. Onde ele falou, é a palavra dele que vale. Onde ele não falou, a
 * nossa medida continua — mas dita como palpite, não como cobrança.
 */
export interface InfracaoDoAnuncio {
  /** A acusação, na palavra do ML. */
  motivo: string;
  /** O que ele manda fazer. Chega em HTML e deve vir limpo. */
  remedio: string;
  /**
   * A CLASSIFICAÇÃO DO ML — `filter_subgroup` na 052.
   *
   * Opcional porque a leitura antiga não a trazia; ausente, tudo se comporta
   * como antes. Os valores vistos na conta em 10/08/2026: FOTOS, PQT, DOMAIN e
   * PI_FAKES.
   */
  categoria?: string;
}

/**
 * O ML classifica propriedade intelectual no espaço `PI_*`.
 *
 * Só `PI_FAKES` foi observado (sete infrações, dois produtos, 30-31/07). O
 * prefixo é deliberado: uma acusação de PI nova entra pelo caminho grave por
 * omissão, que é o lado certo para errar. O contrário — tratar PI desconhecido
 * como pendência de rotina — é o defeito que este ramo existe para impedir.
 */
const ehPropriedadeIntelectual = (i: InfracaoDoAnuncio) =>
  (i.categoria ?? "").toUpperCase().startsWith("PI_");

/** As infrações por MLB. Ausente = o ML não falou deste anúncio. */
export type InfracoesPorAnuncio = Readonly<Record<string, readonly InfracaoDoAnuncio[]>>;

export interface PendenciaDaConta {
  gravidade: Gravidade;
  /** Chave para agrupar na tela. */
  tipo:
    | "bloqueado"
    | "propriedade-intelectual"
    | "infracao-do-ml"
    | "pausado-por-voce"
    | "capa-pequena"
    | "capa-nao-quadrada"
    | "sem-estoque"
    | "em-revisao"
    | "sem-motivo";
  mlb: string;
  permalink: string;
  titulo: string;
  /** O que ela precisa fazer, em português dela — não no jargão do ML. */
  oQueFazer: string;
  /** O fato medido que sustenta a linha. */
  porque: string;
  estoque: number;
  /** O produto a que este anúncio pertence — é por ele que a tela agrupa. */
  familia: string;
}

export interface AnuncioParaPendencia {
  mlb: string;
  titulo: string;
  permalink: string;
  status: string;
  estoque: number;
  subStatus?: string[];
  fotoCapaMaxSize?: string;
  /** O agrupamento do ML — é ele que liga um anúncio bloqueado aos irmãos. */
  familia?: string;
}

/**
 * Uma pendência POR PRODUTO, não por variação.
 *
 * O painel do próprio Mercado Livre mostra assim — "Chinelo Havaianas Slim
 * Liso · Perdendo exposição em 19 variações" — e a lojista disse que faz mais
 * sentido. 237 linhas viram ~20.
 *
 * O estoque é SOMADO: são 19 anúncios do mesmo sapato, e o que decide a ordem
 * é o total parado, não o de um tamanho.
 */
export interface GrupoDePendencia {
  familia: string;
  tipo: PendenciaDaConta["tipo"];
  gravidade: Gravidade;
  quantos: number;
  estoque: number;
  oQueFazer: string;
  porque: string;
  /** Alguns MLBs, para ela abrir e ver. Não todos: a lista é para agir. */
  exemplos: { mlb: string; permalink: string }[];
}

export interface ResumoDePendencias {
  itens: PendenciaDaConta[];
  /** As mesmas pendências, uma linha por produto. É o que a tela usa. */
  grupos: GrupoDePendencia[];
  /** Quantas existem de cada tipo — a lista pode ser recortada, o total não. */
  totais: { tipo: PendenciaDaConta["tipo"]; quantas: number }[];
  /** Estoque parado atrás das pendências de receita. */
  estoqueTravado: number;
}

/**
 * Texto seguro na fronteira.
 *
 * `AnuncioParaPendencia` chega por JSON de `/api/ml/importar-anuncios`. Em
 * 02/08/2026 esta função quebrou com "Cannot read properties of undefined
 * (reading 'localeCompare')" porque um anúncio veio sem `mlb` — o tipo dizia
 * `string`, e o tipo não é um contrato com quem está do outro lado do fio.
 *
 * Mesma lição do `family_id` que veio número: supor o tipo é supor o valor.
 */
const txt = (v: unknown): string => (v == null ? "" : String(v));

const temSub = (a: AnuncioParaPendencia, s: string) => (a.subStatus ?? []).includes(s);
const ativo = (a: AnuncioParaPendencia) => (a.status || "").trim().toLowerCase() === "active";

/**
 * As pendências da conta, já ordenadas.
 *
 * `limitePorTipo` recorta a LISTA, nunca os totais: mostrar 20 de 535 é útil;
 * dizer que são 20 seria mentira.
 */
export function pendenciasDaConta(
  anuncios: readonly AnuncioParaPendencia[],
  limitePorTipo = 25,
  infracoes: InfracoesPorAnuncio = {}
): ResumoDePendencias {
  const todas: PendenciaDaConta[] = [];

  // OS IRMÃOS AINDA NO AR.
  //
  // Em 03/08/2026 o Mercado Livre cancelou 6 anúncios por infração de
  // propriedade intelectual — e deixou 12 dos MESMOS DOIS produtos no ar.
  //
  // Se o gatilho foi o produto (uma marca reivindicando o desenho), esses 12
  // são a próxima leva, e mais 12 infrações sobre um histórico que já tem 6 é
  // outro patamar — a política do ML fala em suspensão.
  //
  // Contar os irmãos transforma "este anúncio foi bloqueado" em "e há outros 8
  // iguais expostos ao mesmo risco", que é a informação que muda a decisão.
  const ativosPorFamilia = new Map<string, number>();
  for (const a of anuncios) {
    const f = txt(a.familia);
    if (!f || !ativo(a)) continue;
    // O já bloqueado NÃO conta como irmão em risco: ele já caiu. Sem esta
    // linha, um anúncio bloqueado contava a si mesmo e a frase dizia "há 1
    // anúncio do mesmo produto ainda no ar" apontando para ele próprio.
    if (temSub(a, "forbidden")) continue;
    ativosPorFamilia.set(f, (ativosPorFamilia.get(f) ?? 0) + 1);
  }

  for (const a of anuncios) {
    const base = {
      mlb: txt(a.mlb),
      permalink: txt(a.permalink),
      titulo: txt(a.titulo) || txt(a.mlb) || "(anúncio sem título)",
      estoque: Number(a.estoque) || 0,
      familia: txt(a.familia) || txt(a.titulo) || txt(a.mlb),
    };

    // O QUE O ML JÁ DISSE deste anúncio. Vazio = ele não falou.
    const doML = infracoes[txt(a.mlb)] ?? [];
    const acusacoes = [...new Set(doML.map((i) => i.motivo).filter(Boolean))];
    const remedios = [...new Set(doML.map((i) => i.remedio).filter(Boolean))];
    const dePI = doML.some(ehPropriedadeIntelectual);

    // 1) CONTA — bloqueio é política, e reincidência custa a conta inteira.
    if (temSub(a, "forbidden")) {
      const irmaos = ativosPorFamilia.get(txt(a.familia)) ?? 0;
      todas.push({
        ...base,
        gravidade: "conta",
        tipo: "bloqueado",
        // A ACUSAÇÃO, quando nós a temos.
        //
        // Este texto mandava a lojista abrir o painel do ML "e ver a acusação".
        // Desde a 052 a acusação está no NOSSO banco — continuar mandando ela
        // procurar fora seria guardar a resposta e não dar.
        oQueFazer:
          (acusacoes.length > 0
            ? `O Mercado Livre diz: ${acusacoes.join(" · ")}. `
            : "Abra no Mercado Livre, em Infrações, e veja a acusação. ") +
          (dePI
            ? "Esta é uma acusação de PROPRIEDADE INTELECTUAL: o Mercado Livre diz que o anúncio não corresponde ao produto original. Não se resolve trocando a foto nem corrigindo o título — é caso de comprovar a origem com ele. "
            : "") +
          "NÃO republique: republicar o que foi cancelado conta como reincidência, e reincidência é o que leva à suspensão da conta." +
          (irmaos > 0
            ? ` Há ${irmaos} anúncio(s) do mesmo produto ainda no ar — se a acusação for sobre o PRODUTO, eles são os próximos. Pausar é reversível.`
            : ""),
        porque: "O Mercado Livre cancelou este anúncio por descumprir uma política.",
      });
      continue; // bloqueio manda; não polui a lista com o resto
    }

    // 1a) ACUSAÇÃO DE PROPRIEDADE INTELECTUAL, ainda sem cancelamento.
    //
    // Medido em 10/08/2026: dois anúncios do Babuche Yvate 1816 com `PI_FAKES`,
    // em `under_review`, SEM `forbidden`. Eles caíam no balde 1b — "está
    // impedindo de vender agora", ordenado por estoque parado — e como o
    // estoque deles é ZERO, iam para o FIM da lista.
    //
    // Uma acusação de contrafação no rodapé da fila de fotos. A gravidade não
    // vem do estoque: vem de reincidência custar a conta inteira, e ela chega
    // com o primeiro aviso, não com o cancelamento.
    if (dePI) {
      const irmaos = ativosPorFamilia.get(txt(a.familia)) ?? 0;
      todas.push({
        ...base,
        gravidade: "conta",
        tipo: "propriedade-intelectual",
        oQueFazer:
          "NÃO edite e republique — isso conta como reincidência. O Mercado Livre não informou remédio para este tipo; o caminho é comprovar a origem do produto com ele (nota fiscal do distribuidor)." +
          (irmaos > 0
            ? ` Há ${irmaos} anúncio(s) do mesmo produto ainda no ar — se a reivindicação for sobre o PRODUTO, eles são os próximos. Pausar é reversível.`
            : ""),
        porque:
          acusacoes.length > 0
            ? `O Mercado Livre acusou este anúncio de propriedade intelectual: ${acusacoes.join(" · ")}`
            : "O Mercado Livre registrou uma infração de propriedade intelectual neste anúncio.",
      });
      // Não segue para 1b: é a MESMA acusação, e a de PI manda. Duas linhas
      // para um anúncio foi o defeito consertado hoje mais cedo no `em-revisao`.
      continue;
    }

    // 1b) O ML FALOU, e não é cancelamento — é punição que trava a venda.
    //
    // 1.060 infrações em 460 anúncios, medidas em 03/08/2026. O remédio é DELE,
    // e é específico: "Corrija suas fotos: não mostra apenas uma unidade do
    // produto". Nenhuma inferência nossa chega a esse nível de instrução.
    if (doML.length > 0) {
      // ELE ESTÁ SEGURANDO O ANÚNCIO, ou só anotou a infração?
      //
      // `waiting_for_patch` é o Mercado Livre dizendo "tirei do ar e só volta
      // quando você corrigir". Sem ele, a infração existe e o anúncio continua
      // vendendo. É a diferença entre risco e prejuízo em curso, e ela decide o
      // que a lojista faz primeiro.
      //
      // Medido em 03/08/2026 na conta dela: 460 anúncios com infração, dos
      // quais 127 segurados — e nesses 127 estavam 800 peças que não podiam
      // vender de jeito nenhum.
      const segurado = temSub(a, "waiting_for_patch");
      todas.push({
        ...base,
        gravidade: "receita",
        tipo: "infracao-do-ml",
        // Sem invenção: o que sai daqui é o que ele escreveu.
        oQueFazer:
          remedios.length > 0
            ? remedios.join(" ")
            : "O Mercado Livre registrou uma infração e não disse o que fazer. Abra o anúncio no painel dele.",
        porque:
          (acusacoes.length > 0
            ? `O Mercado Livre registrou ${doML.length} infração(ões) neste anúncio: ${acusacoes.join(" · ")}`
            : `O Mercado Livre registrou ${doML.length} infração(ões) neste anúncio, sem informar o motivo.`) +
          (segurado
            ? ". E ele TIROU o anúncio do ar até a correção — este estoque não vende enquanto isso."
            : ""),
      });
    }

    // 2) RECEITA — a capa fora do padrão tira exposição. Só conta para quem
    //    está NO AR: mandar refotografar um anúncio pausado é trabalho jogado
    //    fora enquanto ele não voltar.
    // DUAS pendências diferentes, com remédios diferentes — e chamar as duas de
    // "refotografe" mandava a lojista fotografar de novo o que só precisa de
    // faixa branca. Medido em 02/08/2026 na conta dela: `993x1200`, `961x1200`
    // e `896x1152` não são fotos pequenas, são fotos EM PÉ.
    //
    //   lado maior >= 1200  ->  só falta virar quadrada. Ajuste, não fotografia.
    //   lado maior <  1200  ->  não há pixel para recuperar. Foto nova.
    // A NOSSA REGRA SÓ FALA ONDE O ML CALOU.
    //
    // Conferida contra as 460 infrações em 03/08/2026, ela acerta 29%: manda
    // refotografar 373 anúncios que ele nunca reclamou e aprova 166 que ele
    // pune. Onde ele já falou, a palavra dele substitui a nossa — repetir a
    // inferência ao lado do fato só criaria duas cobranças para o mesmo anúncio,
    // uma delas provavelmente errada.
    const capa = lerMaxSize(a.fotoCapaMaxSize);
    if (ativo(a) && doML.length === 0 && capa && !(capa.quadrada && capa.grandeOSuficiente)) {
      const maior = Math.max(capa.largura, capa.altura);
      const daParaAjustar = maior >= LADO_MINIMO_DA_CAPA;
      todas.push({
        ...base,
        gravidade: "receita",
        tipo: daParaAjustar ? "capa-nao-quadrada" : "capa-pequena",
        // A REGRA, NAS PALAVRAS DO ML — lida no painel dela em 03/08/2026:
        //
        //   "Descumpre o tamanho mínimo, posição e proporção do produto na foto."
        //
        // São TRÊS coisas, e só a primeira é resolução. "Proporção do produto na
        // foto" é o quanto o produto OCUPA do quadro.
        //
        // Isso derruba a ideia de completar com fundo branco por dois lados:
        // o ML apara a faixa no upload (enviamos 1200x1200, ele guardou
        // 1062x1200) E, mesmo se não aparasse, a faixa deixaria o produto MENOR
        // dentro da foto — piorando justamente o critério que ele cobra.
        //
        // Antes desta linha eu instruía com base numa premissa minha
        // ("quadrada e >= 1200") que o ML nunca enunciou. O erro não foi o
        // reprocessamento: foi eu ter suposto a regra.
        oQueFazer: daParaAjustar
          ? "Precisa de foto nova. O Mercado Livre cobra tamanho mínimo, posição E proporção do produto na foto — o produto tem que aparecer maior e centralizado no quadro, e isso não se resolve editando o arquivo atual. No anúncio, 'Alterar fotos' mostra o diagnóstico dele."
          : `Precisa de foto nova: o maior lado tem ${maior} pixels e o Mercado Livre pede ${LADO_MINIMO_DA_CAPA}. Não há como ampliar sem perder qualidade.`,
        // DITO COMO PALPITE, porque é o que é.
        //
        // A frase anterior — "fora do padrão que o Mercado Livre exige" —
        // afirmava uma regra que ele nunca enunciou, e a medida de 03/08 mostrou
        // que ela erra em 71% dos casos. Cobrar com a autoridade dele o que é
        // suposição nossa é o mesmo defeito do conserto automático de capa,
        // agora no diagnóstico em vez do conserto.
        porque:
          `A capa tem ${capa.largura}x${capa.altura}. O Mercado Livre NÃO reclamou deste anúncio — ` +
          "isto é uma suspeita nossa, baseada em tamanho, e ela acerta menos da metade das vezes.",
      });
    }

    // VOCÊ PAUSOU — pergunta, não cobrança.
    //
    // Medido em 03/08/2026: 51 anúncios com `paused_by_seller` e 416 peças
    // paradas atrás deles. Até aqui eles eram INVISÍVEIS na lista: não estão
    // `active` (a regra de capa não olha), não têm `out_of_stock` nem
    // `waiting_for_patch`, e o balde "sem motivo informado" exige `subStatus`
    // vazio — que não é o caso, porque o ML disse o motivo.
    //
    // Não é defeito: foi decisão DELA. Mas decisão esquecida e decisão tomada
    // são indistinguíveis para o sistema, e 416 peças é caro para um
    // esquecimento. Então o texto PERGUNTA em vez de acusar — e o botão que
    // resolve já existe na tela de Anúncios desde antes de hoje.
    if (temSub(a, "paused_by_seller")) {
      todas.push({
        ...base,
        gravidade: "receita",
        tipo: "pausado-por-voce",
        oQueFazer:
          "Se foi de propósito, está tudo certo — ignore esta linha. Se esqueceu, o botão Reativar em Anúncios devolve ao ar na hora.",
        porque: "Você pausou este anúncio no Mercado Livre — não foi ele que tirou do ar.",
      });
    }

    if (temSub(a, "out_of_stock")) {
      todas.push({
        ...base,
        gravidade: "receita",
        tipo: "sem-estoque",
        oQueFazer: "Reponha o estoque ou encerre o anúncio.",
        porque: "O Mercado Livre tirou do ar por falta de estoque.",
      });
    }

    // 3) ATENÇÃO — ela precisa saber, e não há ação imediata clara.
    //
    // SÓ QUANDO NÃO SABEMOS QUAL É A CORREÇÃO. Este é o mesmo defeito que o
    // caso `bloqueado` já consertou algumas linhas acima, e que ficou de fora
    // aqui: mandar a lojista procurar no painel do ML uma resposta que está no
    // NOSSO banco desde a 052.
    //
    // Medido em 10/08/2026 contra produção: dos 127 anúncios em
    // `waiting_for_patch`, 127 tinham infração registrada — cem por cento. A
    // linha abaixo era emitida em TODOS eles, ao lado da linha que já trazia o
    // remédio do ML. O mesmo anúncio aparecia duas vezes, e a segunda dizia "só
    // o painel diz qual" logo abaixo da primeira, que dizia qual.
    //
    // Na tela o estrago era maior que a duplicata: o agrupamento é por
    // `tipo|familia`, então os 15 produtos viravam 30 linhas, metade delas
    // mandando a lojista para fora do Zion.
    //
    // Onde ele NÃO falou, esta linha continua certa e continua saindo — é o
    // único caso em que o painel dele é mesmo a única fonte.
    if (temSub(a, "waiting_for_patch") && doML.length === 0) {
      todas.push({
        ...base,
        gravidade: "atencao",
        tipo: "em-revisao",
        oQueFazer: "Abra no Mercado Livre: ele está pedindo uma correção e só o painel diz qual.",
        porque: "O Mercado Livre marcou o anúncio como aguardando correção.",
      });
    }

    if ((a.subStatus ?? []).length === 0 && !ativo(a)) {
      todas.push({
        ...base,
        gravidade: "atencao",
        tipo: "sem-motivo",
        oQueFazer: "Abra no Mercado Livre para ver o que houve.",
        porque: "O anúncio não está no ar e o Mercado Livre não informou o motivo.",
      });
    }
  }

  const PESO: Record<Gravidade, number> = { conta: 0, receita: 1, atencao: 2 };
  // Dentro da mesma gravidade, MAIOR ESTOQUE primeiro: é onde o dinheiro está
  // parado. Empate desempata pelo MLB para a ordem ser determinística — duas
  // execuções da mesma conta precisam produzir a mesma lista.
  todas.sort(
    (x, y) =>
      PESO[x.gravidade] - PESO[y.gravidade] ||
      y.estoque - x.estoque ||
      txt(x.mlb).localeCompare(txt(y.mlb))
  );

  const contagem = new Map<PendenciaDaConta["tipo"], number>();
  for (const p of todas) contagem.set(p.tipo, (contagem.get(p.tipo) ?? 0) + 1);

  const mostradas = new Map<PendenciaDaConta["tipo"], number>();
  const itens = todas.filter((p) => {
    const n = (mostradas.get(p.tipo) ?? 0) + 1;
    mostradas.set(p.tipo, n);
    return n <= limitePorTipo;
  });

  // O agrupamento sai de TODAS, não das 25 mostradas: um grupo que diz "19
  // variações" tem que contar as 19, mesmo que a lista recortada mostre 3.
  const porGrupo = new Map<string, GrupoDePendencia>();
  for (const p of todas) {
    const chave = `${p.tipo}|${p.familia}`;
    const g = porGrupo.get(chave);
    if (!g) {
      porGrupo.set(chave, {
        familia: p.familia,
        tipo: p.tipo,
        gravidade: p.gravidade,
        quantos: 1,
        estoque: p.estoque,
        oQueFazer: p.oQueFazer,
        porque: p.porque,
        exemplos: [{ mlb: p.mlb, permalink: p.permalink }],
      });
      continue;
    }
    g.quantos++;
    g.estoque += p.estoque;
    if (g.exemplos.length < 3) g.exemplos.push({ mlb: p.mlb, permalink: p.permalink });
  }
  const grupos = [...porGrupo.values()].sort(
    (x, y) => PESO[x.gravidade] - PESO[y.gravidade] || y.estoque - x.estoque ||
      x.familia.localeCompare(y.familia)
  );

  return {
    itens,
    grupos,
    totais: [...contagem.entries()]
      .map(([tipo, quantas]) => ({ tipo, quantas }))
      .sort((a, b) => b.quantas - a.quantas),
    estoqueTravado: todas
      .filter((p) => p.gravidade === "receita")
      .reduce((t, p) => t + (p.estoque || 0), 0),
  };
}
