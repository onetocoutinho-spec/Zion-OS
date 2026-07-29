// A execução da busca no catálogo — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin. Nunca no navegador.
//
// A ESTRATÉGIA é do domínio (`buscaDeCatalogo`), pura e testada. Aqui está só o
// I/O: transformar uma `Tentativa` em SQL e devolver linhas. A divisão importa
// porque é ela que permite provar "SKU duplicado é ambíguo" sem levantar banco.
//
// O TENANT VEM DE FORA, derivado da sessão pela rota. Ele é aplicado em TODA
// query, e por isso um EAN que só existe em outro cliente devolve zero linhas —
// não "existe, mas é de outro". A ausência de vazamento é a mesma coisa que a
// ausência de resultado.
//
// NENHUMA CONVERSÃO NUMÉRICA. O termo entra e sai texto. Nesta base 473 SKUs
// começam com zero, e `Number("01040533")` viraria `1040533`.

import { getSupabaseAdmin } from "../supabase/admin";
import type { LinhaEncontrada, Tentativa } from "../../modules/assistant/domain/buscaDeCatalogo";

/**
 * Quantas linhas trazer do banco por tentativa.
 *
 * Maior que o limite de candidatos de propósito: o domínio precisa saber se são
 * 9 ou 84 para dizer o total honesto, e cortar aqui em 8 faria "84 resultados"
 * virar "8 resultados". Duzentos é folgado para a maior família desta base (39
 * variantes) e barato o suficiente para não pesar.
 */
export const LIMITE_DA_QUERY = 200;

/** Escapa `%` e `_`, que são curingas no LIKE e viriam do texto do lojista. */
function semCuringas(termo: string): string {
  return termo.replace(/[%_\\]/g, "\\$&");
}

/**
 * Roda UMA tentativa contra o banco, no tenant dado.
 *
 * O join traz produto e variante juntos porque a distinção entre os dois é
 * informação que o domínio usa — e refazer a consulta para descobrir o pai
 * dobraria o custo de cada busca.
 */
export async function rodarTentativa(
  t: Tentativa,
  clienteId: string
): Promise<LinhaEncontrada[]> {
  const admin = getSupabaseAdmin();

  // ---- Identificadores da VARIANTE: sku, ean ----
  if (t.coluna === "sku" || t.coluna === "ean") {
    let q = admin
      .from("produto_variantes")
      .select("id, produto_id, sku, ean, cor, tamanho, produtos!inner(id, nome, marca, modelo)")
      // TENANT na variante E no produto: as duas tabelas o carregam, e confiar
      // só numa deixaria uma porta aberta se um dia elas divergirem.
      .eq("cliente_id", clienteId)
      .limit(LIMITE_DA_QUERY);
    // Igualdade TEXTUAL. Nunca `Number(...)`.
    q = t.modo === "exato" ? q.eq(t.coluna, t.termo) : q.ilike(t.coluna, `%${semCuringas(t.termo)}%`);
    const { data, error } = await q;
    if (error) throw new Error(`Busca por ${t.coluna} falhou: ${error.message}`);
    // O tipo gerado trata o join como ARRAY. Normalizar aqui e nao no acesso
    // evita `produtos[0]` espalhado — e o `[0]` calado seria o defeito se o
    // Supabase mudasse a forma do retorno.
    return ((data ?? []) as unknown as LinhaDeVariante[])
      .map((v) => ({ ...v, pai: Array.isArray(v.produtos) ? v.produtos[0] : v.produtos }))
      // O `!inner` já garante o pai; um registro sem ele numa base inconsistente
      // seria descartado aqui em vez de virar `undefined.nome`.
      .filter((v) => Boolean(v.pai))
      .map((v) => ({
        produtoId: v.pai.id,
        nome: v.pai.nome,
        marca: v.pai.marca,
        modelo: v.pai.modelo,
        varianteId: v.id,
        sku: v.sku,
        ean: v.ean,
        cor: v.cor,
        tamanho: v.tamanho,
      }));
  }

  // ---- Identificadores do PRODUTO: modelo (a "referência"), nome ----
  let q = admin
    .from("produtos")
    .select("id, nome, marca, modelo")
    .eq("cliente_id", clienteId)
    .limit(LIMITE_DA_QUERY);
  q = t.modo === "exato" ? q.eq(t.coluna, t.termo) : q.ilike(t.coluna, `%${semCuringas(t.termo)}%`);
  const { data, error } = await q;
  if (error) throw new Error(`Busca por ${t.coluna} falhou: ${error.message}`);
  return ((data ?? []) as LinhaDeProduto[]).map((p) => ({
    produtoId: p.id,
    nome: p.nome,
    marca: p.marca,
    modelo: p.modelo,
  }));
}

interface LinhaDeProduto {
  id: string;
  nome: string;
  marca: string | null;
  modelo: string | null;
}

interface LinhaDeVariante {
  id: string;
  produto_id: string;
  sku: string | null;
  ean: string | null;
  cor: string | null;
  tamanho: string | null;
  produtos: LinhaDeProduto | LinhaDeProduto[];
}
