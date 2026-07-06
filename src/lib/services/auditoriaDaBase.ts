// Gera a Auditoria em Massa DIRETO da base de produtos importada (P0-2).
//
// Sem segundo CSV: para cada produto do cliente, deriva os sinais de
// qualidade do próprio cadastro (título, descrição, imagens, ficha, margem,
// estoque, variações), calcula o score e prioriza em modo COLD-START
// (potencial = margem × estoque × quanto há para ganhar). As auditorias
// nascem VINCULADAS ao produto (produtoId) — o que deixa o briefing da
// esteira em lote rico (custo, margem, variações).

import {
  calcularScore,
  classificarPrioridadeColdStart,
  AGENTE_POR_PROBLEMA,
  GRAVIDADE_PROBLEMA,
  SUGESTAO_PROBLEMA,
  ROTULO_TIPO_PROBLEMA,
  type SinaisQualidade,
} from "../auditoria";
import type { AuditoriaAnuncio, ProblemaAnuncio, Produto, TipoProblema } from "../types";
import { listarProdutosDoCliente } from "./produtos";
import { listarTodasVariantes } from "./produtoVariantes";
import { criarImportacao } from "./importacoes";
import { criarAuditorias, listarAuditorias } from "./auditorias";
import { criarProblemas } from "./problemasAnuncio";
import { margemZion } from "./importacaoProdutos";

function tituloParecOtimizado(titulo: string): boolean {
  const palavras = titulo.trim().split(/\s+/).filter(Boolean);
  return titulo.trim().length >= 20 && titulo.trim().length <= 60 && palavras.length >= 4;
}

function derivarSinais(p: Produto, qtdVariacoes: number, margem: number): SinaisQualidade {
  return {
    tituloOtimizado: tituloParecOtimizado(p.nome),
    descricaoCompleta: p.statusDescricao === "Concluído" || Boolean(p.descricaoBase),
    imagensAdequadas: p.statusImagens === "Concluído",
    fichaTecnicaCompleta: Boolean(p.marca && p.modelo && p.categoria),
    precoCompetitivo: p.precoVenda > 0 && margem >= 5,
    estoqueDisponivel: p.estoque > 0,
    variacoesCorretas: p.tipoProduto !== "com_variacao" || qtdVariacoes > 0,
    tabelaMedidasAplicavel: /cal[çc]ad|t[êe]nis|moda|roupa|vestu/i.test(p.categoria),
    // Sem dado de tabela de medidas no cadastro — pendência real em calçado/moda.
    tabelaMedidas: false,
    // Sem métricas de tráfego na geração da base (entram depois, via CSV).
    conversao: 0,
    visitas: 0,
  };
}

/** Problemas derivados dos sinais de CADASTRO (tráfego fica para as métricas). */
function derivarTipos(s: SinaisQualidade): TipoProblema[] {
  const tipos: TipoProblema[] = [];
  if (!s.tituloOtimizado) tipos.push("titulo_ruim");
  if (!s.descricaoCompleta) tipos.push("descricao_incompleta");
  if (!s.imagensAdequadas) tipos.push("imagem_fraca");
  if (!s.fichaTecnicaCompleta) tipos.push("ficha_tecnica_incompleta");
  if (!s.precoCompetitivo) tipos.push("preco_nao_competitivo");
  if (!s.estoqueDisponivel) tipos.push("estoque_baixo");
  if (!s.variacoesCorretas) tipos.push("variacao_incorreta");
  if (s.tabelaMedidasAplicavel && !s.tabelaMedidas) tipos.push("falta_tabela_medidas");
  return tipos;
}

export interface ResumoAuditoriaDaBase {
  auditados: number;
  pulados: number;
  problemas: number;
  criticas: number;
  altas: number;
}

/**
 * Audita a base de produtos do cliente. Produtos que já têm auditoria
 * vinculada são pulados (rodar de novo não duplica).
 */
