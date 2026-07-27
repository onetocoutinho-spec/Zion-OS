// Tabela OFICIAL de custos de envio do Mercado Livre — dado, não regra.
//
// Fonte (consultada em 27/07/2026):
//   verde/MercadoLíder/sem reputação → mercadolivre.com.br/ajuda/40538
//   amarela                          → mercadolivre.com.br/ajuda/40545
//   laranja ou vermelha              → mercadolivre.com.br/ajuda/40547
//
// ⚠️ DUAS COISAS QUE ESTA TABELA DESMENTE:
//
// 1. O custo de envio incide em TODAS as vendas, não só acima de R$ 79.
//    A página é explícita: "se aplica a todas as vendas, mesmo que o comprador
//    pague pelo envio". Abaixo de R$ 79 ele é pequeno (R$ 5,65 a R$ 9,75 para
//    itens leves), mas existe. O que muda no limiar é QUEM oferece o frete
//    grátis — de R$ 19 a R$ 78,99 é o ML, a partir de R$ 79 é o vendedor —
//    e é por isso que a coluna dá um salto ali.
//
// 2. Não é uma tabela por peso: é uma MATRIZ peso × faixa de preço.
//    Um item de 300 g custa R$ 5,65 se for vendido a R$ 15 e R$ 20,95 se for
//    vendido a R$ 250. O preço entra duas vezes na conta do lojista: pela
//    comissão e por aqui.
//
// A reputação é um multiplicador embutido: os valores JÁ incluem o desconto
// (50% em verde, 40% em amarela, nenhum em laranja/vermelha). Por isso são três
// tabelas inteiras e não uma tabela com um fator — o desconto não se aplica de
// forma uniforme entre as faixas.

/** As três faixas de reputação que o ML usa para o custo de envio. */
export type ReputacaoEnvio = "verde" | "amarela" | "laranja";

/**
 * Vendedor SEM reputação usa a tabela verde — é a regra do próprio ML
 * ("MercadoLíderes, com reputação verde ou sem reputação"). Quem está começando
 * paga o mesmo que o melhor vendedor.
 */
export const REPUTACAO_PADRAO: ReputacaoEnvio = "verde";

export const ROTULO_REPUTACAO: Record<ReputacaoEnvio, string> = {
  verde: "Verde, MercadoLíder ou sem reputação (50% de desconto)",
  amarela: "Amarela (40% de desconto)",
  laranja: "Laranja ou vermelha (sem desconto)",
};

/**
 * Traduz o `seller_reputation` da API do ML na tabela de envio que vale. PURO.
 *
 * `level_id` vem como "5_green", "4_light_green", "3_yellow", "2_orange" ou
 * "1_red". `power_seller_status` (silver/gold/platinum) marca MercadoLíder, que
 * entra na faixa verde qualquer que seja a cor.
 *
 * Ausência de reputação → verde, por regra do próprio ML: a página de custos
 * agrupa "MercadoLíderes, com reputação verde OU SEM REPUTAÇÃO".
 *
 * ⚠️ Usa `level_id`, não `real_level`. Vendedor em período de proteção exibe
 * level_id melhor que o real (na doc: level_id "5_green" com real_level "red"),
 * e o desconto de frete acompanha o nível EXIBIDO — é o benefício da proteção.
 * Se algum dia se confirmar o contrário, é aqui que muda.
 */
export function reputacaoDoLevelId(
  levelId: string | null | undefined,
  powerSellerStatus?: string | null
): ReputacaoEnvio {
  if (powerSellerStatus) return "verde"; // MercadoLíder, qualquer medalha
  const nivel = (levelId ?? "").trim().toLowerCase();
  if (!nivel) return "verde"; // sem reputação ainda
  if (nivel.includes("green")) return "verde"; // 5_green e 4_light_green
  if (nivel.includes("yellow")) return "amarela";
  if (nivel.includes("orange") || nivel.includes("red")) return "laranja";
  // Nível desconhecido (o ML mudou a nomenclatura): a escolha conservadora é a
  // tabela mais CARA, para o piso nunca ficar abaixo do custo real.
  return "laranja";
}

/** Teto de cada faixa de peso, em GRAMAS. A última é aberta. */
export const TETOS_PESO_G: readonly number[] = [
  300, 500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 11000,
  13000, 15000, 17000, 20000, 25000, 30000, 40000, 50000, 60000, 70000, 80000,
  90000, 100000, 125000, 150000, Infinity,
];

/** Teto de cada faixa de PREÇO, em reais. A última é aberta. */
export const TETOS_PRECO: readonly number[] = [
  18.99, 48.99, 78.99, 99.99, 119.99, 149.99, 199.99, Infinity,
];

/**
 * Preço abaixo do qual o custo de envio é limitado a metade do preço.
 * Rodapé da tabela: "Os produtos de menos de R$ 19 pagam no máximo metade do
 * preço do produto."
 */
