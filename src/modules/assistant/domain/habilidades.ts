// O REGISTRO DE HABILIDADES — o que o Copilot sabe fazer, e o que ele NÃO sabe.
//
// ===========================================================================
// POR QUE ISTO PRECISOU EXISTIR
// ===========================================================================
//
// O objetivo declarado pelo dono em 24/08/2026: "eu não preciso aprender o
// Zion OS, eu só preciso dizer o que quero". Para isso o Copilot precisa
// responder duas perguntas que ele hoje só sabe improvisar:
//
//   "você consegue fazer X?"        — e a resposta tem que vir de DADO
//   "então por que não consegue?"   — e a resposta tem que ser o motivo REAL
//
// O catálogo de ferramentas (`ferramentasDoAssistente`) diz o que existe, mas
// só o que existe. Ele não sabe dizer que ALTERAR O PREÇO DE UM ANÚNCIO
// PUBLICADO não é uma ferramenta que falta implementar — é uma escrita que o
// projeto inteiro não tem, medida na auditoria de 24/08/2026: das 21 funções
// que falam com a API do Mercado Livre, seis escrevem, e nenhuma edita preço,
// estoque, título, descrição, atributo ou variação de um item no ar.
//
// Um modelo que não tem onde ler isso responde pelo prompt — e prompt não é
// dado. O sintoma já apareceu na frase "posso ajudar a analisar seus
// anúncios", que promete sem conferir.
//
// ===========================================================================
// POR QUE "HABILIDADE", E NÃO "CAPABILITY"
// ===========================================================================
//
// A palavra já está ocupada neste repositório: `src/capabilities/` +
// `src/runtime/` são um sistema DIFERENTE (rotas /z e /pendencias), onde
// Capability é o executor de uma Decision. Reusar o nome faria dois conceitos
// distintos responderem ao mesmo termo em revisão de código.
//
// ===========================================================================
// A REGRA QUE SUSTENTA ESTE ARQUIVO
// ===========================================================================
//
// Toda ferramenta do catálogo tem que aparecer aqui — há teste. Sem isso o
// registro envelhece em silêncio: alguém acrescenta uma ferramenta, o Copilot
// passa a poder usá-la e continua dizendo que não sabe fazer aquilo.
//
// E toda LACUNA carrega três coisas, nunca uma só: o código do motivo, o
// porquê em português, e o que faltaria para deixar de ser lacuna. "Não
// consigo" sozinho não é resposta — é o silêncio com outra roupa.
//
// Puro.

import { FERRAMENTAS, type Ferramenta } from "./ferramentasDoAssistente";

/** O que a habilidade custa a quem a usa — não o `Efeito`, que é técnico. */
export type NivelDaHabilidade =
  /** Só lê. Nada muda. */
  | "consulta"
  /** Monta um cartão; nada acontece sem o clique. */
  | "proposta"
  /** Age sozinha. Hoje só uma, e só porque é reversível com um clique. */
  | "acao";

export interface Habilidade {
  /** A ferramenta que a entrega. É a chave, e é o que liga ao catálogo. */
  ferramenta: string;
  /** O que ela faz, na língua de quem opera a loja. */
  oQueFaz: string;
  nivel: NivelDaHabilidade;
  /** O que precisa existir para ela funcionar. Vazio = nada. */
  precisaDe: readonly string[];
  /** Como se confirma que funcionou. Para ação, é obrigatório de verdade. */
  verificacao: string;
}

/**
 * Por que algo não pode ser feito. O vocabulário é fechado de propósito: um
 * motivo novo exige alguém escrever a linha, e escrever a linha é pensar.
 */
export type CodigoDaLacuna =
  /** O Zion não tem esse caminho escrito. */
  | "CAPACIDADE_AUSENTE"
  /** O marketplace não oferece — ou oferece de um jeito que não usamos. */
  | "LIMITE_DO_MARKETPLACE"
  /** O caminho existiria, mas o dado necessário não é guardado. */
  | "DADO_AUSENTE"
  /** Só uma pessoa pode fazer, fora do Zion. */
  | "ACAO_EXTERNA";

export interface Lacuna {
  /** A chave curta. É ela que vira sinal no journal. */
  assunto: string;
  /** Como o pedido costuma chegar — para o modelo reconhecer o caso. */
  pedidoTipico: readonly string[];
  codigo: CodigoDaLacuna;
  /** O motivo REAL, medido. Nunca "ainda não implementamos". */
  porQue: string;
  /** O que faltaria para deixar de ser lacuna. */
  oQueFaltaria: string;
}

// ---------------------------------------------------------------------------
// O QUE O COPILOT FAZ
// ---------------------------------------------------------------------------

