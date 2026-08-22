// A Proposal do Copilot como PRIMITIVE DE SEGURANÇA.
//
// Não é uma tabela com um cartão em cima. É a resposta a uma pergunta:
//
//     o que exatamente foi autorizado, por quem, sobre qual estado?
//
// Sem ela, a autorização é uma frase numa conversa — e frase não carrega
// escopo, não expira, e não sabe se o mundo mudou desde que foi dita.
//
// AS TRÊS PROTEÇÕES, e por que cada uma existe:
//
// 1. IDENTIDADE. A confirmação referencia um id persistido, não um objeto que
//    a tela montou. Um objeto vindo do navegador pode ser qualquer coisa; um id
//    só vale se existir no banco, pertencer a este cliente e estar pendente.
//
// 2. PRECONDIÇÕES. A proposta guarda o estado que a gerou. Se o custo era
//    R$ 42 quando ela nasceu e é R$ 55 quando alguém clica, ela está STALE —
//    e executar em silêncio gravaria uma decisão tomada sobre um mundo que não
//    existe mais.
//
// 3. IDEMPOTÊNCIA. O ciclo de vida é uma máquina de estados de mão única.
//    `pendente` é o único estado de onde se executa, e a transição é atômica no
//    banco. Duplo clique, retry, refresh e reenvio disputam a mesma linha — um
//    ganha, os outros recebem "já foi executada", não um segundo INSERT.
//
// Este módulo é PURO: sem rede, sem banco, sem React. Toda a lógica de decisão
// se prova aqui, com objetos, e é isso que permite testar "proposta de outro
// tenant" ou "estado mudou" sem levantar infraestrutura.

/** O ciclo de vida. Mão única: de `pendente` não se volta. */
export type StatusProposta =
  | "pendente"
  | "aprovada"
  | "rejeitada"
  | "expirada"
  | "executada"
  | "falhou"
  | "obsoleta";

/**
 * O risco da ação — server-side, e NÃO decidido pelo modelo.
 *
 * O modelo propõe; a política decide se precisa de confirmação. Deixar essa
 * decisão com quem escreve a frase seria pedir ao proponente que avaliasse o
 * próprio risco.
 */
export type NivelDeRisco = "leitura" | "baixo" | "medio" | "alto" | "critico";

/**
 * O que a proposta pretende mudar. Lista fechada: o que não está aqui não executa.
 *
 * `cadastro` é o único que CRIA em vez de corrigir. Ele entra aqui, e não numa
 * segunda primitive de aprovação, porque as três proteções são exatamente as
 * mesmas: identidade (o id vem do banco), precondições (o conjunto de possíveis
 * duplicatas não pode ter mudado) e idempotência (duplo clique não cria dois
 * produtos). Uma segunda máquina de aprovação teria que reprovar tudo isso.
 *
 * Nele, `alvos` carrega o ID DO DRAFT — o que está sendo autorizado é a
 * materialização daquele cadastro, e não uma escrita num produto que já existe.
 */
export type TipoDeProposta =
  | "peso"
  | "custo"
  | "cadastro"
  | "titulo"
  | "preco"
  // TEXTO DO ANÚNCIO, desde 10/08/2026. Dois tipos e não um: a auditoria
  // precisa distinguir "trocou a descrição" de "acrescentou palavras-chave",
  // e a função do banco decide a chave do jsonb por eles.
  | "descricao"
  | "palavras_chave"
  // PUBLICAÇÃO, desde 22/08/2026. A única ação que o comprador vê; era a única
  // fora da Proposal. `texto` carrega o pedido congelado (ver
  // `propostaDePublicacao.ts`) e `alvos[0]` é o anúncio.
  | "publicacao";

/**
 * O estado do mundo no momento em que a proposta nasceu.
 *
 * Guardamos o VALOR, não um hash: quando a proposta fica obsoleta, o cliente
 * merece saber o que mudou ("o custo passou de R$ 42 para R$ 55"), e um hash
 * só sabe dizer que algo mudou.
 *
 * `null` significa "não havia valor" — diferente de zero, que é um valor.
 */
