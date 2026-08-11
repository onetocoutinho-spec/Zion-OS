/**
 * As TRÊS GUARDAS que precedem toda publicação no Mercado Livre.
 *
 * ===========================================================================
 * POR QUE ELAS SAÍRAM DA ROTA
 * ===========================================================================
 *
 * Elas nasceram dentro de `/api/ml/publicar`, que por muito tempo foi o único
 * caminho até o ML. Quando um segundo caminho aparecer — a confirmação de uma
 * proposta vinda do chat —, guarda que mora na rota é guarda que o segundo
 * caminho não tem.
 *
 * E o custo de errar aqui não é simétrico: republicar o que o ML cancelou é
 * REINCIDÊNCIA, que leva à suspensão da conta. Um caminho sem a trava não
 * publica "com menos verificação"; ele publica o que nunca deveria subir.
 *
 * Este módulo NÃO devolve `Response`. Devolve VEREDICTO, e cada chamador o
 * traduz para o seu meio — HTTP na rota, cartão no chat. Foi essa dependência
 * de `Response.json` que prendia as guardas a um caminho só.
 *
 * ===========================================================================
 * A ORDEM IMPORTA
 * ===========================================================================
 *
 *   1. conexão      sem refresh_token não há o que renovar
 *   2. credencial   o token renovado é o que a trava de infração usa
 *   3. infração     precisa do access_token do passo 2
 *
 * Inverter qualquer par faz a guarda seguinte rodar sem o que ela precisa — e
 * uma trava que não consegue rodar é, na prática, uma trava ausente.
 */

export interface TokensDaPublicacao {
  accessToken: string;
  refreshToken: string;
  /** O id do vendedor no ML, quando o provedor devolve. Usado nas guias. */
  userId?: string | number | null;
}

/** O que a guarda leu do canal e o chamador ainda precisa depois. */
export interface CanalDaPublicacao {
  refreshToken?: string | null;
  /** Preferido sobre `tokens.userId` — é o que o lojista conectou. */
  sellerId?: string | number | null;
}

/** O que o chamador precisa registrar. A rota loga em JSON; o chat, não. */
export interface RegistroDoBloqueio {
  nivel: "warn" | "error";
  evento: "bloqueio" | "infracao";
  dados: Record<string, unknown>;
}

export type VeredictoDaPublicacao =
  | {
      liberado: true;
      tokens: TokensDaPublicacao;
      /**
       * O canal já lido. Devolvido para o chamador NÃO reler.
       *
       * Reler seria uma segunda consulta ao mesmo registro entre a guarda e o
       * uso — e uma janela em que os dois discordam.
       */
      canal: CanalDaPublicacao;
    }
  | {
      liberado: false;
      /** O status HTTP que a rota devolve. O chat usa só para distinguir causa. */
      status: 400 | 409 | 503;
      erro: string;
      /** Campos que os clientes de hoje já leem. Mantidos ao pé da letra. */
      motivo?: "reconectar";
      infracao?: true;
      itensComInfracao?: string[];
      infracaoNaoConferida?: true;
      registro?: RegistroDoBloqueio;
    };

/**
 * Os portos. Quem passa é o chamador, com o tenant já preso.
 *
 * Portos e não imports diretos: assim este módulo é testável sem rede, e o
 * chat pode passar as mesmas funções que a rota passa — que é o ponto.
 */
export interface PortosDaPublicacao {
  /** O canal do cliente. `null` = não conectado. */
  lerCanal: () => Promise<CanalDaPublicacao | null>;
  /** Renova e devolve o par. Lança `RenovacaoRecusadaError` quando o ML recusa. */
  renovar: (refreshToken: string) => Promise<TokensDaPublicacao>;
  /** Persiste o refresh_token rotacionado. Roda mesmo se publicar falhar depois. */
  guardarRefresh: (refreshToken: string) => Promise<void>;
  /** Quais destes MLBs o ML cancelou por infração. LANÇA se não conseguir ver. */
  mlbsComInfracao: (accessToken: string, mlbs: readonly string[]) => Promise<string[]>;
}

