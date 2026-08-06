// "Aprovado · nota 0/100" — a contradição que 790 linhas mostravam.
//
// ===========================================================================
// O CASO
// ===========================================================================
//
// 03/08/2026, na tela "Meus Anúncios", no painel de detalhe de um anúncio
// importado:
//
//     Veredito da IA: aprovado · nota 0/100
//
// Ninguém tira zero e é aprovado. O que aconteceu é que `nota_diagnostico` é
// `integer NOT NULL default 0` no banco, então "não avaliado" e "avaliado e
// tirou zero" caem no MESMO valor — e a tela pintava de vermelho um número que
// significava ausência de medição.
//
// Medido: 790 dos 880 anúncios da conta estavam assim. É o defeito que
// atravessa este projeto inteiro — ausência virando afirmação — desta vez na
// apresentação de um número.
//
// ===========================================================================
// POR QUE NÃO FOI CORRIGIDO NO BANCO
// ===========================================================================
//
// O certo seria `nota_diagnostico` aceitar NULL. Isso é DDL, e migração exige
// autorização explícita. A marca vive no `anuncio` (JSONB), que é schemaless —
// mesma verdade, sem tocar no schema.

export interface RegistroComNota {
  notaDiagnostico: number;
  mlItemId?: string | null;
  anuncio?: { avaliadoPelaIA?: boolean } | null;
}

/**
 * A esteira avaliou este anúncio?
 *
 * A marca explícita manda quando existe. Nos registros gravados ANTES dela, a
 * regra é conservadora: só é considerado não-avaliado quem tem MLB **e** nota
 * zero — porque um anúncio que veio pronto do marketplace nunca passou pela
 * esteira, e um rascunho com nota zero passou e tirou zero.
 *
 * A conservadoria tem preço e ele é o certo: um anúncio publicado que
 * genuinamente tirou zero seria mostrado como "não avaliado". Errar para o lado
 * de "não sei" é melhor que errar para o lado de acusar o trabalho de alguém.
 */
export function foiAvaliadoPelaIA(r: RegistroComNota): boolean {
  const marca = r.anuncio?.avaliadoPelaIA;
  if (typeof marca === "boolean") return marca;
  const veioDoMarketplace = Boolean((r.mlItemId ?? "").trim());
  return !(veioDoMarketplace && r.notaDiagnostico === 0);
}

/**
 * A nota para mostrar — ou `null`, que a tela renderiza como "—".
 *
 * `null` NUNCA vira 0 na tela. Foi a confusão entre os dois que produziu a
 * contradição original.
 */
export function notaExibivel(r: RegistroComNota): number | null {
  return foiAvaliadoPelaIA(r) ? r.notaDiagnostico : null;
}

/** A frase do veredito, sem afirmar nota que não existe. */
export function explicarVeredito(r: RegistroComNota & { vereditoA10: string }): string {
  const nota = notaExibivel(r);
  if (nota === null) {
    return "Veio pronto do marketplace — a IA não avaliou este anúncio.";
  }
  // "VEREDITO" SAIU DA FRASE. É palavra de tribunal, e a lojista não está sendo
  // julgada — a IA olhou o anúncio dela e disse se está pronto. O nome interno
  // da régua (`vereditoA10`) fica no DADO, onde pertence: o A10 é o critério, e
  // critério é coisa nossa.
  const julgamento = r.vereditoA10 === "aprovado" ? "Aprovado" : "Reprovado";
  return `${julgamento} pela IA · nota ${nota}/100`;
}
