// Procurar antes de criar — e não confundir "achei parecido" com "é o mesmo".
//
// O cadastro conversacional tem um risco que o formulário não tinha: o lojista
// descreve um produto em voz alta, e ele pode já existir. Criar em silêncio
// produz a duplicata; recusar em silêncio esconde um produto novo legítimo.
//
// A REGRA, herdada de `buscaDeCatalogo` e medida nesta base:
//
//     SKU, EAN e modelo NÃO são únicos aqui
//     (117 SKUs e 112 EANs duplicados, nenhuma constraint UNIQUE)
//
// Portanto casamento exato é EVIDÊNCIA, nunca identidade. Um candidato não
// dispara merge, não bloqueia e não escolhe. Ele vira uma frase e uma pergunta.
//
// ---------------------------------------------------------------------------
// A SEGUNDA COISA QUE ESTE MÓDULO FAZ: a promessa que a Proposal carrega.
//
// Entre T0 (o Draft começa) e T1 (o cliente confirma) o catálogo muda — a
// importação roda, outra aba cadastra, o ERP sincroniza. A busca feita durante a
// conversa não vale como autorização.
//
// Então a Proposal guarda o CONJUNTO de candidatos que existia quando ela
// nasceu, um por precondição, no mesmo formato que o lote já usa
// (`variacoesSemPeso:<id>`). Na confirmação o servidor busca de novo e compara:
//
//   candidato que SUMIU     -> chave vira null   -> obsoleta
//   candidato que APARECEU  -> total muda        -> obsoleta
//
// O cenário obrigatório — T0 sem 7178.102, T2 a importação cria um, T3 o cliente
// confirma — cai no segundo caso: total 0 vira 1, e nada é criado.

import {
  classificar,
  type Achado,
  type LinhaEncontrada,
  type Tentativa,
} from "./buscaDeCatalogo";
import type { EstadoAtual, Precondicao } from "./propostaPersistida";
import { textoDe, type DraftDeCadastro } from "./draftDeCadastro";
import { variantesSem } from "./gradeDeVariantes";

/** O prefixo das precondições por candidato. Um por id encontrado. */
export const PREFIXO_CANDIDATO = "candidatoDoCadastro:";
/** A precondição do TOTAL. Sozinha ela não basta; junto das outras, fecha. */
export const CAMPO_TOTAL_DE_CANDIDATOS = "candidatosDoCadastro";

/**
 * Quantos caracteres um nome precisa ter para valer uma busca textual.
 *
 * "Papete" (6) acha meio catálogo de calçados e não ajuda ninguém; "Papete
 * Modare" (13) aponta para alguma coisa. O corte existe para a busca por nome
 * ser descoberta útil, e não ruído que o modelo teria que filtrar depois.
 */
const MINIMO_PARA_BUSCA_TEXTUAL = 8;

/**
 * As buscas que os fatos deste Draft justificam, na ordem de força.
 *
 * Vazio quando ainda não há nada que identifique: buscar por "chinelo" antes de
 * saber marca e referência devolveria candidatos que não são candidatos de nada.
 */
export function tentativasDoCadastro(draft: DraftDeCadastro): Tentativa[] {
  const tentativas: Tentativa[] = [];

  const modelo = textoDe(draft, "modelo").trim();
  if (modelo) {
    tentativas.push({ coluna: "modelo", modo: "exato", termo: modelo, casamento: "modelo_exato" });
  }

  // O SKU do pai e os das variantes — todos, porque qualquer um deles casando
  // com o catálogo é sinal de que este produto já pode existir.
  for (const sku of identificadores(draft, "sku")) {
    tentativas.push({ coluna: "sku", modo: "exato", termo: sku, casamento: "sku_exato" });
  }
  for (const ean of identificadores(draft, "ean")) {
    tentativas.push({ coluna: "ean", modo: "exato", termo: ean, casamento: "ean_exato" });
  }

  const nome = textoDe(draft, "nome").trim();
  if (tentativas.length === 0 && nome.length >= MINIMO_PARA_BUSCA_TEXTUAL) {
    tentativas.push({ coluna: "nome", modo: "contem", termo: nome, casamento: "candidato_textual" });
  }
  return tentativas;
}

/** Os identificadores conhecidos de um campo — o do pai e os das variantes. */
function identificadores(draft: DraftDeCadastro, campo: "sku" | "ean"): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  const doPai = textoDe(draft, campo).trim();
  if (doPai) {
    vistos.add(doPai.toLowerCase());
    saida.push(doPai);
  }
  // `variantesSem` diz quem NÃO tem; aqui queremos quem TEM.
  const semEste = new Set(variantesSem(draft.variantes, campo).map((v) => v.indice));
  draft.variantes.forEach((v, i) => {
    if (semEste.has(i)) return;
    const valor = (v[campo] ?? "").trim();
    if (!valor || vistos.has(valor.toLowerCase())) return;
    vistos.add(valor.toLowerCase());
    saida.push(valor);
  });
  return saida;
}

export function suficienteParaBuscar(draft: DraftDeCadastro): boolean {
  return tentativasDoCadastro(draft).length > 0;
}

// ---------------------------------------------------------------------------
// o desfecho
// ---------------------------------------------------------------------------

export type DuplicidadePossivel =
  | { desfecho: "nenhum" }
  /**
   * UM candidato. Não é identidade — é um produto que PODE corresponder.
   * A decisão é do lojista, e as duas saídas são legítimas.
   */
  | { desfecho: "possivel_existente"; candidatos: readonly Achado[]; mensagem: string }
  /** Vários. Mostrar todos; nunca `results[0]`. */
  | { desfecho: "varios"; candidatos: readonly Achado[]; total: number; mensagem: string };

