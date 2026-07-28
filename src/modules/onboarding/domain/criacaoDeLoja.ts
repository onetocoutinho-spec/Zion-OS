// Provisionar a loja de quem acabou de se cadastrar — puro, sem rede, sem React.
//
// POR QUE ISTO EXISTE
//
// Até aqui um lojista só existia se alguém da Zion o criasse: `/api/usuarios`
// exige `exigirEquipe`, e a única porta pública era `/definir-senha`, que é
// convite. O último item da checklist de onboarding chamava-se literalmente
// "cliente liberado para operação" — o cliente era LIBERADO por uma pessoa.
//
// Com a decisão de SaaS puro (zero toque humano), a porta passa a ser própria.
//
// A FORMA SEGURA, E POR QUE NÃO A ÓBVIA
//
// O caminho óbvio seria uma rota pública que cria tudo com `service_role`. É
// uma porta aberta: qualquer um na internet criando linhas com poder de admin.
//
// Em vez disso, o cadastro acontece em DUAS fases:
//   1. `supabase.auth.signUp` no NAVEGADOR — o Supabase já traz limite de
//      tentativas e confirmação de e-mail, de graça e melhor do que faríamos;
//   2. só depois, JÁ COM SESSÃO VÁLIDA, uma rota autenticada provisiona a loja.
//
// Assim nunca existe endpoint anônimo com poder de admin, e o provisionamento
// só age em nome de quem provou ser quem é.
//
// Este módulo é a fase 2 sem I/O: valida o que o usuário pediu e decide o que
// fazer. Quem tem sessão, quem escreve no banco e quem envia e-mail fica fora.

/** O tamanho é generoso, mas finito: campo sem teto é convite a abuso. */
const MAX_NOME_LOJA = 120;
const MIN_NOME_LOJA = 2;

export interface PedidoDeLoja {
  /** Como o lojista chama o próprio negócio. Vira o nome do cliente. */
  nomeDaLoja: string;
}

export type ValidacaoLoja =
  | { ok: true; nomeDaLoja: string }
  | { ok: false; erro: string; campo: string };

/**
 * Valida o pedido, recusando qualquer campo que não seja o nome da loja.
 *
 * A lista fechada é deliberada. Um provisionamento que aceita campos extras
 * aceita `papel: "equipe"` no dia em que alguém tentar — e essa é a diferença
 * entre um cliente novo e um invasor com acesso total. O que decide papel é o
 * servidor, nunca o corpo da requisição.
 */
export function validarPedidoDeLoja(bruto: unknown): ValidacaoLoja {
  if (!bruto || typeof bruto !== "object") {
    return { ok: false, erro: "Não entendi o pedido.", campo: "_" };
  }
  const obj = bruto as Record<string, unknown>;

  for (const chave of Object.keys(obj)) {
    if (chave !== "nomeDaLoja") {
      return { ok: false, erro: `Campo não permitido: ${chave}.`, campo: chave };
    }
  }

  const nome = typeof obj.nomeDaLoja === "string" ? obj.nomeDaLoja.trim() : "";
  if (nome.length < MIN_NOME_LOJA) {
    return { ok: false, erro: "Diga o nome da sua loja.", campo: "nomeDaLoja" };
  }
  if (nome.length > MAX_NOME_LOJA) {
    return { ok: false, erro: "Nome da loja muito longo.", campo: "nomeDaLoja" };
  }
  return { ok: true, nomeDaLoja: nome };
}

/** O que já existe para este usuário, do ponto de vista do provisionamento. */
export interface EstadoDoUsuario {
  /** Já tem perfil? Então a loja já foi provisionada. */
  temPerfil: boolean;
  /** O papel do perfil existente, quando houver. */
  papelExistente?: "equipe" | "cliente";
}

export type DecisaoProvisionamento =
  | { acao: "provisionar" }
  /** Já tem loja: repetir o pedido não cria uma segunda. */
  | { acao: "ja_provisionado" }
  /** Usuário de equipe não ganha loja própria por engano. */
  | { acao: "recusar"; motivo: string };

/**
 * O que fazer com este pedido.
 *
 * Idempotente de propósito: o navegador pode repetir a chamada (recarregou,
 * clicou duas vezes, a rede engasgou), e a segunda vez não pode criar uma
 * segunda loja para a mesma pessoa — ela ficaria com duas bases e nenhuma
 * completa.
 */
export function decidirProvisionamento(estado: EstadoDoUsuario): DecisaoProvisionamento {
  if (!estado.temPerfil) return { acao: "provisionar" };
  if (estado.papelExistente === "equipe") {
    return {
      acao: "recusar",
      motivo: "Esta conta é da equipe Zion e não tem loja própria.",
    };
  }
  return { acao: "ja_provisionado" };
}
