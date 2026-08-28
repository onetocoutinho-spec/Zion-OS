// Qual produto é a pasta de fotos que a pessoa acabou de escolher.
//
// ===========================================================================
// POR QUE SAIU DA TELA
// ===========================================================================
//
// Esta função morava dentro de `cliente/imagens/page.tsx`, e ali ela era
// inalcançável por teste: componente de página não se chama de um `node:test`.
// Ela decide para qual produto vão as fotos de uma pasta inteira — errar
// significa a foto de uma cama aparecer no anúncio de outra —, e uma decisão
// desse tamanho não pode viver num lugar onde ninguém consegue apontar uma
// prova.
//
// ===========================================================================
// TRÊS FORMAS DE CASAR, E ELAS NÃO VALEM O MESMO
// ===========================================================================
//
// CÓDIGO   a pasta contém o SKU ou o código do ERP. É identidade: ou é aquele
//          produto, ou não é. Não tem "quase".
//
// REFERÊNCIA  a pasta contém um código que aparece no nome de UM produto só —
//          "7208.101", "MF9184". Também é identidade, e por um motivo medido:
//          num catálogo de 1003 produtos, 664 têm no nome um código que não se
//          repete. Único no catálogo não é parecença, é o produto.
//
// NOME     palavras em comum entre a pasta e o nome do produto. É parecença, e
//          parecença erra — ainda mais num catálogo de móveis, onde "Cama -
//          BELLA", "Cama - NAZARÉ" e "Cama Box" dividem a palavra que mais
//          aparece.
//
// Código vence nome sempre, e a confiança volta junto do resultado para a tela
// poder mostrar o quanto aquilo é um palpite. Antes ela mostrava só "casou" ou
// "não casou", e um casamento de 35% parecia igual a um de 100%.
//
// ===========================================================================
// POR QUE A REFERÊNCIA ENTROU — MEDIDO EM 26/08/2026
// ===========================================================================
//
// O fabricante manda a pasta de fotos com a referência DELE: "7208.101". Sem
// esta regra, isso caía na parecença de nome e morria — "7208.101" tem duas
// palavras, o nome do produto tem seis, e 2/6 = 0,33 fica logo ABAIXO do corte
// de 0,34. Medido nos 1003 produtos da base real:
//
//     pasta = referência do fabricante   casou certo   10,8%   não casou 87,8%
//     pasta = Código Pai do ERP          casou certo   99,1%
//
// Ou seja: o jeito mais provável de a pasta chegar era justamente o que não
// funcionava, e a tela não dizia isso a ninguém.
//
// Um código que se REPETE entre produtos não casa — "7142.101" é o mesmo modelo
// em dois acabamentos, e escolher um dos dois seria chutar num lugar onde
// errar põe a foto no anúncio errado. Repetido vira "não casou", que é o erro
// seguro.

/** Uma parecença abaixo disto não casa: vira "não casou", que é o erro seguro. */
export const CORTE_DE_PARECENCA = 0.34;

export interface ProdutoParaCasar {
  id: string;
  nome: string;
  sku?: string;
  codErp?: string;
}

export interface Casamento {
  produtoId: string | null;
  /** 0 a 1. Por código e por referência é sempre 1 — identidade não tem grau. */
  confianca: number;
  /**
   * `referencia+nome` é o desempate de 27/08: a referência se repete entre
   * produtos do mesmo modelo, e o NOME COMPLETO escolhe entre eles. Os dois
   * sinais precisam concordar, e é isso que a separa de `nome`.
   */
  via: "codigo" | "referencia" | "referencia+nome" | "nome" | null;
}

const norm = (s: string): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Só letras e números, para comparar código com nome de pasta. */
const soAlfanum = (s: string): string => norm(s).replace(/[^a-z0-9]/g, "");

const palavrasDe = (s: string): Set<string> =>
  new Set(
    norm(s)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
  );

/**
 * As palavras SEM os números — para o desempate, onde o código já fez o dele.
 *
 * `palavrasDe` guarda "2526" e "202425" como se fossem palavras, e aí a pasta
 * que escreve "202425" briga com o produto que escreve "2024/25" (dois tokens
 * curtos, descartados). O casamento é perfeito no que importa e a nota cai.
 *
 * No desempate isso não é detalhe: a comparação decide entre produtos do MESMO
 * modelo, então o número é justamente a parte que NÃO distingue.
 */
