// Importação de PESO E MEDIDAS por planilha.
//
// Sem peso o frete do ML não sai da tabela, e sem frete não existe preço
// mínimo: `precoMinimo` devolve { ok: false, motivo: "sem_peso" } e a tela
// mostra pendência. Medido na base do primeiro lojista: 0 de 3.085 variantes
// tinham peso — a calculadora estava correta e muda por falta de entrada.
//
// A decisão de leitura (unidade obrigatória no cabeçalho, casamento exato por
// SKU/EAN) vive no módulo puro `modules/catalog/domain/importacaoPeso`. Aqui
// mora só o que toca o banco: casar as chaves e gravar.
//
// Diferente da importação de custos, NÃO existe casamento por nome. Aquela
// tentou ser prestativa e atribuiu o custo de um sapato a outro modelo da mesma
// marca. Peso errado tem a mesma consequência — preço errado — e a mesma cara
// de acerto. Aqui a chave bate ou a linha é reportada.

import type { PlanilhaLida } from "../planilha";
import {
  detectarColunas,
  lerLinha,
  normalizarChave,
  type ColunasPeso,
  type MotivoRecusa,
} from "../../modules/catalog/domain/importacaoPeso";
import { listarTodasVariantes, atualizarVariantesBulk } from "./produtoVariantes";
import type { ProdutoVariante } from "../types";

export interface ResultadoPeso {
  /** Linhas úteis da planilha (fora o cabeçalho). */
  linhasCsv: number;
  /** Variantes que receberam peso. */
  variantes: number;
  /** Produtos distintos que passaram a ter peso — os que destravam o preço. */
  produtos: number;
  /** Linhas cuja chave não existe na base. */
  naoEncontrados: number;
  /** Linhas sem peso utilizável (vazio, zero, texto). */
  semPeso: number;
  /** Quantas também trouxeram as três medidas (habilita a cubagem). */
  comMedidas: number;
  unidade: "kg" | "g";
  chave: "sku" | "ean";
  aviso?: string;
}

export class PlanilhaDePesoInvalida extends Error {
  readonly motivo: MotivoRecusa;
  constructor(motivo: MotivoRecusa, mensagem: string) {
    super(mensagem);
    this.name = "PlanilhaDePesoInvalida";
    this.motivo = motivo;
  }
}

/** A chave da variante, do jeito que a planilha a encontraria. */
function chaveDaVariante(v: ProdutoVariante, tipo: ColunasPeso["tipoChave"]): string {
  return normalizarChave(tipo === "sku" ? v.sku : v.ean);
}

export async function importarPeso(
  clienteId: string,
  planilha: PlanilhaLida
): Promise<ResultadoPeso> {
  const deteccao = detectarColunas(planilha.headers);
  if (!deteccao.ok) throw new PlanilhaDePesoInvalida(deteccao.motivo, deteccao.mensagem);
  const colunas = deteccao.colunas;

  const variantes = (await listarTodasVariantes()).filter((v) => v.clienteId === clienteId);

  // Uma chave pode aparecer em mais de uma variante (SKU repetido no ERP).
  // Todas recebem o peso: são a mesma peça física.
  const porChave = new Map<string, ProdutoVariante[]>();
  for (const v of variantes) {
    const c = chaveDaVariante(v, colunas.tipoChave);
    if (!c) continue;
    const lista = porChave.get(c);
    if (lista) lista.push(v);
    else porChave.set(c, [v]);
  }

  const atualizacoes: (Partial<ProdutoVariante> & { id: string })[] = [];
  const produtosTocados = new Set<string>();
  const jaVista = new Set<string>();
  let linhasCsv = 0;
  let naoEncontrados = 0;
  let semPeso = 0;
  let comMedidas = 0;

  for (const registro of planilha.linhas) {
    const leitura = lerLinha(registro, colunas);
    if (!leitura.ok) {
      // Linha completamente vazia não é erro do lojista — é o fim da planilha.
      if (leitura.motivo === "sem_chave" && !temAlgumValor(registro)) continue;
      linhasCsv++;
      if (leitura.motivo === "sem_peso") semPeso++;
      else naoEncontrados++;
      continue;
    }
    linhasCsv++;

    const alvos = porChave.get(leitura.linha.chave);
    if (!alvos || alvos.length === 0) {
      naoEncontrados++;
      continue;
    }
    // Chave repetida DENTRO da planilha: a primeira vale. Duas linhas com pesos
    // diferentes para a mesma peça é contradição, e escolher a última seria
    // decidir por ordem de digitação.
    if (jaVista.has(leitura.linha.chave)) continue;
    jaVista.add(leitura.linha.chave);

    const { pesoKg, alturaCm, larguraCm, comprimentoCm } = leitura.linha;
    const temTresMedidas = alturaCm > 0 && larguraCm > 0 && comprimentoCm > 0;
    if (temTresMedidas) comMedidas++;

    for (const v of alvos) {
      // Payload PARCIAL: só o que a operação quer mudar. Mandar a linha inteira
      // acopla a gravação a TODAS as colunas — foi assim que uma importação de
      // custos morreu por causa de um campo que ela nem queria tocar.
      const dados: Partial<ProdutoVariante> & { id: string } = { id: v.id, peso: pesoKg };
      // Medida ausente não sobrescreve o que já existe com 0: apagar dado bom
      // seria pior que não trazer dado novo.
      if (alturaCm > 0) dados.altura = alturaCm;
      if (larguraCm > 0) dados.largura = larguraCm;
      if (comprimentoCm > 0) dados.comprimento = comprimentoCm;
      atualizacoes.push(dados);
      produtosTocados.add(v.produtoId);
    }
  }

  if (atualizacoes.length > 0) await atualizarVariantesBulk(atualizacoes);

  const avisos: string[] = [];
  if (colunas.unidade === "g") {
    avisos.push('A coluna de peso estava em gramas e foi convertida para quilos.');
  }
  if (comMedidas === 0 && atualizacoes.length > 0) {
    avisos.push(
      "Nenhuma linha trouxe altura, largura e comprimento juntos — o frete usa o peso real, " +
        "sem cubagem. Se as caixas forem grandes e leves, o ML cobra pelo volume e o preço mínimo " +
        "sai abaixo do que se paga."
    );
  }

  return {
    linhasCsv,
    variantes: atualizacoes.length,
    produtos: produtosTocados.size,
    naoEncontrados,
    semPeso,
    comMedidas,
    unidade: colunas.unidade,
    chave: colunas.tipoChave,
    ...(avisos.length > 0 ? { aviso: avisos.join(" ") } : {}),
  };
}

function temAlgumValor(registro: Record<string, string>): boolean {
  return Object.values(registro).some((v) => (v ?? "").trim() !== "");
}
