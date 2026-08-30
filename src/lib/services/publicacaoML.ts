// Publicação no Mercado Livre — orquestração no cliente (Fase 3).
//
// Dry-run é 100% local (o builder é puro e sem segredo) → a equipe revisa o
// payload antes. A publicação real vai para /api/ml/publicar (que detém o
// segredo do APP ML) levando o refresh_token do canal do cliente.

import { montarItemML } from "../../modules/integration/domain/mlPayload";
import {
  montarBundleUserProducts,
  fichaDoCadastro,
} from "../../modules/publication/domain/composicaoConteudo";
import { listarAtributosDoProduto } from "./produtoAtributos";
import { listarTabelasDoCliente } from "./tabelasMedidasCliente";
import { irmaosDaFamilia } from "../../modules/publication/domain/irmaosDaFamilia";
import { buscarCanal } from "./canaisMarketplace";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import {
  atualizarAnuncioGerado,
  buscarAnuncioGerado,
  criarAnunciosGeradosBulk,
  listarAnunciosGeradosDoCliente,
  marcarAnuncioPublicado,
} from "./anunciosGerados";
import { urlsDoProduto } from "./storageImagens";
import { autorAtual } from "../auth/autorAtual";
import type { AnuncioGeradoRegistro, TabelaMedida } from "../types";
import {
  capturarDecisao,
  type CapturaDeDecisao,
} from "../../modules/adaptive-intelligence/decision-journal.ts";

