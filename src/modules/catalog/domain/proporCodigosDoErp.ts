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
  /**
   * O nome COMERCIAL do produto no ERP — o que a lojista reconhece.
   *
   * Medido em 18/08/2026, depois de ela dizer "não sei se estou selecionando
   * certo": a tela mostrava o campo `Modelo` do LINX, que para Havaianas é
   * "brasil", "top liso", "h brasil logo 2024 25". Isso é código interno.
   * Ninguém escolhe um produto por ele — e escolher errado aqui gruda o custo
   * e o peso de outro item.
   *
   * Opcional porque nem todo arquivo traz a coluna; sem ele a tela cai no
   * modelo, como antes.
   */
  nomeComercial?: string;
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
      /**
       * Os modelos que a cor NÃO conseguiu desempatar, ordenados por quantas
       * variações cada um casaria.
       *
       * Existe porque recusar sem oferecer saída empurra o problema para um
       * lugar onde ninguém o vê. A contagem torna a escolha informada:
       * "Alecrim" aparece em 4 modelos, mas normalmente só um casa TODAS as
       * variações. Presente só na ambiguidade.
       */
      candidatos?: CandidatoDeModelo[];
    };

export interface CandidatoDeModelo {
  modelo: string;
  /**
   * O nome comercial mais comum desse modelo no ERP.
   *
   * É ELE que a tela mostra em destaque. "Chinelo Havaianas Brasil" se
   * reconhece; "brasil" não.
   */
  nome: string;
  /** Quantas variações do produto casariam por cor + tamanho neste modelo. */
  casam: number;
  /** As cores desse modelo no ERP, para ela reconhecer o produto. */
  cores: string[];
  /**
   * O nome do modelo aparece no nome do produto?
   *
   * Medido na tela em 18/08/2026, e por pouco não custou caro: para
   * "Chinelo Havaianas Masculino BRASIL Bandeira Original", o modelo "top liso"
   * casava 28 variações e o "brasil" casava 21 — e a lista ordenada só por
   * contagem punha o ERRADO em cima. Havaianas partilham cores e numeração
   * entre linhas, então casar mais não quer dizer ser o certo.
   *
   * É PISTA, não decisão: continua sendo ela quem escolhe.
   */
  nomeBate: boolean;
}

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
  // Sem parênteses — o formato das Havaianas — o que sobra é a descrição
  // inteira. Tirar a corrida de números do fim deixa a cor legível; sem isso a
  // lista de candidatos vira um parágrafo por linha e não ajuda a escolher.
  const dentro = m ? m[1] : desc;
  const tokens = dentro.split(" ").filter(Boolean);
  while (tokens.length > 0 && /^\d+$/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.slice(-4).join(" ").trim();
}

/**
 * O TAMANHO no fim da descrição, como uma sequência de números.
 *
 * ===========================================================================
 * POR QUE NÃO É "O ÚLTIMO NÚMERO" — medido em 18/08/2026
 * ===========================================================================
 *
 * Foi assim que eu escrevi primeiro, e funcionava nos Modare:
 *
 *   "papete slide modare 7208.101 nobuck (avela soft 34)"   → 34
 *
 * Nas Havaianas o tamanho é FAIXA, e a descrição termina com os dois números:
 *
 *   "chinelo havaianas brasil azul naval azul naval hav br 33 34"  → 33 34
 *
 * O último número ali é 34; a variação dela chama-se "33-34 BR", cujo primeiro
 * número é 33. Não casava NADA — os sete modelos candidatos apareciam na tela
 * dizendo "casa 0 variação(ões)", que é uma lista inútil.
 *
 * Pega a CORRIDA de números do fim, e não todos: "012 43 hav top 2196 azul
 * naval 23 24" tem 012, 43 e 2196 no meio, que são modelo e código de cor.
 */
function tamanhoDaDescricao(descricao: string): string[] {
  const tokens = descricao.split(" ").filter(Boolean);
  const fim: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!/^\d+$/.test(tokens[i])) break;
    fim.unshift(tokens[i]);
  }
  return fim;
}

