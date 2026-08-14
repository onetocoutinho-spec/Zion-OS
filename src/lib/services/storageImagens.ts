// Upload de imagens de produto para o Supabase Storage (Fase 3.1).
//
// Sobe o arquivo no bucket público `produtos-imagens` (pasta = cliente_id/
// produto_id) e registra a URL pública em `imagens_produto`. É essa URL que a
// publicação no ML consome (o ML não aceita prompts, só imagens por URL).

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import {
  atualizarImagem,
  criarImagem,
  excluirImagem,
  listarImagensDoProduto,
} from "./imagensProduto";
import {
  capaAtual,
  papelDaFotoNova,
  sucessoraDaCapa,
} from "../../modules/catalog/domain/papelDaImagem";
import { dimensaoParaGravar } from "../imagens/medirArquivo";
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

  // ANTES DE SUBIR, porque depois de subir a única referência é uma url — e
  // url do CDN do ML serve variante, não original. Medir aqui é o único
  // momento em que a dimensão é a verdade sem ressalva. Ver migração 059.
  const dimensao = await dimensaoParaGravar(file);

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
    tipoImagem: papelDaFotoNova(existentes, opcoes.tipo),
    url,
    status: "Aprovada",
    observacoes: opcoes.cor ? `Cor: ${opcoes.cor}` : opcoes.observacoes ?? "",
    // A COR VIRA COLUNA. Ela já chegava aqui e ia parar em `observacoes`, texto
    // livre que não casa com variante nenhuma — a informação existia e não era
    // consultável. `null` quando ninguém disse: foto de cor desconhecida não é
    // candidata a capa de anúncio colorido. Migração 060.
    cor: opcoes.cor?.trim() || null,
    ...dimensao,
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
  const anterior = capaAtual(await listarImagensDoProduto(opcoes.produtoId));
  if (anterior) await atualizarImagem(anterior.id, { tipoImagem: "Secundária" });
  try {
    return await uploadImagemProduto({ ...opcoes, tipo: "Principal" });
  } catch (e) {
    if (anterior) await atualizarImagem(anterior.id, { tipoImagem: "Principal" });
    throw e;
  }
}

/**
 * Promove uma foto que JÁ EXISTE a capa do produto — rebaixando a antiga ANTES.
 *
 * Mesma ordem e mesmo desfazer de `trocarCapaDoProduto`, e pelos mesmos dois
 * motivos: o instante com duas capas é o defeito, e produto sem capa nenhuma é
 * pior que o defeito original. A única diferença é a origem da foto — aqui ela
 * já está na tabela, então não há upload.
 *
 * A tela de imagens do portal fazia isto à mão e **sem o desfazer**: se a
 * promoção falhasse depois do rebaixamento, o produto ficava sem capa e nada
 * avisava. Era a quarta cópia da regra da capa, encontrada na varredura de
 * quem escreve (AUD-003) depois que a #193 tirou as outras três das telas.
 *
 * Lê o estado atual do banco em vez de confiar na lista que a tela já tem:
 * `useLiveQuery` pode estar defasado, e decidir capa a partir de cache é como a
 * segunda capa entrava calada antes da 053.
 */
export async function promoverImagemACapa(produtoId: string, imagemId: string): Promise<void> {
  const anterior = capaAtual(await listarImagensDoProduto(produtoId));
  // Clicar na estrela da capa ATUAL continua reaprovando a foto — era o que a
  // tela fazia, e é o que devolve ao envio uma capa que foi marcada "Pendente".
  // O que não pode acontecer nesse caso é o rebaixamento: ele deixaria o
  // produto sem capa por um instante, para promover a mesma foto de volta.
  const jaEraACapa = anterior?.id === imagemId;
  if (anterior && !jaEraACapa) await atualizarImagem(anterior.id, { tipoImagem: "Secundária" });
  try {
    await atualizarImagem(imagemId, { tipoImagem: "Principal", status: "Aprovada" });
  } catch (e) {
    if (anterior && !jaEraACapa) await atualizarImagem(anterior.id, { tipoImagem: "Principal" });
    throw e;
  }
}

/**
 * Apaga uma foto — e não deixa o produto sem capa.
 *
 * ===========================================================================
 * O DEFEITO QUE ISTO FECHA — medido em 14/08/2026
 * ===========================================================================
 *
 * As duas telas que apagam foto chamavam `excluirImagem` direto. Nenhuma
 * olhava se a foto apagada era a capa. `Chinelo Havaianas Top Liso` era o
 * único dos 80 produtos SEM foto Principal, e foi assim que ficou.
 *
 * Nada avisava. `urlsDoProduto` põe a Principal primeiro; sem Principal, a
 * capa do anúncio vira a primeira foto que a consulta devolver — sorteio,
 * decidido no servidor do Mercado Livre.
 *
 * A ORDEM: a sucessão acontece ANTES do apagamento. Se `promoverImagemACapa`
 * falhar, nada é apagado e a capa continua a de antes — a lojista tenta de
 * novo. Apagar primeiro e falhar na promoção deixaria exatamente o buraco que
 * esta função existe para fechar.
 */
export async function excluirImagemDoProduto(
  produtoId: string,
  imagemId: string
): Promise<void> {
  const sucessora = sucessoraDaCapa(await listarImagensDoProduto(produtoId), imagemId);
  if (sucessora) await promoverImagemACapa(produtoId, sucessora.id);
  await excluirImagem(imagemId);
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
