// O que o painel de preço DECIDE — separado do que ele desenha.
//
// Mesmo motivo dos outros cartões: React não é testável neste repositório, e as
// decisões deste painel são as que menos podem errar — é dinheiro na tela.
//
// A REGRA: nenhum número aqui é calculado. Todos vêm de `conversaDePreco`, que
// vem de `modeloPreco`. Esta camada ESCREVE os números; ela não os produz.

import type {
  Cenario,
  Decomposicao,
  SituacaoDoPreco,
  Triagem,
} from "../../pricing/domain/conversaDePreco";
import { escreverReais } from "../../pricing/domain/conversaDePreco";

export interface PrecoNaTela {
  produto?: {
    produtoId: string;
    nome: string;
    situacao: SituacaoDoPreco;
    cenarios: readonly Cenario[];
  };
  triagem?: Triagem;
}

/** Uma linha do detalhamento. `negativa` para o que sai do preço. */
export interface LinhaDoBreakdown {
  rotulo: string;
  valor: string;
  negativa: boolean;
  /** O lucro é o resultado, não uma parcela — a tela o destaca. */
  resultado?: boolean;
}

/**
 * O preço aberto em linhas legíveis.
 *
 * A ORDEM é a da conta: entra o preço, saem as parcelas, sobra o lucro. Ler de
 * cima para baixo tem que reproduzir a subtração — se a ordem embaralhar, o
 * lojista não confere, e um detalhamento que não se confere é decoração.
 *
 * Parcela ZERO fica de fora: uma linha "Taxa fixa: R$ 0,00" ocupa espaço para
 * dizer que não existe.
 */
export function linhasDoBreakdown(d: Decomposicao): LinhaDoBreakdown[] {
  const linhas: LinhaDoBreakdown[] = [
    { rotulo: "Preço de venda", valor: escreverReais(d.preco), negativa: false },
    { rotulo: "Custo do produto", valor: escreverReais(d.custoProduto), negativa: true },
    { rotulo: "Comissão do Mercado Livre", valor: escreverReais(d.comissaoML), negativa: true },
  ];
  if (d.taxaFixaML > 0) {
    linhas.push({ rotulo: "Taxa fixa por venda", valor: escreverReais(d.taxaFixaML), negativa: true });
  }
  if (d.envio > 0) {
    linhas.push({ rotulo: "Frete", valor: escreverReais(d.envio), negativa: true });
  }
  if (d.percentuaisDoLojista > 0) {
    linhas.push({
      rotulo: "Imposto e comissões internas",
      valor: escreverReais(d.percentuaisDoLojista),
      negativa: true,
    });
  }
  if (d.fixosDoLojista > 0) {
    linhas.push({
      rotulo: "Embalagem e etiqueta",
      valor: escreverReais(d.fixosDoLojista),
      negativa: true,
    });
  }
  linhas.push({
    rotulo: "Sobra para você",
    valor: `${escreverReais(d.lucro)} · ${d.margem}%`,
    negativa: false,
    resultado: true,
  });
  return linhas;
}

export type EstadoDoPainelDePreco =
  /** Falta input: o painel diz o quê, e não mostra número nenhum. */
  | { estado: "bloqueado"; nome: string; falta: readonly string[] }
  /** O custo está em disputa ou é absurdo. Preço aqui seria precisão falsa. */
  | { estado: "conflito"; nome: string; motivo: string }
  /** Dá para calcular: o preço de hoje, os pisos e os cenários. */
  | {
      estado: "calculavel";
      nome: string;
      hoje: readonly LinhaDoBreakdown[] | null;
      saude: string;
      minimoSemPrejuizo: string | null;
      minimoNaMargem: string | null;
      cenarios: readonly { preco: string; lucro: string; margem: string; ok: boolean }[];
      /** Verdadeiro quando a comissão é da tabela, não da conta do lojista. */
      comissaoEstimada: boolean;
    }
  /** A triagem do catálogo. */
  | {
      estado: "triagem";
      analisados: number;
      prejuizo: number;
      abaixoDaMargem: number;
      saudaveis: number;
      naoAvaliados: number;
      frase: string;
      piores: readonly { produtoId: string; nome: string; margem: string }[];
      comissaoEstimada: boolean;
      aviso?: string;
    }
  | { estado: "vazio" };

/**
 * O estado do painel.
 *
 * Conflito ANTES de bloqueado, e bloqueado ANTES de calculável — a mesma ordem
 * do domínio. Mostrar um preço sobre um custo em disputa seria dar precisão a
 * um número que não a tem.
 */
