// De onde pode vir a foto que a IA melhora.
//
// `/api/imagens/gerar` recebia `imagemUrl` e fazia `fetch(url)` — qualquer
// URL, sem host permitido, sem bloqueio de IP interno, sem timeout, sem
// conferir de quem era a foto. Isso é SSRF a partir do runtime da Vercel
// (metadata, serviços internos), e o corpo baixado ainda virava anexo para
// o provedor de imagem. (Auditoria do Copilot, 2026-08-22, P1.)
//
// A foto real do produto mora num lugar só: o bucket `produtos-imagens` do
// Supabase do projeto, em `<clienteId>/<produtoId>/<arquivo>`. Então a
// origem válida é exatamente essa — e o primeiro segmento do caminho diz
// QUAL loja é dona da foto, que é o que a rota precisa para autorizar.
//
// Puro: recebe a URL e a URL do Supabase, devolve a decisão. Testável sem rede.

export const BUCKET_DE_FOTOS = "produtos-imagens";

export type OrigemDaFoto =
  | { ok: true; clienteId: string; caminho: string; url: string }
  | { ok: false; motivo: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aceita só `https://<host do Supabase>/storage/v1/object/public/produtos-imagens/<clienteId>/...`.
 * Qualquer outra coisa — outro host, http, IP, outro bucket, caminho sem
 * tenant — é recusada com um motivo legível.
 */
export function origemDaFoto(bruta: string | undefined, supabaseUrl: string | undefined): OrigemDaFoto {
  if (!bruta || typeof bruta !== "string") return { ok: false, motivo: "Envie a foto real do produto." };
  if (!supabaseUrl) return { ok: false, motivo: "Armazenamento de fotos não configurado no servidor." };

  let url: URL;
  let base: URL;
  try {
    url = new URL(bruta);
    base = new URL(supabaseUrl);
  } catch {
    return { ok: false, motivo: "Endereço da foto inválido." };
  }

  if (url.protocol !== "https:") return { ok: false, motivo: "A foto precisa vir do armazenamento do projeto." };
  if (url.host.toLowerCase() !== base.host.toLowerCase()) {
    return { ok: false, motivo: "A foto precisa vir do armazenamento do projeto." };
  }
  if (url.username || url.password) return { ok: false, motivo: "Endereço da foto inválido." };

  const prefixo = `/storage/v1/object/public/${BUCKET_DE_FOTOS}/`;
  if (!url.pathname.startsWith(prefixo)) {
    return { ok: false, motivo: "A foto precisa estar nas fotos do produto." };
  }
  const caminho = decodeURIComponent(url.pathname.slice(prefixo.length));
  const [clienteId, produtoId, ...resto] = caminho.split("/");
  if (!UUID.test(clienteId ?? "") || !UUID.test(produtoId ?? "") || resto.length === 0 || caminho.includes("..")) {
    return { ok: false, motivo: "A foto precisa estar nas fotos do produto." };
  }

  // Sem query nem fragmento: o caminho já diz tudo, e o resto só serviria
  // para contrabandear parâmetro para o storage.
  url.search = "";
  url.hash = "";
  return { ok: true, clienteId, caminho, url: url.toString() };
}

/** Teto do arquivo baixado. Foto de produto acima disso é erro, não imagem. */
export const MAXIMO_DA_FOTO_BYTES = 15 * 1024 * 1024;
/** Tempo para o storage responder. */
export const TIMEOUT_DA_FOTO_MS = 15_000;
