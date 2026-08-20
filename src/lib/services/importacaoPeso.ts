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
  /**
   * Variações que ganharam SKU porque o EAN alcançou um `Código` único do ERP.
   *
   * Contado separado do peso de propósito: é OUTRA coisa que aconteceu, e uma
   * importação que preenche identidade sem dizer transforma "importei o peso"
   * em uma frase incompleta. Zero é resposta legítima.
   */
  skusPreenchidos: number;
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
  const indexar = (tipo: ColunasPeso["tipoChave"]) => {
    const m = new Map<string, ProdutoVariante[]>();
    for (const v of variantes) {
      const c = chaveDaVariante(v, tipo);
      if (!c) continue;
      const lista = m.get(c);
      if (lista) lista.push(v);
      else m.set(c, [v]);
    }
    return m;
  };
  const porChave = indexar(colunas.tipoChave);
  // A SEGUNDA PORTA, quando a planilha traz as duas colunas.
  //
  // Medido em 18/08/2026: o export de derivação do LINX tem `Código` E `EAN`, e
  // 7 variações desta base ficaram sem peso porque o SKU delas está vazio ou é
  // de teste (`01044525_TEST`) — o EAN estava lá, e o arquivo o conhecia.
  const porAlternativa = colunas.tipoAlternativa ? indexar(colunas.tipoAlternativa) : null;

  // ===========================================================================
  // O CÓDIGO QUE O EAN ALCANÇA — e as duas ambiguidades que o impedem
  // ===========================================================================
  //
  // MEDIDO EM 19/08/2026. Restavam 14 variações sem SKU com estoque real (164
  // pares), e TODAS as 14 tinham código de barras. Cruzado contra este mesmo
  // arquivo: 14 de 14 alcançaram um `Código` do ERP pelo EAN, nenhum ambíguo.
  //
  // O EAN é o código do FABRICANTE. Se ele bate, é fisicamente a mesma peça — e
  // o `Código` daquela linha é o SKU dela. O dado sempre esteve no arquivo; o
  // leitor usava o EAN só para achar a variação e nunca para nomeá-la.
  //
  // DUAS AMBIGUIDADES BLOQUEIAM A ESCRITA, e as duas já morderam esta base:
  //
  //   1. O MESMO EAN EM DUAS LINHAS DO ERP. Aí o arquivo não sabe qual código é
  //      o certo, e a primeira linha venceria por ordem de digitação.
  //
  //   2. O CÓDIGO JÁ EM USO por outra variação. Escrevê-lo criaria a duplicata
  //      que a varredura acusa como o defeito mais grave — 128 SKUs em mais de
  //      uma variação.
  //
  // Nos dois casos não se escreve, e o `sem_sku` continua visível. Pendência é
  // mais honesta que código adivinhado: em 15/08 um casamento frouxo colou
  // códigos de um tênis Molekinha num chinelo Modare.
  const codigosPorEan = new Map<string, Set<string>>();
  if (colunas.tipoAlternativa === "ean") {
    for (const reg of planilha.linhas) {
      const l = lerLinha(reg, colunas);
      if (!l.ok || !l.linha.alternativa || !l.linha.chave) continue;
      const set = codigosPorEan.get(l.linha.alternativa) ?? new Set<string>();
      set.add(l.linha.chave);
      codigosPorEan.set(l.linha.alternativa, set);
    }
  }
  /** SKUs já em uso — o que impede a duplicata nascer aqui. */
  const skusEmUso = new Set(
    variantes.map((v) => (v.sku ?? "").trim()).filter(Boolean)
  );
  let skusPreenchidos = 0;

  const atualizacoes: (Partial<ProdutoVariante> & { id: string })[] = [];
  const produtosTocados = new Set<string>();
  const jaVista = new Set<string>();
  const variantesFeitas = new Set<string>();
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

    // AS DUAS CHAVES SOMAM, e não competem.
    //
    // A primeira versão era "SKU manda; EAN só se o SKU não alcançar". Medido
    // em 18/08/2026, três variações ficaram sem peso por causa disso:
    //
    //   sku 01044525       e  sku 01044525_TEST   → a MESMA peça, duplicada
    //   sem sku, ean 7900377004201                → a linha casou pelo sku de
    //                                               outra variação e parou
    //
    // Uma linha do ERP identifica UM item físico, e as duas chaves apontam
    // para ele. Quando a base tem a mesma peça duas vezes — cadastro de teste,
    // duplicata do ML — as duas variações são aquele item, e as duas recebem.
    //
    // Somar não reintroduz o risco que a ordem evitava: `variantesFeitas`
    // garante que ninguém receba peso duas vezes, e a primeira linha do arquivo
    // continua vencendo.
    const porSku = porChave.get(leitura.linha.chave) ?? [];
    const porEan =
      porAlternativa && leitura.linha.alternativa
        ? (porAlternativa.get(leitura.linha.alternativa) ?? [])
        : [];
    const vistos = new Set<string>();
    const alvos = [...porSku, ...porEan].filter((v) => {
      if (vistos.has(v.id)) return false;
      vistos.add(v.id);
      return true;
    });
    if (alvos.length === 0) {
      naoEncontrados++;
      continue;
    }
    // Chave repetida DENTRO da planilha: a primeira vale. Duas linhas com pesos
    // diferentes para a mesma peça é contradição, e escolher a última seria
    // decidir por ordem de digitação.
    //
    // O espaço da chave entra no identificador: um EAN e um SKU iguais em texto
    // são coisas diferentes, e juntá-los faria uma linha engolir a outra.
    // A marca é a LINHA (as duas chaves juntas), porque agora ela pode atingir
    // alvos pelos dois caminhos ao mesmo tempo.
    const marca = `${leitura.linha.chave}|${leitura.linha.alternativa}`;
    if (jaVista.has(marca)) continue;
    jaVista.add(marca);

    const { pesoKg, alturaCm, larguraCm, comprimentoCm } = leitura.linha;
    const temTresMedidas = alturaCm > 0 && larguraCm > 0 && comprimentoCm > 0;
    if (temTresMedidas) comMedidas++;

    for (const v of alvos) {
      // Uma variação recebe peso UMA vez. Sem isto, a que casa pelas duas
      // chaves entraria duas vezes no lote — e se as duas linhas trouxessem
      // pesos diferentes, venceria a ordem do arquivo.
      if (variantesFeitas.has(v.id)) continue;
      variantesFeitas.add(v.id);
      // Payload PARCIAL: só o que a operação quer mudar. Mandar a linha inteira
      // acopla a gravação a TODAS as colunas — foi assim que uma importação de
      // custos morreu por causa de um campo que ela nem queria tocar.
      const dados: Partial<ProdutoVariante> & { id: string } = { id: v.id, peso: pesoKg };
      // Medida ausente não sobrescreve o que já existe com 0: apagar dado bom
      // seria pior que não trazer dado novo.
      if (alturaCm > 0) dados.altura = alturaCm;
      if (larguraCm > 0) dados.largura = larguraCm;
      if (comprimentoCm > 0) dados.comprimento = comprimentoCm;
      // O EAN QUE JÁ ESTAVA NO ARQUIVO — e que era lido e descartado.
      //
      // MEDIDO EM 19/08/2026. A base tinha 160 variações sem código de barras,
      // e o assistente dizia à lojista "preciso dos 160 EANs". O arquivo que
      // ela já tinha mandado trazia 107 deles: esta função usava a coluna EAN
      // como CHAVE de casamento e depois jogava o valor fora, gravando só o
      // peso.
      //
      // É o defeito que este repositório persegue há semanas — o dado chega e
      // é descartado na borda — cometido aqui em uma linha que faltava.
      //
      // Só preenche VAZIO. Sobrescrever um EAN existente com o do arquivo
      // trocaria o que a lojista conferiu por um valor não auditado, e o EAN é
      // a chave que este mesmo módulo usa para casar: mudá-lo por baixo mudaria
      // o alvo das próximas importações.
      if (!(v.ean ?? "").trim() && leitura.linha.alternativa) {
        dados.ean = leitura.linha.alternativa;
      }
      // O SKU, quando o EAN alcança um código ÚNICO e livre. Ver o bloco de
      // `codigosPorEan` acima para as duas ambiguidades que bloqueiam.
      if (!(v.sku ?? "").trim() && leitura.linha.alternativa && leitura.linha.chave) {
        const candidatos = codigosPorEan.get(leitura.linha.alternativa);
        const unico = candidatos && candidatos.size === 1;
        if (unico && !skusEmUso.has(leitura.linha.chave)) {
          dados.sku = leitura.linha.chave;
          // Dentro do MESMO lote também: duas variações sem SKU com o mesmo EAN
          // receberiam o mesmo código, e a duplicata nasceria aqui.
          skusEmUso.add(leitura.linha.chave);
          skusPreenchidos++;
        }
      }
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
    skusPreenchidos,
    unidade: colunas.unidade,
    chave: colunas.tipoChave,
    ...(avisos.length > 0 ? { aviso: avisos.join(" ") } : {}),
  };
}

function temAlgumValor(registro: Record<string, string>): boolean {
  return Object.values(registro).some((v) => (v ?? "").trim() !== "");
}
