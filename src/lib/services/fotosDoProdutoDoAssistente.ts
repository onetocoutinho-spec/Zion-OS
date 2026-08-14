// A LEITURA, no servidor, das fotos de UM produto.
//
// ===========================================================================
// POR QUE ISTO EXISTE — medido em 14/08/2026
// ===========================================================================
//
// 310 anúncios ativos com capa fora do padrão, em 54 produtos, com o Mercado
// Livre cobrando "a foto de capa não cumpre os requisitos". O chat sabia
// contar isso pela conta inteira e não sabia responder a pergunta que ela faz
// produto a produto: **preciso fotografar este, ou já tenho foto boa aqui?**
//
// E a varredura completa daquele dia (391 de 391 anúncios lidos) provou que a
// resposta quase nunca está dentro do anúncio: `trocariam` deu ZERO. O gargalo
// são as fotos dela — então a única coisa que o software pode fazer de útil é
// dizer, por produto, se a viagem ao fabricante é necessária.
//
// ===========================================================================
// LÊ DO NOSSO BANCO, NÃO DO MERCADO LIVRE
// ===========================================================================
//
// Cada chamada ao ML renova e regrava o refresh_token dela. Uma ferramenta de
// chat que lê o marketplace a cada pergunta derruba a conexão num dia
// movimentado — e não precisa: `foto_capa_max_size` passou a ser anotado pela
// própria rota que troca a capa, e a importação o preenche.
//
// E lê com a credencial do SERVIDOR. Reusar uma função que lê pelo cliente do
// NAVEGADOR devolveria vazio em silêncio — o defeito que fez o ensaio de
// publicação dizer "FOTOS 0" num produto com dez fotos, em 11/08/2026.

import { getSupabaseAdmin } from "../supabase/admin";
import { lerTudoPaginado } from "../supabase/paginado";
import {
  diagnosticarFotos,
  type AnuncioParaDiagnostico,
  type DiagnosticoDasFotos,
  type FotoParaDiagnostico,
} from "../../modules/catalog/domain/fotosDoProduto";

export async function fotosDoProdutoDoAssistente(
  clienteId: string,
  produtoId: string,
  nomeDoProduto: string
): Promise<DiagnosticoDasFotos> {
  const [anuncios, fotos] = await Promise.all([
    // `eq(produto_id)` — os anúncios de UM produto. Máximo medido: 42
    // (13/08/2026). Paginado mesmo assim: um teto medido hoje não é um teto.
    lerTudoPaginado<{ ml_item_id: string; foto_capa_max_size: string | null }>(
      "anúncios do produto (fotos, assistente)",
      (de, ate) =>
        getSupabaseAdmin()
          .from("anuncios_gerados")
          .select("ml_item_id, foto_capa_max_size")
          .eq("cliente_id", clienteId)
          .eq("produto_id", produtoId)
          .not("ml_item_id", "is", null)
          .order("id", { ascending: true })
          .range(de, ate)
    ).catch(() => []),
    lerTudoPaginado<{ largura: number | null; altura: number | null; cor: string | null }>(
      "fotos do produto (assistente)",
      (de, ate) =>
        getSupabaseAdmin()
          .from("imagens_produto")
          .select("largura, altura, cor")
          .eq("cliente_id", clienteId)
          .eq("produto_id", produtoId)
          .order("id", { ascending: true })
          .range(de, ate)
    ).catch(() => []),
  ]);

  const paraAnuncios: AnuncioParaDiagnostico[] = anuncios.map((a) => ({
    mlb: a.ml_item_id,
    capaMaxSize: a.foto_capa_max_size,
  }));
  const paraFotos: FotoParaDiagnostico[] = fotos.map((f) => ({
    largura: f.largura,
    altura: f.altura,
    cor: f.cor,
  }));

  return diagnosticarFotos(paraAnuncios, paraFotos, nomeDoProduto);
}
