// As pendências da conta, montadas a partir da MEMÓRIA (migrações 050/051/052).
//
// ===========================================================================
// POR QUE ESTE ARQUIVO EXISTE
// ===========================================================================
//
// Havia DUAS COISAS COM O MESMO NOME no produto, e elas discordavam na tela:
//
//   Visão geral → "Pendências abertas: 0"   lia a tabela `pendencias`,
//                                           herança da época de agência, vazia
//   Tela Pendências → dezenas de linhas     lia o que o Mercado Livre cobra
//
// Um card dizendo "0" ao lado de um menu chamado "Pendências" que lista
// dezenas não é número errado: é a mesma palavra apontando para dois lugares.
// Para a lojista, o card é o resumo da tela — e ele afirmava que não havia o
// que fazer.
//
// ===========================================================================
// POR QUE UMA FUNÇÃO, E NÃO UM SEGUNDO CÁLCULO
// ===========================================================================
//
// Em 03/08/2026 o MESMO defeito apareceu TRÊS vezes: uma regra escrita em dois
// lugares, consertada num deles.
//
//   "Otimizado"                Meus Produtos + Relatórios + Visão geral
//   remédio do ML              "Conferir agora" ligado, memória esquecida
//   estado do anúncio          esteira vs. marketplace
//
// Nas três, consertar um lado não deixava rastro no outro. Somar aqui um
// quarto cálculo de pendências — ainda que correto hoje — seria montar a
// quarta ocorrência com as próprias mãos.
//
// Então a montagem mora AQUI, uma vez. Quem quiser o número chama esta função;
// quem quiser a lista chama esta função. A regra continua em
// `pendenciasDaConta`, que esta função apenas alimenta.
//
// O CARREGAMENTO fica com quem chama, de propósito: as duas telas já leem
// `anuncios_gerados` por conta própria, e puxar de novo aqui dobraria o
// tráfego — que é o muro mais próximo do plano Free (DES-005).

import {
  pendenciasDaConta,
  type InfracoesPorAnuncio,
  type ResumoDePendencias,
} from "../../modules/integration/domain/pendenciasDaConta";
import type { AnuncioGeradoRegistro } from "../types";

/** O que a tela precisa saber além das pendências: quantos, e de quando. */
export interface PendenciasDaMemoria extends ResumoDePendencias {
  /** Anúncios que tinham leitura gravada — a base do retrato. */
  lidos: number;
  /** Quando o Mercado Livre foi lido pela última vez. `null` = nunca. */
  lidoEm: string | null;
}

/** Só o que tem MLB e estado gravado entra: sem leitura, não há retrato. */
type Entrada = Pick<
  AnuncioGeradoRegistro,
  | "mlItemId"
  | "produto"
  | "mlPermalink"
  | "statusMarketplace"
  | "statusMarketplaceEm"
  | "estoqueMarketplace"
  | "subStatusMarketplace"
  | "fotoCapaMaxSize"
> & { anuncio?: { tituloOtimizado?: string } };

export function pendenciasDaMemoria(
  gravados: readonly Entrada[],
  infracoes: InfracoesPorAnuncio = {},
  limitePorTipo = 25
): PendenciasDaMemoria | null {
  const comLeitura = gravados.filter((a) => a.mlItemId && a.statusMarketplace);
  if (comLeitura.length === 0) return null;

  const p = pendenciasDaConta(
    comLeitura.map((a) => ({
      mlb: a.mlItemId as string,
      titulo: a.anuncio?.tituloOtimizado || a.produto || (a.mlItemId as string),
      permalink: a.mlPermalink ?? "",
      status: a.statusMarketplace as string,
      // `?? 0` aqui é seguro e em `subStatus`/`fotoCapaMaxSize` também: são
      // entradas de ORDENAÇÃO e de detecção, não afirmações na tela. O que
      // nunca pode virar padrão é o ESTADO, e ele é filtrado acima.
      estoque: a.estoqueMarketplace ?? 0,
      subStatus: a.subStatusMarketplace ?? [],
      fotoCapaMaxSize: a.fotoCapaMaxSize ?? "",
      familia: a.produto ?? "",
    })),
    limitePorTipo,
    infracoes
  );

  // A DATA importa tanto quanto os números: um retrato de três dias atrás
  // apresentado como atual é a mesma mentira que o `status` fixo era.
  const lidoEm =
    comLeitura
      .map((a) => a.statusMarketplaceEm ?? "")
      .filter(Boolean)
      .sort()
      .pop() ?? null;

  return { ...p, lidos: comLeitura.length, lidoEm };
}
