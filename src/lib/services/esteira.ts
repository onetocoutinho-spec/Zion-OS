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

export interface ResultadoEsteira {
  anuncio: AnuncioGerado;
  tipo: "IA" | "Simulada";
  aviso?: string;
}

export interface OpcoesEsteira {
  /** Bloco de dados do sistema (cliente/produto/anúncio) montado por lib/contexto. */
  contexto?: string;
  /** Nome do produto (para o título simulado e logs). */
  produto?: string;
  /**
   * A grade cadastrada. Cor, tamanho, SKU, EAN e estoque do anúncio saem daqui
   * — a IA não os escreve mais. Ausente vira pendência, nunca grade inventada.
   */
  variantes?: readonly VarianteDaBase[];
  /** Preço do produto pai, para a variação sem preço próprio. */
  precoVenda?: number;
}

/**
 * Roda a esteira de anúncio (A1→A2→A9→A4→A10) via /api/agentes/esteira.
 * Sem ANTHROPIC_API_KEY no servidor, devolve um anúncio simulado com aviso.
 */
export async function rodarEsteira(
  briefing: string,
  opcoes: OpcoesEsteira = {}
): Promise<ResultadoEsteira> {
  // A grade real entra no contexto (para a tabela de medidas falar dos tamanhos
  // que existem) e volta no fim como a grade do anúncio. O modelo conhece, mas
  // não escreve.
  const grade = montarVariacoes(opcoes.variantes ?? [], opcoes.precoVenda ?? 0);
  const contexto = [opcoes.contexto ?? "", briefingDaGrade(grade)]
    .filter((p) => p.trim())
    .join("\n\n");

  const resposta = await fetch("/api/agentes/esteira", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({
      briefing,
      contexto,
      produto: opcoes.produto,
    }),
  });

  if (resposta.status === 503) {
    return {
      anuncio: anuncioSimulado(opcoes.produto ?? ""),
      tipo: "Simulada",
      aviso:
        "ANTHROPIC_API_KEY não configurada — a esteira rodou em modo simulado. Configure a chave no .env.local do servidor para a geração real.",
    };
  }

  const dados = (await resposta.json()) as { anuncio?: AnuncioDaIA; erro?: string };
  if (!resposta.ok || !dados.anuncio) {
    throw new Error(dados.erro ?? "Falha ao rodar a esteira.");
  }

  return { anuncio: comAGradeDoCadastro(dados.anuncio, grade), tipo: "IA" };
}
