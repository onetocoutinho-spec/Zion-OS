// Upload de imagens de produto para o Supabase Storage (Fase 3.1).
//
// Sobe o arquivo no bucket público `produtos-imagens` (pasta = cliente_id/
// produto_id) e registra a URL pública em `imagens_produto`. É essa URL que a
// publicação no ML consome (o ML não aceita prompts, só imagens por URL).

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { comCapaRebaixada, criarImagem, listarImagensDoProduto } from "./imagensProduto";
import { mesmoEscopoDeCapa, papelDaFotoNova } from "../../modules/catalog/domain/papelDaImagem";
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
  /**
   * O papel, quando o chamador tem opinião. Omitir é o caso comum — quem sobe
   * uma foto quer acrescentar fotos, não decidir qual é a capa.
   *
   * Pedir "Principal" para um produto que já tem capa NÃO cria a segunda: a
   * foto entra na galeria. Ver `papelDaFotoNova`. Para TROCAR a capa existe
   * `trocarCapaDoProduto`.
   */
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

  // O papel sai daqui, e de mais lugar nenhum. Era `opcoes.tipo ?? "Principal"`
  // — o padrão invertido que fazia toda foto sem opinião virar capa.
  const existentes = await listarImagensDoProduto(produtoId);

  return criarImagem({
    clienteId,
    produtoId,
    varianteId: null,
    anuncioId: null,
    tipoImagem: papelDaFotoNova(mesmoEscopoDeCapa(existentes, null), opcoes.tipo),
    url,
    status: "Aprovada",
    observacoes: opcoes.cor ? `Cor: ${opcoes.cor}` : opcoes.observacoes ?? "",
  });
}

/**
 * Troca a capa do produto por uma foto nova — rebaixando a antiga ANTES.
 *
 * A ordem é a correção inteira. O Estúdio IA fazia o contrário: inseria a capa
 * nova e só depois rebaixava a antiga, o que exige que exista um instante com
 * duas capas. Enquanto nada impedia, esse instante passava despercebido; com a
 * restrição de uma capa por produto, ele é o defeito.
 *
 * Se a inserção falhar, a antiga VOLTA a ser capa. Sem esse desfazer, uma falha
 * de rede deixaria o produto sem capa nenhuma — pior que o defeito original,
 * porque produto sem capa não publica.
 */
export async function trocarCapaDoProduto(
  opcoes: Omit<OpcoesUpload, "tipo">
): Promise<ImagemProduto> {
  // `uploadImagemProduto` grava sempre com `varianteId: null`, então é esse o
  // escopo cuja capa precisa sair da frente.
  return comCapaRebaixada(opcoes.produtoId, null, () =>
    uploadImagemProduto({ ...opcoes, tipo: "Principal" })
  );
}

/**
 * URLs das imagens de um produto que vão para o anúncio (ML).
 * TODAS entram por padrão — o cliente não precisa selecionar nada. Só fica de
 * fora a foto que ele explicitamente "tirar do envio" (status "Pendente").
 * A "Principal" vira a capa (vai primeiro).
 */
export async function urlsDoProduto(produtoId: string): Promise<string[]> {
  if (!produtoId) return [];
  const imgs = await listarImagensDoProduto(produtoId);
  return imgs
    .filter((i) => i.status !== "Pendente") // "Pendente" = tirada do envio pelo cliente
    .sort((a, b) => (a.tipoImagem === "Principal" ? -1 : b.tipoImagem === "Principal" ? 1 : 0))
    .map((i) => i.url);
}
