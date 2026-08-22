// O NOME HUMANO de cada ferramenta — o que a lojista lê enquanto ela roda.
//
// A tela mostrava "Consultei: o_que_falta_no_produto · propor_titulo": o
// identificador de programador num produto de lojista. A intenção (dizer de
// onde veio a resposta) é certa; o vocabulário, não. (Auditoria do Copilot,
// 2026-08-22, UX P1.)
//
// A lista é NOMINAL e o teste exige que cubra o catálogo inteiro: uma
// ferramenta nova sem rótulo apareceria crua — e é assim que o jargão volta.

import { FERRAMENTAS } from "./ferramentasDoAssistente";

const ROTULOS: Readonly<Record<string, string>> = {
  contar: "as contagens da loja",
  proximo_passo: "o próximo passo",
  estado_da_loja: "o estado da loja",
  o_que_impede: "o que está travando",
  achar_produto: "o catálogo",
  o_que_falta_no_produto: "o que falta no produto",
  pendencias: "as pendências",
  preparacao_de_anuncio: "a preparação do anúncio",
  pricing: "o preço e a margem",
  meus_custos: "os seus custos",
  tabela_de_medidas: "a tabela de medidas",
  procedencia: "de onde veio o dado",
  vendas_da_loja: "as vendas no Mercado Livre",
  comparar_lojas: "a comparação entre as lojas",
  meu_perfil_de_conteudo: "o perfil de conteúdo da loja",
  propor_gravacao: "a proposta de preenchimento",
  preparar_resolucao: "a resolução da pendência",
  propor_preco: "a proposta de preço",
  propor_publicacao: "o ensaio da publicação",
  propor_descricao: "a proposta de descrição",
  propor_palavras_chave: "a proposta de palavras-chave",
  propor_titulo: "a proposta de título",
  propor_anuncio: "a proposta de anúncio",
  propor_tarefas: "a lista de tarefas",
  propor_imagem: "a proposta de imagem",
  gerenciar_cadastro: "o cadastro em andamento",
  reativar_anuncio: "a reativação no Mercado Livre",
};

/** O rótulo de uma ferramenta. Nome desconhecido volta como veio — visível, não escondido. */
export function rotuloDaFerramenta(nome: string): string {
  return ROTULOS[nome] ?? nome;
}

/** As ferramentas do catálogo sem rótulo. Vazio é o único estado aceitável. */
export function ferramentasSemRotulo(): string[] {
  return FERRAMENTAS.map((f) => f.nome).filter((n) => !(n in ROTULOS));
}
