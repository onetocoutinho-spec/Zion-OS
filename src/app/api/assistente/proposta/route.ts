// A confirmação de uma proposta do Copilot.
//
// Esta rota é o ÚNICO caminho por onde uma ação do chat vira escrita. Ela
// existe porque a confirmação não pode ser um objeto que o navegador montou:
// um objeto vindo do cliente pode ser qualquer coisa, e "o lojista aprovou"
// precisa ser um fato verificável, não uma afirmação da tela.
//
// A ORDEM É A SEGURANÇA, e cada passo existe por um motivo:
//
//   1. autenticar        — o tenant vem da SESSÃO, nunca do corpo
//   2. carregar          — a proposta vem do BANCO, não da requisição
//   3. revalidar         — tenant, status, prazo e o ESTADO DO MUNDO agora
//   4. reservar          — transição atômica `pendente` → `executada`
//   5. executar          — pelo MESMO serviço de domínio que a tela usa
//   6. auditar           — inclusive as recusas
//
// Inverter 3 e 4 deixaria uma janela para duas requisições passarem na
// revalidação e as duas gravarem. Inverter 4 e 5 deixaria a janela oposta:
// duas gravam e só uma marca.
//
// A INVARIANTE DO COPILOT CONTINUA INTACTA. Esta rota não é uma ferramenta do
// modelo: ele não a conhece e não pode chamá-la. Ela é acionada por um clique
// humano carregando um id de proposta. `Efeito` continua com dois valores.

import {
  buscarProposta,
  marcarProposta,
  registrarAcao,
  reservarParaExecucao,
} from "@/lib/services/copilotPropostas";
import {
  explicarImpedimento,
  podeExecutar,
  type EstadoAtual,
  type PropostaPersistida,
} from "@/modules/assistant/domain/propostaPersistida";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

export const maxDuration = 30;

/**
 * Lê AGORA os campos que a proposta observou quando nasceu.
 *
 * Só os campos das precondições — não o produto inteiro. O que não foi
 * observado na criação não pode invalidar a execução: seria recusar por uma
 * mudança que ninguém prometeu vigiar.
 */
async function lerEstadoAtual(p: PropostaPersistida): Promise<EstadoAtual> {
  const admin = getSupabaseAdmin();
  const campos = new Set(p.precondicoes.map((c) => c.campo));
  const estado: Record<string, number | null> = {};
  const produtoId = p.alvos[0];

  // ---- LOTE: uma precondicao POR ALVO, na forma `variacoesSemPeso:<id>`.
  //
  // Cada alvo e relido do banco e conferido contra o TENANT DA PROPOSTA. Nao
  // basta validar a Proposal: um id de outro cliente dentro do array seria um
  // vetor para escrever fora do tenant. O `.eq("cliente_id", ...)` no produto
  // pai e o que fecha isso — alvo que nao pertence ao cliente nao e encontrado
  // e vira `null`, que o dominio trata como mudanca e invalida tudo.
  const porAlvo = [...campos].filter((c) => c.startsWith("variacoesSemPeso:"));
  if (porAlvo.length > 0) {
    const idsDaProposta = porAlvo.map((c) => c.slice("variacoesSemPeso:".length));
    const { data: doTenant } = await admin
      .from("produtos")
      .select("id")
      .in("id", idsDaProposta)
      .eq("cliente_id", p.clienteId);
    const permitidos = new Set(((doTenant ?? []) as { id: string }[]).map((r) => r.id));

    const { data: vars } = await admin
      .from("produto_variantes")
      .select("produto_id, peso")
      .in("produto_id", idsDaProposta);
    const semPeso = new Map<string, number>();
    for (const v of (vars ?? []) as { produto_id: string; peso: number | null }[]) {
      if (!v.peso || v.peso <= 0) semPeso.set(v.produto_id, (semPeso.get(v.produto_id) ?? 0) + 1);
    }
    for (const id of idsDaProposta) {
      estado[`variacoesSemPeso:${id}`] = permitidos.has(id) ? (semPeso.get(id) ?? 0) : null;
    }
    return estado;
  }

  if (campos.has("custo")) {
    const { data } = await admin
      .from("produtos")
      .select("custo")
      .eq("id", produtoId)
      .maybeSingle();
    // Produto sumiu ou custo nulo: `null`, que o domínio trata como mudança se
    // havia valor. Supor "continua o mesmo" gravaria sobre o desconhecido.
    const c = (data as { custo?: number | null } | null)?.custo;
    estado.custo = c === null || c === undefined ? null : Number(c);
  }

  if (campos.has("variacoesSemPeso")) {
    const { data } = await admin
      .from("produto_variantes")
      .select("id, peso")
      .eq("produto_id", produtoId);
    const linhas = (data ?? []) as { peso: number | null }[];
    estado.variacoesSemPeso = linhas.filter((v) => !v.peso || v.peso <= 0).length;
  }

  return estado;
}

