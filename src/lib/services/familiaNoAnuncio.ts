// "Estão agrupados no Mercado Livre?" — a leitura viva que responde.
//
// O Zion não guarda o vínculo de família (conferido no banco em 24/08/2026:
// nenhuma coluna, e o jsonb `anuncio` só tem conteúdo gerado). Guardar na
// importação responderia com o retrato do dia da última importação; a pergunta
// é sobre AGORA — quem acabou de agrupar no painel quer ver agrupado.
//
// Uma grade de calçado inteira cabe em UMA chamada ao multiget. O preço de
// estar certo é baixo o bastante para valer sempre.
//
// FALHA ABERTA, e de propósito: se o ML não responder, quem pergunta continua
// recebendo o diagnóstico da grade, e a parte que faltou vira "não sei" — a
// mesma frase honesta de antes desta leitura existir. O contrário
// (`tituloNoAnuncio`) falha FECHADA porque lá se escreve; aqui só se lê.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { familiasDosItens, renovarToken, type LeituraDeFamilias } from "@/lib/marketplaces/mercadolivre";
import {
  atualizarRefreshTokenServidor,
  clienteDaCredencial,
  lerCanalServidor,
} from "@/modules/integration/infrastructure/canalServidor";

const MARKETPLACE = "Mercado Livre";

/** Teto de anúncios lidos numa pergunta. 5 chamadas ao ML, no pior caso. */
const MAXIMO_DE_ITENS = 100;

/**
 * A família dos anúncios DESTE produto, lida no Mercado Livre agora.
 *
 * O tenant vem do argumento e entra no `.eq("cliente_id")` — nunca do modelo.
 * Um produtoId de outra agência não devolve linha, e sem linha não há MLB para
 * perguntar: a fronteira é a consulta, não a instrução.
 */
export async function familiaDosAnunciosDoProduto(
  clienteId: string,
  produtoId: string,
  credenciais: { clientId: string; clientSecret: string }
): Promise<LeituraDeFamilias | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("anuncios_gerados")
    .select("ml_item_id")
    .eq("cliente_id", clienteId)
    .eq("produto_id", produtoId)
    .not("ml_item_id", "is", null)
    .limit(MAXIMO_DE_ITENS);
  if (error) {
    // O log existe porque foi a AUSÊNCIA dele que deixou o defeito de
    // `criado_em` viver duas semanas: o catch devolvia null e null parecia
    // "não há anúncio". Ver `colunasQueExistem.test.ts`.
    console.error("[familiaNoAnuncio] falha ao ler os MLBs do produto:", error.message);
    return null;
  }
  const mlbs = ((data ?? []) as { ml_item_id: string | null }[])
    .map((l) => l.ml_item_id)
    .filter((m): m is string => Boolean(m));
  if (mlbs.length === 0) return null;

  const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, MARKETPLACE);
  if (!canal?.refreshToken) return null;

  try {
    const tokens = await renovarToken({ ...credenciais, refreshToken: canal.refreshToken });
    await atualizarRefreshTokenServidor(clienteDaCredencial(), clienteId, tokens.refreshToken, MARKETPLACE);
    return await familiasDosItens(tokens.accessToken, mlbs);
  } catch (e) {
    console.error("[familiaNoAnuncio] não consegui ler a família no ML:", e instanceof Error ? e.message : e);
    // Credencial recusada ou ML fora: TODOS ficam desconhecidos. Devolver
    // `{lidos: [], naoLidos: mlbs}` e não `null` preserva a diferença entre
    // "não perguntei" e "perguntei e não soube" — quem monta a frase precisa
    // dela para dizer sobre quantos anúncios ficou sem saber.
    return { lidos: [], naoLidos: mlbs };
  }
}
