// POST /api/catalogo/custos/pendencias — grava as disputas de custo que uma
// importação de planilha encontrou (migração 087).
//
// POR QUE ROTA, E NÃO ESCRITA DIRETA DO NAVEGADOR
//
// `custo_pendencias` não tem policy de insert para `authenticated` — só
// `service_role` escreve nela. A criação de uma pendência não é uma decisão da
// lojista (ela não pediu para o conflito existir); é um FATO que a importação
// observou, e fica mais simples auditar quem pode gravar fato quando é sempre
// o mesmo caminho.
//
// UPSERT POR PRODUTO, NÃO INSERT CEGO
//
// Só pode haver uma pendência ABERTA por produto (índice único parcial da
// 087). Uma segunda importação com nova disputa sobre o MESMO produto
// atualiza os candidatos da pendência existente em vez de tentar abrir outra
// e esbarrar no índice.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { respostaDeErro } from "@/lib/http/respostaDeErro";
import type { CandidatoDeCusto } from "@/modules/catalog/domain/custosDoCatalogo";

interface ItemAmbiguo {
  produtoId: string;
  candidatos: CandidatoDeCusto[];
}

interface Corpo {
  clienteId?: string;
  itens?: ItemAmbiguo[];
}

function itemValido(x: unknown): x is ItemAmbiguo {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.produtoId !== "string" || !o.produtoId) return false;
  if (!Array.isArray(o.candidatos) || o.candidatos.length < 2) return false;
  return o.candidatos.every(
    (c) =>
      c &&
      typeof c === "object" &&
      typeof (c as Record<string, unknown>).custo === "number" &&
      typeof (c as Record<string, unknown>).origem === "string"
  );
}

export async function POST(request: Request) {
  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  if (!corpo?.clienteId) {
    return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  }

  try {
    await exigirAcessoAoCliente(request, corpo.clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (!adminConfigurado()) {
    return Response.json({ erro: "Indisponível no momento." }, { status: 503 });
  }

  const itens = (corpo.itens ?? []).filter(itemValido);
  if (itens.length === 0) {
    return Response.json({ ok: true, gravados: 0 });
  }

  const admin = getSupabaseAdmin();
  const clienteId = corpo.clienteId;

  try {
    // Uma pendência aberta por produto: lê as que já existem para decidir
    // insert (produto sem pendência aberta) vs. update (já havia uma — a nova
    // importação trouxe candidatos mais recentes para a MESMA disputa).
    const { data: abertas, error: erroLeitura } = await admin
      .from("custo_pendencias")
      .select("id, produto_id")
      .eq("cliente_id", clienteId)
      .in(
        "produto_id",
        itens.map((i) => i.produtoId)
      )
      .is("resolvido_em", null);
    if (erroLeitura) throw new Error(erroLeitura.message);

    const idAbertaPorProduto = new Map<string, string>();
    for (const linha of abertas ?? []) {
      idAbertaPorProduto.set(linha.produto_id as string, linha.id as string);
    }

    let gravados = 0;
    for (const item of itens) {
      const idExistente = idAbertaPorProduto.get(item.produtoId);
      if (idExistente) {
        const { error } = await admin
          .from("custo_pendencias")
          .update({ candidatos: item.candidatos, criado_em: new Date().toISOString() })
          .eq("id", idExistente);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await admin.from("custo_pendencias").insert({
          cliente_id: clienteId,
          produto_id: item.produtoId,
          candidatos: item.candidatos,
        });
        if (error) throw new Error(error.message);
      }
      gravados++;
    }

    return Response.json({ ok: true, gravados });
  } catch (e) {
    return respostaDeErro("catalogo/custos/pendencias", e, "Não foi possível registrar a disputa de custo.");
  }
}
