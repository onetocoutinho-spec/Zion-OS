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

import { idDoAtributoML } from "../../integration/domain/mlPayload";
import type { ProcedenciaDosObrigatorios } from "./obrigatoriosDoProduto";

/**
 * O que UMA categoria exige. Mesma forma que `atributosObrigatorios` devolve.
 *
 * A fonte viva é `lib/marketplaces/mercadolivre.ts` → `atributosObrigatorios`,
 * que lê `/categories/{id}/attributes` e filtra pela tag `required`. Este tipo
 * existe para que a lista possa VIAJAR até aqui em vez de ser congelada aqui.
 */
export interface ExigenciaDaCategoria {
  id: string;
  nome: string;
  /**
   * Como o ML classifica o campo: `list`, `string`, `number_unit`…
   *
   * A diferença NÃO é decorativa. Em `list` os valores publicados são a lista
   * inteira do que ele aceita; em `string` eles são sugestão, e outro valor
   * passa. Dizer "escolha um destes" num campo `string` seria afirmar um
   * fechamento que o ML não declarou.
   */
  tipo?: string;
  /** O que o ML publica como valor aceito. Ausente = ele não publicou nenhum. */
  valoresAceitos?: readonly ValorAceito[];
  /** O texto de ajuda que o PRÓPRIO ML escreve para o atributo. */
  dica?: string;
  /** Limite de caracteres, quando o ML declara um. */
  tamanhoMaximo?: number;
}

/** Um valor aceito: `id` é o que o payload leva, `nome` é o que a pessoa lê. */
export interface ValorAceito {
  id: string;
  nome: string;
}

/**
 * A forma crua de um atributo em `/categories/{id}/attributes` — só os campos
 * que este repositório lê.
 */
export interface AtributoCruDoML {
  id?: string;
  name?: string;
  tags?: Record<string, unknown>;
  value_type?: string;
  values?: { id?: string; name?: string }[];
  hint?: string;
  value_max_length?: number;
}

/**
 * O que a categoria exige, lido da resposta do ML. PURO: sem rede, testável.
 *
 * ===========================================================================
 * O QUE ESTE REPOSITÓRIO JOGAVA FORA — MEDIDO EM 25/08/2026
 * ===========================================================================
 *
 * `atributosObrigatorios` e `recorteDaCategoria` liam o endpoint e guardavam
 * `{id, nome}`. O resto da resposta ia para o lixo. Medido em MLB273770:
 *
 *     78 atributos · 6 obrigatórios
 *     BRAND 11 valores · GENDER 6 · COLOR 51 · SIZE 44 · FOOTWEAR_TYPE 4
 *     MODEL 0 (livre)
 *     49 dos 78 atributos da categoria trazem lista de valores
 *
 * Cinco dos seis obrigatórios já vinham com o vocabulário que o ML aceita — e
 * o software descartava, para depois perguntar à lojista o que o marketplace
 * já tinha respondido. "Pesquisar nos concorrentes" era, em boa parte, ler
 * esta resposta.
 *
 * Continua devolvendo `[]` para lista inválida: sem confirmação do ML, não se
 * afirma exigência nenhuma.
 */
export function exigenciasDaResposta(
  lista: readonly AtributoCruDoML[]
): ExigenciaDaCategoria[] {
  // A guarda é de RUNTIME: esta função recebe o que o ML devolveu, e o ML já
  // devolveu coisa que não era lista. `Array.isArray` estreita para `any[]` —
  // daí a variável tipada logo abaixo, para o resto da função continuar com
  // tipo em vez de `any`.
  if (!Array.isArray(lista)) return [];
  const atributos: readonly AtributoCruDoML[] = lista;
  return atributos
    .filter((a) => a.tags && "required" in a.tags && a.id)
    .map((a) => {
      const valores = (a.values ?? [])
        // Valor sem nome nem id não identifica nada; entrar como vazio seria
        // oferecer à lojista uma opção em branco.
        .map((v) => ({ id: (v.id ?? v.name ?? "").trim(), nome: (v.name ?? v.id ?? "").trim() }))
        .filter((v) => v.id && v.nome);
      return {
        id: a.id as string,
        nome: a.name || (a.id as string),
        ...(a.value_type ? { tipo: a.value_type } : {}),
        ...(valores.length ? { valoresAceitos: valores } : {}),
        ...(a.hint?.trim() ? { dica: a.hint.trim() } : {}),
        ...(typeof a.value_max_length === "number" ? { tamanhoMaximo: a.value_max_length } : {}),
      };
    });
}

