import { criarRepositorio } from "../repositorio";
import { imagemParaApp, imagemParaBanco } from "../supabase/mappers";
import type { ImagemProdutoRow } from "../supabase/database.types";
import type { ImagemProduto } from "../types";
import { chaveDaFoto } from "@/modules/catalog/domain/envioDeFotoRepetido";

const repo = criarRepositorio<ImagemProduto, ImagemProdutoRow>({
  tabela: "imagens_produto",
  colecao: "imagensProduto",
  prefixoIdLocal: "img",
  selecao: "*",
  paraApp: imagemParaApp,
  paraBanco: imagemParaBanco,
});

export async function listarImagensDoProduto(produtoId: string): Promise<ImagemProduto[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

export async function listarImagensDoAnuncio(anuncioId: string): Promise<ImagemProduto[]> {
  return repo.listar({ coluna: "anuncio_id", valor: anuncioId, campoLocal: "anuncioId" });
}

export async function criarImagem(dados: Omit<ImagemProduto, "id">): Promise<ImagemProduto> {
  return repo.criar(dados);
}

/** Cria muitas imagens de uma vez (importação do ML: fotos reais dos anúncios). */
export async function criarImagensBulk(dados: Omit<ImagemProduto, "id">[]): Promise<void> {
  await repo.criarVarios(dados, { chunk: 100, retornar: false });
}

export async function atualizarImagem(
  id: string,
  dados: Partial<ImagemProduto>
): Promise<ImagemProduto | null> {
  return repo.atualizar(id, dados);
}

export async function excluirImagem(id: string): Promise<void> {
  return repo.excluir(id);
}

/**
 * Todas as imagens, para contar em massa quantos produtos já têm foto.
 *
 * A tela inicial precisa saber "quantos produtos estão sem foto" — perguntar
 * produto a produto seriam 73 consultas para responder um número.
 */
export async function listarTodasImagens(): Promise<ImagemProduto[]> {
  return repo.listar();
}

/**
 * Quantas fotos cada par produto+cor da loja já tem.
 *
 * Serve ao aviso de envio repetido: sem saber o que já existe, a tela não tem
 * como dizer que o próximo envio duplica. Em 27/08/2026 a mesma pasta subiu
 * duas vezes e o produto ficou com 108 imagens onde havia 54.
 *
 * Falha de leitura devolve mapa vazio, de propósito: o aviso some e o envio
 * segue como sempre seguiu. Pior contexto, nunca contexto errado — e nunca um
 * bloqueio por causa de uma consulta que não respondeu.
 */
/**
 * Só as duas colunas que a contagem lê — e a diferença é de segundos.
 *
 * MEDIDO em 27/08/2026, com 8.090 imagens na base:
 *
 *     select *              3.896 ms   ~4,8 MB
 *     produto_id, cor       1.739 ms   ~0,5 MB
 *
 * A função devolve um MAPA DE CONTAGENS. Ela nunca lê url, observações, status,
 * largura, altura — mas as trazia todas, atravessando a rede a cada escolha de
 * pasta na tela de imagens. Somados aos 5,3 s que o casador gastava reindexando
 * o catálogo, davam nove segundos de tela parada antes de aparecer a primeira
 * linha.
 *
 * É o mesmo motivo de `selecaoAlternativa` existir, escrito em `repositorio.ts`
 * sobre outro caso: o navegador é o operário deste desenho, e cada clique puxa
 * a tabela inteira.
 */
const COLUNAS_DA_CONTAGEM = "produto_id, cor";

export async function fotosPorProdutoECor(clienteId: string): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  try {
    const todas = await repo.listar(
      {
        coluna: "cliente_id",
        valor: clienteId,
        campoLocal: "clienteId",
      },
      COLUNAS_DA_CONTAGEM
    );
    for (const i of todas) {
      const k = chaveDaFoto(i.produtoId, i.cor ?? "");
      mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
  } catch {
    return new Map();
  }
  return mapa;
}
