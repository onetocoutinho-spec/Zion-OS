// Store local do Zion OS.
//
// Persiste as coleções em localStorage usando os mocks de lib/data como seed
// inicial. As telas NUNCA importam este arquivo diretamente — elas usam os
// serviços de lib/services, que expõem funções assíncronas. Para migrar para
// Supabase basta reimplementar os serviços; este arquivo inteiro é descartável.

import { clientes as seedClientes } from "./data/clientes";
import { produtos as seedProdutos } from "./data/produtos";
import { agentes as seedAgentes } from "./data/agentes";
import { relatorios as seedRelatorios } from "./data/relatorios";
import { execucoes as seedExecucoes } from "./data/execucoes";
import { pendencias as seedPendencias } from "./data/pendencias";
import { produtoVariantes as seedProdutoVariantes } from "./data/produtoVariantes";
import { produtoAtributos as seedProdutoAtributos } from "./data/produtoAtributos";
import { categoriaTemplates as seedCategoriaTemplates } from "./data/categoriaTemplates";
import { anuncioVariantes as seedAnuncioVariantes } from "./data/anuncioVariantes";
import { precificacaoVariantes as seedPrecificacaoVariantes } from "./data/precificacaoVariantes";
import { imagensProduto as seedImagensProduto } from "./data/imagensProduto";
import {
  importacoesAnuncios as seedImportacoes,
  auditoriasAnuncios as seedAuditorias,
  problemasAnuncio as seedProblemas,
  filaOtimizacao as seedFila,
  execucoesLote as seedExecucoesLote,
} from "./data/auditoriaMassa";

export type CollectionName =
  | "clientes"
  | "produtos"
  | "agentes"
  | "relatorios"
  | "execucoes"
  | "pendencias"
  | "produtoVariantes"
  | "produtoAtributos"
  | "categoriaTemplates"
  | "anuncioVariantes"
  | "precificacaoVariantes"
  | "imagensProduto"
  | "importacoesAnuncios"
  | "auditoriasAnuncios"
  | "problemasAnuncio"
  | "filaOtimizacao"
  | "execucoesLote"
  | "anunciosGerados"
  | "tabelasMedidas"
  | "decisoes"
  | "padroes"
  | "ofertas"
  | "conhecimentos"
  | "delegacoes";

// Versão do schema no localStorage. Se o formato dos dados mudar em uma
// versão futura, incrementar aqui força um re-seed limpo.
// v1.2: registros ganharam campos de ID (clienteId, produtoId, …).
// v1.7: modelagem de produtos marketplace (variantes, atributos, templates…).
// v1.8: auditoria em massa (importações, auditorias, fila…).
const VERSAO = "v1.8";
const storageKey = (c: CollectionName) => `zion-os:${VERSAO}:${c}`;

const SEEDS: Record<CollectionName, { id: string }[]> = {
  clientes: seedClientes,
  produtos: seedProdutos,
  agentes: seedAgentes,
  relatorios: seedRelatorios,
  execucoes: seedExecucoes,
  pendencias: seedPendencias,
  produtoVariantes: seedProdutoVariantes,
  produtoAtributos: seedProdutoAtributos,
  categoriaTemplates: seedCategoriaTemplates,
  anuncioVariantes: seedAnuncioVariantes,
  precificacaoVariantes: seedPrecificacaoVariantes,
  imagensProduto: seedImagensProduto,
  importacoesAnuncios: seedImportacoes,
  auditoriasAnuncios: seedAuditorias,
  problemasAnuncio: seedProblemas,
  filaOtimizacao: seedFila,
  execucoesLote: seedExecucoesLote,
  // Anúncios gerados pela esteira: nasce vazio (é produção real, não demo).
  anunciosGerados: [],
  tabelasMedidas: [],
  // Decision Journal (AIL): log de decisões observadas. Nasce vazio — é
  // produção real, não demo (nenhuma decisão de exemplo é semeada).
  decisoes: [],
  // Pattern Detector (AIL): projeção materializada de padrões. Nasce vazia —
  // é derivada do log de decisões, nunca semeada.
  padroes: [],
  // Registro de Ofertas (AIL, ADR-001): fatos append-only de sugestões
  // apresentadas. Nasce vazio — auditoria real, jamais semeada.
  ofertas: [],
  // Knowledge Maturation (AIL, ADR-002): fatos append-only de promoção/
  // rebaixamento do conhecimento institucional. Nasce vazio — jamais semeado.
  conhecimentos: [],
  // Delegation Runtime (AIL, E5.10b): fatos append-only de concessão/revogação
  // de delegação sobre Knowledge vigente. Nasce vazio — jamais semeado.
  delegacoes: [],
};

