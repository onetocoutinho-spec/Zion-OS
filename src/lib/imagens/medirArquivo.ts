// A MEDIDA DA FOTO, TIRADA DO ARQUIVO QUE A LOJISTA ESCOLHEU.
//
// ===========================================================================
// POR QUE MEDIR AQUI, E NÃO DEPOIS
// ===========================================================================
//
// Medido em 11/08/2026: para responder "existe capa melhor no cadastro deste
// produto?" foi preciso baixar o cabeçalho de 228 fotos, de fora do sistema,
// porque `imagens_produto` não guardava dimensão nenhuma.
//
// E medir depois pela `url` do banco é pior que não medir. Aquela url aponta
// para a variante `-O` do CDN do Mercado Livre, que serve 500px; o original
// está em `-F` e tem 1200. A mesma imagem, medida pelos dois caminhos, dá
// respostas opostas — e a errada é a que faz desistir do conserto.
//
// No upload não há variante nem CDN: há o arquivo. É o único momento em que a
// medida é a verdade sem ressalva.
//
// Vive fora do componente porque agora tem dois donos: o cartão que confere a
// foto no chat e o serviço que sobe a foto no portal. Uma implementação só.

export interface FotoMedida {
  largura: number;
  altura: number;
  /** ObjectURL para pré-visualizar. Quem exibe é quem revoga. */
  url: string;
}

/**
 * Mede a imagem sem subir nada.
 *
 * `null` quando o arquivo não é imagem legível — e o chamador tem que tratar
 * isso como "não medimos", jamais como zero. Zero gravado faria a foto parecer
 * inválida quando o que houve foi uma leitura que falhou.
 */
export async function medirFoto(arquivo: File): Promise<FotoMedida | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () =>
      resolve({ largura: img.naturalWidth, altura: img.naturalHeight, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * A dimensão pronta para gravar, já no formato do registro.
 *
 * Devolve o par NULO quando não deu para medir: as duas colunas andam juntas
 * por constraint na 059, e meia medida gravada é pior que nenhuma porque
 * parece resposta.
 */
export async function dimensaoParaGravar(
  arquivo: File
): Promise<{ largura: number | null; altura: number | null }> {
  const m = await medirFoto(arquivo).catch(() => null);
  if (!m) return { largura: null, altura: null };
  URL.revokeObjectURL(m.url);
  return { largura: m.largura, altura: m.altura };
}
