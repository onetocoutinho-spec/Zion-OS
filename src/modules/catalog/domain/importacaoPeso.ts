// Leitura de uma planilha de PESO E MEDIDAS — puro, sem rede, sem React.
//
// Sem peso, o frete do Mercado Livre não sai da tabela; sem frete, não existe
// preço mínimo. Medido na base do primeiro lojista: 0 de 3.085 variantes tinham
// peso. A calculadora está correta e muda — falta o dado de entrada.
//
// DUAS DECISÕES QUE MANDAM NESTE MÓDULO
//
// 1) A UNIDADE PRECISA ESTAR ESCRITA NO CABEÇALHO. Uma coluna "peso" sem dizer
//    se é kg ou g é recusada, e o arquivo inteiro para.
//
//    Parece rigor desnecessário; é o contrário. 800 g lidos como 800 kg caem na
//    última faixa de frete e o piso estoura; 0,8 kg lido como 0,8 g cai na
//    faixa mais barata e o piso fica baixo demais. Nos dois casos o número
//    aparece na tela com a mesma cara de cálculo correto, e o lojista precifica
//    errado achando que acertou. Adivinhar pela ordem de grandeza também não
//    resolve: 90 g e 90 kg são ambos plausíveis em planilhas diferentes.
//    Recusar e pedir o cabeçalho certo custa um minuto. O silêncio custa vendas.
//
// 2) O CASAMENTO É EXATO, POR SKU OU EAN. Nunca por nome.
//
//    A importação de custos casava por semelhança de nome e chegou a atribuir o
//    custo de um sapato a outro modelo da mesma marca (0,83 de semelhança entre
//    produtos diferentes). Peso errado tem a mesma consequência: preço errado.
//    Aqui a chave ou bate exatamente, ou a linha é reportada como não
//    encontrada — o lojista corrige a planilha, o sistema não inventa.

import { normalizarHeader } from "../../../lib/csv";

export type UnidadePeso = "kg" | "g";
export type TipoChave = "sku" | "ean";

export interface ColunasPeso {
  /** Cabeçalho original da coluna que identifica a variante. */
  chave: string;
  tipoChave: TipoChave;
  /** Cabeçalho original da coluna de peso. */
  peso: string;
  unidade: UnidadePeso;
  /** Medidas em cm — opcionais; sem elas a cubagem não entra na conta. */
  altura?: string;
  largura?: string;
  comprimento?: string;
}

export type MotivoRecusa = "sem_chave" | "sem_peso" | "peso_sem_unidade";

export type DeteccaoColunas =
  | { ok: true; colunas: ColunasPeso }
  | { ok: false; motivo: MotivoRecusa; mensagem: string };

/** Cabeçalhos que identificam a variante, do mais específico ao mais genérico. */
const CHAVES_SKU = ["sku", "sku_variacao", "sku_variante", "codigo", "cod", "codigo_sku", "seller_sku", "sku_erp", "codigo_erp", "cod_erp"];
const CHAVES_EAN = ["ean", "gtin", "codigo_barras", "cod_barras", "ean13", "barcode"];

/** Cabeçalhos de peso que DECLARAM a unidade. Sem unidade não entra na lista. */
const PESO_KG = ["peso_kg", "peso_em_kg", "peso_quilos", "peso_kgs", "kg", "peso_bruto_kg", "peso_liquido_kg"];
const PESO_G = ["peso_g", "peso_em_g", "peso_gramas", "gramas", "peso_gr", "peso_bruto_g", "peso_liquido_g", "g"];
/** Escritos assim, não dá para saber a unidade — servem só para explicar a recusa. */
const PESO_SEM_UNIDADE = ["peso", "peso_bruto", "peso_liquido", "weight"];

const ALTURA = ["altura", "altura_cm", "alt", "h"];
const LARGURA = ["largura", "largura_cm", "larg", "w"];
const COMPRIMENTO = ["comprimento", "comprimento_cm", "compr", "comp", "profundidade", "d", "l"];

function acharColuna(headers: readonly string[], nomes: readonly string[]): string | undefined {
  return headers.find((h) => nomes.includes(normalizarHeader(h)));
}

/**
 * Descobre quais colunas usar. Recusa o arquivo quando falta o essencial —
 * e a mensagem diz o que renomear, porque "arquivo inválido" não ajuda ninguém.
 */
