// A COTA MENSAL, e a frase que a lojista lê quando ela acaba.
//
// ===========================================================================
// OS DOIS DEFEITOS QUE ISTO CONSERTA — medidos em 17/08/2026
// ===========================================================================
//
// 1. "NÃO SEI" VIRAVA "ACABOU". `quotaEsteira()` devolvia
//    `{limite:0, usado:0, restante:0}` quando a leitura FALHAVA — um objeto
//    verdadeiro com restante zero. A tela calculava
//    `semCota = Boolean(quota) && restante <= 0` e mostrava "você usou todas
//    as otimizações do seu plano este mês", **bloqueando o botão Gerar**.
//
//    Ou seja: uma falha de rede virava uma parede comercial. A lojista era
//    mandada falar com a Zion por um erro nosso, e não tinha como saber.
//
// 2. A FRASE NÃO DIZIA QUANDO VOLTA. A cota reinicia no dia 1º —
//    `date_trunc('month', now())` na função do banco. Quem só precisava
//    esperar até o mês virar era obrigado a pedir ajuda, porque a tela dizia
//    "fale com a Zion" e mais nada.
//
//    Medido: o limite de quem entra sozinho é 30 (`LIMITE_ESTEIRA_INICIAL`).
//    É a pessoa que bate nessa parede — a Leilane usa 298 de 5.000 e nunca
//    chega perto.
//
// ===========================================================================
// O QUE ESTE MÓDULO NÃO FAZ, E É DECISÃO
// ===========================================================================
//
// Não oferece ampliar. Ampliar de graça não é produto e ampliar pagando é
// billing, que está fora do caminho crítico por decisão registrada. A frase
// honesta é a que diz o número e a data — e cala sobre o que não existe.

/** O que a função `quota_esteira` do banco devolve. `null` = não conseguimos ler. */
export interface CotaLida {
  limite: number;
  usado: number;
}

export type EstadoDaCota =
  /** A leitura falhou. NUNCA é o mesmo que "acabou". */
  | { tipo: "nao-sei"; frase: string; podeGerar: true }
  | { tipo: "tem"; restante: number; frase: string; podeGerar: true }
  | { tipo: "acabou"; limite: number; frase: string; podeGerar: false };

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Quando a cota volta: dia 1º do mês seguinte.
 *
 * A conta é a mesma do banco (`date_trunc('month', now())`), do outro lado.
 * Se as duas divergirem, a tela promete uma data em que nada acontece.
 */
export function voltaEm(agora: Date): string {
  const m = agora.getMonth();
  return `1º de ${MESES[(m + 1) % 12]}`;
}

/**
 * O estado da cota, e a frase.
 *
 * `podeGerar` é FAIL-OPEN quando não sabemos, e isso segue a decisão que já
 * estava escrita na esteira — "enquanto a quota não chega, não se bloqueia por
 * algo que não se sabe". Bloquear por ignorância é o defeito 1 acima; deixar
 * passar durante uma falha custa, no pior caso, algumas otimizações a mais.
 */
export function estadoDaCota(c: CotaLida | null, agora: Date): EstadoDaCota {
  if (!c || !Number.isFinite(c.limite) || c.limite <= 0) {
    return {
      tipo: "nao-sei",
      podeGerar: true,
      frase:
        "Não consegui ler a sua cota do mês agora. Você pode continuar — se der erro ao " +
        "gerar, tente de novo em alguns minutos.",
    };
  }
  const usado = Math.max(0, Math.floor(c.usado) || 0);
  const restante = Math.max(0, c.limite - usado);
  if (restante > 0) {
    return {
      tipo: "tem",
      restante,
      podeGerar: true,
      frase: `${restante} de ${c.limite} otimizações restantes neste mês.`,
    };
  }
  return {
    tipo: "acabou",
    limite: c.limite,
    podeGerar: false,
    // O NÚMERO E A DATA, e nada além. Sem "fale com a Zion": quem só precisava
    // esperar o mês virar não tem por que pedir ajuda a ninguém.
    frase:
      `Você usou as ${c.limite} otimizações deste mês. ` +
      `A cota volta em ${voltaEm(agora)} — o que já está gerado continua aqui.`,
  };
}