/** Os números do tamanho da variação: "33-34 BR" → ["33","34"]; "37 BR" → ["37"]. */
function tamanhoDaVariacao(v: VariacaoParaCasar): string[] {
  return limpar(v.tamanho).match(/\d+/g) ?? [];
}

/**
 * O tamanho da variação está no fim do tamanho da descrição?
 *
 * SUFIXO, e não igualdade, porque o ERP às vezes cola o código da cor antes:
 * "…sor preto 01 37" tem ["01","37"] no fim, e a variação é só "37". Exigir
 * igualdade perderia esses; comparar só o último número faria "33-34" casar com
 * a linha de "34", que é outra peça.
 */
function tamanhoCasa(daDescricao: string[], daVariacao: string[]): boolean {
  if (daVariacao.length === 0 || daDescricao.length === 0) return false;
  if (daVariacao.length > daDescricao.length) return false;
  const cauda = daDescricao.slice(-daVariacao.length);
  return cauda.every((n, i) => n === daVariacao[i]);
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
  const porModelo = new Map<string, { codigo: string; desc: string; nome: string }[]>();
  for (const l of linhas) {
    const m = norm(l.modelo);
    if (!m || !limpar(l.codigo)) continue;
    const arr = porModelo.get(m) ?? [];
    arr.push({
      codigo: limpar(l.codigo),
      desc: norm(l.descricao),
      nome: limpar(l.nomeComercial ?? ""),
    });
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
      // OS CANDIDATOS VÊM COM A CONTAGEM, e é ela que torna a escolha barata:
      // "Alecrim" aparece em 4 modelos, mas normalmente só um casa TODAS as
      // variações. O software não escolhe — mas não deixa escolher no escuro.
      const nomeDoProduto = norm(p.nome);
      const candidatos: CandidatoDeModelo[] = melhor.modelos
        .map((m) => {
          const ls = porModelo.get(m) ?? [];
          // O nome do modelo bate quando TODAS as palavras dele (fora números
          // soltos) aparecem no nome do produto. "brasil" bate em "…Brasil
          // Bandeira Original"; "top liso" não.
          const palavras = m.split(" ").filter((t) => t.length > 2 && !/^\d+$/.test(t));
          return {
            modelo: m,
            nome: nomeComumDoModelo(ls),
            casam: casarDentroDoModelo(ls, p).pares.length,
            cores: [...new Set(ls.map((l) => corDaDescricao(l.desc)).filter(Boolean))].slice(0, 6),
            nomeBate: palavras.length > 0 && palavras.every((t) => nomeDoProduto.includes(t)),
          };
        })
        // O NOME MANDA ANTES DA CONTAGEM. Ordenar só por contagem punha
        // "top liso" (28) na frente de "brasil" (21) num produto Brasil.
        .sort(
          (a, b) =>
            Number(b.nomeBate) - Number(a.nomeBate) ||
            b.casam - a.casam ||
            a.modelo.localeCompare(b.modelo)
        );
      return {
        produtoId: p.id,
        nome: p.nome,
        ok: false,
        motivo:
          `A cor mais específica deste produto ("${melhor.cor}") aparece em ${melhor.modelos.length} ` +
          `modelos diferentes do ERP. Não dá para saber qual é o dele sem você dizer.`,
        candidatos,
      };
    }

    const modelo = melhor.modelos[0];
    const linhasDoModelo = porModelo.get(modelo) ?? [];

    // 3 e 4) cor + tamanho, dentro do modelo, e só o casamento ÚNICO.
    const { pares, semPar } = casarDentroDoModelo(linhasDoModelo, p);

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
 * O nome comercial que MAIS SE REPETE nas linhas do modelo.
 *
 * O ERP escreve "Chinelo Havaianas Brasil - chinelo havaianas brasil (…)": o
 * que interessa é a parte antes do travessão, e ela às vezes varia de linha
 * para linha. A mais frequente é a que a lojista vai reconhecer.
 */
function nomeComumDoModelo(ls: readonly { nome: string }[]): string {
  const conta = new Map<string, number>();
  for (const l of ls) {
    const antes = l.nome.split(" - ")[0].trim();
    if (!antes) continue;
    conta.set(antes, (conta.get(antes) ?? 0) + 1);
  }
  let melhor = "";
  let n = 0;
  for (const [nome, q] of conta) if (q > n) { melhor = nome; n = q; }
  return melhor;
}

/** Cor + tamanho, dentro de UM modelo. Só o casamento único conta. PURA. */
function casarDentroDoModelo(
  linhasDoModelo: readonly { codigo: string; desc: string }[],
  p: ProdutoParaPropor
): { pares: ParDeCodigo[]; semPar: string[] } {
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
        tamanhoCasa(tamanhoDaDescricao(l.desc), tam)
    );
    if (cand.length === 1) {
      usados.add(cand[0].codigo);
      pares.push({ variacaoId: v.id, rotulo: rotulo(v), codigo: cand[0].codigo });
    } else {
      semPar.push(rotulo(v));
    }
  }
  return { pares, semPar };
}

