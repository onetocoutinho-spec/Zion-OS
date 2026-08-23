// A EXECUÇÃO de uma proposta de publicação — no servidor, a partir do que foi
// congelado, pelo mesmo caminho que a tela da equipe usa.
//
// A ORDEM É A SEGURANÇA, e é diferente da dos tipos atômicos (045–057): a
// publicação é um efeito EXTERNO — não cabe numa transação do banco. Então:
//
//   1. reservar   — `pendente` → `executada` atômico (`reservarParaExecucao`).
//                   Quem perder a corrida não publica. É o que impede o duplo
//                   clique em duas abas de criar dois anúncios.
//   2. publicar   — `publicarNoMercadoLivre`, com as MESMAS guardas da rota
//                   (conexão, credencial, infração que falha fechada).
//   3. gravar     — o registro do anúncio recebe o MLB, o permalink e o estado
//                   que o ML deu — a palavra do ML, não a nossa.
//   4. auditar    — `copilot_acoes`, nos dois desfechos.
//
// Se o ML recusar, a proposta vai para `falhou` com o motivo. A autorização foi
// consumida: um cartão que falhou não é um cartão para tentar de novo em
// silêncio — a pessoa pede de novo e recebe um ensaio NOVO, do estado de agora.
//
// ⚠️ Server-only.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  publicarNoMercadoLivre,
  type PedidoDePublicacao,
} from "@/modules/integration/application/publicarNoMercadoLivre";
import { lerPedidoCongelado, type PedidoCongelado } from "@/modules/assistant/domain/propostaDePublicacao";
import type { PropostaPersistida } from "@/modules/assistant/domain/propostaPersistida";
import { marcarProposta, registrarAcao, reservarParaExecucao } from "./copilotPropostas";

export type DesfechoDaPublicacao =
  | { ok: true; mlItemId: string; permalink: string | null; statusNoML: string | null; itens: number }
  | { ok: false; jaFeito: true }
  | { ok: false; jaFeito?: false; mensagem: string; motivo?: string };

/** O pedido, descongelado — ou `null` se o texto não for um pedido. Puro. */
export function pedidoDaProposta(p: PropostaPersistida): PedidoCongelado | null {
  if (p.tipo !== "publicacao") return null;
  const pedido = lerPedidoCongelado(p.texto);
  // O alvo da Proposal e o do pedido precisam ser o MESMO anúncio. Divergir
  // seria o texto publicando uma coisa e a auditoria registrando outra.
  if (!pedido || pedido.anuncioId !== p.alvos[0]) return null;
  return pedido;
}

export async function executarPublicacaoDaProposta(
  p: PropostaPersistida,
  usuario: string | null,
  credenciais: { clientId: string; clientSecret: string }
): Promise<DesfechoDaPublicacao> {
  const pedido = pedidoDaProposta(p);
  if (!pedido) {
    await marcarProposta(p.id, "falhou", "pedido congelado ilegível");
    return { ok: false, mensagem: "Essa proposta não tem o pedido de publicação. Peça de novo e eu monto outra." };
  }

  // 1) RESERVAR. Perdeu a corrida = outra requisição já está publicando (ou
  // publicou). Não é erro, e não se publica duas vezes.
  const reservou = await reservarParaExecucao(p.id);
  if (!reservou) {
    await registrarAcao({
      clienteId: p.clienteId,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: "confirmar:publicacao",
      alvos: p.alvos,
      antes: null,
      depois: null,
      resultado: "recusada",
      afetados: 0,
      erro: "corrida_perdida",
    });
    return { ok: false, jaFeito: true };
  }

  // 2) PUBLICAR — do que foi salvo. `clienteId` é o da Proposal (tenant já
  // conferido por quem chamou), nunca do pedido.
  const corpo: PedidoDePublicacao = {
    clienteId: p.clienteId,
    registroId: pedido.anuncioId,
    payload: pedido.payload,
    go: true,
    marketplace: pedido.marketplace,
    ...(pedido.tituloParaCategoria ? { tituloParaCategoria: pedido.tituloParaCategoria } : {}),
    ...(pedido.userProducts ? { userProducts: pedido.userProducts } : {}),
    mlbsDoProduto: pedido.mlbsDoProduto,
  };
  const r = await publicarNoMercadoLivre(corpo, credenciais, p.id);
  const id = typeof r.body.id === "string" ? r.body.id : null;

  if (r.status >= 400 || !id) {
    const mensagem = typeof r.body.erro === "string" ? r.body.erro : "Falha ao publicar no Mercado Livre.";
    await marcarProposta(p.id, "falhou", mensagem);
    await registrarAcao({
      clienteId: p.clienteId,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: "confirmar:publicacao",
      alvos: p.alvos,
      antes: { ensaio: pedido.ensaio },
      depois: r.body,
      resultado: "falhou",
      afetados: 0,
      erro: mensagem,
    });
    return {
      ok: false,
      mensagem,
      ...(typeof r.body.motivo === "string" ? { motivo: r.body.motivo } : {}),
    };
  }

  // 3) GRAVAR a palavra do ML no registro — as mesmas colunas que
  // `marcarAnuncioPublicado` escreve pelo navegador, com o tenant da Proposal.
  const permalink = typeof r.body.permalink === "string" ? r.body.permalink : null;
  const statusNoML = typeof r.body.status === "string" ? r.body.status.trim() : "";
  const itens = Array.isArray(r.body.itens) ? r.body.itens.length : 1;
  const { error } = await getSupabaseAdmin()
    .from("anuncios_gerados")
    .update({
      status: "publicado",
      ml_item_id: id,
      ...(permalink ? { ml_permalink: permalink } : {}),
      ...(statusNoML
        ? { status_marketplace: statusNoML, status_marketplace_em: new Date().toISOString() }
        : {}),
    })
    .eq("id", pedido.anuncioId)
    .eq("cliente_id", p.clienteId);
  // O anúncio ESTÁ no ar. Não gravar o registro é ruim; dizer que não está no
  // ar seria mentir na direção oposta. Vai para o log e para a auditoria.
  if (error) console.error("[copilot/publicacao] o ML publicou e o registro não foi atualizado:", error);

  // 4) AUDITAR.
  await registrarAcao({
    clienteId: p.clienteId,
    conversaId: p.conversaId,
    propostaId: p.id,
    executadaPor: usuario,
    ferramenta: "confirmar:publicacao",
    alvos: p.alvos,
    antes: { ensaio: pedido.ensaio },
    depois: { mlItemId: id, permalink, statusNoML: statusNoML || null, itens, registroAtualizado: !error },
    resultado: error ? "parcial" : "sucesso",
    afetados: 1,
    ...(error ? { erro: `registro não atualizado: ${error.message}` } : {}),
  });

  return { ok: true, mlItemId: id, permalink, statusNoML: statusNoML || null, itens };
}
