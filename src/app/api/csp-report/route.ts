// POST /api/csp-report — o navegador conta o que a CSP barrou (ou barraria).
//
// Até aqui a CSP em Report-Only reportava para o console do navegador de
// quem estivesse com o DevTools aberto — ou seja, para ninguém. Medição que
// ninguém lê não é medição. Este endpoint recebe o relatório e escreve uma
// linha JSON nos Runtime Logs da Vercel: `grep "csp.violacao"`.
//
// Sem autenticação, de propósito: o navegador manda o relatório sem
// credenciais, como manda um beacon. O que se controla é o TAMANHO (um
// relatório tem centenas de bytes; 8 KB já é suspeito) e o que se loga (só
// os campos do relatório, nunca o corpo cru — corpo cru de origem anônima
// no log é injeção de log). Resposta é sempre 204: o navegador não espera
// nada e não há o que dizer a ele.

const TAMANHO_MAXIMO = 8 * 1024;

/** Os dois formatos: `report-uri` (csp-report) e `report-to` (array de reports). */
interface RelatorioCsp {
  "document-uri"?: string;
  "violated-directive"?: string;
  "effective-directive"?: string;
  "blocked-uri"?: string;
  disposition?: string;
  "source-file"?: string;
  "line-number"?: number;
}

function extrair(bruto: unknown): RelatorioCsp[] {
  if (Array.isArray(bruto)) {
    return bruto
      .map((r) => (r && typeof r === "object" && "body" in r ? (r as { body: unknown }).body : null))
      .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === "object")
      .map((b) => ({
        "document-uri": String(b.documentURL ?? ""),
        "violated-directive": String(b.effectiveDirective ?? ""),
        "effective-directive": String(b.effectiveDirective ?? ""),
        "blocked-uri": String(b.blockedURL ?? ""),
        disposition: String(b.disposition ?? ""),
        "source-file": b.sourceFile ? String(b.sourceFile) : undefined,
        "line-number": typeof b.lineNumber === "number" ? b.lineNumber : undefined,
      }));
  }
  if (bruto && typeof bruto === "object" && "csp-report" in bruto) {
    const r = (bruto as { "csp-report": Record<string, unknown> })["csp-report"];
    return [
      {
        "document-uri": String(r["document-uri"] ?? ""),
        "violated-directive": String(r["violated-directive"] ?? ""),
        "effective-directive": String(r["effective-directive"] ?? ""),
        "blocked-uri": String(r["blocked-uri"] ?? ""),
        disposition: String(r.disposition ?? ""),
        "source-file": r["source-file"] ? String(r["source-file"]) : undefined,
        "line-number": typeof r["line-number"] === "number" ? r["line-number"] : undefined,
      },
    ];
  }
  return [];
}

export async function POST(request: Request) {
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > TAMANHO_MAXIMO) return new Response(null, { status: 204 });

  let bruto: unknown;
  try {
    const texto = await request.text();
    if (texto.length > TAMANHO_MAXIMO) return new Response(null, { status: 204 });
    bruto = JSON.parse(texto);
  } catch {
    return new Response(null, { status: 204 });
  }

  for (const r of extrair(bruto).slice(0, 10)) {
    console.warn(
      JSON.stringify({
        src: "csp.violacao",
        // "enforce" veio do cabeçalho em bloqueio — algo QUEBROU para alguém.
        // "report" veio do Report-Only — é a próxima promoção sendo medida.
        disposicao: r.disposition || "desconhecida",
        diretiva: (r["effective-directive"] || r["violated-directive"] || "").slice(0, 80),
        bloqueado: (r["blocked-uri"] || "").slice(0, 200),
        pagina: (r["document-uri"] || "").slice(0, 200),
        origem: r["source-file"] ? `${r["source-file"].slice(0, 200)}:${r["line-number"] ?? ""}` : undefined,
        ts: new Date().toISOString(),
      })
    );
  }
  return new Response(null, { status: 204 });
}
