// Valores que o catálogo tem e que a validação já recusaria — puro.
//
// NÃO É UM SISTEMA ESTATÍSTICO. Não há média, desvio nem aprendizado aqui: há a
// aplicação das INVARIANTES QUE JÁ EXISTEM sobre o que já está gravado.
//
// A regra veio de um caso concreto: um chinelo de R$ 30 ficou com custo de
// R$ 30.277.872,00 e selo de "confiança alta", porque a coluna que caiu embaixo
// de CUSTO era a REFERÊNCIA do modelo — e a planilha tinha sido LIDA
// corretamente. `pricing/domain/custoDigitado` nasceu para barrar isso na
// entrada; este módulo aplica o mesmo crivo ao que já entrou antes dele existir.
//
// PROCEDÊNCIA NÃO SALVA VALOR. "Veio da planilha" não torna um custo de trinta
// milhões plausível, e "veio do cliente" não torna um custo de zero um fato. Por
// isso a anomalia é registrada como CONFLITO — algo que precisa de decisão
// humana — e não como origem duvidosa.

import { lerCustoDigitado } from "../../pricing/domain/custoDigitado";
import type { ConflitoDeProcedencia } from "./procedenciaDeCampo";
import { procedenciaDesconhecida } from "./procedenciaDeCampo";
import type { ProdutoParaAnalise } from "./pendenciasDoCatalogo";

/**
 * O custo gravado passaria na validação de hoje?
 *
 * `null` quando passa ou quando não há custo — ausência não é anomalia, é
 * pendência, e são coisas diferentes: uma se resolve informando, a outra
 * decidindo.
 *
 * Reusa `lerCustoDigitado` inteiro, inclusive a checagem de referência de
 * modelo, que é a que explica melhor: "esse número está no nome do produto"
 * resolve a dúvida, e "é um milhão de vezes o preço" só assusta.
 */
export function anomaliaDeCusto(p: ProdutoParaAnalise): ConflitoDeProcedencia | null {
  if (!(p.custo > 0)) return null;
  // O valor volta a TEXTO para passar pelo mesmo leitor que a tela usa. Duas
  // implementações da mesma regra divergem no primeiro ajuste — e esta regra em
  // particular já custou caro para ficar certa.
  const veredicto = lerCustoDigitado(String(p.custo).replace(".", ","), {
    precoVenda: p.precoVenda,
    nome: p.nome,
  });
  if (veredicto.estado === "ok" || veredicto.estado === "vazio") return null;

  const motivo = veredicto.estado === "invalido" ? veredicto.motivo : veredicto.motivo;
  return {
    campo: "custo",
    alvo: { tipo: "produto", id: p.id, rotulo: p.nome },
    // UM lado só: não há dois valores em disputa, há um valor que a validação
    // recusa. O tipo é o mesmo porque o desfecho é o mesmo — decisão humana.
    lados: [
      {
        campo: "custo",
        valor: escreverReais(p.custo),
        procedencia: procedenciaDesconhecida(),
      },
    ],
    explicacao: `${escreverReais(p.custo)} de custo em "${p.nome}": ${motivo}`,
  };
}

function escreverReais(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

/**
 * As anomalias do catálogo inteiro.
 *
 * Só custo hoje, e de propósito: é o único campo com invariante de validação
 * pronta e provada. Peso, preço e estoque não têm um `lerCustoDigitado`
 * equivalente, e inventar limiares agora seria a estatística que esta vertical
 * não vai construir.
 */
export function anomaliasDoCatalogo(
  produtos: readonly ProdutoParaAnalise[]
): ConflitoDeProcedencia[] {
  return produtos
    .map(anomaliaDeCusto)
    .filter((a): a is ConflitoDeProcedencia => a !== null);
}
