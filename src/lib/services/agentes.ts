import { criarRepositorio } from "../repositorio";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import {
  agenteParaApp,
  agenteParaBanco,
  execucaoParaApp,
  execucaoParaBanco,
} from "../supabase/mappers";
import type { AgenteRow, ExecucaoRow } from "../supabase/database.types";
import type { AgenteIA, ExecucaoAgente } from "../types";

const repo = criarRepositorio<AgenteIA, AgenteRow>({
  tabela: "agentes",
  colecao: "agentes",
  prefixoIdLocal: "agt",
  selecao: "*",
  paraApp: agenteParaApp,
  paraBanco: agenteParaBanco,
});

const repoExecucoes = criarRepositorio<ExecucaoAgente, ExecucaoRow>({
  tabela: "execucoes_agentes",
  colecao: "execucoes",
  prefixoIdLocal: "exe",
  selecao: "*, agentes(nome)",
  paraApp: execucaoParaApp,
  paraBanco: execucaoParaBanco,
  ordenarPor: "data_hora",
});

export async function listarAgentes(): Promise<AgenteIA[]> {
  return repo.listar();
}

export async function buscarAgente(id: string): Promise<AgenteIA | null> {
  return repo.buscar(id);
}

export async function criarAgente(dados: Omit<AgenteIA, "id">): Promise<AgenteIA> {
  return repo.criar(dados);
}

export async function atualizarAgente(
  id: string,
  dados: Partial<AgenteIA>
): Promise<AgenteIA | null> {
  return repo.atualizar(id, dados);
}

export async function alterarStatusImplantacao(
  id: string,
  statusImplantacao: AgenteIA["statusImplantacao"]
): Promise<AgenteIA | null> {
  return repo.atualizar(id, { statusImplantacao });
}

export async function excluirAgente(id: string): Promise<void> {
  return repo.excluir(id);
}

// ---- Histórico de execuções (reais via IA ou simuladas) ----

export async function listarExecucoesDoAgente(
  agenteId: string
): Promise<ExecucaoAgente[]> {
  return repoExecucoes.listar({
    coluna: "agente_id",
    valor: agenteId,
    campoLocal: "agenteId",
  });
}

/** Registra uma execução simulada (fallback quando a API Claude não está configurada). */
export async function registrarExecucao(
  agente: AgenteIA,
  contexto = "Execução manual pelo Zion OS"
): Promise<ExecucaoAgente> {
  return repoExecucoes.criar({
    agenteId: agente.id,
    agente: agente.nome,
    dataHora: new Date().toISOString(),
    contexto,
    resultado: `${agente.saidaEsperada} (execução simulada)`,
    tipo: "Simulada",
  });
}

export interface TarefaSugerida {
  tarefa: string;
  prioridade: "Baixa" | "Média" | "Alta" | "Urgente";
  proximaAcao: string;
}

export interface ResultadoExecucaoIA {
  resultado: string;
  tipo: "IA" | "Simulada";
  /** Título de anúncio otimizado, quando a entrega incluir um. */
  tituloOtimizado?: string | null;
  /** Tarefas acionáveis sugeridas pelo agente a partir da entrega. */
  tarefasSugeridas?: TarefaSugerida[];
  /** Preenchido quando a execução caiu para o modo simulado. */
  aviso?: string;
}

export interface OpcoesExecucaoIA {
  /** Bloco de dados do sistema montado por lib/contexto.ts (opcional). */
  contexto?: string;
  /** Resumo curto do contexto (ex.: "TechSound · Fone TWS Pro") para o histórico. */
  resumoContexto?: string;
  /** Há um anúncio no contexto (habilita o extra de título no modo simulado). */
  contemAnuncio?: boolean;
}

/**
 * Executa o agente de verdade via API Claude (rota /api/agentes/executar).
 * Sem ANTHROPIC_API_KEY no servidor, registra uma execução simulada e avisa.
 * Outros erros são lançados para a tela exibir.
 */
export async function executarAgenteIA(
  agente: AgenteIA,
  entrada: string,
  opcoes: OpcoesExecucaoIA = {}
): Promise<ResultadoExecucaoIA> {
  // O que fica gravado no histórico como "contexto" da execução
  const registroContexto = opcoes.resumoContexto
    ? `[${opcoes.resumoContexto}] ${entrada || "Execução com contexto do sistema"}`
    : entrada;

  const resposta = await fetch("/api/agentes/executar", {
    method: "POST",
    // A terceira do mesmo defeito — o painel da equipe. `cadeiaEsteira.ts`
    // chamava a MESMA rota com o cabecalho; tres caminhos, um so acertava.
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ agente, entrada, contexto: opcoes.contexto }),
  });

  if (resposta.status === 503) {
    // API Claude não configurada: mantém o comportamento simulado das versões
    // anteriores, com ações de exemplo para demonstrar o fluxo completo.
    const simulada = await registrarExecucao(agente, registroContexto);
    return {
      resultado: simulada.resultado,
      tipo: "Simulada",
      tituloOtimizado: opcoes.contemAnuncio
        ? `[SIMULAÇÃO] Título otimizado gerado pelo ${agente.nome}`
        : null,
      tarefasSugeridas: [
        {
          tarefa: `[SIMULAÇÃO] Revisar a entrega do ${agente.nome}`,
          prioridade: "Média",
          proximaAcao: "Configurar a ANTHROPIC_API_KEY para execuções reais",
        },
      ],
      aviso:
        "ANTHROPIC_API_KEY não configurada — execução registrada como simulada (as ações abaixo são exemplos). Configure a chave no .env.local para execuções reais.",
    };
  }

  const dados = (await resposta.json()) as {
    resultado?: string;
    tituloOtimizado?: string | null;
    tarefasSugeridas?: TarefaSugerida[];
    erro?: string;
  };

  if (!resposta.ok || !dados.resultado) {
    throw new Error(dados.erro ?? "Falha ao executar o agente.");
  }

  await repoExecucoes.criar({
    agenteId: agente.id,
    agente: agente.nome,
    dataHora: new Date().toISOString(),
    contexto: registroContexto,
    resultado: dados.resultado,
    tipo: "IA",
  });

  return {
    resultado: dados.resultado,
    tipo: "IA",
    tituloOtimizado: dados.tituloOtimizado ?? null,
    tarefasSugeridas: dados.tarefasSugeridas ?? [],
  };
}
