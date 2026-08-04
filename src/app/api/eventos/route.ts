// O destino que faltava.
//
// Antes desta rota, o sistema tinha 146 blocos `catch`, 50 `console.error` e
// nenhum lugar para onde qualquer um deles pudesse ir. As 9 rotas existentes
// (`agentes, assistente, consulta-peso, imagens, loja, ml, otimizar, usuarios,
// versao`) fazem o Zion FALAR com o navegador; nenhuma o deixava OUVIR.
//
// DUAS DECISÕES QUE A ROTA TOMA
//
// Grava com `service_role`, e não com o token de quem chama. A falha mais
// interessante é a que acontece quando o RLS está barrando — se a gravação do
// evento passasse pelas mesmas políticas que causaram o defeito, ela falharia
// exatamente nos casos que existem para ser vistos. O `cliente_id` vem do
// PERFIL do servidor, nunca do corpo da requisição, então gravar com poder de
// administrador não deixa ninguém escrever no nome de outro.
//
// Nunca devolve erro por causa do conteúdo. Um payload torto vira uma linha a
// menos, e não um erro no console de quem já estava com problema — o que
// produziria um evento sobre o evento. `202` é a resposta certa: "recebi, e o
// que acontece com isso não é problema seu".

import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  LIMITE_CHAVES_CONTEXTO,
  validarEventoRecebido,
  type EventoRedigido,
} from "@/modules/observability/domain/evento";

/** Teto por requisição — o cliente já agrega; isto é a barreira, não o normal. */
const MAXIMO_POR_LOTE = 50;

export async function POST(request: Request) {
  let contexto;
  try {
    contexto = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ gravados: 0 }, { status: 202 });
  }

  const lista = (corpo as { eventos?: unknown })?.eventos;
  if (!Array.isArray(lista)) return Response.json({ gravados: 0 }, { status: 202 });

  const validos = lista
    .slice(0, MAXIMO_POR_LOTE)
    .map(validarEventoRecebido)
    .filter((e): e is EventoRedigido => e !== null);
  if (validos.length === 0) return Response.json({ gravados: 0 }, { status: 202 });

  // Do PERFIL, nunca do corpo — ver a nota no topo.
  const clienteId = contexto.perfil.clienteId;

  // Quantos o cliente teve de descartar por excesso: é sinal de que algo está
  // em laço, e some se não for registrado junto.
  const descartados = (corpo as { descartados?: unknown })?.descartados;

  const linhas = validos.map((e) => ({
    cliente_id: clienteId,
    tipo: e.tipo,
    origem: e.origem,
    severidade: e.severidade,
    mensagem: e.mensagem,
    contexto:
      typeof descartados === "number" && descartados > 0
        ? { ...limitar(e.contexto), descartados_na_janela: descartados }
        : limitar(e.contexto),
    repeticoes: e.repeticoes,
  }));

  try {
    const { error } = await getSupabaseAdmin().from("eventos").insert(linhas);
    if (error) return Response.json({ gravados: 0, erro: error.message }, { status: 202 });
  } catch {
    // A rota de telemetria não pode ser a que derruba a requisição.
    return Response.json({ gravados: 0 }, { status: 202 });
  }

  return Response.json({ gravados: linhas.length }, { status: 202 });
}

/** Reserva espaço para `descartados_na_janela` sem estourar o teto de chaves. */
function limitar(
  contexto: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const entradas = Object.entries(contexto).slice(0, LIMITE_CHAVES_CONTEXTO - 1);
  return Object.fromEntries(entradas);
}
