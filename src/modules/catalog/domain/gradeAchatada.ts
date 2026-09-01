// A grade achatada — quando o arquivo traz derivação e a importação não vê.
//
// ===========================================================================
// O QUE ACONTECEU EM 19/08/2026, E POR QUE NÃO BASTOU CONSERTAR AQUELE DIA
// ===========================================================================
//
// `analisarProdutosCsv` decide o modo do arquivo numa linha:
//
//     const agrupado = Boolean(cols["skuVariacao"]);
//
// Se nenhuma coluna casar com `skuVariacao`, o modo cai para FLAT — uma linha,
// um produto — EM SILÊNCIO. Foi o que o export do LINX fez: ele chama a coluna
// da derivação de `Código`, nome que o mapeador não conhecia. Sete produtos do
// ERP viraram QUATORZE no Zion, cada metade com um pedaço das cores, os
// estoques divergindo, e 14 variações sem SKU porque o código "pertencia a
// outro produto" — que era o mesmo produto.
//
// O conserto daquele dia foi ENSINAR um apelido: `Código` + `Código Pai` juntos
// viraram assinatura de arquivo com derivação. Ensinar apelido conserta o ERP
// que já mordeu. O PRÓXIMO ERP, com um nome de coluna que ninguém previu, cai
// no mesmo buraco — e ninguém vai saber.
//
// ===========================================================================
// PAREDE E ALÇAPÃO
// ===========================================================================
//
// Uma coluna obrigatória que falta é uma PAREDE: a tela recusa, a pessoa
// resolve, o estrago não acontece. O modo flat errado é um ALÇAPÃO: a
// importação termina em verde, "14 produtos criados", e o defeito só aparece
// semanas depois, com os anúncios já no ar.
//
// Numa loja que opera sozinha não existe operador olhando por cima do ombro
// para estranhar 7 virando 14. Este módulo é esse olhar.
//
// ===========================================================================
// O QUE ELE NÃO FAZ, E É DECISÃO
// ===========================================================================
//
// **Não bloqueia.** Nome repetido em linhas diferentes é legítimo — dois
// produtos homônimos existem. Barrar por indício transformaria um alçapão numa
// parede falsa, e parede falsa ensina a ignorar aviso.
//
// **Não adivinha pelo NOME da coluna.** A coluna sugerida sai do que os VALORES
// fazem: variar dentro do mesmo produto e nunca repetir no arquivo inteiro é o
// que uma derivação É. Apelido de cabeçalho é justamente o que já falhou.
//
// **Não procura só entre as colunas ignoradas.** No arquivo do LINX a coluna da
// derivação chama `Código`, e `codigo` é apelido conhecido de SKU — ela entra
// como campo reconhecido, não como ignorada. Procurar só no lixo teria deixado
// passar exatamente o caso que originou este módulo. As ignoradas vêm PRIMEIRO
// porque uma coluna que ninguém reclamou é o esconderijo mais provável; as
// usadas vêm depois porque o LINX prova que ali também acontece.

/** Uma linha do arquivo, cabeçalho → valor, como o parser devolve. */
export type RegistroCru = Record<string, string>;

export interface ContextoDaGrade {
  /** O modo em que a importação vai cair. `true` = a grade foi reconhecida. */
  agrupado: boolean;
  /** As linhas cruas do arquivo. */
  registros: readonly RegistroCru[];
  /** O cabeçalho que virou o nome do produto. Ausente = nem nome foi mapeado. */
  colunaNome?: string;
  /** Cabeçalhos que nenhum campo usou. Procurados primeiro. */
  colunasIgnoradas: readonly string[];
  /** Cabeçalhos já a serviço de algum campo. Procurados depois — ver acima. */
  colunasUsadas?: readonly string[];
}

export interface AvisoDeGrade {
  /** Linhas com nome preenchido — as que virariam produto. */
  linhas: number;
  /** Nomes distintos entre elas. */
  produtos: number;
  /** Quantos produtos A MAIS nascem se importar assim. */
  excedente: number;
  /** A coluna que se comporta como código de derivação, quando existe uma. */
  colunaSugerida?: string;
  /** A frase da tela: diz a consequência, não o fato. */
  texto: string;
}