export interface Precondicao {
  /** O campo observado, em nome de domínio. */
  campo: string;
  /** O valor lido quando a proposta foi montada. `null` = ausente. */
  valorNaCriacao: number | null;
  /**
   * A IDENTIDADE do conjunto aprovado — os ids das variantes elegíveis em T0.
   *
   * Presente só em `variacoesSemPeso:<produtoId>`, e só em propostas criadas
   * depois do CICLO G.1. Ausência significa CONTRATO LEGACY, nunca conjunto
   * vazio: uma proposta antiga executa exatamente como antes.
   *
   * ===================================================================
   * POR QUE A CONTAGEM NÃO BASTAVA
   * ===================================================================
   *
   * `alvos` guarda PRODUTOS. A escrita redescobria as variantes por
   * `peso <= 0` no instante do UPDATE, e a revalidação só conferia QUANTAS
   * estavam vazias. Uma troca de tamanho igual passava:
   *
   *     aprovado {A,B,C}  →  alguém preenche C e zera D  →  {A,B,D}
   *     contagem 3 = 3, precondição aprova, e D — que ninguém aprovou —
   *     recebia o peso.
   *
   * Demonstrado em transação revertida sobre o catálogo real. Ver INC-002.
   *
   * ===================================================================
   * NÃO É HASH, E A ORDEM NÃO IMPORTA
   * ===================================================================
   *
   * Os ids REAIS, porque a execução precisa escrever no conjunto — não só
   * detectar que ele mudou. Guardados em ordem normalizada para que duas
   * leituras do mesmo conjunto produzam o mesmo valor.
   *
   * ===================================================================
   * ISTO NÃO É REVALIDADO POR `podeExecutar`
   * ===================================================================
   *
   * É RESTRIÇÃO DE ESCRITA, não precondição. Quem revalida continua sendo
   * `valorNaCriacao` (a contagem). O conjunto congelado limita QUEM pode ser
   * tocado, e o banco aplica esse limite dentro do próprio UPDATE — junto de
   * `peso <= 0` e do tenant. Por isso a garantia sobrevive à concorrência: não
   * existe janela entre conferir e escrever.
   */
  idsAprovados?: readonly string[];
}

export interface PropostaPersistida {
  id: string;
  clienteId: string;
  conversaId: string;
  /** Quem pediu. Auditoria precisa do humano, não só do tenant. */
  criadaPor: string;
  tipo: TipoDeProposta;
  risco: NivelDeRisco;
  status: StatusProposta;
  /** Os alvos. Array porque o lote vem depois — e o escopo é o que se aprova. */
  alvos: readonly string[];
  /** O valor a gravar, na unidade canônica: gramas para peso, reais para custo. */
  valor: number;
  /** O que a pessoa leu antes de confirmar. Guardado para a auditoria. */
  resumo: string;
  precondicoes: readonly Precondicao[];
  criadaEm: string;
  expiraEm: string;
  /** O cadastro em conversa que esta proposta materializa. Só em `cadastro`. */
  draftId?: string | null;
  /** O conteúdo proposto quando ele é texto. Só em `titulo`. */
  texto?: string | null;
  /**
   * De onde o Zion SABE que veio `valor`.
   *
   * `null` = autoridade NÃO REGISTRADA: proposta anterior à migração 044. Não é
   * `sem_autoridade` — é desconhecido histórico, e as duas coisas não podem ser
   * confundidas sem inventar proveniência para o passado.
   *
   * NÃO É GATE. Nada aqui impede execução; expiração, ownership, status,
   * precondições, reserva e confirmação humana seguem mandando. Ver INC-008.
   */
  autoridade?: AutoridadeDoValor | null;
}

/**
 * A classe de autoridade do valor congelado numa Proposal.
 *
 * Responde "de onde o Zion sabe que veio este número?" — nunca "quem autorizou a
 * escrita?", que é `criadaPor` e, na procedência, `origem`/`ator`.
 *
 *   AUTORIZAÇÃO NÃO É AUTORIDADE. O clique prova consentimento, não proveniência.
 *
 * `ditado` existe no tipo e no CHECK do banco e **não é produzido por nenhum
 * fluxo de hoje**: o turno é texto livre e o argumento vem do modelo, então não
 * há prova determinística de que a pessoa forneceu o número. Marcá-lo porque uma
 * ferramenta `propor_*` recebeu o argumento seria fabricar a autoridade que o
 * INC-008 existe para não fabricar. Ele fica declarado para que o dia em que
 * houver captura estruturada não precise de outra migração —
 * `autoridadeEhProduzivel` guarda essa regra.
 */
export type AutoridadeDoValor =
  /** Saiu de fonte autoritativa do próprio domínio (ex.: `pesoConhecidoDoProduto`). */
  | "derivado"
  /** O domínio computou deterministicamente a partir de fatos autorizados. */
  | "calculado"
  /** Chegou como argumento do modelo, sem vínculo demonstrável. Não é erro: é a lacuna, registrada. */
  | "sem_autoridade"
  /** A proposta não carrega valor cuja proveniência esta taxonomia descreva: `titulo` é conteúdo, `cadastro` é identidade. */
  | "nao_se_aplica"
  /** O lojista forneceu, com prova determinística. NUNCA produzido hoje. */
  | "ditado";

