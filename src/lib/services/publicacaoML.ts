// Publicação no Mercado Livre — orquestração no cliente (Fase 3).
//
// Dry-run é 100% local (o builder é puro e sem segredo) → a equipe revisa o
// payload antes. A publicação real vai para /api/ml/publicar (que detém o
// segredo do APP ML) levando o refresh_token do canal do cliente.

import { montarItemML } from "../../modules/integration/domain/mlPayload";
import { montarBundleUserProducts } from "../../modules/publication/domain/composicaoConteudo";
import { buscarCanal } from "./canaisMarketplace";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import {
  atualizarAnuncioGerado,
  buscarAnuncioGerado,
  marcarAnuncioPublicado,
} from "./anunciosGerados";
import { urlsDoProduto } from "./storageImagens";
import type { AnuncioGeradoRegistro } from "../types";
import {
  capturarDecisao,
  type CapturaDeDecisao,
} from "../../modules/adaptive-intelligence/decision-journal.ts";

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

// ── Learning Loop · PR-006 ───────────────────────────────────────────────────
// Dois feedbacks do ambiente deixam de ser perdidos:
//  (1) ambiente PROPÕE (categoriaPrevista) → humano DECIDE (categoriaUsada)
//      → Decision Journal (só com delta; fire-and-forget);
//  (2) ambiente VETA (motivo real da rejeição) → DOMÍNIO (observacoes do
//      anúncio — estrutura existente; a AIL não é tocada: veto não é decisão).

/** Builder PURO da Decision do par proposta-do-ambiente → escolha-consumada. */
export function montarCapturaCategoriaPublicada(
  registro: { id: string; clienteId: string },
  prevista: string | null,
  usada: string | null
): CapturaDeDecisao | null {
  if (!usada) return null;
  return {
    empresa: registro.clienteId,
    contexto: "catalogo",
    campo: "categoriaMarketplace", // mesmo slot do agregado Produto — os padrões convergem
    entidade: { tipo: "anuncio", id: registro.id },
    valorAnterior: prevista, // o que o AMBIENTE propôs (null = não propôs)
    valorNovo: usada, // a escolha consumada na publicação
    origem: "api/ml/publicar",
  };
}

/**
 * Anexa o veredito do ambiente às observações SEM destruir o conteúdo atual
 * (o prefixo "Importado do " é marcador da reimportação — apêndice o preserva).
 */
export function comporObservacoesComFalha(
  existente: string | undefined | null,
  motivo: string
): string {
  const veredito = `[Publicação ML rejeitada] ${motivo}`;
  const atual = (existente ?? "").trim();
  return atual ? `${atual}\n${veredito}` : veredito;
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
  // Puxa as fotos reais do produto (Storage) quando não vieram explicitamente.
  let pictures = opcoes.pictures;
  if (pictures === undefined && registro.produtoId) {
    try {
      pictures = await urlsDoProduto(registro.produtoId);
    } catch {
      pictures = [];
    }
  }
  const payload = montarPreviewML(registro, { ...opcoes, pictures });
  if (!go) return { dry: true, payload };

  // Ingredientes do fluxo User Products (calçado). Vão SEMPRE que dá para
  // montá-los; o servidor só os usa se a categoria prevista exigir esse modelo.
  // Se a categoria for clássica, o bundle é ignorado — o payload acima manda.
  const bundleUP = montarBundleUserProducts(registro.anuncio, {
    pictures,
    tipoAnuncio: opcoes.tipoAnuncio,
  });
  const userProducts = bundleUP.ok ? bundleUP.bundle : undefined;

  const canal = await buscarCanal(registro.clienteId, registro.marketplace);
  if (!canal?.ativo) {
    throw new Error(
      "Cliente não conectado ao Mercado Livre. Conecte a conta em Configurações do canal antes de publicar."
    );
  }

  // O refresh_token NÃO trafega pelo navegador (R3): o servidor lê o token do
  // canal pelo clienteId, valida o acesso e rotaciona/persiste sozinho.
  const resposta = await fetch("/api/ml/publicar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({
      clienteId: registro.clienteId,
      registroId: registro.id,
      marketplace: registro.marketplace,
      payload,
      go: true,
      tituloParaCategoria: registro.anuncio?.tituloOtimizado,
      userProducts,
    }),
  });

  const dados = (await resposta.json()) as {
    id?: string;
    permalink?: string;
    erro?: string;
    categoriaPrevista?: string | null;
    categoriaUsada?: string | null;
  };

  if (!resposta.ok || !dados.id) {
    const motivo = dados.erro ?? "Falha ao publicar no Mercado Livre.";
    // Learning Loop (2): o VETO do ambiente entra no domínio. Nunca pode
    // mascarar a falha original — qualquer erro aqui é engolido.
    try {
      const atual = await buscarAnuncioGerado(registro.id);
      await atualizarAnuncioGerado(registro.id, {
        observacoes: comporObservacoesComFalha(atual?.observacoes, motivo),
      });
    } catch {
      // persistir o motivo jamais encobre o erro real de publicação
    }
    throw new Error(motivo);
  }

  await marcarAnuncioPublicado(registro.id, { itemId: dados.id, permalink: dados.permalink });

  // Learning Loop (1): ambiente propôs → humano decidiu → memória.
  // capturarDecisao garante delta real e fire-and-forget.
  const captura = montarCapturaCategoriaPublicada(
    registro,
    dados.categoriaPrevista ?? null,
    dados.categoriaUsada ?? null
  );
  if (captura) capturarDecisao(captura);

  return { dry: false, id: dados.id, permalink: dados.permalink, payload };
}
