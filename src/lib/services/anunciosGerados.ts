import { criarRepositorio } from "../repositorio";
import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerTudoPaginado } from "../supabase/paginado";
import { anuncioGeradoParaApp, anuncioGeradoParaBanco } from "../supabase/mappers";
import type { AnuncioGeradoRow } from "../supabase/database.types";
import type { AnuncioGeradoRegistro, StatusAnuncioGerado } from "../types";

const repo = criarRepositorio<AnuncioGeradoRegistro, AnuncioGeradoRow>({
  tabela: "anuncios_gerados",
  colecao: "anunciosGerados",
  prefixoIdLocal: "ang",
  selecao: "*, clientes(empresa), produtos(nome)",
  paraApp: anuncioGeradoParaApp,
  paraBanco: anuncioGeradoParaBanco,
});

export const ROTULO_STATUS_ANUNCIO_GERADO: Record<StatusAnuncioGerado, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  publicado: "Publicado",
};

/**
 * Como mostrar o estado NO MARKETPLACE para a lojista.
 *
 * Três regras que não são estilo:
 *
 *  1. `null` NÃO é "no ar". Um anúncio que tem MLB e não tem estado conhecido
 *     mostra "estado desconhecido", porque é o que sabemos. Esconder o caso
 *     faria a ausência de selo significar "está tudo bem" — a mesma mentira
 *     que a coluna veio corrigir.
 *  2. Estado que não conhecemos aparece com a PALAVRA do ML, não some. Se o
 *     Mercado Livre criar um estado novo amanhã, ele fica visível em vez de
 *     ser engolido por um `default`.
 *  3. `active` também é mostrado. Selo só no caso ruim treinaria a leitora a
 *     ignorar o campo, e aí o ruim volta a passar despercebido.
 */
export function rotuloStatusMarketplace(
  status: string | null | undefined
): { texto: string; tom: "ok" | "atencao" | "ruim" | "neutro" } {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return { texto: "Estado desconhecido", tom: "neutro" };
  switch (s) {
    case "active":
      return { texto: "No ar", tom: "ok" };
    case "paused":
      return { texto: "Pausado no ML", tom: "atencao" };
    case "under_review":
      return { texto: "Em revisão pelo ML", tom: "atencao" };
    case "closed":
      return { texto: "Encerrado no ML", tom: "ruim" };
    case "inactive":
      return { texto: "Inativo no ML", tom: "ruim" };
    default:
      // A palavra crua. Nunca um "—" que apagaria o estado desconhecido.
      return { texto: `No ML: ${status}`, tom: "neutro" };
  }
}

export async function listarAnunciosGerados(): Promise<AnuncioGeradoRegistro[]> {
  return repo.listar();
}