/**
 * O que fazer com o que a busca trouxe.
 *
 * Nenhum caminho aqui cria, funde ou bloqueia sozinho. Um candidato vira frase;
 * vários viram lista. O cadastro continua possível nos dois casos — porque
 * produto parecido com produto existente é uma situação normal num catálogo de
 * calçados, e tratar semelhança como impedimento pararia trabalho legítimo.
 */
export function avaliarDuplicidade(
  linhas: readonly LinhaEncontrada[],
  casamento: Achado["casamento"],
  termo: string
): DuplicidadePossivel {
  const r = classificar(linhas, casamento, termo);
  if (r.desfecho === "nada") return { desfecho: "nenhum" };
  if (r.desfecho === "encontrado") {
    return {
      desfecho: "possivel_existente",
      candidatos: [r.achado],
      mensagem:
        "Já existe um produto que pode corresponder a esse cadastro. Confira antes: se for outro produto, seguimos com o cadastro novo.",
    };
  }
  return {
    desfecho: "varios",
    candidatos: r.candidatos,
    total: r.total,
    mensagem: `Encontrei ${r.total} produtos que podem corresponder a esse cadastro. Diga se algum deles é este — eu não escolho por você.`,
  };
}

/**
 * Junta o que várias tentativas acharam, sem repetir produto.
 *
 * A união é por `produtoId` porque a pergunta é "este produto já existe?", e
 * duas variantes do mesmo pai não são dois candidatos — são um.
 */
export function unirAchados(
  porTentativa: readonly { casamento: Achado["casamento"]; linhas: readonly LinhaEncontrada[] }[]
): { linhas: LinhaEncontrada[]; casamento: Achado["casamento"] } {
  const vistos = new Set<string>();
  const linhas: LinhaEncontrada[] = [];
  // O casamento da PRIMEIRA tentativa que trouxe linha: as tentativas já chegam
  // na ordem de força, e é ela que diz como o produto foi achado.
  let casamento: Achado["casamento"] = "candidato_textual";
  let primeiro = true;
  for (const t of porTentativa) {
    if (t.linhas.length > 0 && primeiro) {
      casamento = t.casamento;
      primeiro = false;
    }
    for (const l of t.linhas) {
      if (vistos.has(l.produtoId)) continue;
      vistos.add(l.produtoId);
      linhas.push(l);
    }
  }
  return { linhas, casamento };
}

// ---------------------------------------------------------------------------
// precondições — a promessa que a Proposal carrega
// ---------------------------------------------------------------------------

/**
 * O conjunto de candidatos, congelado.
 *
 * UMA precondição por candidato MAIS o total. As duas juntas fecham os dois
 * jeitos de o mundo mudar: uma some (a chave dela vira `null`) ou uma aparece
 * (o total sobe). Só o total não bastaria — um trocado por outro daria a mesma
 * contagem, e um trocado é tão grave quanto um a mais.
 *
 * Os ids vão ORDENADOS para o `jsonb` da proposta ser comparável entre si em
 * qualquer inspeção posterior.
 */
export function precondicoesDeCadastro(idsEncontrados: readonly string[]): Precondicao[] {
  const unicos = [...new Set(idsEncontrados)].sort();
  return [
    { campo: CAMPO_TOTAL_DE_CANDIDATOS, valorNaCriacao: unicos.length },
    ...unicos.map((id) => ({ campo: `${PREFIXO_CANDIDATO}${id}`, valorNaCriacao: 1 })),
  ];
}

/**
 * O estado de agora, no formato que `podeExecutar` compara.
 *
 * `campos` são as chaves que a proposta observou — só elas. O que não foi
 * observado na criação não invalida a execução, que é a mesma regra do resto do
 * sistema: não se recusa por uma mudança que ninguém prometeu vigiar.
 */
export function estadoDosCandidatos(
  campos: readonly string[],
  idsAgora: readonly string[]
): EstadoAtual {
  const agora = new Set(idsAgora);
  const estado: Record<string, number | null> = {};
  for (const campo of campos) {
    if (campo === CAMPO_TOTAL_DE_CANDIDATOS) {
      estado[campo] = agora.size;
      continue;
    }
    if (campo.startsWith(PREFIXO_CANDIDATO)) {
      const id = campo.slice(PREFIXO_CANDIDATO.length);
      // Sumiu -> `null`, que o domínio trata como mudança. Zero seria "existe e
      // vale zero", e não é isso: é ausência.
      estado[campo] = agora.has(id) ? 1 : null;
    }
  }
  return estado;
}

/** Quais campos desta proposta são de candidato. Usado para reler só o preciso. */
export function ehCampoDeCandidato(campo: string): boolean {
  return campo === CAMPO_TOTAL_DE_CANDIDATOS || campo.startsWith(PREFIXO_CANDIDATO);
}

/** Como um candidato aparece no cartão e para o modelo. */
export function candidatoEnxuto(a: Achado): {
  produtoId: string;
  nome: string;
  marca?: string;
  referencia?: string;
  sku?: string;
  ean?: string;
  casamento: Achado["casamento"];
} {
  return {
    produtoId: a.produtoId,
    nome: a.nome,
    ...(a.marca ? { marca: a.marca } : {}),
    ...(a.modelo ? { referencia: a.modelo } : {}),
    ...(a.sku ? { sku: a.sku } : {}),
    ...(a.ean ? { ean: a.ean } : {}),
    casamento: a.casamento,
  };
}
