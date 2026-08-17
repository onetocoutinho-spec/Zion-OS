// Parser de CSV puro (sem dependências). Lida com:
//  - aspas e aspas escapadas ("" dentro de campo entre aspas)
//  - quebras de linha DENTRO de campos entre aspas
//  - delimitador , ou ; ou TAB (detecção automática)
// Usado pela importação de bases de anúncios (Auditoria em Massa).

export interface CsvParsed {
  headers: string[];
  linhas: Record<string, string>[];
}

/** Descobre o delimitador olhando a primeira linha. Excel BR costuma usar ";". */
export function detectarDelimitador(texto: string): "," | ";" | "\t" {
  const primeira = (texto.split(/\r?\n/)[0] ?? "");
  const conta = (d: string) => (primeira.match(new RegExp(`\\${d}`, "g")) ?? []).length;
  const ponto = conta(";");
  const tab = (primeira.match(/\t/g) ?? []).length;
  const virgula = conta(",");
  if (ponto >= virgula && ponto >= tab) return ";";
  if (tab > virgula) return "\t";
  return ",";
}

/**
 * O CSV como matriz de células, antes de qualquer linha virar cabeçalho.
 *
 * Exposta para o leitor de planilha poder PROCURAR onde está o cabeçalho, em
 * vez de assumir a primeira linha. Um CSV exportado de uma aba de relatório
 * carrega o título e a procedência em cima da tabela, igualzinho ao Excel de
 * onde ele saiu — e assumir a linha 1 ali dá o mesmo "não achei coluna de
 * custo" sobre um arquivo cheio de custo.
 */
export function matrizDoCsv(texto: string, delimitador?: string): string[][] {
  return dividirEmCampos(texto, delimitador ?? detectarDelimitador(texto));
}

function dividirEmCampos(texto: string, delim: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentroAspas = false;
  const t = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroAspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === delim) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo.length > 0 || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  // Descarta linhas totalmente vazias.
  return linhas.filter((l) => l.some((x) => x.trim() !== ""));
}

export function parseCsv(texto: string, delimitador?: string): CsvParsed {
  const delim = delimitador ?? detectarDelimitador(texto);
  const linhas = dividirEmCampos(texto, delim);
  if (linhas.length === 0) return { headers: [], linhas: [] };

  const headers = linhas[0].map((h) => h.trim());
  const registros = linhas.slice(1).map((cols) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = (cols[i] ?? "").trim();
    });
    return rec;
  });
  return { headers, linhas: registros };
}

/** Normaliza um cabeçalho: minúsculo, sem acento, só [a-z0-9_]. */
export function normalizarHeader(h: string): string {
  // Remove acentos via faixa de "combining marks" (0x300–0x36f) após NFD,
  // sem depender de escapes unicode no código-fonte.
  const semAcento = h
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("");
  return semAcento.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