export async function listarAnunciosGeradosDoCliente(
  clienteId: string
): Promise<AnuncioGeradoRegistro[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

/**
 * O anúncio SEM o conteúdo gerado pela esteira.
 *
 * O tipo omite `anuncio` de propósito, e a omissão é a proteção: o mapeador
 * tolera coluna ausente (`row.anuncio ?? {}`), então uma leitura estreita que
 * devolvesse `AnuncioGeradoRegistro` entregaria um anúncio VAZIO com cara de
 * anúncio de verdade. Quem precisa do conteúdo usa `listarAnunciosGeradosDoCliente`
 * e paga o preço dele conscientemente.
 */
export type ResumoDoAnuncio = Omit<AnuncioGeradoRegistro, "anuncio">;

/**
 * Todas as colunas MENOS o JSONB — que é 76,6% do peso da linha (medido em
 * 03/08/2026: 1.055 kB de 1.377 kB em 880 anúncios).
 *
 * A lista é explícita porque o PostgREST não tem "tudo menos uma". Coluna nova
 * que não entrar aqui simplesmente não chega ao resumo — e como o mapeador
 * tolera ausência, ela chegaria como o padrão dela. Por isso o teste de
 * cobertura anda junto: ele quebra quando alguém acrescenta coluna à linha e
 * esquece do resumo.
 */
export const COLUNAS_DO_RESUMO =
  "id, cliente_id, produto_id, auditoria_id, marketplace, origem, tipo_execucao, " +
  "nota_diagnostico, veredito_a10, qtd_pendencias, status, aprovado_por, aprovado_em, " +
  "observacoes, ml_item_id, ml_permalink, status_marketplace, status_marketplace_em, " +
  "sub_status_marketplace, foto_capa_max_size, estoque_marketplace, categoria_ml, " +
  // 074 — o que o ML já dizia e a importação descartava.
  "tipo_anuncio_ml, criado_em_ml, atualizado_em_ml, vendidos_ml, saude_ml, " +
  "do_catalogo_ml, tem_descricao_ml, created_at, " +
  "clientes(empresa), produtos(nome)";

/**
 * A lista para quem só CONTA e ORDENA — sem trazer o JSONB da esteira.
 *
 * Usada pela tela de Produtos (que lê `mlItemId`, `produtoId`, `status`,
 * `notaDiagnostico`, `criadoEm`) e pela importação, que compara o estado no
 * marketplace e nunca abre o conteúdo do anúncio.
 */
export async function listarResumoDeAnunciosDoCliente(
  clienteId: string
): Promise<ResumoDoAnuncio[]> {
  return repo.listar(
    { coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" },
    COLUNAS_DO_RESUMO
  );
}

/**
 * O mesmo resumo, sem recorte de cliente — para quem CONTA a operação inteira.
 *
 * Usada pelo painel da Zion. Sem o JSONB de propósito: contar 880 anúncios não
 * pode custar 1 MB de conteúdo de esteira que ninguém vai ler.
 */
export async function listarResumoDeAnuncios(): Promise<ResumoDoAnuncio[]> {
  return repo.listar(undefined, COLUNAS_DO_RESUMO);
}

/** Os anúncios de UM produto, sem o JSONB. Para a aba Anúncios da ficha. */
export async function listarResumoDeAnunciosDoProduto(
  produtoId: string
): Promise<ResumoDoAnuncio[]> {
  return repo.listar(
    { coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" },
    COLUNAS_DO_RESUMO
  );
}

/**
 * A categoria do ML por produto — a leitura mais estreita que existe aqui.
 *
 * DUAS colunas, e a estreiteza é o ponto: quem precisa disto quer saber com que
 * `category_id` pedir a tarifa exata, não o anúncio. `listarResumoDeAnunciosDoCliente`
 * traria 22 colunas e ~322 kB para produzir um mapa de dois campos — o mesmo
 * desperdício que o JSONB já era.
 *
 * Quando um produto tem vários anúncios, vale o PRIMEIRO com categoria
 * conhecida. Eles são variações do mesmo item e compartilham a categoria; se um
 * dia divergirem, a tarifa é por item e esta função deixa de bastar.
 */
export async function categoriasDosProdutos(clienteId: string): Promise<Map<string, string>> {
  if (!supabaseConfigurado) return new Map();
  const linhas = await lerTudoPaginado<{ produto_id: string | null; categoria_ml: string | null }>(
    "categorias dos produtos",
    (de, ate) =>
      getSupabase()
        .from("anuncios_gerados")
        .select("produto_id, categoria_ml")
        .eq("cliente_id", clienteId)
        .not("categoria_ml", "is", null)
        .order("id", { ascending: true })
        .range(de, ate)
  ).catch(() => []);

  const mapa = new Map<string, string>();
  for (const l of linhas) {
    const produto = (l.produto_id ?? "").trim();
    const categoria = (l.categoria_ml ?? "").trim();
    if (produto && categoria && !mapa.has(produto)) mapa.set(produto, categoria);
  }
  return mapa;
}

export async function buscarAnuncioGerado(
  id: string
): Promise<AnuncioGeradoRegistro | null> {
  return repo.buscar(id);
}

export async function criarAnuncioGerado(
  dados: Omit<AnuncioGeradoRegistro, "id">
): Promise<AnuncioGeradoRegistro> {
  return repo.criar(dados);
}

/**
 * Cria muitos anúncios de uma vez (importação em massa do ML). Lotes pequenos
 * e SEM retornar as linhas (cada uma carrega o JSON do anúncio) — evita o
 * "Failed to fetch" de payloads grandes; com retry por lote.
 */
export async function criarAnunciosGeradosBulk(
  dados: Omit<AnuncioGeradoRegistro, "id">[]
): Promise<void> {
  await repo.criarVarios(dados, { chunk: 100, retornar: false });
}

export async function atualizarAnuncioGerado(
  id: string,
  dados: Partial<AnuncioGeradoRegistro>
): Promise<AnuncioGeradoRegistro | null> {
  return repo.atualizar(id, dados);
}

/** Aprova (trava humana): só chame quando o A10 aprovou e não há pendências. */
export async function aprovarAnuncioGerado(
  id: string,
  aprovadoPor = ""
): Promise<AnuncioGeradoRegistro | null> {
  return repo.atualizar(id, {
    status: "aprovado",
    aprovadoPor,
    aprovadoEm: new Date().toISOString(),
  });
}

export async function rejeitarAnuncioGerado(
  id: string,
  motivo = ""
): Promise<AnuncioGeradoRegistro | null> {
  return repo.atualizar(id, {
    status: "rejeitado",
    observacoes: motivo,
  });
}

/**
 * Marca como publicado após o envio via API do marketplace (Fase 3).
 *
 * `status` é a esteira do Zion; `statusMarketplace` é o que o ML respondeu ao
 * criar o item. Os dois são gravados aqui porque é o único momento em que
 * sabemos os dois com certeza — e porque publicar sem registrar o estado do que
 * acabou de ser publicado deixaria o anúncio novo em `null` (não sabemos)
 * tendo o ML acabado de dizer.
 *
 * Sem `?? "active"`: se o marketplace não devolver estado, fica sem.
 */
export async function marcarAnuncioPublicado(
  id: string,
  ml?: { itemId?: string; permalink?: string; status?: string }
): Promise<AnuncioGeradoRegistro | null> {
  const statusMarketplace = (ml?.status ?? "").trim();
  return repo.atualizar(id, {
    status: "publicado",
    ...(ml?.itemId ? { mlItemId: ml.itemId } : {}),
    ...(ml?.permalink ? { mlPermalink: ml.permalink } : {}),
    ...(statusMarketplace
      ? { statusMarketplace, statusMarketplaceEm: new Date().toISOString() }
      : {}),
  });
}

/**
 * Atualiza o estado NO MARKETPLACE de muitos anúncios de uma vez.
 *
 * `atualizarVarios` agrupa por payload idêntico, então 502 linhas em 5 estados
 * distintos viram 5 requisições, não 502. Isso não é otimização: um laço por
 * anúncio dispara `notificarMudanca()` a cada escrita, e foi assim que 146
 * gravações derrubaram o navegador com `TypeError: Failed to fetch`.
 *
 * Escreve SÓ as duas colunas do eixo do marketplace. `status` (a esteira do
 * Zion) não é tocado.
 */
export async function atualizarEstadoNoMarketplaceBulk(
  atualizacoes: {
    id: string;
    statusMarketplace: string;
    statusMarketplaceEm: string;
    subStatusMarketplace?: string[];
    fotoCapaMaxSize?: string | null;
    estoqueMarketplace?: number | null;
    categoriaMl?: string | null;
    // 074 — os sete atravessam pelo MESMO mapeador (`anuncioGeradoParaBanco`),
    // que só escreve o que foi passado. Nenhuma coluna é tocada por omissão.
    tipoAnuncioMl?: string | null;
    criadoEmMl?: string | null;
    atualizadoEmMl?: string | null;
    vendidosMl?: number | null;
    saudeMl?: number | null;
    doCatalogoMl?: boolean | null;
    temDescricaoMl?: boolean | null;
  }[]
): Promise<{ atualizados: number; falharam: number }> {
  if (atualizacoes.length === 0) return { atualizados: 0, falharam: 0 };

  // POR QUE UMA CHAMADA POR ESTADO, E NÃO UMA SÓ
  //
  // Observado em 2026-08-01: `atualizarVarios` com as 767 linhas de uma vez
  // gravou `active` (546), `under_review` (155) e `paused` (66) e morreu com
  // `TypeError: Failed to fetch` nos DOIS últimos grupos — `closed` (12) e
  // `inactive` (2), os menores. Não é tamanho de requisição: os lotes de 200
  // UUIDs passaram e os de 12 e 2 não.
  //
  // A causa raiz NÃO está estabelecida. O que está é o custo: `atualizarVarios`
  // lança no primeiro lote que desiste, então 14 linhas derrubaram a
  // importação inteira e o usuário viu um erro em cima de 767 gravações que
  // deram certo.
  //
  // Separar por estado limita o dano ao grupo que falhar, e devolver a
  // contagem deixa o parcial VISÍVEL em vez de virar exceção. Reexecutar é
  // seguro: `estadosDesatualizados` só escreve o que mudou, então o segundo
  // clique acerta o que faltou e não toca no resto.
  const porEstado = new Map<string, typeof atualizacoes>();
  for (const a of atualizacoes) {
    const lista = porEstado.get(a.statusMarketplace) ?? [];
    lista.push(a);
    porEstado.set(a.statusMarketplace, lista);
  }

  let atualizados = 0;
  let falharam = 0;
  for (const lista of porEstado.values()) {
    try {
      await repo.atualizarVarios(lista);
      atualizados += lista.length;
    } catch {
      // Engolir aqui é deliberado e tem preço: a contagem sobe em `falharam` e
      // a tela diz. Um `throw` custaria as gravações que já deram certo.
      falharam += lista.length;
    }
  }
  return { atualizados, falharam };
}

export async function excluirAnuncioGerado(id: string): Promise<void> {
  return repo.excluir(id);
}

/** Exclui os anúncios importados do Mercado Livre do cliente (reimportação "substituir"). */
export async function excluirAnunciosImportadosML(clienteId: string): Promise<void> {
  // Prefixo comum "Importado do " cobre variações do texto ao longo do tempo.
  return repo.excluirPorFiltro(
    { coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" },
    { coluna: "observacoes", campoLocal: "observacoes", valor: "Importado do " }
  );
}