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
import { anuncioSimulado, type AnuncioGerado } from "../agentes/esteira";

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
  /** Chamado a cada mudança de estado dos passos (para a barra de progresso). */
  onPasso?: (passos: PassoCadeia[]) => void;
}

/** Códigos que rodam como agente-texto (A4 monta e A10 valida no passo final). */
const INTERMEDIARIOS = ORDEM_ESTEIRA.filter((c) => c !== "A4" && c !== "A10");

async function rodarAgenteTexto(
  agente: AgenteDef,
  entrada: string,
  contexto: string
): Promise<{ markdown: string; simulado: boolean }> {
  const resposta = await fetch("/api/agentes/executar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  const contexto = opcoes.contexto ?? "";
  let dossie = opcoes.briefing?.trim() || "";

  // 1) Agentes intermediários (A0, A1, A2, A9, construtores) — acumulam o dossiê.
  for (const codigo of INTERMEDIARIOS) {
    const agente = AGENTES[codigo];
    const passo = achar(codigo);
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
          "Nenhum provedor de IA configurado no servidor — a esteira rodou em modo simulado. Configure GEMINI_API_KEY (ou ANTHROPIC_API_KEY) no .env.local do servidor.",
      };
    }
    passo.resultado = res.markdown;
    passo.status = "ok";
    dossie += `\n\n=== ${agente.codigo} · ${agente.nome} ===\n${res.markdown}`;
    emitir();
  }

  // 2) Montagem final estruturada (A4 monta + A10 valida) via /api/agentes/esteira.
  const a4 = achar("A4");
  a4.status = "rodando";
  emitir();

  const resposta = await fetch("/api/agentes/esteira", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  const dados = (await resposta.json()) as { anuncio?: AnuncioGerado; erro?: string };
  if (!resposta.ok || !dados.anuncio) {
    a4.status = "erro";
    emitir();
    throw new Error(dados.erro ?? "Falha na montagem final da esteira.");
  }

  a4.status = "ok";
  achar("A10").status = "ok";
  emitir();

  return { anuncio: dados.anuncio, tipo: "IA", passos };
}