/**
 * O pareamento quando a LOJISTA escolheu o modelo.
 *
 * Mesmo casamento por cor + tamanho do caminho automático — a única coisa que
 * muda é quem identificou o modelo. `corQueIdentificou` fica vazia de
 * propósito, e é por ela que a frase sabe dizer "escolhido por você": a prova
 * na tela tem que ser honesta sobre de onde veio a decisão.
 */
export function proporComModelo(
  linhas: readonly LinhaDoErp[],
  produto: ProdutoParaPropor,
  modeloEscolhido: string
): PropostaDeCodigos {
  const alvo = norm(modeloEscolhido);
  const ls = linhas
    .filter((l) => norm(l.modelo) === alvo && limpar(l.codigo))
    .map((l) => ({ codigo: limpar(l.codigo), desc: norm(l.descricao) }));
  const nomeDoErp = nomeComumDoModelo(
    linhas.filter((l) => norm(l.modelo) === alvo).map((l) => ({ nome: limpar(l.nomeComercial ?? "") }))
  );
  if (ls.length === 0) {
    return {
      produtoId: produto.id,
      nome: produto.nome,
      ok: false,
      motivo: `Não achei o modelo "${modeloEscolhido}" no arquivo.`,
    };
  }
  const { pares, semPar } = casarDentroDoModelo(ls, produto);
  if (pares.length === 0) {
    const cores = [...new Set(ls.map((l) => corDaDescricao(l.desc)).filter(Boolean))];
    return {
      produtoId: produto.id,
      nome: produto.nome,
      ok: false,
      motivo:
        `Nenhuma variação casou por cor e tamanho no modelo "${modeloEscolhido}".` +
        (cores.length > 0 ? ` As cores dele no ERP são: ${cores.slice(0, 8).join(", ")}.` : ""),
    };
  }
  return {
    produtoId: produto.id,
    nome: produto.nome,
    ok: true,
    // O nome comercial na frente do código: é o que ela reconhece na hora de
    // conferir. O código fica junto, entre parênteses, para rastrear.
    modelo: nomeDoErp ? `${nomeDoErp} (${alvo})` : alvo,
    corQueIdentificou: "",
    pares,
    semPar,
  };
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
  // A PROCEDÊNCIA DO MODELO muda a frase, e não é detalhe: "eu achei" e "você
  // escolheu" pedem conferências diferentes de quem lê.
  const comoAchou = p.corQueIdentificou
    ? `achei esse modelo porque a cor "${p.corQueIdentificou}" só aparece nele`
    : "modelo escolhido por você";
  return (
    `${p.pares.length} de ${p.pares.length + p.semPar.length} variações casaram com o modelo ` +
    `"${p.modelo}" do seu ERP — ${comoAchou}. Dentro do modelo, cada variação casou por cor e tamanho.` +
    (p.semPar.length > 0 ? ` Ficaram de fora: ${p.semPar.join(", ")}.` : "")
  );
}