/** `true` quando o erro é uma credencial que o ML recusou (4xx), não indisponibilidade. */
export function ehCredencialRecusada(e: unknown): boolean {
  const o = e as { credencialRecusada?: unknown; name?: unknown } | null;
  return !!o && o.credencialRecusada === true;
}

export async function conferirGuardasDaPublicacao(
  portos: PortosDaPublicacao,
  opcoes: {
    marketplace: string;
    /** `false` = ensaio. A trava de infração só vale para publicação real. */
    go: boolean;
    /** Os MLBs que o Zion já conhece DESTE produto. */
    mlbsDoProduto: readonly string[];
  }
): Promise<VeredictoDaPublicacao> {
  const { marketplace, go, mlbsDoProduto } = opcoes;

  // ---- 1) CONEXÃO
  const canal = await portos.lerCanal();
  if (!canal?.refreshToken) {
    return {
      liberado: false,
      status: 400,
      erro: `Cliente não conectado ao ${marketplace}. Conecte a conta antes de publicar.`,
    };
  }

  // ---- 2) CREDENCIAL
  //
  // Só 4xx vira "reconecte". 5xx e falha de rede sobem: o ML fora do ar não diz
  // nada sobre a validade do token, e mandar reconectar seria afirmar o que não
  // se sabe.
  let tokens: TokensDaPublicacao;
  try {
    tokens = await portos.renovar(canal.refreshToken);
  } catch (e) {
    if (!ehCredencialRecusada(e)) throw e;
    return {
      liberado: false,
      status: 409,
      erro: `O ${marketplace} recusou a credencial salva desta conta. Reconecte a conta para publicar.`,
      motivo: "reconectar",
      registro: {
        nivel: "warn",
        evento: "bloqueio",
        dados: { status: "bloqueado", motivo: "reconectar" },
      },
    };
  }
  // O rotacionado é persistido AGORA, mesmo que a publicação falhe depois:
  // perder o refresh novo desconectaria a conta no próximo uso.
  await portos.guardarRefresh(tokens.refreshToken);

  // ---- 3) INFRAÇÃO — FALHA FECHADA
  //
  // 31/07/2026: o ML cancelou 6 anúncios desta lojista por propriedade
  // intelectual. Republicar o que foi cancelado é REINCIDÊNCIA, e é isso que
  // custa a conta.
  //
  // Ao contrário do resto do sistema, aqui não saber é NÃO PUBLICAR: um item a
  // menos no ar se resolve com um clique; uma reincidência, não.
  const mlbs = mlbsDoProduto.filter(Boolean);
  if (go && mlbs.length > 0) {
    let bloqueados: string[];
    try {
      bloqueados = await portos.mlbsComInfracao(tokens.accessToken, mlbs);
    } catch (e) {
      return {
        liberado: false,
        status: 503,
        erro:
          "Não consegui conferir no Mercado Livre se este produto tem anúncio cancelado por infração, e por isso não publiquei. " +
          (e instanceof Error ? e.message : ""),
        infracaoNaoConferida: true,
        registro: { nivel: "error", evento: "infracao", dados: { status: "nao_conferido" } },
      };
    }
    if (bloqueados.length > 0) {
      return {
        liberado: false,
        status: 409,
        erro: `O Mercado Livre já cancelou ${bloqueados.length} anúncio(s) deste produto por infração (${bloqueados.join(", ")}). Publicar de novo conta como reincidência e pode custar a conta. Resolva a infração no painel do ML antes.`,
        infracao: true,
        itensComInfracao: bloqueados,
        registro: {
          nivel: "warn",
          evento: "infracao",
          dados: { status: "bloqueado", itens: bloqueados },
        },
      };
    }
  }

  return { liberado: true, tokens, canal };
}
