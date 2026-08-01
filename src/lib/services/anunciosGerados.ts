import { criarRepositorio } from "../repositorio";
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
  atualizacoes: { id: string; statusMarketplace: string; statusMarketplaceEm: string }[]
): Promise<void> {
  if (atualizacoes.length === 0) return;
  return repo.atualizarVarios(atualizacoes);
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