/**
 * Os 6 obrigatórios de MLB273770, medidos em 2026-07-29 na API pública.
 *
 * É um RETRATO de uma categoria — calçado —, não a regra do marketplace. Ficou
 * escondido dentro de `resolverObrigatorios` até 05/08/2026, e o efeito só
 * apareceu quando chegou um cliente que vende MÓVEIS: o sistema perguntaria a
 * um sofá qual é o tipo de calçado, e a lista de obrigatórios seria a de outra
 * categoria inteira.
 *
 * Continua exportado de propósito. Os caminhos de calçado passam ele À MÃO, e é
 * essa a diferença que importa: a suposição não sumiu, ela saiu de dentro do
 * módulo e virou visível em cada chamada.
 */
/**
 * O RETRATO GANHOU O VOCABULÁRIO — remedido em 25/08/2026, mesma API pública.
 *
 * Até aqui a lista guardava `{id, nome}`: o que o ML EXIGE, sem o que ele
 * ACEITA. Cinco dos cinco caminhos que resolvem atributos passam esta lista à
 * mão (o comentário de `api/ml/categoria` explica por quê: ninguém sabe a
 * categoria), então enquanto ela não trouxesse os valores, o trabalho de
 * `exigenciasDaResposta` não chegava a lugar nenhum.
 *
 * Só os dois `list` trazem valores, e é decisão: em `list` a lista é fechada —
 * é o que o ML aceita e mais nada. `BRAND`, `MODEL`, `COLOR` e `SIZE` são
 * `string`, com valores apenas SUGERIDOS (COLOR tem 51, SIZE 44), e os quatro
 * já se resolvem pelo cadastro. Congelar 95 sugestões aqui seria peso sem
 * resposta.
 */
export const OBRIGATORIOS_CALCADO: readonly ExigenciaDaCategoria[] = [
  {
    id: "BRAND",
    nome: "Marca",
    tipo: "string",
    tamanhoMaximo: 255,
    dica: "Informe a marca verdadeira do produto ou 'Genérica' se não tiver marca.",
  },
  { id: "MODEL", nome: "Modelo", tipo: "string", tamanhoMaximo: 255 },
  {
    id: "GENDER",
    nome: "Gênero",
    tipo: "list",
    valoresAceitos: [
      { id: "339665", nome: "Feminino" },
      { id: "339666", nome: "Masculino" },
      { id: "339668", nome: "Meninas" },
      { id: "339667", nome: "Meninos" },
      { id: "19159491", nome: "Sem gênero infantil" },
      { id: "110461", nome: "Sem gênero" },
    ],
  },
  { id: "COLOR", nome: "Cor", tipo: "string", tamanhoMaximo: 255 },
  { id: "SIZE", nome: "Tamanho", tipo: "string", tamanhoMaximo: 255 },
  {
    id: "FOOTWEAR_TYPE",
    nome: "Tipo de calçado",
    tipo: "list",
    valoresAceitos: [
      { id: "517585", nome: "Sandália" },
      { id: "517586", nome: "Chinelo" },
      { id: "3630523", nome: "Tamanco" },
      { id: "3630524", nome: "Mule" },
    ],
  },
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
  /**
   * OS ATRIBUTOS QUE A LOJISTA JÁ PREENCHEU, por nome exibido ("Gênero").
   *
   * ===================================================================
   * O DEFEITO QUE ESTE CAMPO DESFAZ — MEDIDO EM 11/08/2026
   * ===================================================================
   *
   * `dadosDoProduto` passava só nome, marca, modelo, cores e tamanhos. O
   * cadastro da lojista — `produto_atributos`, com "Gênero" preenchido em 73
   * de 80 produtos — nunca chegava aqui.
   *
   * Resultado: `GENDER` caía direto no palpite pelo NOME. Quando o nome não
   * traz a palavra ("Sapatilha Modare 7016.461 Napa Floater Nature"), o
   * software declarava o gênero AUSENTE e travava a publicação — de um
   * produto cujo cadastro dizia "Feminino".
   *
   * São 26 produtos em que SÓ o cadastro sabe. O software acusava a lojista
   * de não ter preenchido exatamente o que ela preencheu.
   *
   * A ordem em `resolver` já estava certa: cadastro, depois marketplace,
   * depois palpite. Só faltava o cadastro chegar.
   */
  atributos?: ReadonlyMap<string, string>;
}

