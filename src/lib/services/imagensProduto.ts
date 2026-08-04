import { criarRepositorio } from "../repositorio";
import { imagemParaApp, imagemParaBanco } from "../supabase/mappers";
import { capaAtual, mesmoEscopoDeCapa, papelDaFotoNova } from "../../modules/catalog/domain/papelDaImagem";
import type { ImagemProdutoRow } from "../supabase/database.types";
import type { ImagemProduto } from "../types";

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

/**
 * Insert cru, SEM a regra da capa. Quem chama assume a invariante inteira.
 *
 * Só há um chamador legítimo hoje — `registrarImagemPorUrl`, logo abaixo — e o
 * outro caminho que precisa disto é a importação em lote, que já garante uma
 * capa por produto por construção (`criarImagensBulk`, produto recém-criado).
 *
 * Se você está prestes a chamar isto de uma TELA, é quase certo que o que você
 * quer é `registrarImagemPorUrl`: foi um `criarImagem` direto, com o formulário
 * pré-selecionado em "Principal", que sobreviveu à correção de 04/08 como o
 * quinto caminho capaz de criar uma segunda capa calada.
 */
export async function criarImagem(dados: Omit<ImagemProduto, "id">): Promise<ImagemProduto> {
  return repo.criar(dados);
}

/**
 * Registra uma imagem cujo arquivo JÁ está hospedado — a tela do operador cola
 * a URL em vez de subir arquivo.
 *
 * O papel sai de `papelDaFotoNova`, e não do formulário. O `tipoImagem` que
 * chega aqui é o PEDIDO de quem preencheu o campo, e ele é respeitado em tudo
 * menos em criar uma segunda capa — o mesmo contrato de `uploadImagemProduto`,
 * pelo mesmo motivo: um Select que abre em "Principal" não é opinião, é o valor
 * inicial do componente.
 */
export async function registrarImagemPorUrl(
  dados: Omit<ImagemProduto, "id">
): Promise<ImagemProduto> {
  const existentes = await listarImagensDoProduto(dados.produtoId);
  return repo.criar({
    ...dados,
    tipoImagem: papelDaFotoNova(
      mesmoEscopoDeCapa(existentes, dados.varianteId),
      dados.tipoImagem
    ),
  });
}

/**
 * Roda `acao` com a capa atual JÁ rebaixada — e a restaura se `acao` falhar.
 *
 * Esta é a coreografia inteira de "trocar de capa", e ela mora aqui porque
 * existe em dois sabores — subir um arquivo novo (`trocarCapaDoProduto`) e
 * promover uma foto que já está na galeria (`promoverACapa`). Escrita duas
 * vezes, ela divergiria; foi assim que a regra da capa virou quatro versões.
 *
 * A ordem é a correção: rebaixar ANTES. O Estúdio IA fazia o contrário, e isso
 * exige um instante com duas capas — invisível enquanto nada media, defeito
 * assim que o índice existe.
 *
 * O desfazer não é zelo: sem ele, uma falha de rede no meio deixa o produto sem
 * capa nenhuma, e produto sem capa não publica.
 */
export async function comCapaRebaixada<T>(
  produtoId: string,
  varianteId: string | null,
  acao: () => Promise<T>
): Promise<T> {
  const noEscopo = mesmoEscopoDeCapa(await listarImagensDoProduto(produtoId), varianteId);
  const anterior = capaAtual(noEscopo);
  if (anterior) await atualizarImagem(anterior.id, { tipoImagem: "Secundária" });
  try {
    return await acao();
  } catch (e) {
    if (anterior) await atualizarImagem(anterior.id, { tipoImagem: "Principal" });
    throw e;
  }
}

/**
 * Promove uma foto que JÁ está na galeria a capa, rebaixando a atual antes.
 *
 * Era a regra reescrita dentro da tela `/cliente/imagens`, e a cópia de lá
 * tinha dois defeitos que esta não tem: lia a capa atual do estado do React
 * (que pode estar velho) em vez do banco, e não desfazia — se a promoção
 * falhasse depois do rebaixamento, o produto ficava sem capa.
 */
export async function promoverACapa(imagem: ImagemProduto): Promise<ImagemProduto | null> {
  if (imagem.tipoImagem === "Principal") {
    // Já é a capa. Rebaixar e repromover a mesma linha seriam duas escritas
    // para não mudar nada — e um instante em que o produto não tem capa.
    return atualizarImagem(imagem.id, { status: "Aprovada" });
  }
  return comCapaRebaixada(imagem.produtoId, imagem.varianteId, () =>
    atualizarImagem(imagem.id, { tipoImagem: "Principal", status: "Aprovada" })
  );
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
