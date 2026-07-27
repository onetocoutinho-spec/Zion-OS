// O progresso parcial da geração — puro, sem React, sem storage.
//
// A esteira roda 10 agentes de IA em sequência no NAVEGADOR, e o anúncio só é
// gravado quando o último termina. Sair da tela no meio matava tudo: os minutos
// de espera e as chamadas de IA já pagas iam embora, e o lojista voltava para
// uma tela pedindo para começar do zero.
//
// (A cota mensal não é perdida: `quota_esteira` conta linhas em
// `anuncios_gerados`, que só nascem no fim. O que se perde é tempo e token.)
//
// A correção é guardar cada entrega assim que ela fica pronta, e retomar dali.
// Este módulo decide O QUE de um progresso guardado ainda pode ser aproveitado.
//
// A regra que manda em tudo: **só se aproveita um PREFIXO**.
//
// Cada agente recebe como entrada o dossiê acumulado por todos os anteriores.
// A entrega do 5º não é um pedaço solto: ela é uma resposta ao que o 4º disse.
// Retomar com o 5º sem o 4º montaria um dossiê que nenhum agente jamais viu —
// texto que se contradiz, e ninguém saberia por quê. Então na primeira falha da
// sequência o aproveitamento para, mesmo que exista coisa gravada depois.

/** Uma entrega pronta de um agente da esteira. */
export interface EtapaConcluida {
  codigo: string;
  markdown: string;
}

/** O que fica guardado entre uma visita e outra. */
export interface ProgressoGeracao {
  /** De qual produto é este progresso. Trocar de produto invalida tudo. */
  produtoId: string;
  /** Impressão do briefing que originou as entregas (ver `impressaoDoBriefing`). */
  impressaoBriefing: string;
  etapas: EtapaConcluida[];
  /** ISO. Progresso velho demais não serve mais. */
  atualizadoEm: string;
}

/**
 * Depois disso, o progresso guardado é descartado.
 *
 * Não é um limite técnico — é sobre o que o texto ainda representa. Preço,
 * estoque e concorrência mudam; um dossiê de ontem descreve um mercado de
 * ontem. Um dia é tempo de sobra para quem saiu para almoçar e voltou, e curto
 * o bastante para não ressuscitar trabalho que envelheceu.
 */
export const VALIDADE_HORAS = 24;

/** A chave é por cliente: dois lojistas no mesmo navegador não se misturam. */
export function chaveProgresso(clienteId: string): string {
  return `zion:esteira:progresso:${clienteId || "sem-cliente"}`;
}

/**
 * Uma impressão curta e determinística do briefing (FNV-1a, 32 bits).
 *
 * Não é segurança, é detecção de mudança: se o lojista corrigiu o nome, mexeu
 * no preço ou trocou as fotos, as entregas guardadas falam de outro produto que
 * por acaso tem o mesmo id. Melhor refazer do que costurar um anúncio em cima
 * de dados que não existem mais.
 */
export function impressaoDoBriefing(briefing: string): string {
  let h = 0x811c9dc5;
  const texto = briefing.trim();
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    // h * 16777619 sem estourar 32 bits
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Lê o que veio do storage sem confiar em nada — formato antigo, lixo, null. */
export function lerProgresso(bruto: string | null | undefined): ProgressoGeracao | null {
  if (!bruto) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const p = obj as Record<string, unknown>;
  if (typeof p.produtoId !== "string" || !p.produtoId) return null;
  if (typeof p.impressaoBriefing !== "string") return null;
  if (typeof p.atualizadoEm !== "string") return null;
  if (!Array.isArray(p.etapas)) return null;
  const etapas: EtapaConcluida[] = [];
  for (const e of p.etapas) {
    if (!e || typeof e !== "object") continue;
    const { codigo, markdown } = e as Record<string, unknown>;
    if (typeof codigo === "string" && codigo && typeof markdown === "string") {
      etapas.push({ codigo, markdown });
    }
  }
  return {
    produtoId: p.produtoId,
    impressaoBriefing: p.impressaoBriefing,
    etapas,
    atualizadoEm: p.atualizadoEm,
  };
}

export interface AlvoDaRetomada {
  produtoId: string;
  impressaoBriefing: string;
  /** A ordem canônica dos agentes intermediários. */
  ordem: readonly string[];
  /** Agora, em ISO — injetado para o teste não depender do relógio. */
  agora: string;
}

/**
 * As etapas de um progresso guardado que a geração pode reaproveitar.
 *
 * Devolve `[]` (refaz tudo) quando o progresso é de outro produto, de um
 * briefing diferente, velho demais, ou ilegível. Caso contrário devolve o maior
 * PREFIXO da ordem canônica que está inteiro e não-vazio ali dentro — ver a
 * explicação no topo do arquivo.
 */
export function etapasRetomaveis(
  salvo: ProgressoGeracao | null,
  alvo: AlvoDaRetomada
): EtapaConcluida[] {
  if (!salvo) return [];
  if (salvo.produtoId !== alvo.produtoId) return [];
  if (salvo.impressaoBriefing !== alvo.impressaoBriefing) return [];

  const quando = Date.parse(salvo.atualizadoEm);
  const agora = Date.parse(alvo.agora);
  if (!Number.isFinite(quando) || !Number.isFinite(agora)) return [];
  // Data no futuro (relógio do micro mexido) é tão suspeita quanto data velha.
  const idadeHoras = (agora - quando) / 3_600_000;
  if (idadeHoras < 0 || idadeHoras > VALIDADE_HORAS) return [];

  return prefixoDaOrdem(salvo.etapas, alvo.ordem);
}

/**
 * O maior prefixo íntegro da ordem canônica presente nas etapas.
 *
 * Para na primeira ausência ou entrega vazia, e ignora o que vier depois —
 * é a regra do topo do arquivo, isolada aqui porque quem CONSOME a retomada
 * (o motor da esteira) precisa aplicar a mesma peneira em quem o chama.
 * Entrega vazia conta como não-feita: agente sem texto não produziu trabalho.
 */
export function prefixoDaOrdem(
  etapas: readonly EtapaConcluida[],
  ordem: readonly string[]
): EtapaConcluida[] {
  const porCodigo = new Map<string, string>();
  for (const e of etapas) {
    if (!porCodigo.has(e.codigo)) porCodigo.set(e.codigo, e.markdown);
  }

  const prefixo: EtapaConcluida[] = [];
  for (const codigo of ordem) {
    const markdown = porCodigo.get(codigo);
    if (!markdown || !markdown.trim()) break;
    prefixo.push({ codigo, markdown });
  }
  return prefixo;
}