/** Executa a escrita pelo mesmo caminho que a tela usa. Nunca um segundo. */
async function gravar(
  p: PropostaPersistida
): Promise<{ afetados: number; antes: unknown; depois: unknown }> {
  const admin = getSupabaseAdmin();
  const produtoId = p.alvos[0];

  if (p.tipo === "custo") {
    const { data: antes } = await admin
      .from("produtos")
      .select("custo")
      .eq("id", produtoId)
      .maybeSingle();
    const { data, error } = await admin
      .from("produtos")
      .update({ custo: p.valor })
      .eq("id", produtoId)
      .eq("cliente_id", p.clienteId)
      .select("id, custo");
    if (error) throw new Error(error.message);
    return { afetados: data?.length ?? 0, antes, depois: data?.[0] ?? null };
  }

  // ---- LOTE de peso: grava nos ALVOS APROVADOS, e so neles.
  //
  // `.in("produto_id", p.alvos)` usa a LISTA da Proposal — nunca um filtro
  // reexecutado. A 48a variante que apareceu depois nao esta em `p.alvos` e
  // por isso nao e tocada.
  if (p.alvos.length > 1) {
    const emKgLote = p.valor / 1000;
    const { data: antesLote } = await admin
      .from("produto_variantes")
      .select("id, produto_id, peso")
      .in("produto_id", p.alvos);
    const { data, error } = await admin
      .from("produto_variantes")
      .update({ peso: emKgLote })
      .in("produto_id", p.alvos)
      .eq("cliente_id", p.clienteId)
      .select("id, produto_id");
    if (error) throw new Error(error.message);
    return {
      afetados: data?.length ?? 0,
      // RESUMO, nao a lista inteira: com milhares de alvos o payload de
      // auditoria viraria um problema proprio. O que precisa ser reconstruivel
      // sao os IDS (ja em `alvos`) e o ESTADO — a contagem por alvo basta.
      antes: {
        variacoesLidas: (antesLote ?? []).length,
        semPesoAntes: ((antesLote ?? []) as { peso: number | null }[]).filter(
          (v) => !v.peso || v.peso <= 0
        ).length,
      },
      depois: { variacoesAtualizadas: data?.length ?? 0, pesoKg: emKgLote },
    };
  }

  // PESO individual — em quilos na base, gramas na proposta.
  const emKg = p.valor / 1000;
  const { data: antes } = await admin
    .from("produto_variantes")
    .select("id, peso")
    .eq("produto_id", produtoId);
  const { data, error } = await admin
    .from("produto_variantes")
    .update({ peso: emKg })
    .eq("produto_id", produtoId)
    .eq("cliente_id", p.clienteId)
    .select("id, peso");
  if (error) throw new Error(error.message);
  return { afetados: data?.length ?? 0, antes, depois: data ?? null };
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  // O TENANT VEM DAQUI. Nunca do corpo — é a diferença entre autorização e
  // uma string que o navegador escolheu.
  const clienteDaSessao = ctx.perfil.clienteId;
  if (!clienteDaSessao) {
    return Response.json({ erro: "Sessão sem cliente associado." }, { status: 403 });
  }
  const usuario = ctx.usuario?.id ?? null;

  let corpo: { propostaId?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  const propostaId = (corpo.propostaId ?? "").trim();
  if (!propostaId) {
    return Response.json({ erro: "Proposta não informada." }, { status: 400 });
  }

  const proposta = await buscarProposta(propostaId);
  const estadoAtual = proposta ? await lerEstadoAtual(proposta) : {};
  const veredicto = podeExecutar(
    proposta,
    clienteDaSessao,
    new Date().toISOString(),
    estadoAtual
  );

  if (!veredicto.pode) {
    const i = veredicto.impedimento;
    // A RECUSA É AUDITADA. Proposta de outro tenant, obsoleta e confirmação
    // duplicada só aparecem no rastro se forem gravadas — auditar apenas o
    // sucesso registraria exatamente o que não precisa ser investigado.
    await registrarAcao({
      clienteId: clienteDaSessao,
      conversaId: proposta?.conversaId ?? null,
      propostaId: proposta?.id ?? null,
      executadaPor: usuario,
      ferramenta: `confirmar:${proposta?.tipo ?? "desconhecida"}`,
      alvos: proposta?.clienteId === clienteDaSessao ? (proposta?.alvos ?? []) : [],
      antes: null,
      depois: null,
      resultado: "recusada",
      afetados: 0,
      erro: i.motivo,
    });
    // Uma proposta obsoleta não fica pendente esperando outro clique: ela morre
    // aqui, e o lojista pede de novo com os dados de agora.
    if (i.motivo === "obsoleta" && proposta) await marcarProposta(proposta.id, "obsoleta");
    if (i.motivo === "expirada" && proposta) await marcarProposta(proposta.id, "expirada");

    return Response.json(
      {
        ok: false,
        motivo: i.motivo,
        mensagem: explicarImpedimento(i),
        // `ja_executada` não é erro: é o duplo clique encontrando o trabalho
        // feito. Devolver 409 faria a tela mostrar falha para algo que deu certo.
        ...(i.motivo === "ja_executada" ? { jaFeito: true } : {}),
      },
      { status: i.motivo === "ja_executada" ? 200 : 409 }
    );
  }

  // A proposta existe, é deste cliente, está pendente, no prazo, e o mundo não
  // mudou. AGORA a corrida: quem reservar, executa.
  const p = proposta as PropostaPersistida;
  const reservou = await reservarParaExecucao(p.id);
  if (!reservou) {
    // Perdeu a corrida para outra requisição da mesma proposta. Não é erro.
    await registrarAcao({
      clienteId: clienteDaSessao,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: `confirmar:${p.tipo}`,
      alvos: p.alvos,
      antes: null,
      depois: null,
      resultado: "recusada",
      afetados: 0,
      erro: "corrida_perdida",
    });
    return Response.json({ ok: false, jaFeito: true, mensagem: "Isso já foi feito — não repeti a gravação." });
  }

  try {
    const { afetados, antes, depois } = await gravar(p);
    await registrarAcao({
      clienteId: clienteDaSessao,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: `confirmar:${p.tipo}`,
      alvos: p.alvos,
      antes,
      depois,
      // Zero linhas com a reserva feita significa que o alvo sumiu entre a
      // revalidação e a escrita. Chamar isso de sucesso seria mentir.
      resultado: afetados === 0 ? "falhou" : "sucesso",
      afetados,
    });
    if (afetados === 0) {
      await marcarProposta(p.id, "falhou", "nenhuma linha afetada");
      return Response.json(
        { ok: false, mensagem: "Não consegui gravar — o produto não foi encontrado." },
        { status: 409 }
      );
    }
    return Response.json({ ok: true, afetados, mensagem: `Pronto. ${p.resumo}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha desconhecida";
    console.error("[copilot/proposta] falha ao executar:", e);
    await marcarProposta(p.id, "falhou", msg);
    await registrarAcao({
      clienteId: clienteDaSessao,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: `confirmar:${p.tipo}`,
      alvos: p.alvos,
      antes: null,
      depois: null,
      resultado: "falhou",
      afetados: 0,
      erro: msg,
    });
    // NUNCA afirmar sucesso num erro. A proposta fica `falhou` e não volta a
    // ser executável — pedir de novo monta uma nova, com o estado de agora.
    return Response.json(
      { ok: false, mensagem: "Não consegui gravar agora. Nada foi alterado por mim." },
      { status: 502 }
    );
  }
}