export interface AtributoResolvido {
  id: string;
  nome: string;
  /** O valor que o cadastro sustenta, ou null quando ninguém sabe. */
  valor: string | null;
  /**
   * De onde saiu — para a pessoa saber no que confiar, e em que ordem.
   *
   * `cadastro` e `marketplace` são MEDIDOS: alguém preencheu um campo, aqui ou
   * no ML. `nome` é ADIVINHADO de uma string. A precedência sai daí, e é uma
   * regra só: medido vence adivinhado.
   *
   *   cadastro → marketplace → nome → ausente
   *
   * `marketplace` entrou com o DES-002 D6: gênero e tipo de calçado não têm
   * campo no cadastro, e antes eram sempre chutados do nome do produto. Agora
   * vêm de `produto_atributos`, que é o que a lojista informou ao ML.
   */
  origem: "cadastro" | "marketplace" | "nome" | "ausente";
  /**
   * O que o ML publica como valores aceitos deste atributo, quando publica.
   *
   * Viaja junto do resolvido de propósito: sem isso, "falta Gênero" é pergunta
   * aberta mesmo quando o ML já disse que são seis valores e quais.
   */
  opcoes?: readonly ValorAceito[];
  /** `list` (fechado) ou `string` (sugestão) — ver `ExigenciaDaCategoria.tipo`. */
  tipo?: string;
}

/**
 * Os três estados de um obrigatório — e antes só existiam dois.
 *
 * `ausente` respondia por duas situações muito diferentes: o atributo que
 * ninguém sabe e ninguém tem como saber, e o atributo cuja resposta o próprio
 * marketplace publica. Tratar os dois como a mesma pergunta aberta era o que
 * mandava alguém pesquisar concorrente para descobrir um valor que estava a
 * uma requisição de distância.
 */
export type EstadoDoAtributo = "resolvido" | "escolha" | "pergunta";

export function estadoDoAtributo(a: AtributoResolvido): EstadoDoAtributo {
  if (a.valor) return "resolvido";
  return a.opcoes && a.opcoes.length > 0 ? "escolha" : "pergunta";
}

/**
 * O valor resolvido está FORA da lista fechada do marketplace?
 *
 * Só existe para `tipo: "list"`. Ali a lista é o que o ML aceita e mais nada —
 * valor fora dela é recusa na publicação, não questão de estilo. Em `string` a
 * lista é sugestão, e responder algo fora dela é legítimo.
 *
 * ===========================================================================
 * MEDIDO EM 25/08/2026, E É POR ISTO QUE ESTA FUNÇÃO EXISTE
 * ===========================================================================
 *
 * MLB273770 aceita QUATRO tipos de calçado, no singular:
 *
 *     Sandália · Chinelo · Tamanco · Mule
 *
 * `tipoDeCalcadoDoNome` devolve dez valores, no plural — "Chinelos",
 * "Sandálias", "Tamancos" —, e seis deles ("Papetes", "Rasteiras", "Tênis",
 * "Sapatilhas", "Botas", "Meias", "Babuches") não são valores desta categoria.
 * Em `GENDER`, "Meninas e Meninos" também não está na lista do ML.
 *
 * A leitura pelo nome NÃO foi mexida junto, de propósito: trocá-la é decisão
 * que precisa de medição nas categorias reais da conta, não só nesta. O que
 * muda aqui é que a divergência para de ser invisível.
 */
export function valorForaDaLista(a: AtributoResolvido): boolean {
  if (a.tipo !== "list" || !a.valor) return false;
  // O QUE VEIO DO MARKETPLACE NÃO SE QUESTIONA.
  //
  // `origem: "marketplace"` é o valor que a própria lojista informou ao ML e
  // que ele devolveu em `produto_atributos`. Apontar esse valor como não aceito
  // seria o software discordar do marketplace sobre o que o marketplace
  // aceitou — e a precedência deste módulo ("medido vence adivinhado") existe
  // justamente para isso não acontecer.
  //
  // A primeira versão desta função não tinha esta linha, e um teste de 2026 que
  // guarda a doutrina reprovou na hora: `Tipo de calçado: Papetes` vindo do ML.
  // "Papetes" não está na lista de MLB273770 — mas quem sabe em que categoria o
  // item dela está é o ML, não este retrato.
  if (a.origem === "marketplace") return false;

  const ops = a.opcoes ?? [];
  if (!ops.length) return false;
  const alvo = norm(a.valor);
  return !ops.some((v) => norm(v.nome) === alvo || v.id === a.valor);
}

