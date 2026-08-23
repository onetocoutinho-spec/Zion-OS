// Motor da esteira MULTI-AGENTE (modo aprofundado / Opção C).
//
// Diferente da esteira "uma passada" (rodarEsteira, 1 chamada), aqui cada
// agente da linha de produção roda como uma chamada de IA separada, passando a
// saída de um como entrada do próximo (o "dossiê"). No fim, A4 monta e A10
// valida o anúncio ESTRUTURADO reusando /api/agentes/esteira.
//
// Reaproveita a infra existente:
//   - /api/agentes/executar  → um agente-texto (retorna Markdown)
//   - /api/agentes/esteira   → montagem final estruturada (AnuncioGerado)
//
// Cada chamada é curta (< 60s) → cabe no serverless; o progresso é reportado
// passo a passo via onPasso (o usuário acompanha A0…A10).

import { AGENTES, ORDEM_ESTEIRA, type AgenteDef } from "../agentes/catalogo";
// Import relativo (e não "@/…") de propósito: é o que o runner de testes
// resolve, e o que o resto de src/lib/services já usa.
import {
  prefixoDaOrdem,
  type EtapaConcluida,
} from "../../modules/publication/domain/progressoGeracao";
import {
  briefingDaGrade,
  montarVariacoes,
  type VarianteDaBase,
} from "../../modules/publication/domain/variacoesDoAnuncio";
import {
  anuncioSimulado,
  comAGradeDoCadastro,
  type AnuncioDaIA,
  type AnuncioGerado,
} from "../agentes/esteira";
import { cabecalhoAutenticacao } from "../supabase/sessao";

export type StatusPasso = "pendente" | "rodando" | "ok" | "erro" | "pulado";

export interface PassoCadeia {
  codigo: string;
  nome: string;
  status: StatusPasso;
  /** Entrega do agente em Markdown (agentes intermediários). */
  resultado?: string;
}

export interface ResultadoCadeia {
  anuncio: AnuncioGerado;
  tipo: "IA" | "Simulada";
  passos: PassoCadeia[];
  aviso?: string;
}

export interface OpcoesCadeia {
  contexto?: string;
  produto?: string;
  briefing?: string;
  /**
   * A grade cadastrada do produto. É daqui que saem cor, tamanho, SKU, EAN e
   * estoque do anúncio — a IA não os escreve mais.
   *
   * Ausente (ou vazia) NÃO vira grade inventada: vira uma pendência dizendo que
   * o produto não tem grade cadastrada. Foi pedir isso à IA sem lhe dar fonte
   * que produziu SKUs plausíveis e falsos.
   */
  variantes?: readonly VarianteDaBase[];
  /** Preço do produto pai, usado quando a variação não tem preço próprio. */
  precoVenda?: number;
  /** Chamado a cada mudança de estado dos passos (para a barra de progresso). */
  onPasso?: (passos: PassoCadeia[]) => void;
  /**
   * Entregas de uma execução anterior, a serem reaproveitadas em vez de
   * refeitas. Precisa ser um PREFIXO da ordem: cada agente responde ao dossiê
   * dos anteriores, então pular um do meio montaria um dossiê inédito. Quem
   * monta a lista é `etapasRetomaveis` (modules/publication/domain).
   *
   * Um código fora da sequência é ignorado — a esteira roda ele de novo, que é
   * o comportamento seguro.
   */
  retomarDe?: readonly EtapaConcluida[];
  /**
   * Chamado assim que um agente intermediário entrega — inclusive nos
   * reaproveitados. É o gancho para gravar o progresso: sem ele, sair da tela
   * no meio joga fora as chamadas de IA já pagas.
   */
  onEtapaConcluida?: (etapa: EtapaConcluida, todas: EtapaConcluida[]) => void;
}

/**
 * Códigos que rodam como agente-texto (A4 monta e A10 valida no passo final).
 * É esta a ordem que define o prefixo aproveitável numa retomada.
 */
export const INTERMEDIARIOS: readonly string[] = ORDEM_ESTEIRA.filter(
  (c) => c !== "A4" && c !== "A10"
);

async function rodarAgenteTexto(
  agente: AgenteDef,
  entrada: string,
  contexto: string
): Promise<{ markdown: string; simulado: boolean }> {
  const resposta = await fetch("/api/agentes/executar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({
      agente: {
        nome: `${agente.codigo} — ${agente.nome}`,
        area: "Esteira de Anúncio ML",
        objetivo: agente.objetivo,
        quandoUsar: agente.quandoUsar,
        entradaNecessaria: agente.entradaNecessaria,
        saidaEsperada: agente.saidaEsperada,
        promptResumido: agente.promptSistema,
      },
      entrada,
      contexto,
    }),
  });
  if (resposta.status === 503) return { markdown: "", simulado: true };
  const dados = (await resposta.json()) as { resultado?: string; erro?: string };
  if (!resposta.ok) throw new Error(dados.erro ?? `Falha no agente ${agente.codigo}.`);
  return { markdown: dados.resultado ?? "", simulado: false };
}

