// Quando o campo de código traz uma PALAVRA — e a palavra é um recado.
//
// ===========================================================================
// O QUE ACONTECEU, MEDIDO EM 27/08/2026
// ===========================================================================
//
// O catálogo da lojista tem 1003 produtos, e 22 deles têm isto no lugar do SKU
// e do Código do ERP, os dois campos com o mesmo valor:
//
//     inativoo   iinnattivo   inatt      inativo7    inativ
//     inativado  innattivoo   iinativoo  inattivvo   iiinativo
//     INAATIVO   iinnativo    inativoooo INATIVVO    iinnaattivo
//     iinativo   inaattivo    inatiivo   inativos    inativva
//     inattivoo  innativo                            PRESENTE
//
// Ninguém digitou isso vinte e duas vezes por acidente. É um RECADO: alguém no
// ERP escreveu "inativo" no campo do código para marcar que aquele produto saiu
// de linha, e escreveu com uma letra a mais a cada vez porque o ERP não deixa
// dois produtos terem o mesmo código. A grafia errada não é descuido — é o jeito
// de contornar a restrição de unicidade.
//
// O importador leu tudo como SKU. Os 22 viraram produtos normais: entraram na
// contagem do catálogo, na lista de "faltam fotos", e 19 deles RECEBERAM foto —
// trabalho gasto em produto que não se vende.
//
// ===========================================================================
// POR QUE ISTO AVISA E NÃO CONSERTA
// ===========================================================================
//
// "inativo" no campo do código diz que a linha é um marcador, mas NÃO diz o que
// fazer com ela. Pular na importação seria decidir por conta própria que aquele
// produto não interessa — e o estoque, o preço e o histórico dele continuam
// existindo. Adivinhar um código também não: não há de onde tirar.
//
// Então é aviso, no mesmo lugar de `gradeAchatada` e `pesoImplausivel`: a
// importação segue, o número aparece antes de confirmar, e quem manda decide.
// "Avisar, não travar" — e o inverso disto é o alçapão: importar em verde e
// descobrir semanas depois que 22 produtos do catálogo não existem.
//
// ===========================================================================
// O QUE CONTA COMO PALAVRA
// ===========================================================================
//
// Código tem dígito. "7208.101", "MF9184", "2588100", "010.012" — todos têm.
// Uma sequência só de letras não é código de produto em ERP nenhum que este
// repositório já viu, e é isso que a regra usa: SEM NENHUM DÍGITO.
//
// A regra não tenta reconhecer a palavra "inativo". Reconhecer palavras seria
// perseguir grafias para sempre — foram 22 variações num arquivo só. E o aviso
// vale igual para "PRESENTE", "brinde", "kit", ou o que o próximo ERP inventar.

/** Um produto lido do arquivo, do jeito que a importação o monta. */
export interface LinhaComCodigo {
  nome: string;
  sku: string;
  codErp?: string;
}

export interface AvisoDeCodigo {
  /** Quantas linhas trazem palavra no lugar do código. */
  linhas: number;
  /** As palavras distintas encontradas, em ordem de frequência. */
  palavras: string[];
  /** Alguns nomes de produto afetados, para a pessoa reconhecer o caso. */
  exemplos: string[];
  /** A frase da tela: diz a consequência, não o fato. */
  texto: string;
}

/** Sem nenhum dígito e com pelo menos duas letras: é palavra, não código. */
export function ehPalavraNoLugarDoCodigo(valor: string | undefined | null): boolean {
  const v = String(valor ?? "").trim();
  if (v.length < 2) return false;
  if (/[0-9]/.test(v)) return false;
  return /[a-zA-ZÀ-ÿ]{2,}/.test(v);
}

const MAX_PALAVRAS = 6;
const MAX_EXEMPLOS = 3;

/**
 * O arquivo traz palavra onde deveria vir código?
 *
 * `null` quando não há nada a dizer — a ausência de aviso é a resposta comum, e
 * um aviso que aparece sempre deixa de ser lido.
 *
 * A linha entra na conta quando o SKU **ou** o código do ERP é palavra: nos 22
 * casos medidos os dois campos vinham iguais, mas um ERP que preencha só um
 * deles produz o mesmo estrago.
 */
export function avisoDeCodigoQueEPalavra(
  linhas: readonly LinhaComCodigo[]
): AvisoDeCodigo | null {
  const afetadas = linhas.filter(
    (l) => ehPalavraNoLugarDoCodigo(l.sku) || ehPalavraNoLugarDoCodigo(l.codErp)
  );
  if (afetadas.length === 0) return null;

  const frequencia = new Map<string, number>();
  for (const l of afetadas) {
    const palavra = (
      ehPalavraNoLugarDoCodigo(l.sku) ? l.sku : (l.codErp ?? "")
    ).trim();
    frequencia.set(palavra, (frequencia.get(palavra) ?? 0) + 1);
  }
  const palavras = [...frequencia.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([p]) => p);

  const exemplos = afetadas
    .map((l) => l.nome.trim())
    .filter(Boolean)
    .slice(0, MAX_EXEMPLOS);

  const amostra = palavras.slice(0, MAX_PALAVRAS);
  const eOutras = palavras.length > MAX_PALAVRAS ? `, entre outras` : "";
  const quantas =
    afetadas.length === 1 ? "1 produto vem" : `${afetadas.length} produtos vêm`;

  // A FRASE DIZ A CONSEQUÊNCIA, não o fato. "22 SKUs inválidos" não move
  // ninguém; "eles entram como produto e vão pedir foto e preço" move.
  const texto =
    `${quantas} com uma palavra no lugar do código: ${amostra.map((p) => `"${p}"`).join(", ")}${eOutras}. ` +
    `Em ERP isso costuma ser um recado — produto fora de linha, brinde, kit — e não um código. ` +
    `Se importar assim, eles entram como produto normal: contam no catálogo, pedem foto e preço, ` +
    `e podem chegar até a publicação. Confira antes se essas linhas deviam mesmo virar produto.`;

  return { linhas: afetadas.length, palavras, exemplos, texto };
}
