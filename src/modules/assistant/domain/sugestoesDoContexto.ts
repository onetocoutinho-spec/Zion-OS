// O que o assistente SUGERE perguntar — a partir de onde a pessoa está e do
// estado medido da loja.
//
// Eram duas listas fixas ("loja" e "produto"), escolhidas por "tem produto
// aberto ou não", iguais no dashboard, nos anúncios e nos preços, e que
// sumiam para sempre depois do primeiro turno (a conversa é restaurada do
// disco, então `turnos.length === 0` nunca mais era verdade). Um usuário
// recorrente nunca via sugestão nenhuma. (Auditoria do Copilot, 2026-08-22,
// UX P2.)
//
// Aqui a sugestão nasce do DADO: "3 produtos sem peso" vira "O que falta de
// peso?". Os números NÃO entram na frase — eles vêm de `EstadoDaLoja` medido
// no navegador para decidir o que sugerir, mas a resposta vem do servidor,
// e uma sugestão com número seria a tela afirmando antes de perguntar.
//
// Puro e ordenado: o que tem consequência primeiro. No máximo três.

import type { EstadoDaLoja } from "@/modules/publication/domain/prontidaoDaLoja";

export interface ContextoDaSugestao {
  /** A rota da tela: /cliente, /cliente/produtos, /cliente/anuncios, … */
  rota: string;
  loja: EstadoDaLoja | null;
  produto?: { nome: string } | null;
}

export const MAXIMO_DE_SUGESTOES = 3;

export function sugestoesDoContexto(c: ContextoDaSugestao): string[] {
  const s: string[] = [];
  const loja = c.loja;

  if (c.produto) {
    s.push("O que falta neste produto?", "Por quanto posso vender este produto?", "Prepara o anúncio deste produto");
    return s.slice(0, MAXIMO_DE_SUGESTOES);
  }

  // Por rota, o que a tela está mostrando.
  if (/\/cliente\/anuncios/.test(c.rota)) {
    if (loja && loja.aguardandoAprovacao > 0) s.push("Quais anúncios estão esperando minha aprovação?");
    if (loja && loja.aprovadosNaoPublicados > 0) s.push("Quais anúncios estão prontos para publicar?");
    s.push("Quais produtos ainda não têm anúncio?");
  } else if (/\/cliente\/(precos|precificacao)/.test(c.rota)) {
    s.push("Quais produtos estão prontos para precificar?", "Quais produtos estão com margem baixa?");
  } else if (/\/cliente\/imagens/.test(c.rota)) {
    s.push("Quais produtos estão sem foto?");
  } else if (/\/cliente\/produtos/.test(c.rota)) {
    s.push("Quais produtos estão com cadastro incompleto?");
  }

  // Pelo estado, o que tem consequência — em ordem de impacto.
  if (loja) {
    if ((loja.infracoes ?? 0) > 0) s.push("O Mercado Livre apontou alguma infração?");
    if (loja.produtos - loja.comCusto > 0) s.push("Quais produtos estão sem custo?");
    if (loja.produtos - loja.comPeso > 0) s.push("Quais produtos estão sem peso?");
    if (loja.produtos - loja.comFoto > 0) s.push("Quais produtos estão sem foto?");
    if (!loja.conectadoAoMarketplace) s.push("Por que não consigo publicar?");
  }

  // O genérico, para a lista nunca ficar vazia. Vendas entra quando há canal:
  // sem conexão a pergunta só renderia "conecte primeiro".
  if (loja?.conectadoAoMarketplace) s.push("Como estão as minhas vendas?");
  s.push("O que eu resolvo primeiro?", "Como está a minha loja?");

  return [...new Set(s)].slice(0, MAXIMO_DE_SUGESTOES);
}

/** Depois de uma resposta: o que costuma vir em seguida. Curto, para não virar menu. */
export function continuacoes(ultimaFerramentas: readonly string[]): string[] {
  const f = new Set(ultimaFerramentas);
  if (f.has("pendencias") || f.has("estado_da_loja") || f.has("contar")) return ["Resolve o que der", "O que eu faço primeiro?"];
  if (f.has("preparacao_de_anuncio")) return ["Prepara o anúncio", "O que ainda falta?"];
  if (f.has("pricing")) return ["Propõe um preço", "Mostra os meus custos"];
  if (f.has("vendas_da_loja")) return ["Por que caíram?", "O que eu faço com os que sumiram?"];
  if (f.has("achar_produto") || f.has("o_que_falta_no_produto")) return ["O que falta nele?", "Por quanto vender?"];
  return [];
}