export function estadoDoPainelDePreco(p: PrecoNaTela): EstadoDoPainelDePreco {
  if (p.triagem) {
    const t = p.triagem;
    const naoAvaliados = t.semPreco + t.bloqueados + t.conflitos;
    return {
      estado: "triagem",
      analisados: t.analisados,
      prejuizo: t.prejuizo,
      abaixoDaMargem: t.abaixoDaMargem,
      saudaveis: t.saudaveis,
      naoAvaliados,
      frase: fraseDaTriagem(t),
      piores: t.itens
        .filter((i) => i.classe === "prejuizo" || i.classe === "abaixo_da_margem")
        .slice(0, 6)
        .map((i) => ({
          produtoId: i.produtoId,
          nome: i.nome,
          margem: i.margem === undefined ? "—" : `${i.margem}%`,
        })),
      comissaoEstimada: t.comissaoUsada !== "api",
      ...(t.truncado ? { aviso: `Olhei ${t.analisados} de ${t.totalNoCatalogo} produtos.` } : {}),
    };
  }

  if (!p.produto) return { estado: "vazio" };
  const { nome, situacao, cenarios } = p.produto;

  if (situacao.estado === "conflito") {
    return { estado: "conflito", nome, motivo: situacao.bloqueios[0] ?? "custo em conflito" };
  }
  if (situacao.estado === "bloqueado") {
    return { estado: "bloqueado", nome, falta: situacao.bloqueios };
  }
  return {
    estado: "calculavel",
    nome,
    hoje: situacao.hoje ? linhasDoBreakdown(situacao.hoje) : null,
    saude: situacao.hoje?.saude ?? "—",
    minimoSemPrejuizo:
      situacao.minimoSemPrejuizo === null ? null : escreverReais(situacao.minimoSemPrejuizo),
    minimoNaMargem: situacao.minimoNaMargem === null ? null : escreverReais(situacao.minimoNaMargem),
    cenarios: cenarios.map((c) =>
      c.ok
        ? {
            preco: escreverReais(c.preco),
            lucro: escreverReais(c.decomposicao.lucro),
            margem: `${c.decomposicao.margem}%`,
            ok: true,
          }
        : { preco: escreverReais(c.preco), lucro: "—", margem: "—", ok: false }
    ),
    comissaoEstimada: situacao.procedencia.comissao !== "api",
  };
}

/**
 * A frase da triagem.
 *
 * Começa pelo que DÓI — prejuízo antes de "abaixo da margem", e os dois antes
 * do que está saudável. Quem pergunta "quais estão abaixo da margem" quer saber
 * onde está perdendo dinheiro, não quantos estão bem.
 */
export function fraseDaTriagem(t: Triagem): string {
  const partes: string[] = [];
  if (t.prejuizo > 0) {
    partes.push(`${t.prejuizo} ${t.prejuizo > 1 ? "estão" : "está"} dando prejuízo.`);
  }
  if (t.abaixoDaMargem > 0) {
    partes.push(`${t.abaixoDaMargem} abaixo da sua margem mínima.`);
  }
  if (partes.length === 0) {
    partes.push(
      t.saudaveis > 0
        ? `Nenhum produto abaixo da margem entre os ${t.saudaveis} que consegui calcular.`
        : "Não consegui calcular a margem de nenhum produto ainda."
    );
  }
  const naoAvaliados = t.semPreco + t.bloqueados + t.conflitos;
  if (naoAvaliados > 0) {
    partes.push(`${naoAvaliados} eu não consegui avaliar — falta dado.`);
  }
  return partes.join(" ");
}

// ---------------------------------------------------------------------------
// a proposta
// ---------------------------------------------------------------------------

export interface PropostaDePrecoNaTela {
  nome: string;
  preco: number;
  precoAtual: number;
  decomposicao: Decomposicao;
  resumo: string;
  comoVeio: string;
  /** A margem que o LOJISTA escolheu. É contra ela que o aviso decide. */
  margemMinima: number;
}

export type EstadoDoCartaoDePreco =
  | {
      estado: "pendente";
      de: string;
      para: string;
      linhas: readonly LinhaDoBreakdown[];
      rotuloBotao: string;
      /** Presente quando o preço fica abaixo do piso que o lojista escolheu. */
      alerta?: string;
    }
  | { estado: "concluido"; ok: boolean; mensagem: string };

/**
 * O cartão da proposta de preço.
 *
 * Mostra DE → PARA sempre. Um preço novo sozinho não deixa ninguém julgar se a
 * mudança é grande — e é o tamanho da mudança que assusta ou tranquiliza.
 *
 * Preço abaixo do piso NÃO é bloqueio: vender no prejuízo pode ser estratégia
 * (queima de estoque, isca). É aviso — quem decide é quem vende, mas ninguém
 * decide o que não vê. Mesma regra de `avisoDePreco` no cadastro manual.
 */
export function estadoDoCartaoDePreco(
  p: PropostaDePrecoNaTela,
  propostaId?: string,
  desfecho?: { ok: boolean; mensagem: string }
): EstadoDoCartaoDePreco {
  if (desfecho) return { estado: "concluido", ok: desfecho.ok, mensagem: desfecho.mensagem };
  // Sem id persistido não há o que confirmar — e um botão ali ofereceria uma
  // ação que o servidor vai recusar.
  if (!propostaId) {
    return {
      estado: "concluido",
      ok: false,
      mensagem: "Não consegui registrar essa proposta. Peça de novo.",
    };
  }
  return {
    estado: "pendente",
    de: p.precoAtual > 0 ? escreverReais(p.precoAtual) : "sem preço",
    para: escreverReais(p.preco),
    linhas: linhasDoBreakdown(p.decomposicao),
    rotuloBotao: "Aplicar no catálogo",
    ...(p.decomposicao.margem < p.margemMinima
      ? {
          alerta: `Esse preço dá ${p.decomposicao.margem}% de margem e você definiu ${p.margemMinima}% como mínimo.`,
        }
      : {}),
  };
}
