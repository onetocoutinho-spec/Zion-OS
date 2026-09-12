// O peso que a planilha diz, e que o resto da planilha desmente.
//
// ===========================================================================
// MEDIDO EM 26/08/2026, NO PERCURSO DO T1
// ===========================================================================
//
// A importação passou a trazer peso — 6973 variações de uma exportação real de
// ERP. A distribuição:
//
//     6944  entre 50 g e 5 kg      mediana 450 g — coerente com calçado
//       18  abaixo de 50 g
//        1  entre 5 e 30 kg
//       10  ACIMA DE 100 kg        máximo exatamente 800,000
//
// 800,000 num campo cujo cabeçalho diz "Peso (kg)" é a assinatura de GRAMA
// DIGITADA EM COLUNA DE QUILO: 800 g virou 800 kg. O importador está certo —
// gravou o que a planilha disse. Quem está errado é a planilha, e ninguém
// olhava.
//
// O custo não é cosmético: sem peso não há frete, e com peso errado o frete
// sai errado. `prontidaoDaLoja` trata peso ausente como bloqueio justamente
// porque a precificação inteira depende dele — e um peso absurdo é pior que
// ausente, porque ausente ninguém confunde com verdade.
//
// ===========================================================================
// POR QUE A RÉGUA É A PRÓPRIA PLANILHA
// ===========================================================================
//
// A tentação é cravar um teto — "acima de 30 kg é suspeito". Seria inventar
// regra de marketplace que ninguém mediu, e quebraria no dia em que a loja
// vender sofá.
//
// A régua aqui é a MEDIANA DO PRÓPRIO ARQUIVO. Um valor cem vezes acima do
// meio da distribuição não é um produto pesado no meio de produtos leves: é
// outra unidade. E quando esse valor dividido por mil cai de volta perto da
// mediana, a suspeita ganha nome — grama em coluna de quilo.
//
// Catálogo de sofá tem mediana de sofá, e o mesmo teste continua valendo.
//
// ===========================================================================
// O QUE ELE NÃO FAZ, E É DECISÃO
// ===========================================================================
//
// **Não corrige.** Dividir por mil o que "parece grama" seria inventar dado —
// exatamente o que produziu 87 custos falsos e o estrago de R$ 30 milhões que
// a migração 031 teve de desfazer.
//
// **Não bloqueia.** Um catálogo pode legitimamente ter uma peça muito mais
// pesada que as outras. Barrar por indício transformaria aviso em parede, e
// parede falsa ensina a ignorar aviso.
//
// É o mesmo desenho de `ehReferenciaDisfarcada`, que sinaliza o custo que
// parece código de modelo e deixa a decisão com quem sabe.

/** Quantos pesos são precisos para uma mediana significar alguma coisa. */
const MINIMO_PARA_TER_REGUA = 20;

/** Quantas vezes acima da mediana um valor precisa estar para virar suspeita. */
const FATOR_ALTO = 100;

/** E quantas vezes abaixo. */
const FATOR_BAIXO = 100;

export type MotivoDoPeso = "parece_grama" | "muito_acima" | "muito_abaixo";

export interface PesoSuspeito {
  /** Como identificar a linha na planilha: o SKU da variação, quando existe. */
  sku: string;
  /** O valor como ele foi lido, em quilos. */
  pesoKg: number;
  motivo: MotivoDoPeso;
}

export interface AvisoDePeso {
  /** A mediana que serviu de régua, em quilos. */
  medianaKg: number;
  /** Quantos pesos entraram na conta. */
  avaliados: number;
  suspeitos: readonly PesoSuspeito[];
  /** A frase da tela: diz o que fazer, não só o que houve. */
  texto: string;
}

/** A mediana dos positivos. Sem cópia mutável do que veio de fora. */
function mediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[meio - 1] + ordenados[meio]) / 2
    : ordenados[meio];
}

/** Formata em kg ou g, o que for legível — 0.45 vira "450 g", 800 vira "800 kg". */
function comoTexto(kg: number): string {
  return kg < 1 ? `${Math.round(kg * 1000)} g` : `${Number(kg.toFixed(3))} kg`;
}

/**
 * Os pesos que o resto da planilha desmente. `null` quando não há o que dizer.
 *
 * `null` em dois casos, cada um por um motivo: pesos de menos para haver régua
 * (a mediana de três números não descreve distribuição nenhuma), ou nenhum
 * valor fora dela — que é o desfecho normal e não merece ruído na tela.
 */
export function avisoDePesoImplausivel(
  variacoes: readonly { sku?: string; pesoKg?: number }[]
): AvisoDePeso | null {
  const comPeso = variacoes.filter(
    (v): v is { sku?: string; pesoKg: number } =>
      typeof v.pesoKg === "number" && Number.isFinite(v.pesoKg) && v.pesoKg > 0
  );
  if (comPeso.length < MINIMO_PARA_TER_REGUA) return null;

  const med = mediana(comPeso.map((v) => v.pesoKg));
  if (med <= 0) return null;

  const tetoAlto = med * FATOR_ALTO;
  const pisoBaixo = med / FATOR_BAIXO;

  const suspeitos: PesoSuspeito[] = [];
  for (const v of comPeso) {
    if (v.pesoKg >= tetoAlto) {
      // Se dividir por mil traz o valor de volta para perto da mediana, o que
      // se está olhando é a mesma balança em outra unidade.
      const emGramas = v.pesoKg / 1000;
      const motivo: MotivoDoPeso =
        emGramas >= pisoBaixo && emGramas <= tetoAlto ? "parece_grama" : "muito_acima";
      suspeitos.push({ sku: v.sku ?? "", pesoKg: v.pesoKg, motivo });
    } else if (v.pesoKg <= pisoBaixo) {
      suspeitos.push({ sku: v.sku ?? "", pesoKg: v.pesoKg, motivo: "muito_abaixo" });
    }
  }

  if (suspeitos.length === 0) return null;

  const grama = suspeitos.filter((s) => s.motivo === "parece_grama").length;
  const maior = suspeitos.reduce((a, b) => (b.pesoKg > a.pesoKg ? b : a));

  const texto =
    `${suspeitos.length} de ${comPeso.length} pesos destoam do resto da planilha, ` +
    `cuja mediana é ${comoTexto(med)}. O maior é ${comoTexto(maior.pesoKg)}` +
    (maior.sku ? ` (${maior.sku})` : "") +
    "." +
    (grama > 0
      ? ` ${grama} deles fazem sentido se forem GRAMAS numa coluna declarada em quilos — ` +
        "nesse caso o cabeçalho da planilha precisa dizer g, e a importação converte."
      : "") +
    " Sem peso certo o frete sai errado, e o preço mínimo vai junto. " +
    "Nada foi alterado: confira na origem antes de importar.";

  return { medianaKg: med, avaliados: comPeso.length, suspeitos, texto };
}
