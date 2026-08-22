// O PORTFÓLIO — o que a agência (e a Zion) precisa ler em segundos sobre TODAS
// as lojas: qual precisa de mim, e como está cada uma.
//
// Regra pura, sem rede: recebe o que o painel já carrega (lojas, resumo dos
// anúncios, produtos, pendências) e devolve uma linha por loja + a lista de
// atenção. A definição de "anúncio com problema" é a MESMA do portal do
// lojista (src/app/cliente/page.tsx) — a quarta versão dessa regra seria um
// defeito, não uma feature.
//
// O que este módulo NÃO faz de propósito: vendas. Elas vêm do ML por loja
// (api/ml/vendas) e custariam N chamadas por carga do painel. Entram quando
// houver resumo agregado no banco (docs/product/ux/02, "sem comparação
// temporal").

import type { Cliente, Pendencia, Produto } from "../types";
import type { ResumoDoAnuncio } from "../services/anunciosGerados";
import { PESO_DA_SAUDE, saudeDaLoja, type SaudeDaLoja } from "./saudeDaLoja";

export interface LinhaDoPortfolio {
  loja: Cliente;
  saude: SaudeDaLoja;
  produtos: number;
  produtosEmCadastro: number;
  anuncios: number;
  /** `statusMarketplace === "active"` — no ar NA PALAVRA DO ML. */
  noAr: number;
  /** Com pendência da esteira ou parado antes de aprovado/publicado. */
  comProblema: number;
  /** Com motivo apontado pelo ML (`subStatusMarketplace` não vazio). */
  comInfracao: number;
  pendenciasAbertas: number;
  marketplacesConectados: number;
}

export interface ItemDeAtencao {
  lojaId: string;
  loja: string;
  nivel: SaudeDaLoja["nivel"];
  /** O que está acontecendo, com número. */
  motivo: string;
  /** O rótulo do botão. */
  acao: string;
  /** A tela EXATA onde se resolve, já com a loja no contexto. */
  href: string;
}

export interface ResumoDoPortfolio {
  linhas: LinhaDoPortfolio[];
  atencao: ItemDeAtencao[];
  totais: {
    lojas: number;
    lojasAtivas: number;
    noAr: number;
    comProblema: number;
    precisamDeAtencao: number;
    produtosEmCadastro: number;
  };
}

function anuncioComProblema(a: ResumoDoAnuncio): boolean {
  return a.qtdPendencias > 0 || (a.status !== "aprovado" && a.status !== "publicado");
}

export function resumoDoPortfolio(
  lojas: readonly Cliente[],
  anuncios: readonly ResumoDoAnuncio[],
  produtos: readonly Produto[],
  pendencias: readonly Pendencia[]
): ResumoDoPortfolio {
  const porLoja = new Map<string, { a: ResumoDoAnuncio[]; p: Produto[]; pend: Pendencia[] }>();
  const balde = (id: string) => {
    let b = porLoja.get(id);
    if (!b) {
      b = { a: [], p: [], pend: [] };
      porLoja.set(id, b);
    }
    return b;
  };
  for (const a of anuncios) balde(a.clienteId).a.push(a);
  for (const p of produtos) balde(p.clienteId).p.push(p);
  for (const p of pendencias) if (!p.resolvida) balde(p.clienteId).pend.push(p);

  const linhas: LinhaDoPortfolio[] = lojas.map((loja) => {
    const b = porLoja.get(loja.id) ?? { a: [], p: [], pend: [] };
    const comInfracao = b.a.filter((a) => (a.subStatusMarketplace?.length ?? 0) > 0).length;
    const comProblema = b.a.filter(anuncioComProblema).length;
    const pendenciasAbertas = b.pend.length;
    const saude = saudeDaLoja(loja, { anunciosComProblema: comInfracao + comProblema, pendenciasAbertas });
    return {
      loja,
      saude,
      produtos: b.p.length,
      produtosEmCadastro: b.p.filter((p) => p.statusCadastro === "Em cadastro" || p.statusCadastro === "Não iniciado").length,
      anuncios: b.a.length,
      noAr: b.a.filter((a) => a.statusMarketplace === "active").length,
      comProblema,
      comInfracao,
      pendenciasAbertas,
      marketplacesConectados: loja.marketplaces.length,
    };
  });

  linhas.sort(
    (x, y) =>
      PESO_DA_SAUDE[x.saude.nivel] - PESO_DA_SAUDE[y.saude.nivel] ||
      y.comInfracao + y.comProblema - (x.comInfracao + x.comProblema) ||
      x.loja.empresa.localeCompare(y.loja.empresa)
  );

  // ATENÇÃO: um item por loja que não está saudável, com a ação que resolve
  // o motivo MAIS GRAVE — não a ficha genérica.
  const atencao: ItemDeAtencao[] = [];
  for (const l of linhas) {
    if (l.saude.nivel === "ok") continue;
    const id = l.loja.id;
    const nome = l.loja.empresa;
    let acao: { motivo: string; acao: string; href: string };
    if (l.marketplacesConectados === 0) {
      acao = { motivo: "nenhum marketplace conectado", acao: "Conectar ML", href: `/cliente/conectar-ml?cliente=${id}` };
    } else if (l.comInfracao > 0) {
      acao = { motivo: `${l.comInfracao} anúncios com infração no marketplace`, acao: "Ver anúncios", href: `/esteira/aprovacoes?loja=${id}` };
    } else if (l.comProblema > 0) {
      acao = { motivo: `${l.comProblema} anúncios parados na esteira`, acao: "Ver esteira", href: `/esteira/aprovacoes?loja=${id}` };
    } else if (l.pendenciasAbertas > 0) {
      acao = { motivo: `${l.pendenciasAbertas} pendências abertas`, acao: "Ver pendências", href: `/pendencias?loja=${id}` };
    } else if (l.loja.status === "Onboarding") {
      acao = { motivo: "ainda em onboarding", acao: "Abrir loja", href: `/clientes/${id}` };
    } else {
      acao = { motivo: l.saude.motivo, acao: "Abrir loja", href: `/clientes/${id}` };
    }
    atencao.push({ lojaId: id, loja: nome, nivel: l.saude.nivel, ...acao });
  }

  return {
    linhas,
    atencao,
    totais: {
      lojas: lojas.length,
      lojasAtivas: lojas.filter((l) => l.status === "Ativo").length,
      noAr: linhas.reduce((s, l) => s + l.noAr, 0),
      comProblema: linhas.reduce((s, l) => s + l.comProblema + l.comInfracao, 0),
      precisamDeAtencao: atencao.length,
      produtosEmCadastro: linhas.reduce((s, l) => s + l.produtosEmCadastro, 0),
    },
  };
}
