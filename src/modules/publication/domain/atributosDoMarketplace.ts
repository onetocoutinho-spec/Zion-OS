// O que o marketplace REALMENTE exige — puro, sem rede, sem React.
//
// POR QUE ISTO EXISTE
//
// O A10 reprovava anúncios cobrando "solado antiderrapante", "materiais
// reciclados" e "é vegano". Medido na API pública do ML, categoria MLB273770
// (calçados):
//
//   78 atributos · 6 obrigatórios · ZERO com essas palavras
//
// Ele era rigoroso no lugar errado: exigia o que o marketplace não pede e
// deixava passar Gênero e Tipo de calçado, que são obrigatórios de verdade.
//
// O CADASTRO JÁ BASTA — SÓ NINGUÉM LIA
//
// Medido nos 73 produtos da base:
//
//   Marca ............. 73  (campo `marca`)
//   Tipo de calçado ... 73  (legível do nome)
//   Cor ............... 70  (variações)
//   Tamanho ........... 70  (variações)
//   Gênero ............ 49  (legível do nome)
//   os seis juntos .... 47
//
// 47 de 73 produtos já têm tudo que o ML exige. Não falta cadastro — faltava
// LER o que está lá. Tipo e gênero vivem no nome: "Chinelo Havaianas Masculino
// Top Max Comfort" carrega os dois.
//
// LER NÃO É ADIVINHAR
//
// Este módulo só reconhece palavras que ESTÃO no nome, de uma lista fechada.
// Nome sem gênero devolve null — e null vira pergunta, nunca chute. Foi
// adivinhar que escreveu "PVC de alta performance" numa descrição e cor
// "Arco Iris" num produto branco.

/** Os 6 obrigatórios de MLB273770, medidos em 2026-07-29 na API pública. */
export const OBRIGATORIOS_CALCADO = [
  { id: "BRAND", nome: "Marca" },
  { id: "MODEL", nome: "Modelo" },
  { id: "GENDER", nome: "Gênero" },
  { id: "COLOR", nome: "Cor" },
  { id: "SIZE", nome: "Tamanho" },
  { id: "FOOTWEAR_TYPE", nome: "Tipo de calçado" },
] as const;

/**
 * Gêneros, com os valores como o ML os nomeia.
 *
 * A ordem importa: "menina" antes de "menino" seria indiferente, mas
 * "infantil" precisa vir depois dos específicos — um "Sandália Infantil
 * Feminina" é Meninas, não um infantil genérico.
 */
const GENEROS: readonly { termo: RegExp; valor: string }[] = [
  // Separados de propósito. O primeiro regex era /\bmenin[ao]s?\b/ e devolvia
  // "Meninas" também para "Menino" — e o ML tem os dois valores. Um teste meu
  // chegou a consagrar o erro: passou verde sobre comportamento errado, como
  // aconteceu outras vezes neste projeto. Foi ler o resultado que pegou.
  { termo: /\bmenin[ao]s\b/, valor: "Meninas e Meninos" },
  { termo: /\bmenina\b/, valor: "Meninas" },
  { termo: /\bmenino\b/, valor: "Meninos" },
  { termo: /\bunisex(o)?\b/, valor: "Sem gênero" },
  { termo: /\bfeminin[ao]s?\b/, valor: "Feminino" },
  { termo: /\bmasculin[ao]s?\b/, valor: "Masculino" },
  { termo: /\b(infantil|baby|bebe)\b/, valor: "Sem gênero infantil" },
];

/** Tipos de calçado reconhecíveis pelo nome. Lista fechada, sem sinônimos. */
const TIPOS: readonly { termo: RegExp; valor: string }[] = [
  { termo: /\bchinel(o|os)\b/, valor: "Chinelos" },
  { termo: /\b(sandalia|sandalias)\b/, valor: "Sandálias" },
  { termo: /\btamanco?s?\b/, valor: "Tamancos" },
  { termo: /\bpapete?s?\b/, valor: "Papetes" },
  { termo: /\brasteir(a|as)\b/, valor: "Rasteiras" },
  { termo: /\bbabuche?s?\b/, valor: "Babuches" },
  { termo: /\btenis\b/, valor: "Tênis" },
  { termo: /\bsapatilha?s?\b/, valor: "Sapatilhas" },
  { termo: /\bbota?s?\b/, valor: "Botas" },
  { termo: /\bmeia?s?\b/, valor: "Meias" },
];

