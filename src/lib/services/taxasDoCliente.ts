// Monta o ModeloTaxas com o que o ML diz — não com o que a gente supõe.
//
// Duas coisas deixam de ser tabela nossa e passam a vir da fonte:
//   comissão  → a tarifa da CATEGORIA exata do produto
//   reputação → o nível do vendedor, que escolhe a tabela de custo de envio
//
// Ambas caem no padrão quando a API não responde. O padrão é conservador para
// o que importa: reputação desconhecida vira verde (a regra do ML para quem não
// tem reputação), e comissão desconhecida usa a tabela de Moda. Nenhum dos dois
// inventa um custo MENOR do que o real — o erro perigoso.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import { pedeReconexao } from "../../modules/integration/domain/credencialRecusada";
import {
  TAXAS_PADRAO,
  reputacaoDoLevelId,
  type Embalagem,
  type ModeloTaxas,
} from "../../modules/pricing/domain/modeloPreco.ts";

/**
 * A embalagem de um produto vem da VARIANTE — é lá que moram peso e medidas
 * (migração 001). Variantes do mesmo produto costumam dividir a embalagem, mas
 * quando divergem vale a MAIOR: subestimar o volume subestima o frete, e é
 * esse o erro que faz o lojista vender no prejuízo.
 *
 * Devolve null quando nenhuma variante tem medida — aí o envio é pendência,
 * não estimativa. Puro.
 */
export function embalagemDasVariantes(
  variantes: readonly { peso: number; altura: number; largura: number; comprimento: number }[]
): Embalagem | null {
  const uteis = variantes.filter((v) => v.peso > 0 || v.altura > 0 || v.largura > 0 || v.comprimento > 0);
  if (uteis.length === 0) return null;
  return {
    pesoGramas: Math.max(...uteis.map((v) => v.peso)) * 1000, // a variante guarda em kg
    alturaCm: Math.max(...uteis.map((v) => v.altura)),
    larguraCm: Math.max(...uteis.map((v) => v.largura)),
    comprimentoCm: Math.max(...uteis.map((v) => v.comprimento)),
  };
}

interface RespostaCustos {
  reputacao?: { levelId: string | null; powerSellerStatus: string | null } | null;
  tarifa?: { percentual: number; taxaFixa: number; valorTotal: number } | null;
  aviso?: string;
  erro?: string;
}

export interface CustosDoCliente {
  /** O modelo pronto para o núcleo puro. */
  taxas: ModeloTaxas;
  /** true quando a comissão veio da API, não da tabela de Moda. */
  comissaoDaApi: boolean;
  /** true quando a reputação veio da API, não do padrão. */
  reputacaoDaApi: boolean;
  /** Motivo de alguma parte ter caído no padrão. Vale mostrar ao lojista. */
  aviso: string | null;
  /**
   * O ML recusou a credencial salva — só reconectar resolve.
   *
   * Separado do `aviso` de propósito: os outros avisos dizem "caiu no padrão,
   * siga usando"; este tem uma AÇÃO, e a tela precisa saber a diferença para
   * oferecer o caminho em vez de apenas informar.
   */
  precisaReconectar?: boolean;
}

/**
 * Uma consulta por (cliente, categoria, preço, tipo). O percentual de tarifa
 * não muda entre renderizações, e a tela de precificação tem uma linha por
 * produto — sem isto seria uma chamada de rede por linha.
 */
const cache = new Map<string, Promise<CustosDoCliente>>();

export function limparCacheDeCustos(): void {
  cache.clear();
}

export interface PedidoDeCustos {
  clienteId: string;
  marketplace?: string;
  tipoAnuncio?: string;
  /** Sem categoria, só a reputação é consultada. */
  categoryId?: string | null;
  preco?: number | null;
  embalagem?: Embalagem | null;
}

export async function custosDoCliente(p: PedidoDeCustos): Promise<CustosDoCliente> {
  const listingTypeId = /prem|pro|gold_pro/i.test(p.tipoAnuncio ?? "Premium")
    ? "gold_pro"
    : "gold_special";
  // O preço entra na chave arredondado: a tarifa é por faixa, e consultar de
  // centavo em centavo encheria o cache sem mudar a resposta.
  const chave = [
    p.clienteId,
    p.marketplace ?? "Mercado Livre",
    p.categoryId ?? "",
    listingTypeId,
    p.preco ? Math.round(p.preco) : 0,
  ].join("|");

  const emCache = cache.get(chave);
  if (emCache) return aplicarEmbalagem(await emCache, p.embalagem ?? null);

  const promessa = buscar(p, listingTypeId);
  cache.set(chave, promessa);
  try {
    return aplicarEmbalagem(await promessa, p.embalagem ?? null);
  } catch (e) {
    cache.delete(chave); // falha não fica grudada no cache
    throw e;
  }
}

/** A embalagem é do PRODUTO, não da consulta — entra depois do cache. */
function aplicarEmbalagem(c: CustosDoCliente, embalagem: Embalagem | null): CustosDoCliente {
  return { ...c, taxas: { ...c.taxas, embalagem } };
}

async function buscar(p: PedidoDeCustos, listingTypeId: string): Promise<CustosDoCliente> {
  const padrao: CustosDoCliente = {
    taxas: { ...TAXAS_PADRAO, tipoAnuncio: p.tipoAnuncio ?? "Premium" },
    comissaoDaApi: false,
    reputacaoDaApi: false,
    aviso: null,
  };
  if (!p.clienteId) return padrao;

  try {
    const resposta = await fetch("/api/ml/custos", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
      body: JSON.stringify({
        clienteId: p.clienteId,
        marketplace: p.marketplace,
        categoryId: p.categoryId ?? undefined,
        preco: p.preco ?? undefined,
        listingTypeId,
      }),
    });
    const dados = (await resposta.json()) as RespostaCustos;
    if (!resposta.ok) {
      return {
        ...padrao,
        aviso: dados.erro ?? "Não foi possível consultar os custos no ML.",
        precisaReconectar: pedeReconexao(dados),
      };
    }

    const rep = dados.reputacao;
    const tarifa = dados.tarifa;
    return {
      taxas: {
        ...TAXAS_PADRAO,
        tipoAnuncio: p.tipoAnuncio ?? "Premium",
        reputacao: rep
          ? reputacaoDoLevelId(rep.levelId, rep.powerSellerStatus)
          : TAXAS_PADRAO.reputacao,
        percentualVendaML: tarifa?.percentual ?? null,
        taxaFixaVendaML: tarifa?.taxaFixa ?? null,
      },
      comissaoDaApi: Boolean(tarifa),
      reputacaoDaApi: Boolean(rep),
      aviso: dados.aviso ?? null,
    };
  } catch {
    // Sem rede, a precificação continua funcionando com a tabela — só não é
    // a verdade da conta do cliente, e o chamador sabe disso pelos flags.
    return { ...padrao, aviso: "Sem conexão com o Mercado Livre; usando a tabela padrão." };
  }
}
