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
 * Um obrigatório já resolvido por `resolverObrigatorios`, na forma mínima.
 *
 * Tipado por estrutura e não importado do módulo de publicação: esta camada não
 * precisa conhecer aquela para receber `{ id, valor, origem }`, e `AtributoResolvido`
 * satisfaz isto sem conversão.
 */
export interface ObrigatorioResolvido {
  id: string;
  valor: string | null;
  origem: string;
}

/**
 * O CADASTRO PREENCHE O QUE O MODELO ESQUECEU DE ESCREVER.
 *
 * ===========================================================================
 * O QUE FOI MEDIDO EM 28/08/2026
 * ===========================================================================
 *
 * O ensaio do passo 7 (`scripts/ensaioDaPublicacao.mjs`) rodou nos 793 anúncios
 * publicáveis da base real:
 *
 *     passariam na conferência da categoria .... 291
 *     seriam recusados por atributo ............ 500   (500 GENDER, 410 FOOTWEAR_TYPE)
 *
 *     dos 500, o resolvedor responde TODOS os ausentes em ... 497
 *     497 GENDER e 410 FOOTWEAR_TYPE vindos do CADASTRO
 *
 * O payload leva `attributes` montado só a partir da FICHA TÉCNICA que o modelo
 * escreveu — e numa amostra de 400 aprovados a ficha traz "Gênero" em 159. O
 * valor está no banco, respondido pela lojista em `produto_atributos`, e nunca
 * chegava ao Mercado Livre. Pedia-se ao modelo e não se garantia.
 *
 * ===========================================================================
 * SÓ O QUE ELA RESPONDEU — PALPITE NÃO ENTRA
 * ===========================================================================
 *
 * `resolverObrigatorios` responde de quatro origens: `cadastro`, `marketplace`,
 * `nome` e `ausente`. Aqui entram as DUAS PRIMEIRAS.
 *
 * `nome` é dedução — "Chinelo Feminino" no título vira GENDER=Feminino. Serve
 * para SUGERIR num briefing; não serve para afirmar, sob a conta da lojista, um
 * atributo de um anúncio que fica no ar. Um palpite publicado é uma afirmação
 * dela que ela não fez.
 *
 * E excluí-lo não custou nada: dos 497 resolvíveis, 497 vêm do cadastro. Os que
 * sobram continuam virando pergunta — que é o comportamento certo, e o mesmo
 * "null vira pergunta, nunca chute" do resto do sistema.
 *
 * Devolve o que ACRESCENTAR, e não mexe no payload: quem escreve é o chamador,
 * num lugar só, e esta função continua provável sem montar um payload inteiro.
 */
export function doCadastroParaOPayload(
  ausentes: readonly AtributoExigido[],
  resolvidos: readonly ObrigatorioResolvido[]
): { id: string; value_name: string }[] {
  if (ausentes.length === 0) return [];
  const podeAfirmar = new Map<string, string>();
  for (const r of resolvidos) {
    if (!r.valor?.trim()) continue;
    if (r.origem !== "cadastro" && r.origem !== "marketplace") continue;
    podeAfirmar.set(r.id, r.valor.trim());
  }
  return ausentes
    .filter((a) => podeAfirmar.has(a.id))
    .map((a) => ({ id: a.id, value_name: podeAfirmar.get(a.id)! }));
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
