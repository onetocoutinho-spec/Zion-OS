// Offer Observation (E5.0) — o que aconteceu depois que uma Oferta foi criada?
//
// SOMENTE OBSERVAÇÃO: leitura pura sobre os dois logs imutáveis (`ofertas` ×
// `decisoes`). Nada é escrito, nada é recalculado, nenhum estado novo existe.
// Esta é a fundação da futura Outcome Projection (E5.1) — aqui nomeamos as
// CLASSES DE EVIDÊNCIA que os fatos permitem distinguir:
//
//   respondida_igual      ∃ Decision posterior no mesmo slot (e mesma entidade,
//                         quando a oferta tem) com o valor oferecido → "aceita"
//   respondida_diferente  a Decision posterior traz OUTRO valor → "editada/
//                         contradita" (indistinguíveis sem fato de aplicação —
//                         limite declarado)
//   sem_resposta          nenhuma Decision posterior → "ignorada ATÉ AGORA".
//                         Sem janela temporal: janela seria heurística (a
//                         política de recência segue deferida — RFC-AIL-004
//                         §6.4). A observação nunca "fecha" uma oferta.
//
// LIMITES DECLARADOS (evidências que o sistema produz sobre si mesmo):
//   1. `criarProduto` não captura → aceitação em CRIAÇÃO é invisível ao Journal.
//   2. "Remover sugestão" não registra fato → `rejeitada` é INDETECTÁVEL hoje.
//   3. Correspondência é por slot(+entidade), não por causalidade provada.
// Esses limites são insumos do design da E5.1, não defeitos silenciosos.

import { criarRepositorio } from "../../../lib/repositorio.ts";
import type { OfertaRow } from "../../../lib/supabase/database.types.ts";
import { canonicalizarValor } from "../domain/pattern-key.ts";
import type { Decision } from "../domain/decision.ts";
import type { Oferta } from "../domain/offer.ts";
import { ofertaParaApp, ofertaParaBanco } from "../infrastructure/offer.mapper.ts";
import { reposLeituraPadrao, rotuloAutor, type ReposDeLeitura } from "./pattern-browser.ts";

const repoOfertas = criarRepositorio<Oferta, OfertaRow>({
  tabela: "ofertas",
  colecao: "ofertas",
  prefixoIdLocal: "ofr", // nunca usado: leitura apenas
  selecao: "*",
  paraApp: ofertaParaApp,
  paraBanco: ofertaParaBanco,
});

/** Repositórios de observação (injetáveis em teste). */
export interface ReposObservacao extends ReposDeLeitura {
  ofertas: {
    listar(filtro?: { coluna: string; valor: string; campoLocal: string }): Promise<Oferta[]>;
  };
}

const reposPadrao: ReposObservacao = { ...reposLeituraPadrao, ofertas: repoOfertas };

/** As classes de evidência que os fatos atuais permitem distinguir. */
export type ClasseDeResposta = "respondida_igual" | "respondida_diferente" | "sem_resposta";

/** A observação de UMA oferta — cada campo com origem nos dois logs. */
export interface ObservacaoDaOferta {
  oferta: Oferta;
  classe: ClasseDeResposta;
  /** A PRIMEIRA Decision posterior correspondente (null em sem_resposta). */
  resposta: {
    decisionId: string;
    autor: string; // rotulado ("não registrado" quando anônima)
    quando: string;
    valorAnterior: string | null;
    valorNovo: string;
    origem: string;
    /** Tempo entre a oferta e a resposta, em ms (E5.2: "quanto tempo levou"). */
    tempoAteRespostaMs: number;
  } | null;
  /** Decisions posteriores adicionais no mesmo alvo (transparência total). */
  respostasSubsequentes: number;
}

/** a Decision corresponde ao alvo da oferta? (slot + entidade quando houver) */
function correspondeAoAlvo(oferta: Oferta, d: Decision): boolean {
  if (d.empresa !== oferta.empresa) return false;
  if (d.contexto !== oferta.contexto) return false;
  if (d.campo !== oferta.campo) return false;
  if (oferta.entidade) {
    return d.entidade.tipo === oferta.entidade.tipo && d.entidade.id === oferta.entidade.id;
  }
  return true; // oferta em criação: correspondência por slot (limite declarado)
}

/**
 * PURA: observa UMA oferta contra o Journal. A resposta é a primeira Decision
 * posterior correspondente (ordem por timestamp; empate lexicográfico — o
 * mesmo desempate determinístico do Detector).
 */
export function observarOferta(oferta: Oferta, decisoes: readonly Decision[]): ObservacaoDaOferta {
  const posteriores = decisoes
    .filter((d) => correspondeAoAlvo(oferta, d) && d.timestamp > oferta.oferecidaEm)
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : 1));

  if (posteriores.length === 0) {
    return { oferta, classe: "sem_resposta", resposta: null, respostasSubsequentes: 0 };
  }

  const primeira = posteriores[0];
  const valorRespondido = canonicalizarValor(primeira.valorNovo, oferta.campo);
  const classe: ClasseDeResposta =
    valorRespondido === oferta.valorOferecido ? "respondida_igual" : "respondida_diferente";

  return {
    oferta,
    classe,
    resposta: {
      decisionId: primeira.id,
      autor: rotuloAutor(primeira.autor),
      quando: primeira.timestamp,
      valorAnterior: primeira.valorAnterior,
      valorNovo: primeira.valorNovo,
      origem: primeira.origem,
      tempoAteRespostaMs: Math.max(0, Date.parse(primeira.timestamp) - Date.parse(oferta.oferecidaEm)),
    },
    respostasSubsequentes: posteriores.length - 1,
  };
}

/**
 * Observa TODAS as ofertas de uma empresa (ou todas, sem filtro). Leitura pura:
 * uma listagem de cada log, cruzamento em memória — nenhuma escrita.
 */
export async function observarOfertas(
  empresa?: string,
  repos: ReposObservacao = reposPadrao
): Promise<ObservacaoDaOferta[]> {
  const filtro = empresa ? { coluna: "empresa", valor: empresa, campoLocal: "empresa" } : undefined;
  const [ofertas, decisoes] = await Promise.all([
    repos.ofertas.listar(filtro),
    repos.decisoes.listar(filtro),
  ]);
  return ofertas
    .map((o) => observarOferta(o, decisoes))
    .sort((a, b) => (a.oferta.oferecidaEm < b.oferta.oferecidaEm ? 1 : -1)); // recentes primeiro
}
