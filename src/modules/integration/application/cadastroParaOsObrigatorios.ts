// O que a lojista já respondeu, para o obrigatório que falta no payload.
//
// ===========================================================================
// POR QUE NO SERVIDOR, E NÃO NO NAVEGADOR
// ===========================================================================
//
// A resposta depende da CATEGORIA — é ela que diz quais atributos são exigidos.
// E a categoria muitas vezes só existe aqui: `publicarNoMercadoLivre` a descobre
// com `preverCategoria`, que precisa do token do lojista, que nunca desce para o
// navegador (`payload.category_id` é preenchido no servidor quando chega vazio).
//
// Montar a resposta no navegador daria certo só para quem já sabia a categoria,
// e quem já sabia a categoria é a minoria. Aqui vale para todos os caminhos —
// tela da equipe, portal da lojista e confirmação de proposta do chat — porque
// os três atravessam a mesma função.
//
// ===========================================================================
// LEITURA QUE FALHA NÃO BLOQUEIA
// ===========================================================================
//
// Erro de banco devolve lista vazia, e o efeito é exatamente o de antes desta
// função existir: o obrigatório continua ausente e a publicação é recusada com
// a mensagem que já existia. Uma leitura de ENRIQUECIMENTO não pode inventar um
// modo novo de falhar num caminho que já funcionava.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolverObrigatorios } from "@/modules/publication/domain/atributosDoMarketplace";
import type { AtributoExigido, ObrigatorioResolvido } from "../domain/exigenciasDoPayload";

/**
 * Os obrigatórios da categoria, resolvidos contra o cadastro DESTE anúncio.
 *
 * `cores` e `tamanhos` vão vazios de propósito. SIZE e COLOR moram em
 * `variations[].attribute_combinations`, e `obrigatoriosAusentes` os confere lá
 * — quando eles faltam, o que falta é a GRADE, que a esteira já cobra como
 * pendência e que nenhum atributo de cadastro repõe. Buscar variantes aqui seria
 * uma consulta a mais para responder o que outra camada já respondeu.
 */
export async function obrigatoriosDoCadastro(
  clienteId: string,
  registroId: string | null,
  exigencias: readonly AtributoExigido[]
): Promise<ObrigatorioResolvido[]> {
  if (!registroId || exigencias.length === 0) return [];
  try {
    const sb = getSupabaseAdmin();

    const { data: registro } = await sb
      .from("anuncios_gerados")
      .select("produto_id")
      .eq("id", registroId)
      .eq("cliente_id", clienteId)
      .maybeSingle();
    const produtoId = (registro as { produto_id?: string | null } | null)?.produto_id;
    if (!produtoId) return [];

    const [{ data: produto }, { data: atributos }] = await Promise.all([
      sb
        .from("produtos")
        .select("nome, marca, modelo")
        .eq("id", produtoId)
        .eq("cliente_id", clienteId)
        .maybeSingle(),
      sb
        .from("produto_atributos")
        .select("nome_atributo, valor_atributo")
        .eq("produto_id", produtoId),
    ]);
    if (!produto) return [];

    const p = produto as { nome?: string | null; marca?: string | null; modelo?: string | null };
    const doCadastro = new Map<string, string>();
    for (const a of (atributos ?? []) as { nome_atributo?: string; valor_atributo?: string | null }[]) {
      const nome = a.nome_atributo?.trim();
      const valor = a.valor_atributo?.trim();
      if (!nome || !valor || doCadastro.has(nome)) continue;
      doCadastro.set(nome, valor);
    }

    return resolverObrigatorios(
      {
        nome: p.nome ?? "",
        marca: p.marca ?? "",
        modelo: p.modelo ?? "",
        cores: [],
        tamanhos: [],
        atributos: doCadastro,
      },
      exigencias
    );
  } catch {
    return [];
  }
}
