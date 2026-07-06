// Upload de imagens de produto para o Supabase Storage (Fase 3.1).
//
// Sobe o arquivo no bucket público `produtos-imagens` (pasta = cliente_id/
// produto_id) e registra a URL pública em `imagens_produto`. É essa URL que a
// publicação no ML consome (o ML não aceita prompts, só imagens por URL).

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { criarImagem, listarImagensDoProduto } from "./imagensProduto";
import type { ImagemProduto, TipoImagem } from "../types";

const BUCKET = "produtos-imagens";

function slugArquivo(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  const ext = ponto > 0 ? nome.slice(ponto + 1).toLowerCase() : "jpg";
  const limpo = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return `${limpo || "img"}.${ext}`;
}

export interface OpcoesUpload {
  clienteId: string;
  produtoId: string;
  file: File;
  tipo?: TipoImagem;
  /** Cor da variação (vai para observações e ajuda a casar variante). */
  cor?: string;
  observacoes?: string;
}

/** Sobe um arquivo e registra a imagem do produto. Retorna o registro criado. */
export async function uploadImagemProduto(opcoes: OpcoesUpload): Promise<ImagemProduto> {
  if (!supabaseConfigurado) {
    throw new Error("O upload de imagens precisa do Supabase configurado.");
  }
  const { clienteId, produtoId, file } = opcoes;
  const caminho = `${clienteId}/${produtoId}/${Date.now()}-${slugArquivo(file.name)}`;

  const sb = getSupabase();
  const { error } = await sb.storage.from(BUCKET).upload(caminho, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(caminho);
  const url = data.publicUrl;

  return criarImagem({
    clienteId,
    produtoId,
    varianteId: null,
    anuncioId: null,
    tipoImagem: opcoes.tipo ?? "Principal",
    url,
    status: "Aprovada",
    observacoes: opcoes.cor ? `Cor: ${opcoes.cor}` : opcoes.observacoes ?? "",
  });
}

/** URLs das imagens de um produto (para alimentar a publicação no ML). */
export async function urlsDoProduto(produtoId: string): Promise<string[]> {
  if (!produtoId) return [];
  const imgs = await listarImagensDoProduto(produtoId);
  // Principal primeiro (vira a capa no ML).
  return imgs
    .sort((a, b) => (a.tipoImagem === "Principal" ? -1 : b.tipoImagem === "Principal" ? 1 : 0))
    .map((i) => i.url);
}
