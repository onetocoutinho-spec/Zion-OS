// O ERP PROPÕE OS CÓDIGOS — puro, e recusa mais do que aceita.
//
// ===========================================================================
// A DESCOBERTA QUE PRODUZIU ISTO, MEDIDA EM 18/08/2026
// ===========================================================================
//
// Quinze produtos desta base não têm código em nenhuma variação: vieram
// importados do Mercado Livre, onde o `seller_custom_field` está vazio. Sem
// código, nenhuma planilha do ERP os alcança — nem custo, nem peso.
//
// O nome não serve de ponte: no Zion eles têm título de marketing do ML
// ("Chinelo Ortopédico Feminino Slide Modare Ultraconforto Laço") e no ERP têm
// nome de fábrica ("papete slide modare 7208.101 nobuck"). São 43% de
// semelhança, e baixar limiar é o que já mandou o custo de um sapato para outro.
//
// Mas a COR serve. A derivação do LINX escreve "modelo (cor tamanho)", e as
// cores de catálogo são específicas: "Avelã Soft" aparece em UM único modelo
// entre 14.629 linhas. Achado o modelo, cada variação casa por cor + tamanho —
// exato, sem semelhança nenhuma.
//
// Medido nos quinze: 6 caem num modelo único, 8 têm cor genérica demais
// ("Creme" aparece em 30 modelos) e 1 não existe no arquivo. Este módulo
// propõe os 6 e diz, dos outros, por que não.
//
// ===========================================================================
// POR QUE ELE PROPÕE E NUNCA GRAVA
// ===========================================================================
//
// Um código errado aqui não erra sozinho: ele faz a variação herdar o custo e o
// peso de OUTRO produto na próxima importação, em silêncio. Já aconteceu nesta
// base em 18/08/2026 — dois códigos de exemplo que eram reais viraram chave de
// duas variações de um chinelo, e apontavam para tênis Molekinha.
//
// Então tudo aqui é proposta: o pareamento inteiro vai para a tela, com o
// modelo que o justificou e a cor que o identificou, e quem grava é o clique.

/** Uma linha do export de derivação do ERP, reduzida ao que decide. */
export interface LinhaDoErp {
  codigo: string;
  modelo: string;
  /** "papete slide modare 7208.101 nobuck (avela soft 34)" */
  descricao: string;
}

export interface VariacaoParaCasar {
  id: string;
  cor: string;
  tamanho: string;
}

export interface ProdutoParaPropor {
  id: string;
  nome: string;
  /** Só as variações SEM código. */
  variacoes: VariacaoParaCasar[];
}

export interface ParDeCodigo {
  variacaoId: string;
  rotulo: string;
  codigo: string;
}

export type PropostaDeCodigos =
  | {
      produtoId: string;
      nome: string;
      ok: true;
      /** O modelo do ERP que a cor identificou. Aparece na tela: é a prova. */
      modelo: string;
      /** A cor que identificou o modelo — a mais específica das do produto. */
      corQueIdentificou: string;
      pares: ParDeCodigo[];
      /** Variações que o modelo não explicou. Nunca chutadas. */
      semPar: string[];
    }
  | {
      produtoId: string;
      nome: string;
      ok: false;
      /** Por que não deu, em português e acionável. */
      motivo: string;
    };

const limpar = (s: string) => (s ?? "").trim();
const norm = (s: string) =>
  limpar(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const rotulo = (v: VariacaoParaCasar) =>
  [limpar(v.cor), limpar(v.tamanho)].filter(Boolean).join(" · ") || "(sem cor nem tamanho)";

/**
 * A COR, tal como o ERP a escreve: o que está entre parênteses, sem o tamanho.
 *
 * Serve só para EXPLICAR a recusa — "as cores desse modelo no ERP são X, Y" —
 * quando o modelo foi achado e nenhuma variação casou. Nunca decide nada.
 */
function corDaDescricao(desc: string): string {
  const m = desc.match(/\(([^)]*)\)/);
  const dentro = m ? m[1] : desc;
  return dentro.replace(/\s*\d+\s*$/, "").trim();
}

/** O número do calçado, tal como a derivação o escreve: o ÚLTIMO da descrição. */
function tamanhoDaDescricao(descricao: string): string {
  const nums = descricao.match(/\d+/g);
  return nums && nums.length > 0 ? nums[nums.length - 1] : "";
}

/** O primeiro número do tamanho da variação: "37/38 BR" → "37". */
function tamanhoDaVariacao(v: VariacaoParaCasar): string {
  const m = limpar(v.tamanho).match(/\d+/);
  return m ? m[0] : "";
}

/**
 * Propõe os códigos de cada produto, ou explica por que não consegue.
 *
 * A ordem é a mesma que a medição usou, e cada passo pode recusar:
 *
 *   1. entre as cores do produto, achar a que aparece em MENOS modelos do ERP;
 *   2. se ela não isola UM modelo, parar — e dizer em quantos ela aparece;
 *   3. dentro do modelo, casar cada variação por cor + tamanho;
 *   4. só propor a variação que casou com UMA linha.
 */