export const PRECO_TETO_METADE = 19;

/** [faixa de peso][faixa de preço] → custo em reais. */
type Matriz = readonly (readonly number[])[];

const VERDE: Matriz = [
  [5.65, 6.55, 7.75, 12.35, 14.35, 16.45, 18.45, 20.95],
  [5.95, 6.65, 7.85, 13.25, 15.45, 17.65, 19.85, 22.55],
  [6.05, 6.75, 7.95, 13.85, 16.15, 18.45, 20.75, 23.65],
  [6.15, 6.85, 8.05, 14.15, 16.45, 18.85, 21.15, 24.65],
  [6.25, 6.95, 8.15, 14.45, 16.85, 19.25, 21.65, 24.65],
  [6.35, 7.95, 8.55, 15.75, 18.35, 21.05, 23.65, 26.25],
  [6.45, 8.15, 8.95, 17.05, 19.85, 22.65, 25.55, 28.35],
  [6.55, 8.35, 9.75, 18.45, 21.55, 24.65, 27.75, 30.75],
  [6.65, 8.55, 9.95, 25.45, 28.55, 32.65, 35.75, 39.75],
  [6.75, 8.75, 10.15, 27.05, 31.05, 36.05, 40.05, 44.05],
  [6.85, 8.95, 10.35, 28.85, 33.65, 38.45, 43.25, 48.05],
  [6.95, 9.15, 10.55, 29.65, 34.55, 39.55, 44.45, 49.35],
  [7.05, 9.55, 10.95, 41.25, 48.05, 54.95, 61.75, 68.65],
  [7.15, 9.95, 11.35, 42.15, 49.25, 56.25, 63.25, 70.25],
  [7.25, 10.15, 11.55, 45.05, 52.45, 59.95, 67.45, 74.95],
  [7.35, 10.35, 11.75, 48.55, 56.05, 63.55, 70.75, 78.65],
  [7.45, 10.55, 11.95, 54.75, 63.85, 72.95, 82.05, 91.15],
  [7.65, 10.95, 12.15, 64.05, 75.05, 84.75, 95.35, 105.95],
  [7.75, 11.15, 12.35, 65.95, 75.45, 85.55, 96.25, 106.95],
  [7.85, 11.35, 12.55, 67.75, 78.95, 88.95, 99.15, 107.05],
  [7.95, 11.55, 12.75, 70.25, 81.05, 92.05, 102.55, 110.75],
  [8.05, 11.75, 12.95, 74.95, 86.45, 98.15, 109.35, 118.15],
  [8.15, 11.95, 13.15, 80.25, 92.95, 105.05, 117.15, 126.55],
  [8.25, 12.15, 13.35, 83.95, 97.05, 109.85, 122.45, 132.25],
  [8.35, 12.35, 13.55, 93.25, 107.45, 122.05, 136.05, 146.95],
  [8.45, 12.55, 13.75, 106.55, 123.95, 139.55, 155.55, 167.95],
  [8.55, 12.75, 13.95, 119.25, 138.05, 156.05, 173.95, 187.95],
  [8.65, 12.75, 14.15, 126.55, 146.15, 165.65, 184.65, 199.45],
  [8.75, 12.95, 14.35, 166.15, 192.45, 217.55, 242.55, 261.95],
];