export async function gerarAuditoriasDaBase(
  clienteId: string,
  cliente: string
): Promise<ResumoAuditoriaDaBase> {
  const [produtos, variantes, existentes] = await Promise.all([
    listarProdutosDoCliente(clienteId),
    listarTodasVariantes(),
    listarAuditorias(),
  ]);

  const qtdPorProduto = new Map<string, number>();
  variantes.forEach((v) => {
    if (v.produtoId) qtdPorProduto.set(v.produtoId, (qtdPorProduto.get(v.produtoId) ?? 0) + 1);
  });
  const jaAuditados = new Set(existentes.map((a) => a.produtoId).filter(Boolean));

  const alvo = produtos.filter((p) => !jaAuditados.has(p.id));
  if (alvo.length === 0) {
    return { auditados: 0, pulados: produtos.length, problemas: 0, criticas: 0, altas: 0 };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const importacao = await criarImportacao({
    clienteId,
    cliente,
    marketplace: "Mercado Livre",
    nomeArquivo: "",
    origem: "manual",
    quantidadeAnuncios: alvo.length,
    quantidadeProcessada: alvo.length,
    status: "concluida",
    dataImportacao: hoje,
    responsavel: "",
    observacoes: `Auditoria gerada da base de produtos (${alvo.length} itens, priorização cold-start).`,
  });

  const auditorias: Omit<AuditoriaAnuncio, "id">[] = [];
  const tiposPorIndice: TipoProblema[][] = [];
  let criticas = 0;
  let altas = 0;

  for (const p of alvo) {
    const qtdVar = qtdPorProduto.get(p.id) ?? 0;
    const margem = p.margem ?? margemZion(p.custo, p.precoVenda);
    const sinais = derivarSinais(p, qtdVar, margem);
    const score = calcularScore(sinais);
    const tipos = derivarTipos(sinais);
    const prioridade = classificarPrioridadeColdStart(score, { margem, estoque: p.estoque });
    if (prioridade === "critica") criticas++;
    if (prioridade === "alta") altas++;

    auditorias.push({
      importacaoId: importacao.id,
      clienteId,
      cliente,
      anuncioId: null,
      produtoId: p.id,
      marketplace: p.marketplace ?? "Mercado Livre",
      linkAnuncio: "",
      tituloAtual: p.nome,
      categoria: p.categoria,
      preco: p.precoVenda,
      estoque: p.estoque,
      vendas: 0,
      visitas: 0,
      conversao: 0,
      scoreQualidade: score,
      classificacaoAbc: "C",
      prioridade,
      statusAuditoria: "analisado",
      problemasEncontrados:
        tipos.slice(0, 3).map((t) => ROTULO_TIPO_PROBLEMA[t]).join(", ") ||
        "Nenhum problema crítico de cadastro",
      oportunidades: `Cold-start — potencial: margem ${margem.toFixed(1)}%, ${p.estoque} em estoque, ${qtdVar} variações.`,
      proximaAcao:
        tipos.length > 0 ? SUGESTAO_PROBLEMA[tipos[0]] : "Cadastro ok — validar métricas quando houver tráfego.",
      agenteRecomendado:
        tipos.length > 0 ? AGENTE_POR_PROBLEMA[tipos[0]] : "Zion Checklist por Categoria",
      responsavel: "",
    });
    tiposPorIndice.push(tipos);
  }

  const criadas = await criarAuditorias(auditorias);

  const problemas: Omit<ProblemaAnuncio, "id">[] = [];
  criadas.forEach((aud, i) => {
    (tiposPorIndice[i] ?? []).slice(0, 4).forEach((tipo) => {
      problemas.push({
        auditoriaId: aud.id,
        tipoProblema: tipo,
        gravidade: GRAVIDADE_PROBLEMA[tipo],
        descricao: `${ROTULO_TIPO_PROBLEMA[tipo]} identificado na auditoria da base.`,
        sugestaoCorrecao: SUGESTAO_PROBLEMA[tipo],
        agenteRecomendado: AGENTE_POR_PROBLEMA[tipo],
        status: "aberto",
      });
    });
  });
  await criarProblemas(problemas);

  return {
    auditados: criadas.length,
    pulados: produtos.length - alvo.length,
    problemas: problemas.length,
    criticas,
    altas,
  };
}