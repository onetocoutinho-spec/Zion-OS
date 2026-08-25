// "COMPARA MINHAS LOJAS" — a leitura de quem opera várias.
//
// Só agência e equipe chegam aqui: o lojista tem uma loja e a pergunta não
// faz sentido para ele. As lojas vêm do BANCO pelo alcance da sessão — a
// agência só enxerga `clientes.agencia_id = a dela`; a equipe, todas — e cada
// uma é medida pela MESMA conta do contexto do Copilot
// (`contextoDoCopilotNoServidor`), para os números baterem com o que a
// própria loja veria. (Auditoria do Copilot, 2026-08-22, NEXT item 6.)
//
// Decisão de produto registrada aqui: a comparação é de PRONTIDÃO (cadastro,
// anúncio, conexão, infração), não de vendas. Vendas por loja exigiria uma
// chamada ao Mercado Livre por loja com a credencial de cada uma; quem quiser
// o número de vendas de UMA loja pergunta dentro dela.
//
// ⚠️ Server-only.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { contextoDoCopilotNoServidor } from "@/lib/services/contextoDoCopilot";
import type { ContextoAutorizado } from "@/lib/auth/serverAuthorization";
import type { EstadoDaLoja } from "@/modules/publication/domain/prontidaoDaLoja";

/** O teto de lojas medidas numa resposta. Acima disso a resposta vira planilha. */
export const MAXIMO_DE_LOJAS_COMPARADAS = 15;

export interface LojaComparada {
  id: string;
  nome: string;
  estado: EstadoDaLoja;
}

export type ComparacaoDeLojas =
  | { ok: true; lojas: LojaComparada[]; totalNoAlcance: number; truncado: boolean }
  | { ok: false; motivo: "so_uma_loja" | "sem_lojas"; mensagem: string };

export async function compararLojas(ctx: ContextoAutorizado): Promise<ComparacaoDeLojas> {
  if (ctx.perfil.papel === "cliente") {
    return { ok: false, motivo: "so_uma_loja", mensagem: "Esta conta opera uma loja só — não há o que comparar." };
  }
  const admin = getSupabaseAdmin();
  let consulta = admin.from("clientes").select("id, nome", { count: "exact" }).order("nome").limit(MAXIMO_DE_LOJAS_COMPARADAS);
  if (ctx.perfil.papel === "agencia") {
    if (!ctx.perfil.agenciaId) return { ok: false, motivo: "sem_lojas", mensagem: "Esta agência ainda não tem lojas vinculadas." };
    consulta = consulta.eq("agencia_id", ctx.perfil.agenciaId);
  }
  const { data, count, error } = await consulta;
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as { id: string; nome: string | null }[];
  if (linhas.length === 0) return { ok: false, motivo: "sem_lojas", mensagem: "Nenhuma loja no alcance desta conta." };

  // Uma medição por loja, em paralelo com teto — são cinco consultas cada.
  const lojas: LojaComparada[] = [];
  for (let i = 0; i < linhas.length; i += 5) {
    const lote = linhas.slice(i, i + 5);
    const medidas = await Promise.all(
      lote.map(async (l) => ({
        id: l.id,
        nome: l.nome ?? "(sem nome)",
        estado: (await contextoDoCopilotNoServidor(l.id, null)).pergunta.loja,
      }))
    );
    lojas.push(...medidas);
  }
  const totalNoAlcance = count ?? linhas.length;
  return { ok: true, lojas, totalNoAlcance, truncado: totalNoAlcance > lojas.length };
}