const AMARELA: Matriz = [
  [6.46, 7.49, 8.86, 14.82, 17.22, 19.74, 22.14, 25.14],
  [6.8, 7.6, 8.97, 15.9, 18.54, 21.18, 23.82, 27.06],
  [6.91, 7.71, 9.09, 16.62, 19.38, 22.14, 24.9, 28.38],
  [7.03, 7.83, 9.2, 16.98, 19.74, 22.62, 25.38, 29.58],
  [7.14, 7.94, 9.31, 17.34, 20.22, 23.1, 25.98, 29.58],
  [7.26, 9.09, 9.77, 18.9, 22.02, 25.26, 28.38, 31.5],
  [7.37, 9.31, 10.23, 20.46, 23.82, 27.18, 30.66, 34.02],
  [7.49, 9.54, 11.14, 22.14, 25.86, 29.58, 33.3, 36.9],
  [7.6, 9.77, 11.37, 30.54, 34.26, 39.18, 42.9, 47.7],
  [7.71, 10, 11.6, 32.46, 37.26, 43.26, 48.06, 52.86],
  [7.83, 10.23, 11.83, 34.62, 40.38, 46.14, 51.9, 57.66],
  [7.94, 10.46, 12.06, 35.58, 41.46, 47.46, 53.34, 59.22],
  [8.06, 10.91, 12.51, 49.5, 57.66, 65.94, 74.1, 82.38],
  [8.17, 11.37, 12.97, 50.58, 59.1, 67.5, 75.9, 84.3],
  [8.29, 11.6, 13.2, 54.06, 62.94, 71.94, 80.94, 89.94],
  [8.4, 11.83, 13.43, 58.26, 67.26, 76.26, 84.9, 94.38],
  [8.51, 12.06, 13.66, 65.7, 76.62, 87.54, 98.46, 109.38],
  [8.74, 12.51, 13.89, 76.86, 90.06, 101.7, 114.42, 127.14],
  [8.86, 12.74, 14.11, 79.14, 90.54, 102.66, 115.5, 128.34],
  [8.97, 12.97, 14.34, 81.3, 94.74, 106.74, 118.98, 128.46],
  [9.09, 13.2, 14.57, 84.3, 97.26, 110.46, 123.06, 132.9],
  [9.2, 13.43, 14.8, 89.94, 103.74, 117.78, 131.22, 141.78],
  [9.31, 13.66, 15.03, 96.3, 111.54, 126.06, 140.58, 151.86],
  [9.43, 13.89, 15.26, 100.74, 116.46, 131.82, 146.94, 158.7],
  [9.54, 14.11, 15.49, 111.9, 128.94, 146.46, 163.26, 176.34],
  [9.66, 14.34, 15.71, 127.86, 148.74, 167.46, 186.66, 201.54],
  [9.77, 14.57, 15.94, 143.1, 165.66, 187.26, 208.74, 225.54],
  [9.89, 14.57, 16.17, 151.86, 175.38, 198.78, 221.58, 239.34],
  [10, 14.57, 16.4, 199.38, 230.94, 261.06, 291.06, 314.34],
];

const LARANJA: Matriz = [
  [8.07, 9.36, 11.07, 24.7, 28.7, 32.9, 36.9, 41.9],
  [8.5, 9.5, 11.21, 26.5, 30.9, 35.3, 39.7, 45.1],
  [8.64, 9.64, 11.36, 27.7, 32.3, 36.9, 41.5, 47.3],
  [8.79, 9.79, 11.5, 28.3, 32.9, 37.7, 42.3, 49.3],
  [8.93, 9.93, 11.64, 28.9, 33.7, 38.5, 43.3, 49.3],
  [9.07, 11.36, 12.21, 31.5, 36.7, 42.1, 47.3, 52.5],
  [9.21, 11.64, 12.79, 34.1, 39.7, 45.3, 51.1, 56.7],
  [9.36, 11.93, 13.93, 36.9, 43.1, 49.3, 55.5, 61.5],
  [9.5, 12.21, 14.21, 50.9, 57.1, 65.3, 71.5, 79.5],
  [9.64, 12.5, 14.5, 54.1, 62.1, 72.1, 80.1, 88.1],
  [9.79, 12.79, 14.79, 57.7, 67.3, 76.9, 86.5, 96.1],
  [9.93, 13.07, 15.07, 59.3, 69.1, 79.1, 88.9, 98.7],
  [10.07, 13.64, 15.64, 82.5, 96.1, 109.9, 123.5, 137.3],
  [10.21, 14.21, 16.21, 84.3, 98.5, 112.5, 126.5, 140.5],
  [10.36, 14.5, 16.5, 90.1, 104.9, 119.9, 134.9, 149.9],
  [10.5, 14.79, 16.79, 97.1, 112.1, 127.1, 141.5, 157.3],
  [10.64, 15.07, 17.07, 109.5, 127.7, 145.9, 164.1, 182.3],
  [10.93, 15.64, 17.36, 128.1, 150.1, 169.5, 190.7, 211.9],
  [11.07, 15.93, 17.64, 131.9, 150.9, 171.1, 192.5, 213.9],
  [11.21, 16.21, 17.93, 135.5, 157.9, 177.9, 198.3, 214.1],
  [11.36, 16.5, 18.21, 140.5, 162.1, 184.1, 205.1, 221.5],
  [11.5, 16.79, 18.5, 149.9, 172.9, 196.3, 218.7, 236.3],
  [11.64, 17.07, 18.79, 160.5, 185.9, 210.1, 234.3, 253.1],
  [11.79, 17.36, 19.07, 167.9, 194.1, 219.7, 244.9, 264.5],
  [11.93, 17.64, 19.36, 186.5, 214.9, 244.1, 272.1, 293.9],
  [12.07, 17.93, 19.64, 213.1, 247.9, 279.1, 311.1, 335.9],
  [12.21, 18.21, 19.93, 238.5, 276.1, 312.1, 347.9, 375.9],
  [12.36, 18.21, 20.21, 253.1, 292.3, 331.3, 369.3, 398.9],
  [12.5, 18.21, 20.5, 332.3, 384.9, 435.1, 485.1, 523.9],
];

export const TABELA_ENVIO: Record<ReputacaoEnvio, Matriz> = {
  verde: VERDE,
  amarela: AMARELA,
  laranja: LARANJA,
};
