// Diagnóstico das INFRAÇÕES da conta no Mercado Livre — somente leitura.
//
// A pergunta que motivou a rota: em 31/07/2026 o ML cancelou 6 anúncios por
// infração de propriedade intelectual e não revelou o motivo. O Zion não sabia
// que existiam, e o único sinal disponível (`sub_status: forbidden`) só enxerga
// anúncio que ainda está no catálogo importado.
//
// NÃO cria, NÃO altera e NÃO encerra nada. Segue o contrato de
// /api/ml/diagnostico-item: autorização server-side, refresh_token via RLS,
// token rotacionado persistido ANTES da operação externa.
//
// POR QUE DUAS VARIANTES DA MESMA ROTA
// ------------------------------------
// A documentação do ML mostra o caminho de duas formas — com e sem o prefixo
// `/marketplace` — e as DUAS responderam 403 (política) na medida sem token de
// 03/08/2026, o que prova que existem e não diz qual serve. Escolher uma aqui
// seria voltar a adivinhar. Esta rota chama as duas e relata os dois status;
// quem decide é a resposta da conta real, não eu.
//
// Depois que a conta responder, a variante perdedora sai — este arquivo é um
// instrumento de medição, e instrumento que sobrevive ao seu propósito vira
// código morto.

import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import {
  lerInfracoes,
  contarPorMotivo,
  contaPodeAnunciar,
  itensDistintos,
  referenciaDeModeracao,
} from "@/modules/integration/domain/infracoesDaConta";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

// 300: o teto do Pro. A conta real declarou 1.060 infrações e o `limit` da rota
// do ML é 20 — são 53 páginas. Com 60s isto não terminaria.
export const maxDuration = 300;

const API = "https://api.mercadolibre.com";

/** Quantas moderações detalhar. O `last_moderation` é uma chamada por elemento. */
const MAX_DETALHES = 5;

/** O `limit` do ML aqui é 1–20, documentado. Pedir mais é pedir erro. */
const LIMITE_ML = 20;

interface Sonda {
  url: string;
  status: number;
  /** O corpo cru, como chegou. É o ponto da rota: aprender o formato real. */
  corpo: unknown;
  erro?: string;
}

async function sondar(url: string, auth: Record<string, string>): Promise<Sonda> {
  try {
    const r = await fetch(url, { headers: auth });
    // O corpo é lido como TEXTO primeiro e só depois convertido. Uma resposta
    // 200 que não é JSON já derrubou esta base uma vez — a plataforma devolveu
    // HTML de 504 e a tela mostrou "Unexpected token '<'", sem dizer de onde
    // vinha. Aqui o texto cru sobrevive ao erro de parse.
    const bruto = await r.text();
    let corpo: unknown = null;
    let erro: string | undefined;
    if (bruto.trim() === "") {
      corpo = null;
    } else {
      try {
        corpo = JSON.parse(bruto);
      } catch {
        corpo = null;
        erro = `resposta não era JSON: ${bruto.slice(0, 200)}`;
      }
    }
    return { url, status: r.status, corpo, erro };
  } catch (e) {
    // `fetch failed` do undici guarda o motivo real em `cause` — e é ele que
    // diz se foi tempo, conexão ou DNS.
    const causa = (e as { cause?: { code?: string; message?: string } })?.cause;
    return {
      url,
      status: 0,
      corpo: null,
      erro: `exceção no nosso código: ${e instanceof Error ? e.message : String(e)}${
        causa?.code || causa?.message ? ` (${causa.code ?? causa.message})` : ""
      }`,
    };
  }
}

