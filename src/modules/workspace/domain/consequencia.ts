// O contrato da CONSEQUÊNCIA — o que o sistema tem direito de dizer depois de
// uma escrita, e o que ele não tem direito de fazer.
//
// ===========================================================================
// ISTO É CONTRATO, NÃO IMPLEMENTAÇÃO
// ===========================================================================
//
// O exemplo do enunciado —
//
//     ✓ 47 variantes atualizadas
//       Isso desbloqueou:  Pricing (agora calculável)
//                          Preparação (2 produtos podem avançar)
//       [Calcular preço]
//
// — pede DOIS dados que hoje ninguém devolve: "pricing virou calculável POR
// CAUSA desta escrita" e "2 produtos passaram a poder avançar".
//
// O que existe hoje, medido:
//
//   `/api/assistente/proposta` devolve o desfecho da escrita (quantos alvos,
//   sucesso/parcial/falha) e grava em `copilot_acoes` o antes e o depois.
//   NÃO devolve o que mudou de possível.
//
// Inventar o número no cliente seria repetir o defeito que o próprio Copilot
// existe para não ter: o `/api/assistente` foi desenhado para NÃO receber
// contagens, porque "um modelo que vê 43 sem custo escreve cerca de 40". Uma
// tela que estima "2 produtos podem avançar" erra pelo mesmo motivo.
//
// Então: o contrato fica escrito e testado; a construção do `Desbloqueio` fica
// para quem tiver o dado. `semDesbloqueios` é o caminho honesto até lá — e ele
// não é um caso degradado, é o caso comum.
//
// ===========================================================================
// A INVARIANTE
// ===========================================================================
//
//     UMA CONSEQUÊNCIA NÃO CARREGA DESTINO.
//
// Ela descreve o que aconteceu e o que passou a ser possível. Ir é do clique.
// O tipo abaixo não tem campo de navegação, e `aplicar` em `modosDoWorkspace`
// não aceita nenhum — a regra não depende de ninguém lembrar dela.

import type { ModoDoWorkspace } from "./modosDoWorkspace";

/**
 * Um modo que passou a ser possível, com o motivo em números REAIS.
 *
 * `quantos` é `number | null`, e `null` não é descuido: é a resposta quando o
 * servidor não contou. "Preparação" sem número é uma oferta honesta;
 * "Preparação — 2 produtos" inventada é uma mentira que o lojista vai conferir.
 */
export interface Desbloqueio {
  modo: ModoDoWorkspace;
  /** Quantos itens passaram a ser possíveis. `null` = o servidor não contou. */
  quantos: number | null;
  /** O substantivo contado ("produtos", "variantes"). Ignorado se `quantos` é null. */
  unidade?: string;
}

export interface Consequencia {
  /** O que aconteceu — vem do desfecho REAL da escrita, nunca do modelo. */
  resumo: string;
  /** Quantos alvos a escrita afetou. É o número que a rota já devolve. */
  afetados: number;
  desbloqueios: readonly Desbloqueio[];
}

/**
 * A consequência de uma escrita sobre a qual não se sabe o que foi desbloqueado.
 *
 * O caso comum hoje. A tela mostra o que aconteceu e não oferece transição —
 * que é melhor que oferecer uma transição para um modo que talvez não tenha
 * nada dentro.
 */
export function semDesbloqueios(resumo: string, afetados: number): Consequencia {
  return { resumo, afetados, desbloqueios: [] };
}

/**
 * O rótulo do convite.
 *
 * Sem `quantos`, só o nome do modo. Com `quantos`, o número — e o singular certo,
 * porque "1 produtos podem avançar" denuncia que a frase foi montada por
 * concatenação e faz duvidar do resto da tela.
 */
export function rotuloDoDesbloqueio(d: Desbloqueio): string {
  const nome = NOME_DO_MODO[d.modo];
  if (d.quantos === null || d.quantos === undefined) return nome;
  const unidade = d.unidade ?? "itens";
  const singular = d.quantos === 1 ? unidade.replace(/s$/, "") : unidade;
  return `${nome} — ${d.quantos} ${singular}`;
}

const NOME_DO_MODO: Record<ModoDoWorkspace, string> = {
  "fila-de-decisoes": "Decisões",
  triagem: "Triagem",
  pricing: "Pricing",
  draft: "Cadastro",
  preparacao: "Preparação",
};

/**
 * Um desbloqueio com contagem ZERO não é oferta — é botão para uma tela vazia.
 *
 * Filtrar aqui, e não na tela, porque a tela vai esquecer. `null` continua
 * passando: "não contei" é diferente de "contei e deu zero".
 */
export function ofertasQueValem(c: Consequencia): readonly Desbloqueio[] {
  return c.desbloqueios.filter((d) => d.quantos === null || d.quantos > 0);
}

/**
 * O que a consequência autoriza a mudar no workspace: NADA além das ofertas.
 *
 * Existe para ser chamada no lugar de construir o evento à mão, e para que a
 * conversão consequência -> evento tenha um teste. O tipo de saída não tem
 * destino; não há como acrescentar um sem mudar `modosDoWorkspace`.
 */
export function comoEvento(c: Consequencia): {
  tipo: "consequencia";
  consequencia: { resumo: string; desbloqueou: readonly ModoDoWorkspace[] };
} {
  return {
    tipo: "consequencia",
    consequencia: {
      resumo: c.resumo,
      desbloqueou: ofertasQueValem(c).map((d) => d.modo),
    },
  };
}
