// A SAÚDE DA LOJA — um estado, uma forma, um motivo.
//
// O painel mostrava "risco" como uma coluna editada à mão (`clientes.risco`),
// sem dizer por quê. Aqui o estado é DERIVADO do que o sistema sabe, e o
// motivo acompanha sempre — indicador sem motivo vira ruído
// (docs/product/ux/02-PROBLEMS.md, "loja em risco sem definição").
//
// O campo manual continua valendo como override: se alguém marcou "Alto", a
// loja está em risco até alguém desmarcar. A derivação só ACRESCENTA.
//
// Puro: recebe a loja (e, quando houver, os sinais operacionais) e devolve o
// estado. A forma (● ⚠ ▲) vai junto com a cor — daltonismo e impressão.

import type { Cliente } from "../types";

export type NivelDeSaude = "ok" | "atencao" | "risco";

export interface SaudeDaLoja {
  nivel: NivelDeSaude;
  /** A forma que acompanha a cor. */
  forma: "●" | "⚠" | "▲";
  rotulo: "Saudável" | "Atenção" | "Em risco";
  /** Por que — sempre presente, mesmo quando está tudo bem. */
  motivo: string;
}

export interface SinaisDaLoja {
  /** Anúncios com problema apontado pelo marketplace (infração, pausado…). */
  anunciosComProblema?: number;
  /** Lacunas internas abertas (pendências da esteira/cadastro). */
  pendenciasAbertas?: number;
  /** Percentual da cota de IA já usado no mês (0–100). */
  cotaUsadaPct?: number;
}

const NIVEL: Record<NivelDeSaude, Omit<SaudeDaLoja, "motivo">> = {
  ok: { nivel: "ok", forma: "●", rotulo: "Saudável" },
  atencao: { nivel: "atencao", forma: "⚠", rotulo: "Atenção" },
  risco: { nivel: "risco", forma: "▲", rotulo: "Em risco" },
};

export function saudeDaLoja(loja: Cliente, sinais: SinaisDaLoja = {}): SaudeDaLoja {
  const motivos: { nivel: NivelDeSaude; texto: string }[] = [];

  if (loja.status === "Em risco" || loja.risco === "Alto") {
    motivos.push({ nivel: "risco", texto: "marcada como em risco pela equipe" });
  }
  if (loja.status === "Pausado" || loja.status === "Cancelado") {
    motivos.push({ nivel: "risco", texto: `contrato ${loja.status.toLowerCase()}` });
  }
  if ((sinais.anunciosComProblema ?? 0) >= 10) {
    motivos.push({ nivel: "risco", texto: `${sinais.anunciosComProblema} anúncios com problema no marketplace` });
  } else if ((sinais.anunciosComProblema ?? 0) > 0) {
    motivos.push({ nivel: "atencao", texto: `${sinais.anunciosComProblema} anúncios com problema no marketplace` });
  }
  if ((sinais.cotaUsadaPct ?? 0) >= 90) {
    motivos.push({ nivel: "atencao", texto: `${sinais.cotaUsadaPct}% da cota de IA usada` });
  }
  if (loja.risco === "Médio") {
    motivos.push({ nivel: "atencao", texto: "risco médio apontado pela equipe" });
  }
  if (loja.status === "Onboarding") {
    motivos.push({ nivel: "atencao", texto: "ainda em onboarding" });
  }
  if (loja.marketplaces.length === 0) {
    motivos.push({ nivel: "atencao", texto: "nenhum marketplace conectado" });
  }
  if ((sinais.pendenciasAbertas ?? 0) >= 5) {
    motivos.push({ nivel: "atencao", texto: `${sinais.pendenciasAbertas} pendências abertas` });
  }

  if (motivos.length === 0) {
    return { ...NIVEL.ok, motivo: "sem pendências conhecidas" };
  }
  const nivel: NivelDeSaude = motivos.some((m) => m.nivel === "risco") ? "risco" : "atencao";
  const texto = motivos
    .filter((m) => m.nivel === nivel)
    .map((m) => m.texto)
    .join(" · ");
  return { ...NIVEL[nivel], motivo: texto };
}

/** Ordena por gravidade: risco primeiro, saudável por último. */
export const PESO_DA_SAUDE: Record<NivelDeSaude, number> = { risco: 0, atencao: 1, ok: 2 };
