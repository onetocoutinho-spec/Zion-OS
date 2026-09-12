// POST /api/agencia/loja — a agência põe uma loja NOVA na própria carteira.
//
// ===========================================================================
// O QUE ISTO DESTRAVA
// ===========================================================================
//
// A 054 deu à agência `select` e `update` em `clientes`, e recusou `insert`
// com um motivo escrito: "Criar loja é provisionamento e já tem caminho com
// sessão validada (`/api/loja/provisionar`)".
//
// Só que aquele caminho é o do AUTOCADASTRO: ele exige quem ainda NÃO tem
// perfil e cria um perfil de lojista para o próprio requisitante. Uma agência
// tem perfil, e não quer virar lojista — ela quer uma loja a mais na carteira.
// Então o caminho prometido não servia, e a consequência aparecia na tela: o
// `AppShell` esconde "adicionar loja" de quem é agência
// (`podeAdicionarLoja={perfil?.papel !== "agencia"}`), porque o formulário
// escreve pelo navegador e o RLS recusaria em silêncio.
//
// Esta rota é o caminho que a 054 supôs que existisse.
//
// ===========================================================================
// O QUE ELA NÃO FAZ, DE PROPÓSITO
// ===========================================================================
//
// Não REIVINDICA loja existente. Deixar uma agência apontar para uma loja que
// já existe e chamá-la de sua seria permitir que qualquer agência tomasse
// qualquer loja self-service — a carteira alheia a um `update` de distância.
// Trazer uma loja que já opera para uma agência exige o consentimento da loja,
// que é outra funcionalidade, com aperto de mão.
//
// Aqui a loja NASCE dentro da carteira. Não há dono anterior para consultar.
//
// ===========================================================================
// A AGÊNCIA VEM DO PERFIL
// ===========================================================================
//
// O corpo traz só o nome. A `agencia_id` é lida do perfil do servidor, como o
// `papel` em `/api/loja/provisionar` — um corpo que pudesse dizer a agência
// seria a diferença entre pôr uma loja na própria carteira e pôr na de outro.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { validarPedidoDeLoja } from "@/modules/onboarding/domain/criacaoDeLoja";

/** Os mesmos padrões de quem entra sozinho — a loja da agência não é menor. */
const PLANO_INICIAL = "Essencial";
const LIMITE_ESTEIRA_INICIAL = 30;

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  // Só agência. A equipe já cria loja pelo formulário (o RLS a deixa), e abrir
  // esta rota para ela seria um segundo caminho para a mesma coisa — no dia em
  // que os dois discordassem, venceria o mais permissivo.
  if (ctx.perfil.papel !== "agencia" || !ctx.perfil.agenciaId) {
    return Response.json({ erro: "Sem permissão para criar loja aqui." }, { status: 403 });
  }

  if (!adminConfigurado()) {
    return Response.json({ erro: "Cadastro de loja indisponível no momento." }, { status: 503 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const pedido = validarPedidoDeLoja(corpo);
  if (!pedido.ok) {
    return Response.json({ erro: pedido.erro, campo: pedido.campo }, { status: 400 });
  }

  // `service_role` porque `clientes` não tem política de INSERT para agência —
  // e não deve ter: a decisão é desta rota, depois da sessão validada, e não de
  // uma política que alguém possa alargar sem perceber. Mesmo desenho de
  // `/api/loja/provisionar`.
  const admin = getSupabaseAdmin();
  const { data: loja, error } = await admin
    .from("clientes")
    .insert({
      empresa: pedido.nomeDaLoja,
      responsavel: "",
      plano: PLANO_INICIAL,
      status: "Onboarding",
      limite_esteira_mes: LIMITE_ESTEIRA_INICIAL,
      marketplaces: ["Mercado Livre"],
      agencia_id: ctx.perfil.agenciaId, // do PERFIL, nunca do corpo
    })
    .select("id")
    .single();

  if (error || !loja) {
    console.error("[agencia/loja] falha ao criar loja");
    return Response.json({ erro: "Não foi possível criar a loja agora." }, { status: 500 });
  }

  // Sem compensação a fazer: diferente de `/api/loja/provisionar`, aqui não há
  // um segundo insert que possa deixar a loja órfã. Quem a enxerga é a agência
  // que a criou, por `agencia_le_as_lojas`.
  console.info("[agencia/loja] loja criada na carteira");
  return Response.json({ ok: true, clienteId: loja.id }, { status: 201 });
}