/** As classes que algum fluxo atual consegue demonstrar. `ditado` não está aqui. */
export const AUTORIDADES_PRODUZIVEIS = [
  "derivado",
  "calculado",
  "sem_autoridade",
  "nao_se_aplica",
] as const satisfies readonly AutoridadeDoValor[];

export function autoridadeEhProduzivel(a: AutoridadeDoValor): boolean {
  return (AUTORIDADES_PRODUZIVEIS as readonly string[]).includes(a);
}

/**
 * Quanto tempo uma proposta vale.
 *
 * Trinta minutos é generoso para quem foi tomar um café e curto para o mundo
 * mudar sem ninguém notar. A expiração não substitui a checagem de
 * precondições — ela é a rede embaixo, para o caso de o campo observado não
 * cobrir tudo que importa.
 */
export const MINUTOS_ATE_EXPIRAR = 30;

/** O risco de cada tipo. Server-side, fixo, fora do alcance do modelo. */
export const RISCO_POR_TIPO: Record<TipoDeProposta, NivelDeRisco> = {
  // Peso muda o frete, e frete errado vira preço abaixo do custo.
  peso: "alto",
  // Custo é a base de lucro, margem e piso. Esta base já recebeu R$ 30 milhões
  // de custo por escrita que ninguém revisou.
  custo: "alto",
  // TEXTO DO ANÚNCIO: `medio`, o mesmo do título, e pelo mesmo motivo — nada
  // aqui muda dinheiro. Descrição errada custa venda, não margem, e é
  // reversível reescrevendo.
  //
  // Palavras-chave é o MENOS arriscado dos dois: ACRESCENTA, então nada do que
  // já vendia é apagado. Fica em `medio` junto com a descrição porque um nível
  // a menos só existiria para este caso, e um nível por caso deixa de ser
  // escala.
  descricao: "medio",
  palavras_chave: "medio",
  // Criar produto é a única escrita que ADICIONA linha ao catálogo. Um produto
  // duplicado não dispara alarme nenhum: ele fica lá, recebe anúncio, recebe
  // estoque, e só aparece quando alguém tenta conciliar.
  cadastro: "alto",
  // Trocar título é reversível e não move dinheiro — mas é o texto que o
  // comprador lê primeiro, e um título pior derruba a busca sem avisar. Médio:
  // exige confirmação, não exige o cuidado de uma escrita irreversível.
  titulo: "medio",
  // Preço é o número de onde sai o faturamento. Um preço abaixo do piso vende
  // no prejuízo em silêncio, e o estrago só aparece no fechamento do mês.
  preco: "alto",
  // Publicar é o que o COMPRADOR vê, e o Mercado Livre não tem "desfazer":
  // um anúncio duplicado ou errado no ar é reputação, não só dado. Crítico.
  publicacao: "critico",
};

/** O que impede uma proposta de ser executada agora. */
export type Impedimento =
  | { motivo: "nao_encontrada" }
  | { motivo: "outro_tenant" }
  | { motivo: "outro_usuario" }
  | { motivo: "ja_executada" }
  | { motivo: "status_invalido"; status: StatusProposta }
  | { motivo: "expirada" }
  | {
      motivo: "obsoleta";
      /** O que mudou, para a resposta poder dizer. */
      mudou: readonly { campo: string; de: number | null; para: number | null }[];
    };

export type VeredictoDaProposta = { pode: true } | { pode: false; impedimento: Impedimento };

/**
 * O estado atual dos campos que a proposta observou, lido AGORA.
 *
 * Chave é o `campo` da precondição. Ausente vira `null` — e `null` casa com
 * `null`, porque "continua sem valor" não é mudança.
 */
export type EstadoAtual = Readonly<Record<string, number | null>>;

/**
 * Pode executar?
 *
 * A ordem das checagens é deliberada e vai do mais grosso ao mais fino:
 * existência, tenant, status, prazo, e só então o estado do mundo. Checar
 * precondições antes do tenant vazaria, pela mensagem de erro, que a proposta
 * existe e o que ela mudaria.
 */