// ---- Notificação de mudanças (as telas se inscrevem via useLiveQuery) ----

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Notifica as telas (via useLiveQuery) de que algum dado mudou.
 * Exportado para que a camada de repositório dispare o mesmo evento
 * após escritas no Supabase.
 */
export function notificarMudanca() {
  listeners.forEach((fn) => fn());
}

const notify = notificarMudanca;

// ---- Leitura e escrita ----

function read<T extends { id: string }>(collection: CollectionName): T[] {
  if (typeof window === "undefined") return SEEDS[collection] as T[];
  const raw = window.localStorage.getItem(storageKey(collection));
  if (raw) {
    try {
      return JSON.parse(raw) as T[];
    } catch {
      // dado corrompido: cai para o seed abaixo
    }
  }
  const seed = SEEDS[collection] as T[];
  window.localStorage.setItem(storageKey(collection), JSON.stringify(seed));
  return seed;
}

function write<T>(collection: CollectionName, items: T[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(collection), JSON.stringify(items));
  }
  notify();
}

function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---- CRUD genérico usado pelos serviços ----

export function listAll<T extends { id: string }>(collection: CollectionName): T[] {
  return read<T>(collection);
}

export function getById<T extends { id: string }>(
  collection: CollectionName,
  id: string
): T | undefined {
  return read<T>(collection).find((item) => item.id === id);
}

export function createItem<T extends { id: string }>(
  collection: CollectionName,
  dados: Omit<T, "id">,
  prefixo: string
): T {
  const item = { ...dados, id: novoId(prefixo) } as T;
  write(collection, [item, ...read<T>(collection)]);
  return item;
}

/** Cria vários itens de uma vez, com uma única escrita/notificação. */
export function createManyItems<T extends { id: string }>(
  collection: CollectionName,
  registros: Omit<T, "id">[],
  prefixo: string
): T[] {
  if (registros.length === 0) return [];
  const criados = registros.map(
    (dados) => ({ ...dados, id: novoId(prefixo) }) as T
  );
  write(collection, [...criados, ...read<T>(collection)]);
  return criados;
}

export function updateItem<T extends { id: string }>(
  collection: CollectionName,
  id: string,
  dados: Partial<T>
): T | null {
  const items = read<T>(collection);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const atualizado = { ...items[index], ...dados, id };
  items[index] = atualizado;
  write(collection, items);
  return atualizado;
}

/**
 * Insere ou substitui um item pelo seu id (upsert), RESPEITANDO o id fornecido.
 * A identidade é do domínio: nada é gerado aqui. Insere se ausente, substitui se
 * presente — idempotente por id. Primitivo interno (irmão de createItem/updateItem);
 * os consumidores usam criarRepositorio().salvar().
 */
export function upsertItem<T extends { id: string }>(
  collection: CollectionName,
  item: T
): T {
  const items = read<T>(collection);
  const index = items.findIndex((i) => i.id === item.id);
  const proximos =
    index === -1 ? [item, ...items] : items.map((i, n) => (n === index ? item : i));
  write(collection, proximos);
  return item;
}

export function removeItem(collection: CollectionName, id: string): void {
  write(
    collection,
    read(collection).filter((item) => item.id !== id)
  );
}

/** Apaga tudo e volta aos dados de demonstração (usado em Configurações). */
export function resetStore(): void {
  if (typeof window === "undefined") return;
  (Object.keys(SEEDS) as CollectionName[]).forEach((c) => {
    window.localStorage.setItem(storageKey(c), JSON.stringify(SEEDS[c]));
  });
  notify();
}
