// AS FOTOS DE UM PRODUTO, respondidas do nosso próprio dado.
//
// ===========================================================================
// A PERGUNTA QUE NÃO TINHA RESPOSTA — 14/08/2026
// ===========================================================================
//
// A lojista tem 310 anúncios ativos com capa fora do padrão, em 54 produtos, e
// o Mercado Livre cobrando "a foto de capa não cumpre os requisitos". O chat
// sabia CONTAR isso pela conta inteira e não sabia responder a pergunta que ela
// realmente faz, produto a produto: **preciso fotografar este, ou já tenho foto
// boa aqui dentro?**
//
// A diferença entre as duas respostas é uma viagem ao fabricante.
//
// ===========================================================================
// POR QUE NÃO PERGUNTA AO MERCADO LIVRE
// ===========================================================================
//
// Porque cada chamada ao ML renova e regrava o refresh_token dela — uma
// ferramenta de chat que lê o marketplace a cada pergunta é uma ferramenta que
// derruba a conexão dela num dia movimentado.
//
// E não precisa: `anuncios_gerados.foto_capa_max_size` passou a ser anotado
// pela própria rota que troca a capa (14/08), e a importação o preenche. O
// dado é nosso e está fresco.
//
// ===========================================================================
// A RÉGUA É A MESMA, SEMPRE
// ===========================================================================
//
// `lerMaxSize` é o mesmo juiz que a tela de conferência usa quando ela larga
// uma foto no chat, e o mesmo que classifica as capas que o ML informou. Uma
// segunda régua aqui diria "serve" sobre o que a outra chama de fora do padrão
// — e a lojista descobriria a divergência do pior jeito, com o anúncio no ar.

import { lerMaxSize, LADO_MINIMO_DA_CAPA } from "../../integration/domain/capaForaDoPadrao";

export interface AnuncioParaDiagnostico {
  mlb: string;
  /** O `max_size` da capa como o ML informa: "1200x1200". `null` = não sabemos. */
  capaMaxSize: string | null;
}

export interface FotoParaDiagnostico {
  largura: number | null;
  altura: number | null;
  /** A cor da foto (migração 076). `null` = não sabemos de qual variação é. */
  cor: string | null;
}

export type VeredictoDasFotos =
  | "sem-anuncio"
  | "nao-sei"
  | "tudo-certo"
  | "tem-foto-para-aplicar"
  | "precisa-fotografar";

export interface DiagnosticoDasFotos {
  anuncios: number;
  /** Capas que a régua reprova. */
  foraDoPadrao: number;
  /** Capas que ainda não medimos. NUNCA somadas às reprovadas. */
  semMedida: number;
  /** Fotos do cadastro que serviriam de capa. */
  fotosQueServem: number;
  /** As cores dessas fotos, quando declaradas — é por cor que a troca acontece. */
  coresProntas: readonly string[];
  veredicto: VeredictoDasFotos;
  frase: string;
}

/** A foto serve de capa? Mesma régua da tela, e do relatório do ML. */
export function serveDeCapa(f: FotoParaDiagnostico): boolean {
  const c = lerMaxSize(f.largura && f.altura ? `${f.largura}x${f.altura}` : null);
  return !!c && c.quadrada && c.grandeOSuficiente;
}

/**
 * O diagnóstico, e a frase que a lojista lê.
 *
 * A ordem dos vereditos é a ordem do que ela pode FAZER:
 *
 *   1. não sabemos          — e dizer isso vale mais que um palpite
 *   2. está tudo certo      — não gaste o tempo dela
 *   3. já tem foto boa aqui — o conserto é um clique, não uma viagem
 *   4. precisa fotografar   — a resposta cara, e por isso a última
 *
 * `semMedida` nunca entra na conta de `foraDoPadrao`: "não medimos" e "está
 * ruim" são respostas diferentes, e só a segunda manda alguém trabalhar.
 */
export function diagnosticarFotos(
  anuncios: readonly AnuncioParaDiagnostico[],
  fotos: readonly FotoParaDiagnostico[],
  nomeDoProduto: string
): DiagnosticoDasFotos {
  const semMedida = anuncios.filter((a) => !lerMaxSize(a.capaMaxSize)).length;
  const medidos = anuncios.filter((a) => !!lerMaxSize(a.capaMaxSize));
  const foraDoPadrao = medidos.filter((a) => {
    const c = lerMaxSize(a.capaMaxSize)!;
    return !(c.quadrada && c.grandeOSuficiente);
  }).length;

  const boas = fotos.filter(serveDeCapa);
  const coresProntas = [
    ...new Set(boas.map((f) => (f.cor ?? "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const base = { anuncios: anuncios.length, foraDoPadrao, semMedida, fotosQueServem: boas.length, coresProntas };

  if (anuncios.length === 0) {
    return {
      ...base,
      veredicto: "sem-anuncio",
      frase: `${nomeDoProduto} ainda não tem anúncio no Mercado Livre.`,
    };
  }
  if (medidos.length === 0) {
    return {
      ...base,
      veredicto: "nao-sei",
      frase:
        `Ainda não medi a capa de nenhum dos ${anuncios.length} anúncio(s) de ${nomeDoProduto}. ` +
        "Rode \"Reler minha conta no Mercado Livre\" que eu passo a saber.",
    };
  }
  const ressalva =
    semMedida > 0
      ? ` (de ${semMedida} anúncio(s) eu ainda não sei — não medi a capa deles)`
      : "";

  if (foraDoPadrao === 0) {
    return {
      ...base,
      veredicto: "tudo-certo",
      frase: `As capas de ${nomeDoProduto} estão dentro do padrão${ressalva}.`,
    };
  }
  if (boas.length > 0) {
    const cores =
      coresProntas.length > 0
        ? ` A(s) que tenho é(são) de: ${coresProntas.join(", ")}.`
        : " Mas nenhuma delas tem a cor definida, e cada anúncio seu é de uma cor — me diga a cor e eu aplico.";
    return {
      ...base,
      veredicto: "tem-foto-para-aplicar",
      frase:
        `${foraDoPadrao} anúncio(s) de ${nomeDoProduto} estão com a capa fora do padrão${ressalva}, ` +
        `e já tenho ${boas.length} foto(s) aqui que serviriam de capa.${cores}`,
    };
  }
  return {
    ...base,
    veredicto: "precisa-fotografar",
    frase:
      `${foraDoPadrao} anúncio(s) de ${nomeDoProduto} estão com a capa fora do padrão${ressalva}, ` +
      `e nenhuma das ${fotos.length} foto(s) que tenho aqui atende o mínimo dele: quadrada ` +
      `com ${LADO_MINIMO_DA_CAPA} de lado. Essa é foto nova — me mande pelo chat que eu troco. ` +
      "Aviso desde já: atender o mínimo não garante que ele tire a cobrança — ele também " +
      "exige o produto inteiro e centralizado, e isso só o olho dele julga.",
  };
}
