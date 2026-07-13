// Estratégias de autenticação padronizadas (003 §Responsabilidades).
//
// Descreve COMO um conector autentica, sempre server-side. Aqui há apenas
// descritores e um Port de resolução (interface, sem implementação/IO). A
// renovação transparente (ex.: refresh de OAuth) é responsabilidade do conector
// concreto (PR futuro), guiada por `precisaRenovacao`.

import type { Resultado } from "../resultado.ts";
import type { ReferenciaCredencial, TipoEstrategiaAuth } from "./credencial.ts";

export interface DescritorEstrategiaAuth {
  readonly tipo: TipoEstrategiaAuth;
  readonly descricao: string;
  /** true quando a credencial expira e precisa de refresh (ex.: OAuth2). */
  readonly precisaRenovacao: boolean;
}

export const ESTRATEGIAS_AUTH: Record<TipoEstrategiaAuth, DescritorEstrategiaAuth> = {
  oauth2: { tipo: "oauth2", descricao: "OAuth 2.0 (access + refresh token)", precisaRenovacao: true },
  api_key: { tipo: "api_key", descricao: "Chave de API estática", precisaRenovacao: false },
  arquivo: { tipo: "arquivo", descricao: "Upload de arquivo/planilha (ex.: catálogo)", precisaRenovacao: false },
  nenhuma: { tipo: "nenhuma", descricao: "Sem autenticação", precisaRenovacao: false },
};

export function precisaRenovar(tipo: TipoEstrategiaAuth): boolean {
  return ESTRATEGIAS_AUTH[tipo].precisaRenovacao;
}

/**
 * Credencial resolvida server-side. Tipo OPACO por design: o SDK nunca inspeciona
 * nem serializa o valor — só o repassa ao cliente HTTP do conector concreto.
 */
export interface CredencialViva {
  readonly estrategia: TipoEstrategiaAuth;
}

/** Port de resolução do ponteiro → credencial viva. Interface apenas (sem IO neste PR). */
export interface ResolvedorCredencial {
  resolver(referencia: ReferenciaCredencial): Promise<Resultado<CredencialViva>>;
}