/**
 * Resolve os seis obrigatórios do ML contra o que se SABE.
 *
 * Cor e Tamanho aceitam vários valores porque a grade tem vários; o ML os
 * recebe por variação. Aqui interessa só se EXISTEM.
 *
 * `doMarketplace` é `id → valor`, vindo de `produto_atributos` — o que a
 * lojista já informou ao Mercado Livre (DES-002). Vazio, o comportamento é
 * exatamente o de antes.
 *
 * UMA regra de precedência, e ela vale para os seis: **medido vence adivinhado**.
 *
 *   cadastro → marketplace → nome → ausente
 *
 * Não há caso especial por atributo. Marca e cor têm campo no cadastro e
 * ganham por ali; gênero e tipo de calçado não têm, então o marketplace passa
 * na frente do chute pelo nome — sozinho, sem `if`.
 */
/** Como um atributo é lido do que já se sabe. `null` = ninguém sabe. */
type LeitorDeAtributo = (p: DadosDoProduto) => string | null;

/**
 * Atributos que saem de CAMPO DO CADASTRO. Valem em qualquer categoria —
 * marca, modelo, cor e tamanho existem para sofá tanto quanto para chinelo.
 */
const DO_CADASTRO: Record<string, LeitorDeAtributo> = {
  BRAND: (p) => p.marca,
  MODEL: (p) => p.modelo,
  COLOR: (p) => (p.cores.length ? p.cores.join(", ") : null),
  SIZE: (p) => (p.tamanhos.length ? p.tamanhos.join(", ") : null),
};

/**
 * Atributos LIDOS DO NOME. São de calçado, e por isso moram num mapa por id: só
 * disparam quando a categoria pede aquele id.
 *
 * Uma categoria de móveis não pede `GENDER` nem `FOOTWEAR_TYPE`, então estes
 * leitores simplesmente não são chamados — sem `if`, sem lista de exceção.
 */
const DO_NOME: Record<string, LeitorDeAtributo> = {
  GENDER: (p) => generoDoNome(p.nome),
  FOOTWEAR_TYPE: (p) => tipoDeCalcadoDoNome(p.nome),
};

/**
 * O valor que ela respondeu para ESTE atributo, casando o nome sem rigor de
 * grafia.
 *
 * A busca era `p.atributos?.get(nome)` — igualdade exata contra o nome que o ML
 * devolveu ("Gênero"). Quem monta o mapa varia: um caminho normaliza (sem
 * acento, minúsculas) e outro guardava o nome cru do banco, e o mesmo produto
 * era resolvido por uma porta e recusado pela outra. Um ERP que grave "GENERO"
 * cai no mesmo buraco sem nada no log dizendo por quê.
 *
 * Exato primeiro, para não mudar o que já funcionava; depois a comparação sem
 * acento e sem caixa. Não é afrouxar o critério — o atributo continua sendo o
 * mesmo atributo, escrito de outro jeito.
 */
function doCadastroDela(
  atributos: ReadonlyMap<string, string> | undefined,
  nome: string
): string | null {
  if (!atributos) return null;
  const exato = atributos.get(nome);
  if (exato) return exato;
  const alvo = semAcentoNemCaixa(nome);
  for (const [chave, valor] of atributos) {
    if (semAcentoNemCaixa(chave) === alvo) return valor;
  }
  return null;
}

/**
 * A normalização que decide se dois nomes de atributo são O MESMO.
 *
 * EXPORTADA em 28/08 porque virou a terceira cópia. `composicaoConteudo` tem a
 * sua e `perguntasDaCategoria` tinha ganhado outra — e a chave de "já
 * perguntado" compara o resultado de uma contra o da outra. Duas normalizações
 * para a mesma chave foi o defeito que custou uma revisão inteira neste dia,
 * em `fichaDoCadastro`: o mesmo produto publicava por um caminho e era recusado
 * pelo outro.
 */
