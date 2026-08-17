// Leitor unificado de planilha: aceita CSV e Excel (.xlsx/.xls).
// Devolve o mesmo formato do parseCsv: { headers, linhas }.
//
// ATÉ 17/08/2026 ELE ASSUMIA DUAS COISAS, e as duas estavam erradas no mesmo
// arquivo real: que a tabela está na PRIMEIRA aba, e que o cabeçalho é a
// PRIMEIRA linha. Quem procura agora é `tabelasDaPlanilha`, no domínio, e é lá
// que está escrito o caso que produziu a mudança.

import * as XLSX from "xlsx";
import { parseCsv, matrizDoCsv } from "./csv";
import { decodificarTexto } from "./textoDeArquivo";
import {
  acharTabelas,
  tabelaPadrao,
  type AbaCrua,
  type TabelaDaPlanilha,
} from "../modules/catalog/domain/tabelasDaPlanilha";

export interface PlanilhaLida {
  headers: string[];
  linhas: Record<string, string>[];
  /**
   * De ONDE saiu esta tabela dentro do arquivo.
   *
   * Presente sempre que o leitor teve que escolher. A tela mostra — porque um
   * leitor que escolhe em silêncio é a mesma coisa que um leitor que adivinha,
   * e este repo já pagou caro por isso na coluna de custo.
   */
  origem?: { aba: string; linhaDoCabecalho: number };
  /**
   * TODAS as tabelas do arquivo, quando há mais de uma — inclusive a aberta.
   *
   * Existe para a tela poder trocar. Aquele arquivo tem sete abas e mais de uma
   * tabela de custo legítima; abrir uma e não dizer que há outras gravaria
   * metade do que a lojista mandou sem ela saber qual metade.
   */
  tabelas?: TabelaDaPlanilha[];
}

function ehExcel(nome: string): boolean {
  return /\.(xlsx|xls|xlsm)$/i.test(nome);
}

/** As abas do arquivo como matrizes de texto. */
function abasDoExcel(buf: ArrayBuffer): AbaCrua[] {
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((nome) => {
    const ws = wb.Sheets[nome];
    const matriz = ws
      ? XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
          header: 1,
          blankrows: false,
          defval: "",
        })
      : [];
    return { nome, matriz: matriz.map((linha) => linha.map((c) => String(c ?? ""))) };
  });
}

/** Empacota a tabela escolhida no formato que as telas já consomem. */
function comoPlanilha(escolhida: TabelaDaPlanilha, todas: TabelaDaPlanilha[]): PlanilhaLida {
  return {
    headers: escolhida.headers,
    linhas: escolhida.linhas,
    origem: { aba: escolhida.aba, linhaDoCabecalho: escolhida.linhaDoCabecalho },
    ...(todas.length > 1 ? { tabelas: todas } : {}),
  };
}

/**
 * Lê o CSV com o encoding CERTO.
 *
 * `file.text()` decodifica sempre como UTF-8, e o Excel no Windows exporta em
 * Windows-1252 — foi assim que 470 produtos entraram com "T?nis" no lugar de
 * "Tênis", e esse nome corrompido vai direto para o título do anúncio.
 * Ver src/lib/textoDeArquivo.ts.
 */
async function lerCsvComEncoding(file: File): Promise<string> {
  return decodificarTexto(await file.arrayBuffer()).texto;
}

/** Lê um arquivo CSV ou Excel e devolve { headers, linhas }. */
export async function lerPlanilha(file: File): Promise<PlanilhaLida> {
  const abas: AbaCrua[] = ehExcel(file.name)
    ? abasDoExcel(await file.arrayBuffer())
    // O CSV entra pela MESMA porta, com uma aba só. Dois leitores com regras
    // diferentes divergiriam em silêncio, e a lojista que salva a aba como CSV
    // para "facilitar" cairia num caminho pior que o do arquivo original.
    : [{ nome: file.name, matriz: matrizDoCsv(await lerCsvComEncoding(file)) }];

  const escolhida = tabelaPadrao(abas);
  if (!escolhida) return { headers: [], linhas: [] };
  return comoPlanilha(escolhida, acharTabelas(abas));
}

/**
 * Troca a tabela aberta por outra do MESMO arquivo, sem reler nada.
 *
 * As tabelas já vieram inteiras em `tabelas`; reabrir o arquivo exigiria que a
 * tela guardasse o `File`, e a tela guarda a planilha lida. Pura de propósito.
 */
export function trocarTabela(planilha: PlanilhaLida, aba: string, linhaDoCabecalho: number): PlanilhaLida {
  const alvo = (planilha.tabelas ?? []).find(
    (t) => t.aba === aba && t.linhaDoCabecalho === linhaDoCabecalho
  );
  if (!alvo) return planilha;
  return comoPlanilha(alvo, planilha.tabelas ?? []);
}

/**
 * Devolve o conteúdo como TEXTO CSV — Excel é convertido para CSV. Útil para
 * reaproveitar fluxos que já parseiam CSV em texto (importação da base).
 *
 * CONTINUA NA PRIMEIRA ABA, e é de propósito: quem chama isto é
 * `analisarProdutosCsv`, que precisa do texto CRU para agrupar variações e
 * preservar vírgula dentro de campo. Recortar a tabela aqui devolveria um CSV
 * remontado, e uma vírgula perdida vira produto com nome cortado. Um catálogo
 * em .xlsx de várias abas segue recusado com instrução, não lido pela metade.
 */
export async function lerPlanilhaComoCsv(file: File): Promise<string> {
  if (!ehExcel(file.name)) return lerCsvComEncoding(file);
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return ws ? XLSX.utils.sheet_to_csv(ws) : "";
}