export function podeExecutar(
  proposta: PropostaPersistida | null,
  clienteIdDaSessao: string,
  agoraISO: string,
  estadoAtual: EstadoAtual,
  /**
   * Quem está clicando. `undefined` = o chamador não informou (chamadas
   * antigas e testes de outras regras); `null` = sessão sem usuário (demo).
   * Nos dois casos a checagem de autoria não roda — e isso fica declarado
   * aqui, não escondido num `??`.
   */
  usuarioIdDaSessao?: string | null
): VeredictoDaProposta {
  if (!proposta) return { pode: false, impedimento: { motivo: "nao_encontrada" } };

  // O tenant vem da SESSÃO, nunca do corpo da requisição. Uma proposta de outro
  // cliente é tratada como inexistente do ponto de vista da mensagem — mas
  // distinguimos internamente, para a auditoria registrar a tentativa.
  if (proposta.clienteId !== clienteIdDaSessao) {
    return { pode: false, impedimento: { motivo: "outro_tenant" } };
  }

  // QUEM VIU O DIFF É QUEM CONFIRMA — para o que mexe em dinheiro ou frete.
  //
  // `criadaPor` existia "para a auditoria" e nunca era conferido: numa loja
  // com três operadores, B confirmava a proposta de preço montada na
  // conversa privada de A, que B nunca leu. O portão virava "alguém do
  // tenant clicou". Para `medio`/`baixo` (título, descrição) o custo de
  // errar é reversível e a regra não se aplica. (Auditoria do Copilot, P2.)
  if (
    usuarioIdDaSessao &&
    (proposta.risco === "alto" || proposta.risco === "critico") &&
    proposta.criadaPor &&
    proposta.criadaPor !== usuarioIdDaSessao
  ) {
    return { pode: false, impedimento: { motivo: "outro_usuario" } };
  }

  // `ja_executada` ANTES de `status_invalido`: é o caso do duplo clique, e
  // merece uma resposta específica ("já foi feito") em vez de um erro genérico
  // que faria a pessoa tentar de novo.
  if (proposta.status === "executada") {
    return { pode: false, impedimento: { motivo: "ja_executada" } };
  }
  if (proposta.status !== "pendente") {
    return { pode: false, impedimento: { motivo: "status_invalido", status: proposta.status } };
  }

  if (Date.parse(proposta.expiraEm) <= Date.parse(agoraISO)) {
    return { pode: false, impedimento: { motivo: "expirada" } };
  }

  const mudou = precondicoesQuebradas(proposta.precondicoes, estadoAtual);
  if (mudou.length > 0) {
    return { pode: false, impedimento: { motivo: "obsoleta", mudou } };
  }

  return { pode: true };
}

/**
 * Quais precondições não valem mais.
 *
 * Comparação por valor, com `null` significando ausência. Um campo que não
 * aparece em `estadoAtual` é tratado como ausente — e se ele tinha valor na
 * criação, isso É uma mudança: o dado foi apagado.
 */
export function precondicoesQuebradas(
  precondicoes: readonly Precondicao[],
  estadoAtual: EstadoAtual
): { campo: string; de: number | null; para: number | null }[] {
  const quebradas: { campo: string; de: number | null; para: number | null }[] = [];
  for (const p of precondicoes) {
    const agora = Object.prototype.hasOwnProperty.call(estadoAtual, p.campo)
      ? estadoAtual[p.campo]
      : null;
    if (agora !== p.valorNaCriacao) {
      quebradas.push({ campo: p.campo, de: p.valorNaCriacao, para: agora });
    }
  }
  return quebradas;
}

/** Quando esta proposta expira, a partir de quando nasceu. */
export function expiraEm(criadaEmISO: string): string {
  return new Date(Date.parse(criadaEmISO) + MINUTOS_ATE_EXPIRAR * 60_000).toISOString();
}

/**
 * A frase que explica por que não deu — para o lojista, não para o log.
 *
 * "Os dados mudaram" sem dizer o quê deixa a pessoa achando que o sistema
 * quebrou. Dizendo o que mudou, ela entende que foi protegida.
 */
export function explicarImpedimento(i: Impedimento): string {
  switch (i.motivo) {
    case "nao_encontrada":
    case "outro_tenant":
      // A MESMA frase de propósito: distinguir contaria a quem tentou que a
      // proposta existe em outro cliente.
      return "Não encontrei essa proposta. Peça de novo e eu monto outra.";
    case "outro_usuario":
      return "Essa proposta foi montada na conversa de outra pessoa. Peça de novo na sua conversa e eu monto outra para você confirmar.";
    case "ja_executada":
      return "Isso já foi feito — não repeti a gravação.";
    case "expirada":
      return "Essa proposta passou da validade. Peça de novo para eu recalcular com os dados de agora.";
    case "status_invalido":
      return `Essa proposta não está mais pendente (${i.status}).`;
    case "obsoleta": {
      const partes = i.mudou.map(
        (m) => `${m.campo} passou de ${escrever(m.de)} para ${escrever(m.para)}`
      );
      return `Os dados mudaram depois que eu montei essa proposta — ${partes.join("; ")}. Não gravei. Peça de novo e eu refaço com o valor de agora.`;
    }
  }
}

function escrever(v: number | null): string {
  return v === null ? "vazio" : String(v);
}