export function semAcentoNemCaixa(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function resolverObrigatorios(
  p: DadosDoProduto,
  /**
   * O que ESTA categoria exige. Sem valor padrão de propósito: um padrão aqui
   * seria a suposição de calçado voltando a morar escondida, que é o defeito
   * que esta assinatura existe para desfazer.
   */
  obrigatorios: readonly ExigenciaDaCategoria[],
  doMarketplace: ReadonlyMap<string, string> = new Map()
): AtributoResolvido[] {
  const limpo = (v: string | null | undefined): string | null =>
    v && v.trim() ? v.trim() : null;

  const resolver = (
    id: string,
    nome: string,
    doCadastro: string | null,
    doNome: string | null = null
  ): AtributoResolvido => {
    // O CADASTRO PRIMEIRO, e agora ele inclui os atributos que ela preencheu.
    // Antes só chegavam marca e modelo; "Gênero" e os outros passavam direto
    // para o palpite pelo nome.
    const cadastro = limpo(doCadastro) ?? limpo(doCadastroDela(p.atributos, nome));
    if (cadastro) return { id, nome, valor: cadastro, origem: "cadastro" };
    const mercado = limpo(doMarketplace.get(id));
    if (mercado) return { id, nome, valor: mercado, origem: "marketplace" };
    const adivinhado = limpo(doNome);
    if (adivinhado) return { id, nome, valor: adivinhado, origem: "nome" };
    return { id, nome, valor: null, origem: "ausente" };
  };

  // A lista deixou de ser escrita aqui e passou a ser percorrida. O atributo que
  // nenhum leitor conhece cai em `ausente` sozinho — e `ausente` já quer dizer
  // "vira pergunta, nunca chute", que é a resposta certa para um obrigatório de
  // móvel que ninguém mediu ainda.
  return obrigatorios.map((exigencia) => {
    const { id, nome } = exigencia;
    const base = resolver(id, nome, DO_CADASTRO[id]?.(p) ?? null, DO_NOME[id]?.(p) ?? null);
    // O que o ML publica sobre o atributo viaja com o resolvido. Não muda o
    // valor nem a origem: muda o que dá para fazer quando não há valor.
    return {
      ...base,
      ...(exigencia.tipo ? { tipo: exigencia.tipo } : {}),
      ...(exigencia.valoresAceitos?.length ? { opcoes: exigencia.valoresAceitos } : {}),
    };
  });
}

/**
 * O bloco que vai ao modelo.
 *
 * Diz o que o marketplace exige, o que já está resolvido e o que falta — e
 * proíbe cobrar fora dessa lista. Sem isto o A10 inventava requisitos
 * ("antiderrapante", "vegano", "materiais reciclados") que travavam a
 * publicação para sempre, porque publicar exige a lista de pendências vazia.
 */
/**
 * `produto_atributos` → `id → valor`, para alimentar `resolverObrigatorios`.
 *
 * A tabela guarda o NOME que o ML devolveu, não o id — consequência declarada
 * do DES-002. `idDoAtributoML` faz o caminho de volta, com o MESMO mapa que
 * monta o payload.
 *
 * O que não tem id conhecido fica de fora: um atributo que não vira id não
 * chega ao ML como aquele atributo, e fingir que resolveria seria afirmar o que
 * não se sabe.
 */
export function atributosPorId(
  atributos: readonly { nomeAtributo: string; valorAtributo: string }[]
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const a of atributos) {
    const id = idDoAtributoML(a.nomeAtributo);
    if (!id || !a.valorAtributo?.trim()) continue;
    if (!mapa.has(id)) mapa.set(id, a.valorAtributo.trim());
  }
  return mapa;
}

/**
 * Quantos valores do ML cabem no briefing antes de virarem ruído.
 *
 * COLOR tem 51 e SIZE tem 44 nesta categoria. Despejar 95 palavras num prompt
 * que roda a cada produto é caro e não ajuda o modelo a escolher melhor — o
 * que ele precisa é saber que a lista EXISTE e como ela é.
 */
const VALORES_NO_BRIEFING = 12;

/**
 * As opções, em texto, quando o ML publica alguma.
 *
 * `list` e `string` recebem frases diferentes de propósito: em `list` a lista é
 * o que o ML aceita; em `string` ela é o que ele já viu. Prometer fechamento
 * onde não há seria inventar regra do marketplace — o defeito que o DES-001
 * arrancou do A10.
 */
function opcoesEmTexto(a: AtributoResolvido): string {
  const ops = a.opcoes ?? [];
  if (!ops.length) return "";
  const mostrados = ops.slice(0, VALORES_NO_BRIEFING).map((v) => v.nome).join(", ");
  const resto = ops.length - VALORES_NO_BRIEFING;
  const cauda = resto > 0 ? `, e mais ${resto}` : "";
  return a.tipo === "list"
    ? ` — o Mercado Livre aceita SÓ estes: ${mostrados}${cauda}`
    : ` — valores que o Mercado Livre já conhece (outro também é aceito): ${mostrados}${cauda}`;
}