const palavrasSemNumero = (s: string): Set<string> =>
  new Set(
    norm(s)
      .replace(/[0-9]/g, " ")
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2)
  );

function parecencaDeNome(a: string, b: string): number {
  const A = palavrasSemNumero(a);
  const B = palavrasSemNumero(b);
  if (A.size === 0 || B.size === 0) return 0;
  let comuns = 0;
  for (const w of A) if (B.has(w)) comuns++;
  return comuns / Math.max(A.size, B.size);
}

/**
 * Um código curto demais casa por acaso.
 *
 * "A1" aparece dentro de qualquer coisa. Quatro caracteres é o mínimo em que a
 * coincidência deixa de ser provável — e um código de verdade tem mais.
 */
const CODIGO_MINIMO = 4;

/**
 * MEDIDA NÃO É CÓDIGO — "152g" identifica um peso, não um produto.
 *
 * `152g` normaliza para `152G`: quatro caracteres com dígito, que é exatamente
 * o mínimo para virar código. E como só um produto do catálogo tinha esse peso
 * no nome, ele virou uma REFERÊNCIA ÚNICA — identidade, no critério desta
 * função.
 *
 * MEDIDO em 27/08/2026, na pasta SLIME:
 *
 *     "Slime Gelele Color 152g"        -> "Slime Gelelé Tradicional Pote 152g"
 *     "Slime Gelele Glitter Pote 152g" -> o MESMO produto
 *
 * Dois produtos diferentes casando num terceiro, os dois "por identidade", pelo
 * peso. Peso é atributo, e atributo se repete de propósito.
 *
 * A lista é curta e o casamento é do TOKEN INTEIRO: "4931103" não vira medida
 * por acabar em dígito, e "010012" também não. Medido no catálogo inteiro: das
 * 664 referências únicas, exatamente UMA é medida — esta.
 */
const MEDIDA = /^[0-9]+(G|GR|KG|ML|CM|MM|UN|PCS)$/;

/**
 * TAMANHO TAMBÉM NÃO É CÓDIGO — "24/25" vira "2425" e parece modelo.
 *
 * A grade de calçado infantil se escreve como par consecutivo: 24/25, 25/26,
 * 33/34. Sem pontuação viram 2425, 2526, 3334 — quatro dígitos, e o suficiente
 * para `codigosNoTexto` chamar de código.
 *
 * O estrago apareceu DEPOIS do conserto de 27/08, e por causa dele: pasta com
 * código não cai mais na parecença de nome, então uma pasta cujo único "código"
 * era o tamanho deixou de casar por completo. Medido: 23 grupos, 198 fotos,
 * travados só por isso — e removendo o número o nome casa a 1,00:
 *
 *     "Chinelo Havaianas Baby Classics 2526" -> "... Baby Classics 25/26"
 *     "Chinelo Havaianas Aloha 2425"         -> "... Aloha 24/25"
 *
 * Um deles é o caso que mais ensina: "Disney Personagens Stylish 2425", que uma
 * tentativa de desempate pela COR mandou para "Slim Mickey & Minnie Disney
 * 24/25" — outro produto, mesmo tamanho. Sem o tamanho no caminho, ele acha o
 * próprio nome, a 1,00.
 *
 * A regra é estreita de propósito: quatro dígitos em que o segundo par é o
 * primeiro MAIS UM. Medido no catálogo: dos 2.006 SKUs e das 664 referências
 * únicas, ZERO seriam excluídos. Só existem dois tokens assim — 2425 e 2526 —,
 * e ambos aparecem em mais de um produto, ou seja, nunca serviram de identidade.
 */
function ehTamanho(t: string): boolean {
  if (!/^[0-9]{4}$/.test(t)) return false;
  return Number(t.slice(2)) === Number(t.slice(0, 2)) + 1;
}