function num(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  let s = String(v).trim().replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Preço/estoque do produto pai — quando não temos o Produto, derivamos das variações. */
function dadosProduto(registro: AnuncioGeradoRegistro): { precoVenda: number; estoque: number } {
  const vs = registro.anuncio?.variacoes ?? [];
  const precos = vs.map((v) => num(v.preco)).filter((n) => n > 0);
  const estoques = vs.map((v) => num(v.estoque));
  return {
    precoVenda: precos.length ? Math.min(...precos) : 0,
    estoque: estoques.length ? estoques.reduce((a, b) => a + b, 0) : 0,
  };
}

export interface OpcoesPublicacao {
  categoryId?: string;
  pictures?: string[];
  tipoAnuncio?: string;
  produto?: { precoVenda: number; estoque: number };
}

/** Monta o payload do ML (dry-run local) — para a equipe revisar. */
export function montarPreviewML(
  registro: AnuncioGeradoRegistro,
  opcoes: OpcoesPublicacao = {}
): Record<string, unknown> {
  return montarItemML({
    produto: opcoes.produto ?? dadosProduto(registro),
    anuncio: registro.anuncio,
    categoryId: opcoes.categoryId ?? "",
    tipoAnuncio: opcoes.tipoAnuncio ?? "Premium",
    pictures: opcoes.pictures,
  });
}

export interface ResultadoPublicacao {
  dry: boolean;
  id?: string;
  permalink?: string;
  payload: Record<string, unknown>;
  /**
   * O que o cadastro tem de estranho e foi publicado assim mesmo.
   *
   * Hoje só uma coisa: o mesmo tamanho escrito de duas formas (`33 - 34` e
   * `33 BR` no mesmo produto), que vira duas opções para a compradora. Não é
   * deduplicado porque escolher a grafia certa é da lojista — mas morrer no
   * domínio sem ninguém ver seria o mesmo que não detectar.
   */
  avisos?: string[];
}

// ── Learning Loop · PR-006 ───────────────────────────────────────────────────
// Dois feedbacks do ambiente deixam de ser perdidos:
//  (1) ambiente PROPÕE (categoriaPrevista) → humano DECIDE (categoriaUsada)
//      → Decision Journal (só com delta; fire-and-forget);
//  (2) ambiente VETA (motivo real da rejeição) → DOMÍNIO (observacoes do
//      anúncio — estrutura existente; a AIL não é tocada: veto não é decisão).

/** Builder PURO da Decision do par proposta-do-ambiente → escolha-consumada. */
export function montarCapturaCategoriaPublicada(
  registro: { id: string; clienteId: string },
  prevista: string | null,
  usada: string | null
): CapturaDeDecisao | null {
  if (!usada) return null;
  return {
    empresa: registro.clienteId,
    contexto: "catalogo",
    campo: "categoriaMarketplace", // mesmo slot do agregado Produto — os padrões convergem
    entidade: { tipo: "anuncio", id: registro.id },
    valorAnterior: prevista, // o que o AMBIENTE propôs (null = não propôs)
    valorNovo: usada, // a escolha consumada na publicação
    origem: "api/ml/publicar",
  };
}

/**
 * Anexa o veredito do ambiente às observações SEM destruir o conteúdo atual
 * (o prefixo "Importado do " é marcador da reimportação — apêndice o preserva).
 */
export function comporObservacoesComFalha(
  existente: string | undefined | null,
  motivo: string
): string {
  const veredito = `[Publicação ML rejeitada] ${motivo}`;
  const atual = (existente ?? "").trim();
  return atual ? `${atual}\n${veredito}` : veredito;
}

// ── Guarda contra publicação ACIDENTAL ───────────────────────────────────────
// O Mercado Livre proíbe o mesmo produto, nas mesmas condições, em mais de um
// anúncio — a infração pode custar o anúncio e até a conta do lojista. Mas
// REPUBLICAR (criar um anúncio novo e migrar do antigo) é estratégia legítima:
// editar o título de um anúncio vivo reseta o histórico de relevância.
//
// A distinção não é "republicar ou não" — é se alguém ESCOLHEU republicar:
//   • duplo clique / retry após timeout → ninguém escolheu. É defeito: bloqueamos.
//   • republicação deliberada          → é decisão do lojista, com consequência
//     real. Não se resolve com um erro genérico: exige apresentar a situação e
//     perguntar o que fazer com o anúncio antigo.
//
// Esta guarda cobre APENAS o acidente. A republicação deliberada é tratada em
// fluxo próprio, com a decisão explícita de quem vende.

/** Erro identificável: já existe anúncio publicado para este registro. */
export class JaPublicadoError extends Error {
  readonly mlItemId: string | null;
  readonly mlPermalink: string | null;
  constructor(mlItemId: string | null, mlPermalink: string | null) {
    super(
      "Este anúncio já foi publicado no Mercado Livre" +
        (mlItemId ? ` (${mlItemId})` : "") +
        ". Publicar de novo criaria um anúncio duplicado, o que o Mercado Livre não permite."
    );
    this.name = "JaPublicadoError";
    this.mlItemId = mlItemId;
    this.mlPermalink = mlPermalink;
  }
}

/**
 * Erro identificável: o canal existe e está ativo, mas o marketplace RECUSOU a
 * credencial salva. Só reconectar a conta resolve.
 *
 * Precisa ser distinguível de uma falha de publicação qualquer por dois
 * motivos: a tela mostra um caminho (o link de reconectar) em vez de uma
 * mensagem sem saída, e o veredito NÃO é anexado às observações do anúncio —
 * uma credencial morta não diz nada sobre o conteúdo que se tentou publicar.
 *
 * A CLASSE MUDOU DE CASA, e a reexportação é o ponto: com nove telas passando
 * a levantar o mesmo erro, DUAS classes com o mesmo nome fariam `instanceof`
 * falhar em silêncio conforme o import — o pior tipo de defeito, porque a tela
 * simplesmente voltaria a mostrar o box vermelho sem saída.
 */
import { ReconectarCanalError } from "@/modules/integration/domain/credencialRecusada";
export { ReconectarCanalError };

/** Publicações em voo, por registro — barra o duplo clique simultâneo. */
const emVoo = new Set<string>();

/**
 * go=false → só devolve o payload (dry-run local).
 * go=true  → publica de verdade via /api/ml/publicar e marca como publicado.
 *
 * Lança JaPublicadoError quando o registro já tem anúncio no ML ou quando outra
 * publicação do mesmo registro ainda está em andamento.
 */
export async function publicarNoML(
  registro: AnuncioGeradoRegistro,
  go: boolean,
  opcoes: OpcoesPublicacao = {}
): Promise<ResultadoPublicacao> {
  // A guarda vale só para publicação real; o dry-run (preview) é livre.
  if (go) {
    if (registro.status === "publicado" || registro.mlItemId) {
      throw new JaPublicadoError(registro.mlItemId ?? null, registro.mlPermalink ?? null);
    }
    if (emVoo.has(registro.id)) {
      throw new JaPublicadoError(null, null);
    }
    emVoo.add(registro.id);
  }
  try {
    return await executarPublicacao(registro, go, opcoes);
  } finally {
    if (go) emVoo.delete(registro.id);
  }
}

async function executarPublicacao(
  registro: AnuncioGeradoRegistro,
  go: boolean,
  opcoes: OpcoesPublicacao
): Promise<ResultadoPublicacao> {
  // Puxa as fotos reais do produto (Storage) quando não vieram explicitamente.
  let pictures = opcoes.pictures;
  if (pictures === undefined && registro.produtoId) {
    try {
      pictures = await urlsDoProduto(registro.produtoId);
    } catch {
      pictures = [];
    }
  }
  // O QUE A LOJISTA RESPONDEU NO CADASTRO, para o bundle abaixo.
  //
  // Medido em 28/08/2026: `montarBundleUserProducts` recusava 408 dos 674
  // publicáveis de calçado por "gênero ausente na ficha técnica" — e o gênero
  // estava em `produto_atributos`, respondido por ela. A ficha é escrita pelo
  // modelo, que a traz em 159 de 400.
  //
  // Falha de leitura segue sem o cadastro: o bundle volta a recusar como
  // recusava, e a recusa é a mensagem que já existia. Enriquecimento não pode
  // inventar um modo novo de falhar.
  let doCadastro: Map<string, string> | undefined;
  if (registro.produtoId) {
    try {
      doCadastro = fichaDoCadastro(await listarAtributosDoProduto(registro.produtoId));
    } catch {
      doCadastro = undefined;
    }
  }

  // E AS TABELAS DE MEDIDA DELA, pelo mesmo motivo e com a mesma regra.
  //
  // Guardada por `produtoId` como a de cima: sem produto nao ha bundle. O que
  // NAO da para evitar daqui e a categoria — quem decide se este anuncio vai
  // pelo modelo User Products e o servidor, depois de prever a categoria com o
  // token que o navegador nao tem. Entao os 119 classicos desta base ainda
  // pagam as duas leituras; evita-las exigiria a categoria aqui, e ela nao esta
  // aqui.
  //
  // `medidasDaMarca` lia so a lista embutida no software. Medido em 28/08: 30
  // dos 674 recusados por tamanho FORA da faixa dessa lista — Molekinho 19 a
  // 24, Ipanema 25 e 26, Yvate 41 a 43. As medidas nao estao no software e nao
  // e para estarem; o que faltava era a resposta dela chegar ate aqui.
  let tabelasDaLoja: TabelaMedida[] = [];
  if (registro.produtoId) {
    try {
      tabelasDaLoja = await listarTabelasDoCliente(registro.clienteId);
    } catch {
      tabelasDaLoja = [];
    }
  }

  const payload = montarPreviewML(registro, { ...opcoes, pictures });
  if (!go) {
    // A simulação também precisa avisar: é justamente onde dá para corrigir
    // antes de ir ao ar.
    const previa = montarBundleUserProducts(registro.anuncio, {
      pictures,
      tipoAnuncio: opcoes.tipoAnuncio,
      doCadastro,
      tabelasDaLoja,
    });
    return { dry: true, payload, ...(previa.ok && previa.avisos ? { avisos: previa.avisos } : {}) };
  }

  // Ingredientes do fluxo User Products (calçado). Vão SEMPRE que dá para
  // montá-los; o servidor só os usa se a categoria prevista exigir esse modelo.
  // Se a categoria for clássica, o bundle é ignorado — o payload acima manda.
  const bundleUP = montarBundleUserProducts(registro.anuncio, {
    pictures,
    tipoAnuncio: opcoes.tipoAnuncio,
    doCadastro,
    tabelasDaLoja,
  });
  const userProducts = bundleUP.ok ? bundleUP.bundle : undefined;
  const avisosDoBundle = bundleUP.ok ? bundleUP.avisos : undefined;

  // Os MLBs que o Zion conhece DESTE produto. O servidor confere se algum foi
  // cancelado por infração — republicar o que o ML cancelou é reincidência, e
  // reincidência de propriedade intelectual custa a conta, não o anúncio.
  //
  // A lista sai daqui porque é o cliente quem sabe quais anúncios pertencem ao
  // produto; o servidor só recebe MLBs e pergunta ao ML sobre eles.
  const mlbsDoProduto = registro.produtoId
    ? (await listarAnunciosGeradosDoCliente(registro.clienteId))
        .filter((a) => a.produtoId === registro.produtoId && a.mlItemId)
        .map((a) => a.mlItemId as string)
    : [];

  const canal = await buscarCanal(registro.clienteId, registro.marketplace);
  if (!canal?.ativo) {
    throw new Error(
      // "Configurações do canal" não existe — nunca existiu. O fluxo de conexão
      // é `/cliente/conectar-ml`, rotulado "Conexão com o Mercado Livre" no
      // contexto Zion (ver portal/domain/navegacao). Mandar alguém procurar uma
      // tela inventada é a mesma falha do INC-009 num degrau acima.
      "Cliente não conectado ao Mercado Livre. Conecte a conta em Zion › Conexão com o Mercado Livre antes de publicar."
    );
  }

  // O refresh_token NÃO trafega pelo navegador (R3): o servidor lê o token do
  // canal pelo clienteId, valida o acesso e rotaciona/persiste sozinho.
  const resposta = await fetch("/api/ml/publicar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({
      clienteId: registro.clienteId,
      registroId: registro.id,
      marketplace: registro.marketplace,
      payload,
      go: true,
      tituloParaCategoria: registro.anuncio?.tituloOtimizado,
      userProducts,
      // Os MLBs deste produto que o Zion conhece. O servidor confere se algum
      // foi cancelado por infração antes de publicar — republicar o que o ML
      // cancelou é reincidência.
      mlbsDoProduto,
    }),
  });

  const dados = (await resposta.json()) as {
    id?: string;
    permalink?: string;
    /** O estado que o ML deu ao item recém-criado. */
    status?: string;
    /**
     * TODOS os MLBs criados — no modelo User Products, um por tamanho.
     *
     * A rota sempre devolveu este campo e este arquivo não o declarava, então
     * só `id` (o primeiro) era persistido. Os outros ficavam vivos no ML sem
     * registro nenhum no Zion. Observado em 2026-08-01 com o Papete Modare.
     */
    itens?: { id?: string; permalink?: string; status?: string }[];
    erro?: string;
    motivo?: string;
    categoriaPrevista?: string | null;
    categoriaUsada?: string | null;
  };

  if (!resposta.ok || !dados.id) {
    const motivo = dados.erro ?? "Falha ao publicar no Mercado Livre.";
    // Sai ANTES do Learning Loop (2): credencial recusada não é veto ao
    // conteúdo. Anexá-la às observações sujaria o registro do anúncio com um
    // problema de conexão, e o próximo leitor acharia que o ML reprovou o
    // anúncio.
    if (dados.motivo === "reconectar") throw new ReconectarCanalError(motivo);
    // Learning Loop (2): o VETO do ambiente entra no domínio. Nunca pode
    // mascarar a falha original — qualquer erro aqui é engolido.
    try {
      const atual = await buscarAnuncioGerado(registro.id);
      await atualizarAnuncioGerado(registro.id, {
        observacoes: comporObservacoesComFalha(atual?.observacoes, motivo),
      });
    } catch {
      // persistir o motivo jamais encobre o erro real de publicação
    }
    throw new Error(motivo);
  }

  await marcarAnuncioPublicado(registro.id, {
    itemId: dados.id,
    permalink: dados.permalink,
    status: dados.status,
  });

  // Os DEMAIS tamanhos da família. Sem isto eles ficam vivos no Mercado Livre
  // e invisíveis aqui: não aparecem na lista, não contam como publicados, não
  // podem ser pausados pelo Zion, e a guarda contra publicação duplicada não os
  // enxerga. A importação seguinte os traz de volta como anúncios NOVOS e cria
  // um produto duplicado — foi o que aconteceu com o `MLB4980078561`.
  //
  // Falhar aqui NÃO derruba a publicação: o anúncio principal já está no ar, e
  // lançar agora faria a lojista achar que a publicação falhou quando ela deu
  // certo. Os irmãos que não gravarem entram como aviso — e a próxima
  // importação os recupera de qualquer forma.
  const irmaos = irmaosDaFamilia(registro, dados.itens ?? [], dados.id, new Date().toISOString());
  const avisosDaFamilia: string[] = [];
  if (irmaos.length > 0) {
    try {
      await criarAnunciosGeradosBulk(irmaos);
    } catch {
      avisosDaFamilia.push(
        `${irmaos.length} tamanho(s) foram publicados no Mercado Livre mas não foram registrados aqui (${irmaos
          .map((i) => i.mlItemId)
          .join(", ")}). Importe do ML para completar.`
      );
    }
  }

  // Learning Loop (1): ambiente propôs → humano decidiu → memória.
  // capturarDecisao garante delta real e fire-and-forget. Autoria (E4.2.3):
  // quem publicou é quem decidiu — o autor da sessão; o builder segue puro.
  const captura = montarCapturaCategoriaPublicada(
    registro,
    dados.categoriaPrevista ?? null,
    dados.categoriaUsada ?? null
  );
  if (captura) capturarDecisao({ ...captura, autor: await autorAtual() });

  return {
    dry: false,
    id: dados.id,
    permalink: dados.permalink,
    payload,
    ...(avisosDoBundle || avisosDaFamilia.length > 0
      ? { avisos: [...(avisosDoBundle ?? []), ...avisosDaFamilia] }
      : {}),
  };
}