const norm = (s: string): string =>
  (s ?? "")
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return n < 0x300 || n > 0x36f;
    })
    .join("")
    .toLowerCase();

function primeiro(nome: string, tabela: readonly { termo: RegExp; valor: string }[]): string | null {
  const n = norm(nome);
  for (const { termo, valor } of tabela) if (termo.test(n)) return valor;
  return null;
}

/** O gênero que o NOME declara. null = o nome não diz, e ninguém deve supor. */
export function generoDoNome(nome: string): string | null {
  return primeiro(nome, GENEROS);
}

/** O tipo de calçado que o NOME declara. null = não diz. */
export function tipoDeCalcadoDoNome(nome: string): string | null {
  return primeiro(nome, TIPOS);
}

export interface DadosDoProduto {
  nome: string;
  marca: string;
  modelo: string;
  /** Cores distintas das variações, já sem vazios. */
  cores: readonly string[];
  /** Tamanhos distintos das variações, já sem vazios. */
  tamanhos: readonly string[];
}

export interface AtributoResolvido {
  id: string;
  nome: string;
  /** O valor que o cadastro sustenta, ou null quando ninguém sabe. */
  valor: string | null;
  /** De onde saiu — para a pessoa saber no que confiar. */
  origem: "cadastro" | "nome" | "ausente";
}

/**
 * Os 6 obrigatórios, resolvidos contra o cadastro.
 *
 * Cor e Tamanho aceitam vários valores porque a grade tem vários; o ML os
 * recebe por variação. Aqui interessa só se EXISTEM.
 */
export function resolverObrigatorios(p: DadosDoProduto): AtributoResolvido[] {
  const doCadastro = (id: string, nome: string, v: string | null): AtributoResolvido => ({
    id,
    nome,
    valor: v && v.trim() ? v.trim() : null,
    origem: v && v.trim() ? "cadastro" : "ausente",
  });
  const doNome = (id: string, nome: string, v: string | null): AtributoResolvido => ({
    id,
    nome,
    valor: v,
    origem: v ? "nome" : "ausente",
  });

  return [
    doCadastro("BRAND", "Marca", p.marca),
    doCadastro("MODEL", "Modelo", p.modelo),
    doNome("GENDER", "Gênero", generoDoNome(p.nome)),
    doCadastro("COLOR", "Cor", p.cores.length ? p.cores.join(", ") : null),
    doCadastro("SIZE", "Tamanho", p.tamanhos.length ? p.tamanhos.join(", ") : null),
    doNome("FOOTWEAR_TYPE", "Tipo de calçado", tipoDeCalcadoDoNome(p.nome)),
  ];
}

/**
 * O bloco que vai ao modelo.
 *
 * Diz o que o marketplace exige, o que já está resolvido e o que falta — e
 * proíbe cobrar fora dessa lista. Sem isto o A10 inventava requisitos
 * ("antiderrapante", "vegano", "materiais reciclados") que travavam a
 * publicação para sempre, porque publicar exige a lista de pendências vazia.
 */
export function briefingDosAtributos(resolvidos: readonly AtributoResolvido[]): string {
  const linhas = resolvidos.map((a) =>
    a.valor
      ? `- ${a.nome}: ${a.valor} (já resolvido pelo ${a.origem === "nome" ? "nome do produto" : "cadastro"})`
      : `- ${a.nome}: FALTA`
  );
  const faltam = resolvidos.filter((a) => !a.valor).map((a) => a.nome);

  return [
    `ATRIBUTOS OBRIGATÓRIOS DO MERCADO LIVRE (medidos na API da categoria — são estes e só estes):`,
    ...linhas,
    "",
    faltam.length
      ? `Só ${faltam.join(" e ")} pode(m) virar pendência. NÃO repita os já resolvidos.`
      : `Todos resolvidos. NÃO liste pendência de atributo obrigatório.`,
    `NÃO invente exigências fora desta lista: "antiderrapante", "vegano", "materiais reciclados", "altura do solado" e "forma do calçado" NÃO são atributos desta categoria no Mercado Livre.`,
  ].join("\n");
}