function vazio(valor: string | undefined): boolean {
  return !valor || valor.trim() === "";
}

/** Mesma normalização do agrupamento: caixa, espaço nas pontas e no meio. */
function normalizar(valor: string | undefined): string {
  return (valor ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Esta coluna se comporta como código de derivação?
 *
 * Três provas, todas sobre os VALORES:
 *   1. preenchida em toda linha — derivação sem código não é código;
 *   2. varia dentro de cada produto repetido — é isto que separa a derivação
 *      de um dado do produto (marca, categoria) repetido na grade inteira;
 *   3. nunca repete no arquivo — dois códigos iguais seriam a mesma peça em
 *      dois produtos diferentes.
 *
 * As três, juntas, também descartam sozinhas as duas colunas que jamais podem
 * ser sugeridas: a do NOME (constante dentro do grupo, reprova na 2) e a do
 * CÓDIGO PAI (idem). Não é preciso excluí-las à mão.
 */
function pareceDerivacao(
  coluna: string,
  grupos: ReadonlyMap<string, readonly RegistroCru[]>,
  comNome: readonly RegistroCru[]
): boolean {
  if (comNome.some((r) => vazio(r[coluna]))) return false;

  for (const linhasDoGrupo of grupos.values()) {
    if (linhasDoGrupo.length < 2) continue;
    const distintos = new Set(linhasDoGrupo.map((r) => normalizar(r[coluna])));
    if (distintos.size !== linhasDoGrupo.length) return false;
  }

  const todos = new Set(comNome.map((r) => normalizar(r[coluna])));
  return todos.size === comNome.length;
}

/**
 * O aviso, ou `null` quando não há o que avisar.
 *
 * `null` em três casos, cada um por um motivo diferente: a grade foi
 * reconhecida (nada a dizer), o nome nem foi mapeado (a parede já está lá, e
 * empilhar aviso sobre erro é ruído), ou nenhum nome se repete (sem repetição
 * não há achatamento — o arquivo é de produtos simples mesmo).
 */
export function avisoDeGradeAchatada(ctx: ContextoDaGrade): AvisoDeGrade | null {
  if (ctx.agrupado) return null;

  const colunaNome = ctx.colunaNome;
  if (!colunaNome) return null;

  // Linha sem nome não vira produto; contá-la inflaria o número que a frase
  // promete, e número inflado é a forma mais rápida de perder o aviso.
  const comNome = ctx.registros.filter((r) => !vazio(r[colunaNome]));

  const grupos = new Map<string, RegistroCru[]>();
  for (const r of comNome) {
    const chave = normalizar(r[colunaNome]);
    const arr = grupos.get(chave) ?? [];
    arr.push(r);
    grupos.set(chave, arr);
  }

  const linhas = comNome.length;
  const produtos = grupos.size;
  const excedente = linhas - produtos;
  if (excedente <= 0) return null;

  const candidatas = [...ctx.colunasIgnoradas, ...(ctx.colunasUsadas ?? [])];
  const colunaSugerida = candidatas.find((c) => pareceDerivacao(c, grupos, comNome));

  const texto =
    `Seu arquivo tem ${linhas} linhas para ${produtos} ` +
    `produto${produtos === 1 ? "" : "s"} — há linhas repetindo o mesmo nome. ` +
    `Do jeito que está, cada linha vira um produto separado: ` +
    `${produtos} vira${produtos === 1 ? "" : "m"} ${linhas}, e a grade de cor e ` +
    `tamanho não é criada.` +
    (colunaSugerida
      ? ` Se a coluna "${colunaSugerida}" for o código de cada variação, aponte ela em "SKU da variação".`
      : ` Se cada linha for uma variação, aponte a coluna do código dela em "SKU da variação".`);

  return {
    linhas,
    produtos,
    excedente,
    ...(colunaSugerida ? { colunaSugerida } : {}),
    texto,
  };
}
