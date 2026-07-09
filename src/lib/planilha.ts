// Leitor unificado de planilha: aceita CSV e Excel (.xlsx/.xls).
// Devolve o mesmo formato do parseCsv: { headers, linhas }.

import * as XLSX from "xlsx";
import { parseCsv } from "./csv";

export interface PlanilhaLida {
  headers: string[];
  linhas: Record<string, string>[];
}

function ehExcel(nome: string): boolean {
  return /\.(xlsx|xls|xlsm)$/i.test(nome);
}

/** Lê a primeira aba de um Excel como { headers, linhas } (strings). */
function lerExcel(buf: ArrayBuffer): PlanilhaLida {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], linhas: [] };
  const matriz = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (matriz.length === 0) return { headers: [], linhas: [] };
  const headers = (matriz[0] ?? []).map((h) => String(h).trim());
  const linhas = matriz.slice(1).map((cols) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = String(cols[i] ?? "").trim();
    });
    return rec;
  });
  return { headers, linhas };
}

/** Lê um arquivo CSV ou Excel e devolve { headers, linhas }. */
export async function lerPlanilha(file: File): Promise<PlanilhaLida> {
  if (ehExcel(file.name)) {
    return lerExcel(await file.arrayBuffer());
  }
  return parseCsv(await file.text());
}

/**
 * Devolve o conteúdo como TEXTO CSV — Excel é convertido para CSV. Útil para
 * reaproveitar fluxos que já parseiam CSV em texto (importação da base).
 */
export async function lerPlanilhaComoCsv(file: File): Promise<string> {
  if (!ehExcel(file.name)) return file.text();
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return ws ? XLSX.utils.sheet_to_csv(ws) : "";
}