const NIVEL_POR_EFEITO: Record<Ferramenta["efeito"], NivelDaHabilidade> = {
  le: "consulta",
  rascunha: "proposta",
  propoe: "proposta",
  executa: "acao",
};

/** Como se confirma cada nível. A da ação é a única que exige releitura. */
const VERIFICACAO_PADRAO: Record<NivelDaHabilidade, string> = {
  consulta: "O resultado é o próprio dado lido, com a fonte e a data da medição.",
  proposta: "Nada acontece até o clique. Depois do clique, a gravação é conferida contra o estado que a proposta congelou.",
  acao: "Depois de agir, o estado é lido de novo no marketplace e comparado. Sem confirmação, a resposta diz que não confirmou.",
};

/**
 * O que cada ferramenta entrega, na língua da lojista, e o que ela exige.
 *
 * Só o que NÃO dá para derivar do catálogo mora aqui: a frase de operação e os
 * pré-requisitos. Nível e existência vêm do catálogo, para não divergirem.
 */
const DETALHE: Readonly<Record<string, { oQueFaz: string; precisaDe: readonly string[] }>> = {
  contar: { oQueFaz: "Conta quantos produtos estão numa condição — sem peso, sem custo, sem foto, sem anúncio.", precisaDe: [] },
  proximo_passo: { oQueFaz: "Diz o que resolver primeiro para destravar o resto.", precisaDe: [] },
  estado_da_loja: { oQueFaz: "Mostra o panorama de tudo que está pendente na loja.", precisaDe: [] },
  o_que_impede: { oQueFaz: "Diz o que impede precificar, anunciar ou publicar hoje.", precisaDe: [] },
  achar_produto: { oQueFaz: "Acha um produto por nome, SKU, referência ou EAN.", precisaDe: [] },
  o_que_falta_no_produto: { oQueFaz: "Lista o que falta preencher num produto específico.", precisaDe: ["o produto identificado"] },
  pendencias: { oQueFaz: "Agrupa as pendências da loja por decisão, separando o que dá para preparar sozinho.", precisaDe: [] },
  preparacao_de_anuncio: { oQueFaz: "Mostra em que etapa a preparação do anúncio está e o que trava.", precisaDe: ["o produto identificado"] },
  pricing: { oQueFaz: "Calcula preço, margem e lucro pelo motor financeiro, e simula cenários.", precisaDe: ["custo do produto", "peso, quando o frete é por conta da loja"] },
  meus_custos: { oQueFaz: "Mostra os custos e a margem mínima configurados pela loja.", precisaDe: [] },
  tabela_de_medidas: { oQueFaz: "Mostra a tabela de medidas do produto e de onde ela veio.", precisaDe: ["o produto identificado"] },
  procedencia: { oQueFaz: "Diz de onde veio o valor de um campo: quem preencheu, por qual caminho e quando.", precisaDe: ["o produto identificado"] },
  vendas_da_loja: { oQueFaz: "Compara as vendas no Mercado Livre com o período anterior e aponta o que caiu, subiu e sumiu.", precisaDe: ["loja conectada ao Mercado Livre"] },
  comparar_lojas: { oQueFaz: "Mede todas as lojas da conta com a mesma régua, uma por linha.", precisaDe: ["conta de agência ou equipe"] },
  anuncios_ativos: { oQueFaz: "Mostra quantos anúncios estão no ar e em que estado estão os demais.", precisaDe: ["anúncios importados do Mercado Livre"] },
  anuncios_a_corrigir: { oQueFaz: "Agrupa os anúncios fora do ar pelo motivo do Mercado Livre e diz o que dá para fazer com cada um.", precisaDe: ["anúncios importados do Mercado Livre"] },
  diagnostico_de_agrupamento: { oQueFaz: "Mede quanto da grade de cada produto está comprável e aponta produtos com a mesma referência para conferir.", precisaDe: ["anúncios importados do Mercado Livre"] },
  diagnostico_do_anuncio: { oQueFaz: "Diz por que um anúncio não vende, separando quem não é visto de quem é visto e não converte.", precisaDe: ["loja conectada ao Mercado Livre", "o produto com anúncio publicado"] },
  o_que_eu_consigo: { oQueFaz: "Confere o que eu sei e o que eu não sei fazer, e explica o motivo real quando algo não é possível.", precisaDe: [] },
  meu_perfil_de_conteudo: { oQueFaz: "Mostra o tom, o público e as palavras que a loja definiu em Configurações.", precisaDe: [] },
  gerenciar_cadastro: { oQueFaz: "Cadastra um produto novo conversando, guardando o rascunho entre as falas.", precisaDe: [] },
  propor_gravacao: { oQueFaz: "Propõe preencher peso ou custo, num produto ou em lote.", precisaDe: ["o valor dito pela lojista"] },
  preparar_resolucao: { oQueFaz: "Propõe a pendência que o sistema consegue resolver sozinho, como o peso das variantes irmãs.", precisaDe: ["variantes irmãs já pesadas"] },
  propor_preco: { oQueFaz: "Propõe trocar o preço no catálogo do Zion, por valor ou por margem-alvo.", precisaDe: ["custo do produto"] },
  propor_publicacao: { oQueFaz: "Monta o ensaio da publicação no Mercado Livre e propõe publicar.", precisaDe: ["anúncio aprovado", "loja conectada ao Mercado Livre"] },
  propor_descricao: { oQueFaz: "Propõe uma descrição nova, mostrando a atual ao lado.", precisaDe: ["o produto identificado"] },
  propor_palavras_chave: { oQueFaz: "Propõe acrescentar palavras-chave — nunca substitui as que existem.", precisaDe: ["o produto identificado"] },
  propor_titulo: { oQueFaz: "Propõe um título novo dentro do limite do canal, mostrando o atual ao lado.", precisaDe: ["o produto identificado"] },
  propor_imagem: { oQueFaz: "Propõe gerar uma imagem a partir da foto real do produto, por tipo (capa, detalhe, medidas).", precisaDe: ["foto real do produto", "cota de IA disponível"] },
  propor_tarefas: { oQueFaz: "Propõe uma lista de tarefas para a loja, com motivo e prioridade.", precisaDe: [] },
  propor_anuncio: { oQueFaz: "Confere os pré-requisitos e encaminha para gerar o anúncio completo.", precisaDe: ["o produto com cadastro completo"] },
  reativar_anuncio: { oQueFaz: "Reativa no Mercado Livre um anúncio que a própria loja pausou.", precisaDe: ["loja conectada ao Mercado Livre", "o anúncio pausado e sem infração"] },
};