export function proporCodigos(
  linhas: readonly LinhaDoErp[],
  produtos: readonly ProdutoParaPropor[]
): PropostaDeCodigos[] {
  // Índice por modelo, com a descrição já normalizada — os arquivos têm 14 mil
  // linhas e cada produto varre todas as cores.
  const porModelo = new Map<string, { codigo: string; desc: string }[]>();
  for (const l of linhas) {
    const m = norm(l.modelo);
    if (!m || !limpar(l.codigo)) continue;
    const arr = porModelo.get(m) ?? [];
    arr.push({ codigo: limpar(l.codigo), desc: norm(l.descricao) });
    porModelo.set(m, arr);
  }

  return produtos.map((p): PropostaDeCodigos => {
    if (p.variacoes.length === 0) {
      return { produtoId: p.id, nome: p.nome, ok: false, motivo: "Este produto não tem variação sem código." };
    }

    // 1) a cor mais ESPECÍFICA: a que aparece em menos modelos.
    const cores = [...new Set(p.variacoes.map((v) => limpar(v.cor)).filter(Boolean))];
    let melhor: { cor: string; modelos: string[] } | null = null;
    for (const cor of cores) {
      const partes = norm(cor).split(" ").filter(Boolean);
      if (partes.length === 0) continue;
      const modelos: string[] = [];
      for (const [modelo, ls] of porModelo) {
        if (ls.some((l) => partes.every((t) => l.desc.includes(t)))) modelos.push(modelo);
      }
      if (modelos.length === 0) continue;
      if (!melhor || modelos.length < melhor.modelos.length) melhor = { cor, modelos };
    }

    if (!melhor) {
      return {
        produtoId: p.id,
        nome: p.nome,
        ok: false,
        motivo:
          `Nenhuma das cores deste produto (${cores.join(", ") || "sem cor"}) aparece no arquivo do ` +
          `ERP. Sem isso não tenho como saber de qual item ele é.`,
      };
    }
    // 2) a cor precisa ISOLAR um modelo. Escolher entre vários seria adivinhar
    //    de qual produto do ERP este anúncio é — e o preço do erro é custo e
    //    peso de outro item, calados.
    if (melhor.modelos.length > 1) {
      return {
        produtoId: p.id,
        nome: p.nome,
        ok: false,
        motivo:
          `A cor mais específica deste produto ("${melhor.cor}") aparece em ${melhor.modelos.length} ` +
          `modelos diferentes do ERP. Não dá para saber qual é o dele sem você dizer.`,
      };
    }

    const modelo = melhor.modelos[0];
    const linhasDoModelo = porModelo.get(modelo) ?? [];

    // 3 e 4) cor + tamanho, dentro do modelo, e só o casamento ÚNICO.
    const pares: ParDeCodigo[] = [];
    const semPar: string[] = [];
    const usados = new Set<string>();
    for (const v of p.variacoes) {
      const partes = norm(v.cor).split(" ").filter(Boolean);
      const tam = tamanhoDaVariacao(v);
      const cand = linhasDoModelo.filter(
        (l) =>
          !usados.has(l.codigo) &&
          partes.length > 0 &&
          partes.every((t) => l.desc.includes(t)) &&
          tam !== "" &&
          tamanhoDaDescricao(l.desc) === tam
      );
      if (cand.length === 1) {
        usados.add(cand[0].codigo);
        pares.push({ variacaoId: v.id, rotulo: rotulo(v), codigo: cand[0].codigo });
      } else {
        semPar.push(rotulo(v));
      }
    }

    if (pares.length === 0) {
      // AS CORES DO MODELO ENTRAM NA FRASE, e não é enfeite.
      //
      // Medido em 18/08/2026: o "Tênis Sorano" tem cor "SOR AREIA" no Zion e
      // "15745a/sor preto 01" no ERP. Dizer só "nada casou" manda a lojista
      // adivinhar; mostrar as cores de lá deixa a diferença visível.
      const cores = [...new Set(linhasDoModelo.map((l) => corDaDescricao(l.desc)).filter(Boolean))];
      return {
        produtoId: p.id,
        nome: p.nome,
        ok: false,
        motivo:
          `Achei o modelo "${modelo}" pela cor "${melhor.cor}", mas nenhuma variação casou por ` +
          `cor e tamanho dentro dele.` +
          (cores.length > 0
            ? ` As cores desse modelo no ERP são: ${cores.slice(0, 8).join(", ")}.`
            : ""),
      };
    }

    return {
      produtoId: p.id,
      nome: p.nome,
      ok: true,
      modelo,
      corQueIdentificou: melhor.cor,
      pares,
      semPar,
    };
  });
}

/**
 * A frase que a tela mostra por produto, com a PROVA junto.
 *
 * "Achei porque a cor X só existe neste modelo" é o que permite a lojista
 * conferir em vez de confiar — e conferir é o único caminho, porque o Zion não
 * sabe validar código nenhum contra o ERP dela.
 */
export function fraseDaProposta(p: PropostaDeCodigos): string {
  if (!p.ok) return p.motivo;
  return (
    `${p.pares.length} de ${p.pares.length + p.semPar.length} variações casaram com o modelo ` +
    `"${p.modelo}" do seu ERP — achei esse modelo porque a cor "${p.corQueIdentificou}" só ` +
    `aparece nele. Dentro do modelo, cada variação casou por cor e tamanho.` +
    (p.semPar.length > 0 ? ` Ficaram de fora: ${p.semPar.join(", ")}.` : "")
  );
}
