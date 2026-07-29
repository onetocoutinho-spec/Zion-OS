// A grade de variantes de um cadastro em conversa.
//
// "Tem preto 37, 38 e 39 e bege 36, 37 e 38" é uma frase; seis variantes são
// uma estrutura. Este módulo faz a travessia — e recusa de fazer quando a frase
// não determina o alvo.
//
// A ESTRUTURA REAL DESTA BASE (confirmada no schema, não suposta):
//
//   produtos            nome, marca, modelo          <- família
//   produto_variantes   cor, tamanho, sku, ean       <- unidade da grade
//
// Cor e tamanho são os dois eixos que existem hoje. `EIXOS` é uma lista para
// que um terceiro eixo não exija reescrever a primitive — mas nada é
// generalizado além do que o banco sustenta agora.
//
// A REGRA QUE MAIS IMPORTA AQUI:
//
//     associação ambígua não se resolve por proximidade
//
// "Preto 37 é SKU 01040533" tem alvo. "Esse é 01040533", com seis variantes na
// mesa, não tem — e escolher a primeira gravaria o identificador de uma variante
// em outra. Um SKU no lugar errado é um produto trocado no pedido do cliente.

import { lerIdentificador } from "./fatosDoCadastro";

/** Os eixos da grade. Lista, não par fixo, para o terceiro não exigir reescrita. */
export const EIXOS = ["cor", "tamanho"] as const;
export type Eixo = (typeof EIXOS)[number];

/** Uma unidade da grade. `sku` e `ean` chegam depois, um a um. */
export interface VarianteEmRascunho {
  cor: string;
  tamanho: string;
  sku?: string;
  ean?: string;
}

/** O que o lojista disse sobre os eixos, antes de virar grade. */
export interface EixosDitos {
  cores: readonly string[];
  tamanhos: readonly string[];
}

/**
 * O produto cartesiano dos eixos.
 *
 * Duas cores e três tamanhos dão seis variantes — e é o lojista que confirma se
 * são realmente seis. Nem toda grade é completa (pode não haver bege 39), mas
 * partir do cartesiano e deixar remover é menos trabalho que enumerar seis.
 *
 * Valores repetidos e vazios saem: "preto, preto, 37" é digitação, não intenção.
 */
export function montarGrade(eixos: EixosDitos): VarianteEmRascunho[] {
  const cores = unicos(eixos.cores);
  const tamanhos = unicos(eixos.tamanhos);

  // Um eixo sozinho ainda produz grade: "tem preto e bege" são duas variantes
  // sem tamanho, e "tem 37 e 38" são duas sem cor. Forçar os dois eixos
  // obrigaria a inventar o que falta.
  if (cores.length === 0 && tamanhos.length === 0) return [];
  if (cores.length === 0) return tamanhos.map((tamanho) => ({ cor: "", tamanho }));
  if (tamanhos.length === 0) return cores.map((cor) => ({ cor, tamanho: "" }));

  const grade: VarianteEmRascunho[] = [];
  for (const cor of cores) {
    for (const tamanho of tamanhos) grade.push({ cor, tamanho });
  }
  return grade;
}

function unicos(vs: readonly string[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const v of vs) {
    const t = v.trim();
    if (!t) continue;
    const chave = t.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(t);
  }
  return saida;
}

/** Como uma variante aparece para quem confirma. */
export function escreverVariante(v: VarianteEmRascunho): string {
  const partes = [v.cor, v.tamanho].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "(sem cor nem tamanho)";
}

/**
 * O resumo da grade, agrupado por cor.
 *
 * "Preto: 37, 38, 39" se lê num relance; seis linhas soltas, não. É o formato
 * que vai para o cartão de confirmação.
 */
export function resumirGrade(grade: readonly VarianteEmRascunho[]): {
  total: number;
  porCor: readonly { cor: string; tamanhos: readonly string[] }[];
} {
  const mapa = new Map<string, string[]>();
  for (const v of grade) {
    const chave = v.cor || "(sem cor)";
    const lista = mapa.get(chave) ?? [];
    if (v.tamanho) lista.push(v.tamanho);
    mapa.set(chave, lista);
  }
  return {
    total: grade.length,
    porCor: [...mapa.entries()].map(([cor, tamanhos]) => ({ cor, tamanhos })),
  };
}

// ---------- associação de identificador ----------

export type Associacao =
  | { ok: true; indice: number; grade: VarianteEmRascunho[] }
  | { ok: false; motivo: string; candidatos?: readonly string[] };

/**
 * Associa um SKU ou EAN a UMA variante da grade.
 *
 * O alvo vem dos eixos ditos na mesma frase — cor, tamanho, ou os dois. Se eles
 * não determinarem exatamente uma variante, a associação é RECUSADA com os
 * candidatos, para a pergunta seguinte ser específica.
 *
 * Recusar é o comportamento correto: um SKU gravado na variante errada é um
 * produto trocado no pedido, e não há como descobrir isso olhando a tela.
 */
export function associarIdentificador(
  grade: readonly VarianteEmRascunho[],
  campo: "sku" | "ean",
  valorBruto: string,
  alvo: { cor?: string; tamanho?: string }
): Associacao {
  const valor = lerIdentificador(valorBruto);
  if (!valor) return { ok: false, motivo: `Não entendi o ${campo}.` };

  const iguais = (a: string | undefined, b: string) =>
    (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

  const indices = grade
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => {
      if (alvo.cor && !iguais(alvo.cor, v.cor)) return false;
      if (alvo.tamanho && !iguais(alvo.tamanho, v.tamanho)) return false;
      return true;
    })
    .map(({ i }) => i);

  if (indices.length === 0) {
    return {
      ok: false,
      motivo: `Não achei essa variante na grade. Diga a cor e o tamanho do ${campo} ${valor}.`,
    };
  }
  if (indices.length > 1) {
    return {
      ok: false,
      motivo: `Esse ${campo} serve para qual variante? Achei ${indices.length} possíveis.`,
      candidatos: indices.map((i) => escreverVariante(grade[i])),
    };
  }

  // Grade nova, não mutação: o rascunho é comparado antes e depois em outros
  // lugares, e mutar em silêncio esconderia o que mudou.
  const nova = grade.map((v) => ({ ...v }));
  nova[indices[0]] = { ...nova[indices[0]], [campo]: valor };
  return { ok: true, indice: indices[0], grade: nova };
}

/**
 * Quais variantes ainda não têm um identificador.
 *
 * Serve para a pergunta seguinte ser útil: perguntar seis SKUs de uma vez é
 * interrogatório; dizer "faltam 4" e pedir os que faltam é trabalho.
 */
export function variantesSem(
  grade: readonly VarianteEmRascunho[],
  campo: "sku" | "ean"
): { indice: number; descricao: string }[] {
  return grade
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => !v[campo])
    .map(({ v, i }) => ({ indice: i, descricao: escreverVariante(v) }));
}