/** As habilidades, derivadas do catálogo — nunca de uma segunda lista. */
export function habilidades(catalogo: readonly Ferramenta[] = FERRAMENTAS): Habilidade[] {
  return catalogo.map((f) => {
    const nivel = NIVEL_POR_EFEITO[f.efeito];
    const d = DETALHE[f.nome];
    return {
      ferramenta: f.nome,
      // Sem detalhe escrito, cai na descrição técnica: pior de ler, e nunca
      // falso. O teste impede que isso aconteça sem alguém decidir.
      oQueFaz: d?.oQueFaz ?? f.descricao,
      nivel,
      precisaDe: d?.precisaDe ?? [],
      verificacao: VERIFICACAO_PADRAO[nivel],
    };
  });
}

/** As ferramentas do catálogo sem frase de operação. Vazio é o único estado aceitável. */
export function ferramentasSemHabilidade(catalogo: readonly Ferramenta[] = FERRAMENTAS): string[] {
  return catalogo.map((f) => f.nome).filter((n) => !(n in DETALHE));
}

// ---------------------------------------------------------------------------
// O QUE O COPILOT NÃO FAZ — medido, não suposto
// ---------------------------------------------------------------------------

/**
 * As lacunas conhecidas.
 *
 * Cada uma foi CONFERIDA no código na auditoria de 24/08/2026. Uma lacuna
 * escrita de memória seria pior que nenhuma: ela ensinaria o Copilot a recusar
 * algo que o sistema sabe fazer.
 */