export function detectarColunas(headers: readonly string[]): DeteccaoColunas {
  const sku = acharColuna(headers, CHAVES_SKU);
  const ean = acharColuna(headers, CHAVES_EAN);
  const chave = sku ?? ean;
  if (!chave) {
    return {
      ok: false,
      motivo: "sem_chave",
      mensagem:
        "A planilha precisa de uma coluna que identifique a variação: SKU (ou código) ou EAN. " +
        "Casar por nome não é aceito aqui — nomes parecidos já trocaram custo entre produtos diferentes.",
    };
  }

  const kg = acharColuna(headers, PESO_KG);
  const g = acharColuna(headers, PESO_G);
  if (!kg && !g) {
    const semUnidade = acharColuna(headers, PESO_SEM_UNIDADE);
    if (semUnidade) {
      return {
        ok: false,
        motivo: "peso_sem_unidade",
        mensagem:
          `A coluna "${semUnidade}" não diz a unidade. Renomeie para "peso_kg" ou "peso_g" e envie de novo. ` +
          "Sem isso não dá para saber se 800 é 800 gramas ou 800 quilos — e o erro sairia como preço, não como aviso.",
      };
    }
    return {
      ok: false,
      motivo: "sem_peso",
      mensagem: 'A planilha precisa de uma coluna de peso com a unidade no nome: "peso_kg" ou "peso_g".',
    };
  }

  return {
    ok: true,
    colunas: {
      chave,
      tipoChave: sku ? "sku" : "ean",
      peso: kg ?? g!,
      unidade: kg ? "kg" : "g",
      altura: acharColuna(headers, ALTURA),
      largura: acharColuna(headers, LARGURA),
      comprimento: acharColuna(headers, COMPRIMENTO),
    },
  };
}

/**
 * Número de planilha brasileira. Devolve null (não 0) quando não há número:
 * peso 0 é "não sei", e 0 gravado como se fosse medida esconde a pendência.
 */
export function parseNumero(s: string): number | null {
  const t = (s ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!t) return null;
  let normalizado: string;
  if (t.includes(",")) {
    // Com vírgula presente, ela é o decimal e o ponto é milhar. Sem ambiguidade.
    normalizado = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
    // Só pontos, todos agrupando de 3 em 3 → separador de milhar.
    //
    // O primeiro grupo não pode começar com zero: ninguém escreve "0.850" para
    // oitocentos e cinquenta. Em planilha de peso essa forma é justamente como
    // se escreve 850 g em quilos — ler como 850 kg erraria por mil vezes.
    normalizado = t.replace(/\./g, "");
  } else {
    normalizado = t;
  }
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * A chave, comparável. Só apara espaços e sobe a caixa.
 *
 * Zeros à esquerda são PRESERVADOS de propósito: "00103800" é um SKU real desta
 * base, e cortar o zero criaria um código que casa com outra coisa.
 */
export function normalizarChave(v: string): string {
  return (v ?? "").trim().toUpperCase();
}

export interface LinhaPeso {
  chave: string;
  pesoKg: number;
  /** 0 = não informado. A cubagem só entra quando as três medidas existem. */
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
}

export type LeituraLinha =
  | { ok: true; linha: LinhaPeso }
  | { ok: false; motivo: "sem_chave" | "sem_peso" };

/** Lê uma linha da planilha. O peso vira sempre kg, que é como a variante guarda. */
export function lerLinha(
  registro: Record<string, string>,
  colunas: ColunasPeso
): LeituraLinha {
  const chave = normalizarChave(registro[colunas.chave] ?? "");
  if (!chave) return { ok: false, motivo: "sem_chave" };

  const bruto = parseNumero(registro[colunas.peso] ?? "");
  if (bruto === null || bruto <= 0) return { ok: false, motivo: "sem_peso" };
  const pesoKg = colunas.unidade === "g" ? bruto / 1000 : bruto;

  const medida = (header?: string) => {
    if (!header) return 0;
    const n = parseNumero(registro[header] ?? "");
    return n !== null && n > 0 ? n : 0;
  };

  return {
    ok: true,
    linha: {
      chave,
      pesoKg,
      alturaCm: medida(colunas.altura),
      larguraCm: medida(colunas.largura),
      comprimentoCm: medida(colunas.comprimento),
    },
  };
}
