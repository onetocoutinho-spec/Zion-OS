// POST /api/catalogo/custos/procedencia — registra de onde veio um custo
// gravado FORA da tela de Custos da loja.
//
// ============================================================
// A LACUNA QUE ISTO FECHA
// ============================================================
//
// A tela de Custos lê `procedencia_de_campo` para responder "de onde veio
// esse custo?" — mas até aqui só ELA MESMA gravava nessa tabela. Dois outros
// caminhos escrevem `produtos.custo` normalmente e nunca deixaram rastro:
//
//   `definirCustoEscolhido` (importacaoCustos.ts) — a caixa de custo da tela
//   de Precificação E a caixa de resolver ambíguos pós-importação;
//
//   `importarCustos` (importacaoCustos.ts) — a gravação em massa das linhas
//   de planilha que casaram SEM disputa (a maioria de uma importação).
//
// Sem esta rota, todo custo definido por esses dois caminhos nasce e
// permanece "Confirmado / origem não registrada" na tela — o mesmo selo que
// um valor de procedência genuinamente desconhecida, mesmo tendo sido uma
// pessoa (ou uma planilha nomeada) quem acabou de afirmar o número.
//
// ============================================================
// POR QUE ROTA, E NÃO CHAMAR registrarProcedencia DIRETO
// ============================================================
//
// `definirCustoEscolhido` e `importarCustos` rodam no NAVEGADOR (gravam
// `produtos.custo` via RLS, com o cliente do navegador). `registrarProcedencia`
// exige `getSupabaseAdmin()` — server-only por contrato (ver o cabeçalho de
// `procedencia.ts`). Esta rota é a ponte, com a mesma autorização de tenant
// das outras rotas de Custos.
//
// ============================================================
// ORIGEM/MÉTODO SÃO FIXOS, NÃO LIVRES
// ============================================================
//
// Esta rota não é um registrador genérico — aceita só as DUAS combinações que
// os dois caminhos de fato produzem (ver COMBINACOES_PERMITIDAS). Aceitar uma
// origem livre do corpo da requisição deixaria um cliente autenticado forjar,
// por exemplo, `origem: "zion"` (o Zion calculou) para uma edição que foi
// manual dela.

import { adminConfigurado } from "@/lib/supabase/admin";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { registrarVarias, type RegistroDeProcedencia } from "@/lib/services/procedencia";

interface ItemDeProcedencia {
  produtoId: string;
  valor: number;
  valorAnterior: number | null;
  origem: "cliente" | "planilha";
  metodo: "cadastro_manual" | "importacao";
}

interface Corpo {
  clienteId?: string;
  registros?: ItemDeProcedencia[];
}

/** As ÚNICAS combinações que esta rota aceita — ver o cabeçalho do arquivo. */
const COMBINACOES_PERMITIDAS = new Set(["cliente|cadastro_manual", "planilha|importacao"]);

function itemValido(x: unknown): x is ItemDeProcedencia {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.produtoId !== "string" || !o.produtoId) return false;
  if (typeof o.valor !== "number" || !Number.isFinite(o.valor) || !(o.valor > 0)) return false;
  if (o.valorAnterior !== null && typeof o.valorAnterior !== "number") return false;
  if (typeof o.origem !== "string" || typeof o.metodo !== "string") return false;
  return COMBINACOES_PERMITIDAS.has(`${o.origem}|${o.metodo}`);
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

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, corpo.clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (!adminConfigurado()) {
    return Response.json({ erro: "Indisponível no momento." }, { status: 503 });
  }

  const registros = (corpo.registros ?? []).filter(itemValido);
  if (registros.length === 0) {
    return Response.json({ ok: true, gravados: 0 });
  }

  const clienteId = corpo.clienteId;
  // O ATOR VEM DA SESSÃO, NUNCA DO CORPO — o mesmo motivo de sempre: um valor
  // que a requisição poderia forjar não pode decidir quem afirmou o quê.
  const ator = ctx.usuario?.id ?? null;

  const payload: RegistroDeProcedencia[] = registros.map((r) => ({
    clienteId,
    entidade: { tipo: "produto", id: r.produtoId },
    campo: "custo",
    valor: String(r.valor),
    valorAnterior: r.valorAnterior != null ? String(r.valorAnterior) : null,
    origem: r.origem,
    metodo: r.metodo,
    ator,
  }));

  // NUNCA LANÇA (contrato de `registrarVarias`) — best-effort de propósito: um
  // rastro perdido é ruim, mas não pode derrubar uma resposta cujo custo já
  // foi gravado antes desta chamada.
  await registrarVarias(payload);

  return Response.json({ ok: true, gravados: payload.length });
}