/**
 * O briefing dos obrigatórios, dito com a PROCEDÊNCIA da lista.
 *
 * ===========================================================================
 * O CABEÇALHO AFIRMAVA UMA MEDIÇÃO QUE PODE NÃO TER ACONTECIDO
 * ===========================================================================
 *
 * Ele era fixo: "medidos na API da categoria — são estes e só estes". Mas
 * `obrigatoriosDoProduto` cai em `OBRIGATORIOS_CALCADO` com
 * `procedencia: "palpite"` sempre que o produto não tem categoria — e produto
 * recém-importado NUNCA tem. Medido em 26/08/2026 numa base real: **1003 de
 * 1003** produtos entrariam na esteira recebendo a lista de calçado anunciada
 * como medida no Mercado Livre. Cinquenta deles são bolsa, meia ou kit.
 *
 * É a forma exata do INC-011 — "'o Mercado Livre exige' e 'a gente supõe que
 * exige' não são a mesma frase, e a segunda foi cobrada como se fosse a
 * primeira em 118 anúncios". `ProcedenciaDosObrigatorios` existe desde então
 * para o chamador poder dizer a diferença; faltava o briefing dizê-la.
 *
 * Sem valor padrão, pelo mesmo motivo de `resolverObrigatorios`: um padrão aqui
 * seria a afirmação forte voltando a ser silêncio.
 */
export function briefingDosAtributos(
  resolvidos: readonly AtributoResolvido[],
  procedencia: ProcedenciaDosObrigatorios
): string {
  // A origem aparece no briefing porque ela muda o que o modelo deve fazer com
  // o valor: o que veio do Mercado Livre é o que a própria lojista informou lá,
  // e não se questiona; o que veio do nome é leitura nossa, e pode estar errado.
  const deOnde: Record<AtributoResolvido["origem"], string> = {
    cadastro: "cadastro",
    marketplace: "Mercado Livre",
    nome: "nome do produto",
    ausente: "",
  };
  const linhas = resolvidos.map((a) => {
    if (!a.valor) return `- ${a.nome}: FALTA${opcoesEmTexto(a)}`;
    // Valor fora de lista fechada não é "resolvido": é recusa esperando
    // acontecer na publicação. Chamá-lo de resolvido é o silêncio que este
    // módulo passou a quebrar.
    if (valorForaDaLista(a)) {
      return `- ${a.nome}: ${a.valor} — VALOR NÃO ACEITO nesta categoria${opcoesEmTexto(a)}`;
    }
    return `- ${a.nome}: ${a.valor} (já resolvido pelo ${deOnde[a.origem]})`;
  });
  const faltam = resolvidos.filter((a) => !a.valor).map((a) => a.nome);
  // O que falta MAS tem lista não é a mesma pergunta: a resposta já está na
  // tela, e o modelo não precisa (nem deve) inventar uma.
  const escolhiveis = resolvidos
    .filter((a) => estadoDoAtributo(a) === "escolha")
    .map((a) => a.nome);

  const medida = procedencia === "categoria";
  return [
    medida
      ? `ATRIBUTOS OBRIGATÓRIOS DO MERCADO LIVRE (medidos na API da categoria — são estes e só estes):`
      : `ATRIBUTOS QUE PROVAVELMENTE SERÃO EXIGIDOS (a categoria deste produto ainda não foi definida, então esta lista é a de CALÇADO, por suposição — não uma medição do Mercado Livre):`,
    ...linhas,
    "",
    faltam.length
      ? `Só ${faltam.join(" e ")} pode(m) virar pendência. NÃO repita os já resolvidos.`
      : `Todos resolvidos. NÃO liste pendência de atributo obrigatório.`,
    ...(escolhiveis.length
      ? [
          `Para ${escolhiveis.join(" e ")}, escolha entre os valores listados acima — são os que o próprio Mercado Livre publica. NÃO invente valor fora do que está ali.`,
        ]
      : []),
    medida
      ? `NÃO invente exigências fora desta lista: "antiderrapante", "vegano", "materiais reciclados", "altura do solado" e "forma do calçado" NÃO são atributos desta categoria no Mercado Livre.`
      : `Trate a lista como PROVÁVEL, não como certa: se este produto não for calçado, ela não se aplica. Em nenhum caso invente exigências fora dela — "antiderrapante", "vegano", "materiais reciclados", "altura do solado" e "forma do calçado" não são atributos do Mercado Livre.`,
  ].join("\n");
}
