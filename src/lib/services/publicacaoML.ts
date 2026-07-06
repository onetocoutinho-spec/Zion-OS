// Publicação no Mercado Livre — orquestração no cliente (Fase 3).
//
// Dry-run é 100% local (o builder é puro e sem segredo) → a equipe revisa o
// payload antes. A publicação real vai para /api/ml/publicar (que detém o
// segredo do APP ML) levando o refresh_token do canal do cliente.

import { montarItemML } from "../marketplaces/mlPayload";
import { buscarCanal, atualizarRefreshToken } from "./canaisMarketplace";
import { marcarAnuncioPublicado } from "./anunciosGerados";
import type { AnuncioGeradoRegistro } from "../types";

function num(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  let s = String(v).trim().replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Preço/estoque do produto pai — quando não temos o Produto, derivamos das variações. */
function dadosProduto(registro: AnuncioGeradoRegistro): { precoVenda: number; estoque: number } {
  const vs = registro.anuncio?.variacoes ?? [];
  const precos = vs.map((v) => num(v.preco)).filter((n) => n > 0);
  const estoques = vs.map((v) => num(v.estoque));
  return {
    precoVenda: precos.length ? Math.min(...precos) : 0,
    estoque: estoques.length ? estoques.reduce((a, b) => a + b, 0) : 0,
  };
}

export interface OpcoesPublicacao {
  categoryId?: string;
  pictures?: string[];
  tipoAnuncio?: string;
  produto?: { precoVenda: number; estoque: number };
}

/** Monta o payload do ML (dry-run local) — para a equipe revisar. */
export function montarPreviewML(
  registro: AnuncioGeradoRegistro,
  opcoes: OpcoesPublicacao = {}
): Record<string, unknown> {
  return montarItemML({
    produto: opcoes.produto ?? dadosProduto(registro),
    anuncio: registro.anuncio,
    categoryId: opcoes.categoryId ?? "",
    tipoAnuncio: opcoes.tipoAnuncio ?? "Premium",
    pictures: opcoes.pictures,
  });
}

export interface ResultadoPublicacao {
  dry: boolean;
  id?: string;
  permalink?: string;
  payload: Record<string, unknown>;
}

/**
 * go=false → só devolve o payload (dry-run local).
 * go=true  → publica de verdade via /api/ml/publicar e marca como publicado.
 */
export async function publicarNoML(
  registro: AnuncioGeradoRegistro,
  go: boolean,
  opcoes: OpcoesPublicacao = {}
): Promise<ResultadoPublicacao> {
  const payload = montarPreviewML(registro, opcoes);
  if (!go) return { dry: true, payload };

  const canal = await buscarCanal(registro.clienteId, registro.marketplace);
  if (!canal?.refreshToken) {
    throw new Error(
      "Cliente não conectado ao Mercado Livre. Conecte a conta (refresh token) em Configurações do canal antes de publicar."
    );
  }

  const resposta = await fetch("/api/ml/publicar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload,
      refreshToken: canal.refreshToken,
      go: true,
      tituloParaCategoria: registro.anuncio?.tituloOtimizado,
    }),
  });

  const dados = (await resposta.json()) as {
    id?: string;
    permalink?: string;
    refreshToken?: string;
    erro?: string;
  };

  // Persiste o refresh_token rotacionado mesmo se a publicação falhar depois.
  if (dados.refreshToken) {
    await atualizarRefreshToken(registro.clienteId, dados.refreshToken, registro.marketplace);
  }

  if (!resposta.ok || !dados.id) {
    throw new Error(dados.erro ?? "Falha ao publicar no Mercado Livre.");
  }

  await marcarAnuncioPublicado(registro.id, { itemId: dados.id, permalink: dados.permalink });
  return { dry: false, id: dados.id, permalink: dados.permalink, payload };
}
