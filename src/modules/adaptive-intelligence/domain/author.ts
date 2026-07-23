// Autor — o Value Object tipado de autoria (E5.8).
//
// Materializa o conceito previsto desde a fundação adormecida (S-35:
// `Autor{tipo, id, agenteCodigo, confianca}` em src/application) — COLHENDO O
// CONCEITO, não o código: a fundação continua intocada (decisão E5.1.1 do
// backlog). Deliberadamente SEM `confianca` (evita a colisão de vocabulário
// registrada no GLOSSARY — três significados de "confiança") e SEM
// `agenteCodigo` (nenhum caso de uso presente; YAGNI).
//
// RETROCOMPATIBILIDADE TOTAL (substituição gradual, string → Autor):
//   - Os campos persistidos NÃO mudam: `decisoes.autor` (e-mail ou "") e
//     `ofertas.autor_da_oferta` ("suggestion-engine") continuam strings —
//     append-only, nenhuma migração.
//   - O VO nasce como LEITURA tipada: `autorDe(texto)` interpreta qualquer
//     string já gravada de forma determinística; `textoDe(autor)` faz o
//     roundtrip. Nenhum fato antigo é reinterpretado incorretamente:
//     "" → nao_registrado; ids de sistema conhecidos → sistema; resto → humano.
//   - As superfícies de exibição passam a rotular via o VO (mesmos textos de
//     antes — os testes existentes não mudam).

/** Tipos de autor sustentados pelos fatos atuais. */
export type TipoAutor = "humano" | "sistema" | "nao_registrado";

/** O Value Object — imutável, sem identidade própria. */
export interface Autor {
  readonly tipo: TipoAutor;
  /** E-mail/id (humano), identificador do componente (sistema), "" (não registrado). */
  readonly id: string;
}

/** Ids de sistema CONHECIDOS nos fatos já gravados (ofertas.autor_da_oferta). */
export const IDS_DE_SISTEMA: ReadonlySet<string> = new Set(["suggestion-engine"]);

/** Prefixo canônico para FUTUROS autores de sistema (E5.9 em diante). */
export const PREFIXO_SISTEMA = "sistema:";

export const AUTOR_NAO_REGISTRADO: Autor = { tipo: "nao_registrado", id: "" };

/**
 * PURA E DETERMINÍSTICA: interpreta qualquer string de autoria já gravada.
 * "" / espaços → não registrado; id de sistema conhecido ou prefixo
 * "sistema:" → sistema; qualquer outro texto → humano (e-mail/id da sessão).
 */
export function autorDe(texto: string | null | undefined): Autor {
  const id = (texto ?? "").trim();
  if (!id) return AUTOR_NAO_REGISTRADO;
  if (IDS_DE_SISTEMA.has(id)) return { tipo: "sistema", id };
  if (id.startsWith(PREFIXO_SISTEMA)) {
    const semPrefixo = id.slice(PREFIXO_SISTEMA.length).trim();
    return semPrefixo ? { tipo: "sistema", id: semPrefixo } : AUTOR_NAO_REGISTRADO;
  }
  return { tipo: "humano", id };
}

/**
 * Roundtrip para os campos string existentes: humano → id puro (como sempre
 * foi gravado); sistema conhecido → id puro (compatível com as ofertas já
 * gravadas); sistema novo → prefixado; não registrado → "".
 */
export function textoDe(autor: Autor): string {
  if (autor.tipo === "nao_registrado") return "";
  if (autor.tipo === "sistema") {
    return IDS_DE_SISTEMA.has(autor.id) ? autor.id : `${PREFIXO_SISTEMA}${autor.id}`;
  }
  return autor.id;
}

/** Rótulo de exibição — preserva os textos já usados pelas telas. */
export function rotuloDe(autor: Autor): string {
  if (autor.tipo === "nao_registrado") return "não registrado";
  if (autor.tipo === "sistema") return `sistema · ${autor.id}`;
  return autor.id;
}
