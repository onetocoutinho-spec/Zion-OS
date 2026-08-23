// A EXECUÇÃO de uma proposta de imagem — reservar, cobrar a cota, gerar a
// versão (bucket privado), auditar. ⚠️ Server-only.
//
// A mesma ordem da publicação: reserva atômica primeiro (duplo clique não
// gera duas vezes), cota antes do provedor (é a chamada mais cara por
// unidade), e o desfecho — inclusive a falha — em `copilot_acoes`.

import { gerarVersaoDeImagem } from "./imagensVersoes";
import { lerPedidoDeImagem } from "@/modules/assistant/domain/propostaDeImagem";
import type { PropostaPersistida } from "@/modules/assistant/domain/propostaPersistida";
import { marcarProposta, registrarAcao, reservarParaExecucao } from "./copilotPropostas";
import { cobrarCota, reservaNoBanco } from "@/lib/agentes/cotaDeIA";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ContextoAutorizado } from "@/lib/auth/serverAuthorization";

export type DesfechoDaImagem =
  | { ok: true; versaoId: string; url: string | null; slot: string }
  | { ok: false; jaFeito: true }
  | { ok: false; jaFeito?: false; mensagem: string };

export async function executarImagemDaProposta(
  p: PropostaPersistida,
  ctx: Pick<ContextoAutorizado, "perfil" | "usuario">
): Promise<DesfechoDaImagem> {
  const usuario = ctx.usuario?.id ?? null;
  const pedido = p.tipo === "imagem" ? lerPedidoDeImagem(p.texto) : null;
  if (!pedido || pedido.produtoId !== p.alvos[0]) {
    await marcarProposta(p.id, "falhou", "pedido de imagem ilegível");
    return { ok: false, mensagem: "Essa proposta não tem o pedido de imagem. Peça de novo e eu monto outra." };
  }
  const auditar = (resultado: "sucesso" | "falhou" | "recusada", depois: unknown, erro?: string) =>
    registrarAcao({
      clienteId: p.clienteId, conversaId: p.conversaId, propostaId: p.id, executadaPor: usuario,
      ferramenta: "confirmar:imagem", alvos: p.alvos, antes: { pedido }, depois,
      resultado, afetados: resultado === "sucesso" ? 1 : 0, ...(erro ? { erro } : {}),
    });

  const reservou = await reservarParaExecucao(p.id);
  if (!reservou) {
    await auditar("recusada", null, "corrida_perdida");
    return { ok: false, jaFeito: true };
  }

  // A COTA, antes do provedor. O lojista paga pela loja da proposta; agência e
  // equipe seguem sem cota (ver cotaDeIA.ts) — o tenant da cota é o perfil.
  if (ctx.perfil.clienteId) {
    const cota = await cobrarCota(ctx, "imagem", reservaNoBanco(getSupabaseAdmin()));
    if (!cota.ok) {
      await marcarProposta(p.id, "falhou", cota.motivo);
      await auditar("recusada", null, cota.motivo);
      return { ok: false, mensagem: cota.motivo };
    }
  }

  const r = await gerarVersaoDeImagem({
    clienteId: p.clienteId,
    usuarioId: usuario,
    produtoId: pedido.produtoId,
    produtoNome: pedido.produtoNome,
    slot: pedido.slot,
    instrucao: pedido.instrucao,
    paiId: pedido.paiId ?? null,
    feedback: pedido.feedback ?? null,
    beneficios: pedido.beneficios ?? null,
    propostaId: p.id,
  });
  if (!r.ok) {
    await marcarProposta(p.id, "falhou", r.mensagem);
    await auditar("falhou", null, r.mensagem);
    return { ok: false, mensagem: r.mensagem };
  }
  await auditar("sucesso", { versaoId: r.versao.id, slot: r.versao.slot, caminho: r.versao.caminho });
  return { ok: true, versaoId: r.versao.id, url: r.url, slot: r.versao.slot };
}
