// DES-001 D4 — o que o marketplace exige, conferido antes de mandar.
//
// ===========================================================================
// POR QUE ESTA CHECAGEM EXISTE
// ===========================================================================
//
// Sem ela, um payload sem atributo obrigatório vai para o Mercado Livre, ele
// recusa, e a lojista lê a prosa dele em inglês. É a mesma forma do INC-009: em
// vez de deixar o marketplace recusar, o sistema diz antes o que impede.
//
// ===========================================================================
// O CUIDADO QUE ELA EXIGE, E QUE JÁ CUSTOU CARO UMA VEZ
// ===========================================================================
//
// Uma exigência FALSA aqui trava a publicação para sempre — foi exatamente o
// que o DES-001 arrancou do A10, onde 13 de 13 pendências não eram exigidas por
// ninguém. Então esta função só afirma o que consegue verificar:
//
//   • a lista de exigidos vem da API do ML, por categoria — nunca de nós;
//   • a presença é conferida nos DOIS lugares onde ela pode estar.
//
// O segundo ponto é o que torna a checagem correta. O payload separa:
//
//   attributes[]                          BRAND, MODEL, GENDER, FOOTWEAR_TYPE
//   variations[].attribute_combinations   SIZE, COLOR
//
// Olhar só o primeiro acusaria SIZE e COLOR de ausentes em TODO anúncio com
// variação — e a grade é justamente o que o cadastro sempre preenche.

/** Um atributo exigido pela categoria, como o ML o nomeia. */
export interface AtributoExigido {
  id: string;
  nome: string;
}

interface AtributoNoPayload {
  id?: string;
}

interface VariacaoNoPayload {
  attribute_combinations?: AtributoNoPayload[];
  attributes?: AtributoNoPayload[];
}

/** Todos os ids presentes no payload, dos dois lugares onde eles moram. */
function idsPresentes(payload: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  for (const a of (payload.attributes as AtributoNoPayload[] | undefined) ?? []) {
    if (a?.id) ids.add(a.id);
  }
  for (const v of (payload.variations as VariacaoNoPayload[] | undefined) ?? []) {
    for (const c of v?.attribute_combinations ?? []) if (c?.id) ids.add(c.id);
    for (const c of v?.attributes ?? []) if (c?.id) ids.add(c.id);
  }
  return ids;
}

/**
 * O que a categoria exige e o payload não tem.
 *
 * Lista VAZIA quando `exigidos` vem vazio — e isso é deliberado. Se não deu
 * para perguntar ao ML o que ele exige, não se bloqueia nada: afirmar uma
 * exigência que ninguém confirmou é o defeito, não a proteção. O ML continua
 * sendo a última palavra, como sempre foi.
 */
export function obrigatoriosAusentes(
  payload: Record<string, unknown>,
  exigidos: readonly AtributoExigido[]
): AtributoExigido[] {
  if (exigidos.length === 0) return [];
  const presentes = idsPresentes(payload);
  return exigidos.filter((e) => !presentes.has(e.id));
}

/**
 * A frase para o lojista — em português, nomeando os atributos.
 *
 * "Faltam atributos obrigatórios" sem dizer QUAIS é a mesma inutilidade de
 * "3 conflitos" sem dizer onde.
 */
export function explicarAusentes(ausentes: readonly AtributoExigido[]): string {
  const nomes = ausentes.map((a) => a.nome).join(", ");
  return (
    `O Mercado Livre exige ${ausentes.length === 1 ? "este atributo" : "estes atributos"} ` +
    `nesta categoria e ${ausentes.length === 1 ? "ele não está" : "eles não estão"} no anúncio: ${nomes}. ` +
    `Complete a ficha técnica do produto e tente de novo.`
  );
}
