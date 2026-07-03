// Store local do Zion OS.
//
// Persiste as coleções em localStorage usando os mocks de lib/data como seed
// inicial. As telas NUNCA importam este arquivo diretamente — elas usam os
// serviços de lib/services, que expõem funções assíncronas. Para migrar para
// Supabase basta reimplementar os serviços; este arquivo inteiro é descartável.

import { clientes as seedClientes } from "./data/clientes";
import { onboardings as seedOnboardings } from "./data/onboardings";
import { produtos as seedProdutos } from "./data/produtos";
import { anuncios as seedAnuncios } from "./data/anuncios";
import { agentes as seedAgentes } from "./data/agentes";
import { tarefas as seedTarefas } from "./data/tarefas";
import { relatorios as seedRelatorios } from "./data/relatorios";
import { financeiro as seedFinanceiro } from "./data/financeiro";
import { execucoes as seedExecucoes } from "./data/execucoes";

export type CollectionName =
  | "clientes"
  | "onboardings"
  | "produtos"
  | "anuncios"
  | "agentes"
  | "tarefas"
  | "relatorios"
  | "financeiro"
  | "execucoes";

// Versão do schema no localStorage. Se o formato dos dados mudar em uma
// versão futura, incrementar aqui força um re-seed limpo.
const VERSAO = "v1.1";
const storageKey = (c: CollectionName) => `zion-os:${VERSAO}:${c}`;

const SEEDS: Record<CollectionName, { id: string }[]> = {
  clientes: seedClientes,
  onboardings: seedOnboardings,
  produtos: seedProdutos,
  anuncios: seedAnuncios,
  agentes: seedAgentes,
  tarefas: seedTarefas,
  relatorios: seedRelatorios,
  financeiro: seedFinanceiro,
  execucoes: seedExecucoes,
};

// ---- Notificação de mudanças (as telas se inscrevem via useLiveQuery) ----

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

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
