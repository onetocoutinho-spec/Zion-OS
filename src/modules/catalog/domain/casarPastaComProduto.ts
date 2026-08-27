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
  via: "codigo" | "referencia" | "nome" | null;
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
 * Um código curto demais casa por acaso.
 *
 * "A1" aparece dentro de qualquer coisa. Quatro caracteres é o mínimo em que a
 * coincidência deixa de ser provável — e um código de verdade tem mais.
 */
const CODIGO_MINIMO = 4;

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
    .filter((t) => t.length >= CODIGO_MINIMO && /[0-9]/.test(t));
}

/**
 * Os códigos que aparecem no nome de UM produto só.
 *
 * O que se repete fica de fora: dois produtos com "7142.101" no nome são o
 * mesmo modelo em acabamentos diferentes, e escolher um seria chute.
 */
function referenciasUnicas(produtos: readonly ProdutoParaCasar[]): Map<string, string> {
  const donos = new Map<string, string[]>();
  for (const p of produtos) {
    for (const c of new Set(codigosNoTexto(p.nome))) {
      const lista = donos.get(c) ?? [];
      lista.push(p.id);
      donos.set(c, lista);
    }
  }
  const unicas = new Map<string, string>();
  for (const [codigo, ids] of donos) if (ids.length === 1) unicas.set(codigo, ids[0]);
  return unicas;
}

function casaPorCodigo(pasta: string, p: ProdutoParaCasar): boolean {
  const alvo = soAlfanum(pasta);
  for (const codigo of [p.sku, p.codErp]) {
    const c = soAlfanum(codigo ?? "");
    if (c.length >= CODIGO_MINIMO && alvo.includes(c)) return true;
  }
  return false;
}

export function casarPastaComProduto(
  pasta: string,
  produtos: readonly ProdutoParaCasar[]
): Casamento {
  // Identidade primeiro. Um código na pasta encerra a pergunta, e nenhuma
  // parecença de nome deveria discutir com ele.
  for (const p of produtos) {
    if (casaPorCodigo(pasta, p)) return { produtoId: p.id, confianca: 1, via: "codigo" };
  }

  // Referência do fabricante: também identidade, quando ela não se repete.
  const unicas = referenciasUnicas(produtos);
  for (const c of codigosNoTexto(pasta)) {
    const dono = unicas.get(c);
    if (dono) return { produtoId: dono, confianca: 1, via: "referencia" };
  }

  const alvo = palavrasDe(pasta);
  if (alvo.size === 0) return { produtoId: null, confianca: 0, via: null };

  let melhor: string | null = null;
  let melhorScore = 0;
  for (const p of produtos) {
    const palavras = palavrasDe(p.nome);
    let comuns = 0;
    for (const w of alvo) if (palavras.has(w)) comuns++;
    const score = comuns / Math.max(alvo.size, palavras.size, 1);
    if (score > melhorScore) {
      melhorScore = score;
      melhor = p.id;
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
  const porProfundidade = new Map<number, string[][]>();
  for (const m of meios) {
    if (m.length === 0) continue;
    const lista = porProfundidade.get(m.length) ?? [];
    if (lista.length < amostra) lista.push([...m]);
    porProfundidade.set(m.length, lista);
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
