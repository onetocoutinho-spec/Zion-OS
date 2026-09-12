// A COR DA FOTO, e o casamento dela com a variante.
//
// ===========================================================================
// POR QUE ISTO EXISTE — medido em 12/08/2026
// ===========================================================================
//
// Os anúncios desta lojista são um por COR E TAMANHO: "Chinelo Havaianas Top
// Liso Amarelo 33-34", "... Azul 33-34" — 460 anúncios para 80 produtos.
//
// As 651 fotos do cadastro estão ligadas ao produto e a mais nada. Mandar a
// foto do produto para os anúncios dele poria chinelo amarelo no anúncio azul,
// que não melhora o problema: troca uma infração de foto por uma de "o anúncio
// não corresponde ao produto" — a categoria com que o ML já PAUSOU 25 anúncios
// desta conta.
//
// ===========================================================================
// NÃO EXISTE TAXONOMIA DE CORES AQUI, E É DELIBERADO
// ===========================================================================
//
// As cores da base são texto livre com variedade legítima: `Preto` em 282
// variantes, `Branco` em 99, e também `Azul-marinho`, `Preto/Branco`,
// `Preto/Camel`. Uma tabela de cores canônicas seria uma segunda verdade que
// divergiria da primeira no dia seguinte — o mesmo erro das três cópias da
// regra de alcance da agência.
//
// A cor da foto é a MESMA string da variante. Quem preenche ESCOLHE da lista
// do produto; não digita. O que este módulo faz é só tornar a comparação
// robusta a caixa, acento e espaço — porque `Azul-Marinho` e `azul-marinho`
// são a mesma cor e nada além disso é adivinhado.

/**
 * A faixa das marcas combinantes do Unicode, escrita por CÓDIGO.
 *
 * Escrita com os caracteres literais dentro da regex, ela fica invisível no
 * diff, some num copiar-colar e reaparece como classe vazia — que casa com
 * nada e faz `Preto` e `Prêto` virarem cores diferentes em silêncio.
 */
const ACENTOS = /[̀-ͯ]/g;

/** Caixa, acento e espaço saem; o resto fica intocado. */
export function normalizarCor(cor: string): string {
  return (cor ?? "")
    .normalize("NFD")
    .replace(ACENTOS, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export interface VarianteComCor {
  cor?: string | null;
}

/**
 * As cores que ESTE produto tem, na grafia original da variante.
 *
 * É esta lista que a tela oferece na hora de subir a foto. Oferecer um campo
 * livre convidaria a digitar "amarelo claro" para uma variante chamada
 * "Amarelo", e o casamento falharia sem ninguém entender por quê.
 */
export function coresDoProduto(
  variantes: readonly VarianteComCor[]
): string[] {
  const vistas = new Map<string, string>();
  for (const v of variantes) {
    const bruta = (v.cor ?? "").trim();
    if (!bruta) continue;
    const chave = normalizarCor(bruta);
    // A PRIMEIRA grafia vence. Duas variantes escritas `Preto` e `PRETO` são a
    // mesma cor, e a lista não pode mostrar as duas como se fossem escolhas.
    if (!vistas.has(chave)) vistas.set(chave, bruta);
  }
  return [...vistas.values()];
}

/**
 * A foto serve para esta variante?
 *
 * `null` de qualquer lado responde NÃO. Foto sem cor não é coringa: ela é uma
 * foto de que ninguém sabe a cor, e usá-la numa variante colorida é apostar.
 * Variante sem cor também não atrai foto colorida — produto sem grade de cor
 * não tem esse problema para resolver.
 */
export function fotoServeParaVariante(
  corDaFoto: string | null | undefined,
  corDaVariante: string | null | undefined
): boolean {
  const f = normalizarCor(corDaFoto ?? "");
  const v = normalizarCor(corDaVariante ?? "");
  if (!f || !v) return false;
  return f === v;
}

export interface FotoComCor {
  cor?: string | null;
  tipoImagem?: string;
  largura?: number | null;
  altura?: number | null;
}

/**
 * O que falta fotografar num produto: as cores sem NENHUMA foto que sirva de
 * capa.
 *
 * "Servir de capa" é quadrada e com o lado mínimo — a mesma régua do resto do
 * sistema. Uma cor que só tem foto pequena continua sendo trabalho a fazer, e
 * dizer o contrário mandaria a lojista subir de novo o que já não serve.
 */
export function coresSemFotoBoa(
  variantes: readonly VarianteComCor[],
  fotos: readonly FotoComCor[],
  ladoMinimo: number
): string[] {
  const boas = new Set(
    fotos
      .filter(
        (f) =>
          f.cor &&
          typeof f.largura === "number" &&
          typeof f.altura === "number" &&
          f.largura === f.altura &&
          f.largura >= ladoMinimo
      )
      .map((f) => normalizarCor(f.cor as string))
  );
  return coresDoProduto(variantes).filter((c) => !boas.has(normalizarCor(c)));
}
