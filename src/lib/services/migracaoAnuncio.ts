// Migração de anúncio — a CAMADA COM REDE da republicação.
//
// A regra (o que é republicar, o que é duplicar, o que perguntar) mora no núcleo
// puro: `modules/publication/domain/republicacao`. Aqui só existe o que precisa
// de mundo externo: ler os registros e encerrar um anúncio no Mercado Livre.

import {
  listarAnunciosGerados,
  listarAnunciosGeradosDoCliente,
  rejeitarAnuncioGerado,
} from "./anunciosGerados";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import {
  anunciosAtivosDoProduto,
  type AnuncioAtivo,
} from "../../modules/publication/domain/republicacao.ts";

export type { AnuncioAtivo };

/**
 * Busca no repositório os anúncios já vivos no ML para o mesmo produto.
 *
 * Escopado pelo cliente: um anúncio de OUTRO lojista jamais deve aparecer como
 * conflito — a duplicidade que o ML pune é dentro da mesma conta. Sem clienteId
 * (equipe/demo) cai na lista completa, que já vem filtrada pelo RLS.
 */
export async function buscarAnunciosAtivosDoProduto(
  clienteId: string | null | undefined,
  produtoId: string | null | undefined,
  registroAtualId: string
): Promise<AnuncioAtivo[]> {
  if (!produtoId) return [];
  const registros = clienteId
    ? await listarAnunciosGeradosDoCliente(clienteId)
    : await listarAnunciosGerados();
  return anunciosAtivosDoProduto(registros, produtoId, registroAtualId);
}

/**
 * ENCERRA um anúncio no Mercado Livre e reflete isso no registro local.
 *
 * Chamado apenas quando o lojista escolhe migrar. O encerramento no ML é
 * terminal; o registro local só é marcado depois que o ML confirma, para que o
 * histórico nunca afirme um encerramento que não aconteceu.
 */
export async function encerrarAnuncioNoML(
  clienteId: string,
  ativo: AnuncioAtivo,
  marketplace = "Mercado Livre"
): Promise<{ id: string; status: string }> {
  const resposta = await fetch("/api/ml/encerrar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ clienteId, itemId: ativo.mlItemId, marketplace }),
  });
  const dados = (await resposta.json()) as { id?: string; status?: string; erro?: string };
  if (!resposta.ok) {
    throw new Error(dados.erro ?? "Falha ao encerrar o anúncio no Mercado Livre.");
  }
  // O ML confirmou. O registro antigo deixa de valer como anúncio vivo — mas o
  // fato de ter existido permanece (nada é apagado).
  try {
    await rejeitarAnuncioGerado(ativo.registroId, "Encerrado no ML (migração de anúncio)");
  } catch {
    // O encerramento real já aconteceu; falhar ao anotar não pode mascará-lo.
  }
  return { id: dados.id ?? ativo.mlItemId, status: dados.status ?? "closed" };
}

/** O que sobrou por fazer depois de publicar o novo e tentar encerrar os antigos. */
export interface ResultadoMigracao {
  encerrados: string[];
  /** Anúncios que o ML recusou encerrar — precisam de ação manual. NUNCA calado. */
  falharam: { mlItemId: string; motivo: string }[];
}

/**
 * Encerra os anúncios antigos APÓS a publicação do novo.
 *
 * A ordem é deliberada: publica-se primeiro, encerra-se depois. Se fosse ao
 * contrário e a publicação falhasse, o lojista ficaria sem anúncio nenhum no ar —
 * um prejuízo real causado pela ferramenta. Na ordem correta, a pior falha
 * possível é uma janela curta com dois anúncios ativos, que é exatamente o que
 * acontece em qualquer migração feita à mão.
 *
 * Nunca lança: o anúncio novo já está no ar e esse fato não pode ser desfeito
 * por um erro posterior. O que falhou volta em `falharam` para ser dito ao
 * lojista — silenciar aqui deixaria um anúncio duplicado sem ninguém saber.
 */
export async function encerrarAntigosAposPublicar(
  clienteId: string,
  ativos: readonly AnuncioAtivo[],
  marketplace = "Mercado Livre"
): Promise<ResultadoMigracao> {
  const encerrados: string[] = [];
  const falharam: { mlItemId: string; motivo: string }[] = [];
  for (const ativo of ativos) {
    try {
      await encerrarAnuncioNoML(clienteId, ativo, marketplace);
      encerrados.push(ativo.mlItemId);
    } catch (e) {
      falharam.push({
        mlItemId: ativo.mlItemId,
        motivo: e instanceof Error ? e.message : "erro desconhecido",
      });
    }
  }
  return { encerrados, falharam };
}