const LACUNAS: readonly Lacuna[] = [
  {
    assunto: "editar_anuncio_publicado",
    pedidoTipico: [
      "muda o preço desse anúncio no Mercado Livre",
      "corrige o título do anúncio que está no ar",
      "atualiza o estoque no ML",
      "troca a descrição do anúncio publicado",
    ],
    codigo: "CAPACIDADE_AUSENTE",
    porQue:
      "O Zion publica, encerra, pausa, reativa e troca as fotos de um anúncio — mas não altera preço, estoque, título, descrição, atributo ou variação de um anúncio que já está no ar. Esse caminho não existe no código.",
    oQueFaltaria:
      "Escrever a alteração de item no Mercado Livre e fazê-la passar por proposta com confirmação e releitura. Hoje, a única forma de corrigir um anúncio publicado é encerrá-lo e republicar — o que perde o histórico e a relevância dele.",
  },
  {
    assunto: "detalhe_da_moderacao",
    pedidoTipico: [
      "o que o Mercado Livre quer que eu mude nesse anúncio",
      "por que esse anúncio está em revisão",
      "o que falta corrigir nos que estão esperando",
    ],
    codigo: "DADO_AUSENTE",
    porQue:
      "O Mercado Livre informa QUE o anúncio espera uma alteração (o motivo waiting_for_patch), e o Zion guarda isso. Mas o detalhe do que ele quer mudar não é lido nem guardado por aqui.",
    oQueFaltaria:
      "Ler o detalhe da moderação no Mercado Livre e guardá-lo junto do anúncio. Enquanto isso, o aviso original aparece ao abrir o anúncio no próprio Mercado Livre.",
  },
  {
    assunto: "agrupar_anuncios",
    pedidoTipico: [
      "junta esses anúncios numa família",
      "agrupa as variações desse produto",
      "separa esses anúncios",
    ],
    codigo: "CAPACIDADE_AUSENTE",
    porQue:
      "O Zion cria a família quando publica (todos os tamanhos com o mesmo nome de família), mas não reagrupa nem desagrupa anúncios que já existem. E o vínculo de família que vem do Mercado Livre não é guardado, então nem dá para dizer como eles estão agrupados hoje.",
    oQueFaltaria:
      "Guardar o vínculo de família na importação e escrever a operação de reagrupamento no Mercado Livre.",
  },
  {
    assunto: "outros_marketplaces",
    pedidoTipico: [
      "publica isso no TikTok Shop",
      "como estão minhas vendas na Shopee",
      "sobe esse produto na Amazon",
    ],
    codigo: "CAPACIDADE_AUSENTE",
    porQue:
      "Só o Mercado Livre está integrado. TikTok Shop, Shopee e Amazon aparecem como opção no cadastro, mas não existe conexão com nenhum deles — nem para ler, nem para publicar.",
    oQueFaltaria: "Construir a integração de cada canal: conexão da conta, leitura de anúncios e publicação.",
  },
  {
    assunto: "erp",
    pedidoTipico: [
      "puxa o estoque do ERP",
      "sincroniza com o Magazord",
      "atualiza o custo direto do sistema",
    ],
    codigo: "CAPACIDADE_AUSENTE",
    porQue:
      "A troca com o ERP é por arquivo, não por conexão: o Zion gera a planilha de vínculo e a lojista importa no ERP dela. Existe código de conector escrito, mas ele não está ligado ao sistema.",
    oQueFaltaria: "Ligar o conector ao aplicativo e definir o que ele lê e escreve.",
  },
  {
    assunto: "perguntas_e_mensagens",
    pedidoTipico: [
      "responde as perguntas dos compradores",
      "tem mensagem nova no Mercado Livre?",
      "responde essa pergunta do anúncio",
    ],
    codigo: "CAPACIDADE_AUSENTE",
    porQue: "O Zion não lê nem responde perguntas e mensagens do Mercado Livre — essa parte da API não é usada em lugar nenhum do sistema.",
    oQueFaltaria: "Integrar perguntas e mensagens, com o cuidado de que responder ao comprador é ação visível para fora.",
  },
  {
    assunto: "anuncios_patrocinados",
    pedidoTipico: ["cria uma campanha", "quanto gastei em anúncios patrocinados", "aumenta o investimento em ads"],
    codigo: "CAPACIDADE_AUSENTE",
    porQue: "Não há integração com a parte de publicidade do Mercado Livre: nem leitura de campanha, nem investimento.",
    oQueFaltaria: "Integrar a API de publicidade do canal.",
  },
  {
    assunto: "estado_ao_vivo",
    pedidoTipico: ["o anúncio está no ar AGORA?", "confere no Mercado Livre agora", "atualiza o estado dos anúncios"],
    codigo: "LIMITE_DO_MARKETPLACE",
    porQue:
      "O estado dos anúncios que eu leio é o da última importação, com a data. Não existe aviso automático do Mercado Livre quando algo muda, então entre uma importação e outra o dado envelhece.",
    oQueFaltaria:
      "Receber avisos do Mercado Livre quando um anúncio muda. Enquanto isso, a lojista atualiza pelo Importar do Mercado Livre, na tela de Produtos — e eu sempre digo de quando é a medição.",
  },
  {
    assunto: "excluir",
    pedidoTipico: ["apaga esse produto", "exclui esse anúncio", "remove isso do sistema"],
    codigo: "ACAO_EXTERNA",
    porQue:
      "Eu não apago nada. Encerrar um anúncio no Mercado Livre é irreversível, e apagar produto do catálogo não passa por mim — as duas coisas se fazem nas telas, onde a confirmação é explícita.",
    oQueFaltaria: "Nada a construir: é uma decisão de produto, para que uma remoção nunca aconteça por interpretação de uma frase.",
  },
];

export function lacunas(): readonly Lacuna[] {
  return LACUNAS;
}

/** A lacuna de um assunto. `null` quando o assunto não é conhecido. */
export function lacunaPorAssunto(assunto: string): Lacuna | null {
  const a = assunto.trim().toLowerCase();
  return LACUNAS.find((l) => l.assunto === a) ?? null;
}

/** Os assuntos, para o enum do parâmetro da ferramenta. */
export function assuntosDeLacuna(): string[] {
  return LACUNAS.map((l) => l.assunto);
}