export async function rodarCadeiaEsteira(opcoes: OpcoesCadeia = {}): Promise<ResultadoCadeia> {
  const passos: PassoCadeia[] = ORDEM_ESTEIRA.map((c) => ({
    codigo: c,
    nome: AGENTES[c].nome,
    status: "pendente",
  }));
  const emitir = () => opcoes.onPasso?.(passos.map((p) => ({ ...p })));
  const achar = (codigo: string) => passos.find((p) => p.codigo === codigo)!;
  emitir();

  // A grade REAL, montada uma vez e usada duas: ela entra no contexto que os
  // agentes leem (para a tabela de medidas falar dos tamanhos que existem) e
  // volta no fim como a grade do anúncio. O modelo conhece, mas não escreve.
  const grade = montarVariacoes(opcoes.variantes ?? [], opcoes.precoVenda ?? 0);
  const contexto = [opcoes.contexto ?? "", briefingDaGrade(grade)]
    .filter((p) => p.trim())
    .join("\n\n");
  let dossie = opcoes.briefing?.trim() || "";

  // Só vale como retomada o PREFIXO íntegro da ordem — o resto se refaz. A
  // peneira é aplicada aqui de novo (e não só em quem chama) porque um dossiê
  // remontado fora de ordem não dá erro: dá texto que se contradiz em silêncio.
  const reaproveitar = new Map(
    prefixoDaOrdem(opcoes.retomarDe ?? [], INTERMEDIARIOS).map((e) => [e.codigo, e.markdown])
  );
  const concluidas: EtapaConcluida[] = [];

  // 1) Agentes intermediários (A0, A1, A2, A9, construtores) — acumulam o dossiê.
  for (const codigo of INTERMEDIARIOS) {
    const agente = AGENTES[codigo];
    const passo = achar(codigo);
    const guardado = reaproveitar.get(codigo);
    if (guardado !== undefined) {
      // Já entregue numa execução anterior: reentra no dossiê sem gastar IA.
      passo.resultado = guardado;
      passo.status = "ok";
      dossie += `\n\n=== ${agente.codigo} · ${agente.nome} ===\n${guardado}`;
      concluidas.push({ codigo, markdown: guardado });
      opcoes.onEtapaConcluida?.({ codigo, markdown: guardado }, [...concluidas]);
      emitir();
      continue;
    }
    passo.status = "rodando";
    emitir();
    let res: { markdown: string; simulado: boolean };
    try {
      const entrada = dossie || `Produto a otimizar: ${opcoes.produto ?? "(ver contexto)"}`;
      res = await rodarAgenteTexto(agente, entrada, contexto);
    } catch (e) {
      passo.status = "erro";
      emitir();
      throw e;
    }
    if (res.simulado) {
      // Sem provedor de IA no servidor → cai para simulado (marca o resto como pulado).
      passos.forEach((p) => {
        if (p.status === "pendente" || p.status === "rodando") p.status = "pulado";
      });
      emitir();
      return {
        anuncio: anuncioSimulado(opcoes.produto ?? ""),
        tipo: "Simulada",
        passos,
        aviso:
          "Nenhum provedor de IA configurado no servidor — a esteira rodou em modo simulado. Configure OPENAI_API_KEY no .env.local do servidor.",
      };
    }
    passo.resultado = res.markdown;
    passo.status = "ok";
    dossie += `\n\n=== ${agente.codigo} · ${agente.nome} ===\n${res.markdown}`;
    concluidas.push({ codigo, markdown: res.markdown });
    // Grava ANTES de seguir: se a pessoa sair no próximo agente, este está salvo.
    opcoes.onEtapaConcluida?.({ codigo, markdown: res.markdown }, [...concluidas]);
    emitir();
  }

  // 2) Montagem final estruturada (A4 monta + A10 valida) via /api/agentes/esteira.
  const a4 = achar("A4");
  a4.status = "rodando";
  emitir();

  const resposta = await fetch("/api/agentes/esteira", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ briefing: dossie, contexto, produto: opcoes.produto }),
  });

  if (resposta.status === 503) {
    passos.forEach((p) => {
      if (p.status === "pendente" || p.status === "rodando") p.status = "pulado";
    });
    emitir();
    return {
      anuncio: anuncioSimulado(opcoes.produto ?? ""),
      tipo: "Simulada",
      passos,
      aviso: "Provedor de IA indisponível na montagem final — resultado simulado.",
    };
  }

  const dados = (await resposta.json()) as { anuncio?: AnuncioDaIA; erro?: string };
  if (!resposta.ok || !dados.anuncio) {
    a4.status = "erro";
    emitir();
    throw new Error(dados.erro ?? "Falha na montagem final da esteira.");
  }

  a4.status = "ok";
  achar("A10").status = "ok";
  emitir();

  return { anuncio: comAGradeDoCadastro(dados.anuncio, grade), tipo: "IA", passos };
}