export async function GET(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ erro: "Integração ML não configurada no servidor." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const clienteId = (searchParams.get("clienteId") ?? "").trim();
  if (!clienteId) return Response.json({ erro: "clienteId ausente." }, { status: 400 });

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  try {
    const canal = await lerCanalServidor(ctx.supabase, clienteId, "Mercado Livre");
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }
    const renovacao = await renovarTokenDaRota({
      clientId,
      clientSecret,
      refreshToken: canal.refreshToken,
      marketplace: "Mercado Livre",
      oQueFalhou: "ver o que o Mercado Livre apontou",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    await atualizarRefreshTokenServidor(ctx.supabase, clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    const sellerId = canal.sellerId || tokens.userId;
    if (!sellerId) {
      return Response.json({ erro: "seller_id não encontrado." }, { status: 422 });
    }

    const query = `limit=${LIMITE_ML}&offset=0&language=PT&sort=date_created_asc`;

    // As três perguntas de uma vez. `/users/me` vem junto porque `status.list.allow`
    // é o que transforma "6 infrações" em "a conta está em risco" — e essa é a
    // única das duas frases que muda o que a lojista faz hoje.
    const [comPrefixo, semPrefixo, usuario] = await Promise.all([
      sondar(`${API}/marketplace/moderations/infractions/${sellerId}?${query}`, auth),
      sondar(`${API}/moderations/infractions/${sellerId}?${query}`, auth),
      sondar(`${API}/users/me`, auth),
    ]);

    // Qual variante respondeu? A que veio 200. Se as duas vierem, a com prefixo
    // manda — é a que a documentação do Global Selling apresenta como caminho
    // único. Se nenhuma vier, isso é o resultado, e ele é dito.
    const vencedora = comPrefixo.status === 200 ? comPrefixo : semPrefixo.status === 200 ? semPrefixo : null;
    const primeira = vencedora ? lerInfracoes(vencedora.corpo) : null;

    // PAGINAR ATÉ O FIM — porque 20 não é a conta.
    //
    // Medido em 03/08/2026: a primeira página trouxe 20 e o ML declarou
    // `paging.total = 1060`. Parar na primeira página e chamar aquilo de
    // "as infrações da conta" seria a mesma afirmação de completude que a
    // importação fazia quando parava nos 500 e ninguém sabia.
    //
    // `limit` é 1–20 por documentação, então são ~53 requisições. É diagnóstico
    // rodado a pedido, não varredura periódica — e o teto existe para o caso de
    // o `total` vir errado e a paginação não terminar nunca.
    const TETO_DE_PAGINAS = 80; // 1.600 infrações: trava, não limite esperado
    const todas = primeira ? [...primeira.infracoes] : [];
    const paginasComFalha: { offset: number; status: number; erro?: string }[] = [];
    let paginasLidas = primeira ? 1 : 0;

    if (vencedora && primeira && !primeira.formatoInesperado) {
      const base = vencedora.url.split("?")[0];
      for (let pagina = 1; pagina < TETO_DE_PAGINAS; pagina++) {
        const offset = pagina * LIMITE_ML;
        if (primeira.total >= 0 && offset >= primeira.total) break;
        const s = await sondar(
          `${base}?limit=${LIMITE_ML}&offset=${offset}&language=PT&sort=date_created_asc`,
          auth
        );
        if (s.status !== 200) {
          // Página que falhou é DITA, não engolida. Sem isso, "li 900 de 1.060"
          // se leria como "a conta tem 900".
          paginasComFalha.push({ offset, status: s.status, erro: s.erro });
          break;
        }
        const l = lerInfracoes(s.corpo);
        paginasLidas++;
        if (l.infracoes.length === 0) break; // o ML parou de devolver
        todas.push(...l.infracoes);
        if (primeira.total < 0 && l.infracoes.length < LIMITE_ML) break;
      }
    }

    const distintos = itensDistintos(todas);

    // O detalhe do MOTIVO — a informação que faltou em 31/07. Uma chamada por
    // elemento, limitada: isto é diagnóstico, não varredura.
    const detalhes = primeira
      ? await Promise.all(
          todas
            .slice(0, MAX_DETALHES)
            .map((i) => referenciaDeModeracao(i.elementoId, i.tipoElemento))
            .filter(Boolean)
            .map((ref) => sondar(`${API}/moderations/last_moderation/${ref}`, auth))
        )
      : [];

    return Response.json({
      sellerId,
      // O QUE A CONTA RESPONDEU, sem interpretação — é para isto que a rota existe.
      sondas: {
        comPrefixoMarketplace: { url: comPrefixo.url, status: comPrefixo.status, erro: comPrefixo.erro },
        semPrefixo: { url: semPrefixo.url, status: semPrefixo.status, erro: semPrefixo.erro },
        usuario: { status: usuario.status, erro: usuario.erro },
      },
      varianteQueRespondeu: vencedora ? vencedora.url : null,
      // O corpo CRU da vencedora. Sem isto, o diagnóstico só confirmaria o que
      // eu já achava que ia vir — e foi assim que afirmei três sucessos falsos
      // no mesmo recurso em 03/08.
      corpoCru: vencedora ? vencedora.corpo : null,
      leitura: primeira
        ? {
            infracoes: todas,
            /** O que o ML DIZ que a conta tem. */
            total: primeira.total,
            /** O que conseguimos ler de verdade. Separado de `total` de propósito. */
            lidas: todas.length,
            paginasLidas,
            paginasComFalha,
            /** A conta que muda a decisão: infrações ≠ anúncios. */
            anunciosDistintos: distintos.itens,
            infracoesSemAnuncio: distintos.semItem,
            nenhumaDeclarada: primeira.nenhumaDeclarada,
            formatoInesperado: primeira.formatoInesperado,
            porMotivo: contarPorMotivo(todas),
          }
        : null,
      // `null` = o ML não disse. Nunca "pode anunciar".
      contaPodeAnunciar: usuario.status === 200 ? contaPodeAnunciar(usuario.corpo) : null,
      detalhesDaModeracao: detalhes.map((d) => ({
        url: d.url,
        status: d.status,
        corpo: d.corpo,
        erro: d.erro,
      })),
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao consultar as infrações no ML." },
      { status: 502 }
    );
  }
}