/**
 * Códigos escondidos num texto: 4+ alfanuméricos com pelo menos um dígito,
 * atravessando ponto, hífen e barra ("7208.101" → "7208101").
 *
 * O dígito é o que separa código de palavra: "SANDALIA" tem 8 letras e não é
 * identidade de nada.
 */
function codigosNoTexto(texto: string): string[] {
  const brutos = (texto ?? "").match(/[A-Za-z0-9]+(?:[.\-/][A-Za-z0-9]+)*/g) ?? [];
  return brutos
    .map((t) => t.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
    .filter((t) => !MEDIDA.test(t) && !ehTamanho(t))
    .filter((t) => t.length >= CODIGO_MINIMO && /[0-9]/.test(t));
}

/**
 * O QUE SE SABE SOBRE O CATÁLOGO, CALCULADO UMA VEZ.
 *
 * `referenciasUnicas` e `donosPorReferencia` varriam os 981 produtos e rodavam
 * regex em cada nome — A CADA CHAMADA. Uma pasta de 543 grupos chamava a função
 * 543 vezes, e cada uma refazia o mesmo índice do zero.
 *
 * MEDIDO em 27/08/2026: 10,5 ms por chamada, 5,3 s para 543 grupos. Síncrono,
 * na thread da interface — a tela não "demora", ela CONGELA. É o mesmo formato
 * do travamento de 5,7 s que já tinha aparecido no casamento de nomes.
 *
 * A memória é por LISTA, num `WeakMap`: a tela passa o mesmo array a cada
 * chamada do lote, então acerta sempre; e quando o catálogo é recarregado, o
 * array é outro e o índice se refaz sozinho. Sem invalidação manual, que é onde
 * cache erra.
 *
 * `unicas` sai de `donos` em vez de ser uma segunda varredura — são a mesma
 * informação, filtrada.
 */
interface IndiceDoCatalogo {
  /** Referência → todos os produtos cujo NOME a contém. */
  donos: Map<string, string[]>;
  /** Referência → o produto, quando ela aparece em um só. */
  unicas: Map<string, string>;
  /** Os códigos de ERP já normalizados, para não refazer por produto. */
  codigosDoErp: { id: string; codigos: string[] }[];
  /**
   * As palavras de cada nome, prontas.
   *
   * A parecença rodava `palavrasDe(p.nome)` para os 981 produtos EM CADA
   * chamada — normalização, split e filtro, mil vezes por grupo de pasta. É o
   * que sobrava dos 1,7 s depois de o índice de referências entrar.
   */
  palavras: { id: string; palavras: Set<string> }[];
  porId: Map<string, ProdutoParaCasar>;
}

const INDICE = new WeakMap<readonly ProdutoParaCasar[], IndiceDoCatalogo>();

function indiceDoCatalogo(produtos: readonly ProdutoParaCasar[]): IndiceDoCatalogo {
  const guardado = INDICE.get(produtos);
  if (guardado) return guardado;

  const donos = new Map<string, string[]>();
  const codigosDoErp: { id: string; codigos: string[] }[] = [];
  const porId = new Map<string, ProdutoParaCasar>();
  for (const p of produtos) {
    porId.set(p.id, p);
    for (const c of new Set(codigosNoTexto(p.nome))) {
      const lista = donos.get(c) ?? [];
      lista.push(p.id);
      donos.set(c, lista);
    }
    const codigos = [p.sku, p.codErp]
      .map((c) => soAlfanum(c ?? ""))
      .filter((c) => c.length >= CODIGO_MINIMO);
    if (codigos.length > 0) codigosDoErp.push({ id: p.id, codigos });
  }
  const unicas = new Map<string, string>();
  for (const [codigo, ids] of donos) if (ids.length === 1) unicas.set(codigo, ids[0]);

  const palavras = produtos.map((p) => ({ id: p.id, palavras: palavrasDe(p.nome) }));
  const indice: IndiceDoCatalogo = { donos, unicas, codigosDoErp, porId, palavras };
  INDICE.set(produtos, indice);
  return indice;
}

/**
 * O código do ERP está dentro do nome da pasta?
 *
 * `alvo` vem PRONTO do chamador: a versão anterior chamava `soAlfanum(pasta)`
 * dentro do laço de produtos, normalizando a MESMA string 981 vezes por
 * chamada. Os códigos do lado do produto vêm normalizados do índice.
 */
function casaPorCodigo(alvo: string, codigos: readonly string[]): boolean {
  for (const c of codigos) if (alvo.includes(c)) return true;
  return false;
}

export function casarPastaComProduto(
  pasta: string,
  produtos: readonly ProdutoParaCasar[]
): Casamento {
  const indice = indiceDoCatalogo(produtos);

  // Identidade primeiro. Um código na pasta encerra a pergunta, e nenhuma
  // parecença de nome deveria discutir com ele.
  const alvoDoCodigo = soAlfanum(pasta);
  for (const { id, codigos } of indice.codigosDoErp) {
    if (casaPorCodigo(alvoDoCodigo, codigos)) return { produtoId: id, confianca: 1, via: "codigo" };
  }

  // Referência do fabricante: também identidade, quando ela não se repete.
  const unicas = indice.unicas;
  const codigosDaPasta = codigosNoTexto(pasta);
  for (const c of codigosDaPasta) {
    const dono = unicas.get(c);
    if (dono) return { produtoId: dono, confianca: 1, via: "referencia" };
  }

  // ===========================================================================
  // REFERÊNCIA REPETIDA: O CÓDIGO ESTREITA, O NOME ESCOLHE — 27/08/2026
  // ===========================================================================
  //
  // "7142.101" em dois produtos era "não casou", e o arquivo explicava por quê:
  // escolher um dos dois seria chute. A frase estava certa sobre o CÓDIGO
  // sozinho e errada sobre o par código+nome.
  //
  // Quando a referência se repete, os candidatos são o MESMO MODELO em
  // acabamentos diferentes — e o catálogo os distingue no nome:
  //
  //     "Chinelo Baby Dedo Ipanema 27046 Brasil"
  //     "Chinelo Baby Dedo Feminino Ipanema 27046 Brasil"
  //
  // Duas pastas com esses nomes exatos existem. O código sozinho não decide; o
  // código MAIS o nome decide, e sem sair do modelo certo.
  //
  // A REGRA É DUPLA CONCORDÂNCIA, não uma média: as palavras da pasta têm que
  // ser exatamente as de UM candidato, e de um só. Empate em 1,00 continua
  // sendo "não casou" — é o caso de dois produtos que o catálogo escreve igual,
  // e aí não há o que decidir sem uma pessoa.
  //
  // Isso é diferente da parecença de nome, que compara contra o CATÁLOGO
  // INTEIRO e foi o que pôs 470 fotos no sapato errado. Aqui o universo já é o
  // do modelo: o pior erro possível é trocar um acabamento por outro do mesmo
  // par, não uma sandália por um mocassim.
  //
  // MEDIDO sobre as pastas reais: dos 122 grupos travados por referência
  // repetida, 96 têm um vencedor exato e único — 928 fotos. Os 26 restantes
  // continuam sem casar, e a maioria é empate em 1,00.
  //
  // TODOS OS CÓDIGOS DA PASTA, E ELES PRECISAM CONCORDAR.
  //
  // A primeira versão retornava no PRIMEIRO código com vencedor único, sem
  // olhar os demais — e aí uma pasta com dois códigos ("Sandalia 7208.101 ref
  // 7142.101") dependia da ORDEM das palavras no nome. Renomear a pasta mudava
  // o produto escolhido, sem nada indicar.
  //
  // Ordem não é evidência. Se dois códigos da mesma pasta apontam para produtos
  // diferentes, a pasta está dizendo duas coisas, e a resposta é a mesma que o
  // arquivo dá para todo empate: "não casou", que é o erro seguro.
  const vencedores = new Set<string>();
  for (const c of codigosDaPasta) {
    const candidatos = indice.donos.get(c);
    if (!candidatos || candidatos.length < 2) continue;
    const perfeitos = candidatos.filter(
      (id) => parecencaDeNome(pasta, indice.porId.get(id)?.nome ?? "") >= 0.999
    );
    // Empate DENTRO de um código já era "não casou"; só o vencedor único conta.
    if (perfeitos.length === 1) vencedores.add(perfeitos[0]);
  }
  if (vencedores.size === 1) {
    return { produtoId: [...vencedores][0], confianca: 1, via: "referencia+nome" };
  }
  if (vencedores.size > 1) {
    // Dois códigos, dois produtos. A pasta se contradiz — e escolher um seria
    // exatamente o chute que esta função existe para não dar.
    return { produtoId: null, confianca: 0, via: null };
  }

  // ===========================================================================
  // PASTA COM CÓDIGO NÃO CAI NA PARECENÇA — E CAÍA
  // ===========================================================================
  //
  // O cabeçalho deste arquivo já dizia a regra: "Código vence nome sempre". Ela
  // valia só quando o código ACERTAVA. Quando a pasta trazia um código que não
  // resolvia — porque o produto não está no catálogo, ou porque a referência se
  // repete —, o fluxo caía na parecença de nome e casava por PALAVRA, ignorando
  // justamente o código que a pasta havia declarado.
  //
  // MEDIDO em 27/08/2026, sobre os 992 grupos de foto da base real, comparando
  // o código da pasta com o do produto escolhido, dígito a dígito:
  //
  //     código BATE ......... 403
  //     código NÃO BATE .....  53   ->  470 fotos no produto ERRADO
  //
  // E o erro tinha cara de acerto, porque a palavra em comum era boa:
  //
  //     "Sandalia Beira Rio 8513113 Anel MT"  ->  8367.878 London
  //     "Sandalia Modare 7162219 Floather"    ->  MOCASSIM 7397.101 Floather
  //     "Tamanco Slide 7142101 Canelado"      ->  7198.100 Canelado
  //     "Sandalia Moleca 5504213 Napa Turim"  ->  5555.203 Napa Turim
  //
  // Uma sandália virou mocassim. A foto de 8513.113 iria anunciar a 8367.878.
  //
  // A regra nova é a que o arquivo já defendia para o código REPETIDO: "vira
  // não casou, que é o erro seguro". Uma pasta que se identifica por código
  // está dizendo QUAL produto ela é. Se aquele produto não aparece, a resposta
  // certa é "não achei" — não "achei um parecido". Parecença só decide onde não
  // há identidade declarada.
  //
  // O custo disto é conhecido e é o custo certo: grupos que antes casavam por
  // palavra passam a exigir uma pessoa. Foto no produto errado ninguém revisa,
  // porque ela parece certa.
  if (codigosDaPasta.length > 0) {
    return { produtoId: null, confianca: 0, via: null };
  }

  const alvo = palavrasDe(pasta);
  if (alvo.size === 0) return { produtoId: null, confianca: 0, via: null };

  let melhor: string | null = null;
  let melhorScore = 0;
  for (const { id, palavras } of indice.palavras) {
    let comuns = 0;
    for (const w of alvo) if (palavras.has(w)) comuns++;
    const score = comuns / Math.max(alvo.size, palavras.size, 1);
    if (score > melhorScore) {
      melhorScore = score;
      melhor = id;
    }
  }

  return melhorScore >= CORTE_DE_PARECENCA
    ? { produtoId: melhor, confianca: melhorScore, via: "nome" }
    : { produtoId: null, confianca: melhorScore, via: null };
}

/** O que uma pasta de fotos diz sobre um arquivo: de que produto e de que cor. */
export interface CaminhoDaFoto {
  pastaProduto: string;
  cor: string;
}

/**
 * Lê produto e cor do caminho relativo de um arquivo escolhido por pasta.
 *
 * ===========================================================================
 * O DEFEITO QUE ISTO CONSERTA
 * ===========================================================================
 *
 * A leitura anterior contava segmentos A PARTIR DO FIM: o antepenúltimo era o
 * produto e o penúltimo era a cor. Com três níveis funciona; com DOIS, inverte
 * tudo — porque `webkitRelativePath` inclui a pasta escolhida como primeiro
 * segmento:
 *
 *   Fotos/CAMA BELLA/Castanho/01.jpg   produto CAMA BELLA · cor Castanho  ✅
 *   Fotos/CAMA BELLA/01.jpg            produto FOTOS · cor CAMA BELLA     ❌
 *
 * No segundo caso o nome da pasta escolhida virava o produto, o produto virava
 * a cor, e o lote inteiro colapsava num grupo só. Móvel cai justamente aí:
 * nem todo produto tem cor, então a subpasta de cor muitas vezes não existe.
 *
 * A leitura passa a ser a partir do COMEÇO, depois de tirar as duas pontas que
 * nunca são produto nem cor — a raiz escolhida e o nome do arquivo. O que
 * sobrar é: nada (fotos soltas na raiz), o produto, ou produto e cor.
 */
/**
 * TODAS as pastas do caminho, incluindo a que a pessoa escolheu.
 *
 * `Fotos/CHINELO/Chinelo Klin 442127/4380 azul/01.png` → as quatro. É a
 * matéria-prima de `nivelDoProdutoPorProfundidade`, que decide qual delas é o
 * produto.
 *
 * ===========================================================================
 * POR QUE A ESCOLHIDA ENTRA
 * ===========================================================================
 *
 * A versão anterior descartava o primeiro segmento, porque ele é a pasta que a
 * pessoa selecionou. Isso funciona quando ela seleciona a pasta-mãe — e joga
 * fora a única informação útil quando ela seleciona a pasta de UM PRODUTO:
 *
 *     seleciona `Papete Slide Modare 7208101 Nobuck`
 *     caminho    Papete Slide Modare 7208101 Nobuck/100983 verde/01.png
 *     descartado ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  o nome do produto
 *
 * Medido em 27/08/2026: a tela agrupou por "100983 verde luna nobu" e não casou
 * com nada, porque estava procurando o produto no nome da COR.
 *
 * Com a escolhida incluída, o catálogo decide entre TODOS os níveis — e a
 * pessoa pode selecionar a pasta-mãe, a do tipo ou a de um produto só, que a
 * resposta continua certa.
 */
export function pastasDoCaminho(caminho: string): string[] {
  const partes = (caminho || "").split("/").filter(Boolean);
  return partes.length < 2 ? [] : partes.slice(0, -1);
}

/**
 * Em QUE nível de pasta mora o produto — decidido pelo catálogo, não por regra.
 *
 * ===========================================================================
 * A PASTA QUE CHEGOU, E POR QUE A REGRA FIXA NÃO SERVIA
 * ===========================================================================
 *
 * `lerCaminhoDaFoto` assume `Produto → Cor`, contando do começo. A pasta real
 * de uma loja, medida em 27/08/2026, tem um nível a mais:
 *
 *     BABUCHE / Babuche Baby Molekinha 2749200 / 34224 pretoprata / 01.png
 *     ^tipo     ^produto                          ^cor
 *
 *     9.384 imagens em TIPO/Produto/Cor
 *     1.592 em ZZ_NAO_IDENTIFICADO/TIPO/Produto/Cor
 *
 * Contar do começo põe o TIPO no lugar do produto. Contar do fim quebra a pasta
 * de dois níveis, que foi o defeito que `lerCaminhoDaFoto` já consertou uma vez.
 * Nenhuma das duas regras serve para as duas formas.
 *
 * ===========================================================================
 * O CATÁLOGO DECIDE, E A DIFERENÇA É GRANDE
 * ===========================================================================
 *
 * Medido nas pastas reais contra os 1003 produtos da base:
 *
 *     nível do TIPO     ("CHINELO", "BABUCHE")    casa com produto:   1 de 20
 *     nível do PRODUTO  (o nome completo)         casa com produto: 427 de 457
 *
 * Não é ambiguidade — é 20 contra 1. Então a escolha é MEDIDA: para cada
 * profundidade, tenta-se cada nível e fica o que mais casa com o catálogo.
 *
 * Por profundidade, e não uma vez só, porque a mesma pasta mistura as duas
 * formas: o produto está no índice 1 nas de três níveis e no 2 nas de quatro.
 *
 * Empate ou nenhum casamento devolve 0 — que é exatamente o comportamento
 * anterior. Sem prova, nada muda.
 */
export function nivelDoProdutoPorProfundidade(
  meios: readonly (readonly string[])[],
  produtos: readonly ProdutoParaCasar[],
  /** Quantas pastas olhar por profundidade. Amostra, não varredura. */
  amostra = 30
): Map<number, number> {
  // A AMOSTRA É ESPALHADA, E ERA AS 30 PRIMEIRAS.
  //
  // `if (lista.length < amostra) push` pega o começo da varredura — e a
  // varredura é alfabética por pasta. Numa árvore TIPO/produto/cor, as 30
  // primeiras caem TODAS dentro do primeiro TIPO.
  //
  // MEDIDO em 27/08/2026 na pasta ZZ_NAO_IDENTIFICADO: 1.592 fotos, 519 pastas
  // de produto, e as 30 amostradas eram todas de "BABUCHE" — cujos códigos não
  // estão neste catálogo. Zero casamentos em TODOS os níveis, e a função caiu
  // no padrão `1`, que ali é a pasta de TIPO. O nível certo era o 2, onde 74
  // pastas casam.
  //
  // Escolher o nível errado não é um detalhe: ele decide o que vira "produto" e
  // o que vira "cor". Com o 1, 517 grupos viraram 18 — e os 11 que casaram
  // foram todos para o mesmo produto.
  //
  // Espalhar é a mesma correção da amostragem por tipo em `api/ml/categoria`:
  // pega-se de passo em passo, não do começo, para a amostra atravessar a
  // árvore em vez de ficar presa no primeiro galho.
  const porProfundidade = new Map<number, string[][]>();
  const todosPorProfundidade = new Map<number, string[][]>();
  for (const m of meios) {
    if (m.length === 0) continue;
    const lista = todosPorProfundidade.get(m.length) ?? [];
    lista.push([...m]);
    todosPorProfundidade.set(m.length, lista);
  }
  for (const [profundidade, todos] of todosPorProfundidade) {
    // O índice é calculado, não incrementado por um passo inteiro.
    //
    // A primeira versão fazia `passo = floor(total / amostra)` e caminhava de
    // `passo` em `passo`. Com 50 itens e amostra 30 o passo dá 1, e ela voltava
    // a pegar os 30 PRIMEIROS — o mesmo viés, só que escondido. Ou seja: o
    // espalhamento só valia quando o total passava do dobro da amostra.
    //
    // `floor(i * total / amostra)` atravessa a lista inteira em qualquer razão.
    const espalhada: string[][] = [];
    if (todos.length <= amostra) {
      espalhada.push(...todos);
    } else {
      for (let i = 0; i < amostra; i++) {
        espalhada.push(todos[Math.floor((i * todos.length) / amostra)]);
      }
    }
    porProfundidade.set(profundidade, espalhada);
  }

  const escolhido = new Map<number, number>();
  for (const [profundidade, lista] of porProfundidade) {
    // O último nível nunca é o produto: se fosse, não sobraria pasta para a cor
    // — e uma pasta de dois níveis sem cor cai no `?? ""` do chamador.
    let melhorIndice = 0;
    let melhorCasou = -1;
    for (let i = 0; i < profundidade; i++) {
      let casou = 0;
      const vistos = new Set<string>();
      for (const m of lista) {
        const nome = m[i] ?? "";
        if (!nome || vistos.has(nome)) continue;
        vistos.add(nome);
        if (casarPastaComProduto(nome, produtos).produtoId) casou++;
      }
      if (casou > melhorCasou) {
        melhorCasou = casou;
        melhorIndice = i;
      }
    }
    // Sem casamento nenhum, o padrão é o segundo nível — que é a pasta logo
    // abaixo da escolhida, o comportamento de sempre. Só quando não há sequer
    // um segundo nível é que resta o primeiro.
    const padrao = profundidade > 1 ? 1 : 0;
    escolhido.set(profundidade, melhorCasou > 0 ? melhorIndice : padrao);
  }
  return escolhido;
}

export function lerCaminhoDaFoto(caminho: string): CaminhoDaFoto {
  const partes = (caminho || "").split("/").filter(Boolean);
  // Sem barra nenhuma, é só um nome de arquivo: não há pasta que diga produto.
  if (partes.length < 2) return { pastaProduto: "(raiz)", cor: "" };
  const meio = partes.slice(1, -1);
  return { pastaProduto: meio[0] || "(raiz)", cor: meio[1] || "" };
}
