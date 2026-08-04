// O fio do lado do navegador: leva o que falhou até onde alguém possa ler.
//
// TRÊS PROPRIEDADES, E TODAS AS TRÊS SÃO O PONTO
//
// 1. NUNCA LANÇA. Telemetria que derruba a tela é pior que telemetria nenhuma:
//    o defeito original vira dois, e o segundo é nosso. Toda função aqui
//    engole a própria falha — e este é o único lugar do sistema onde engolir
//    é a decisão certa, porque não há a quem contar que o "contar" falhou.
//
// 2. NUNCA BLOQUEIA. Nada aqui é esperado por quem chama. `registrarEvento` é
//    síncrona e volta na hora; o envio acontece depois.
//
// 3. AGREGA ANTES DE MANDAR. Uma consulta que falha em laço produziria
//    centenas de requisições por minuto — telemetria virando a causa da queda.
//    A janela junta o que é o mesmo e manda `repeticoes`.
//
// O que NÃO está aqui, e é limitação declarada: se a aba fecha antes do flush,
// os eventos daquela janela se perdem. `sendBeacon` cobre parte disso e está
// abaixo; o resto é aceito de propósito — durabilidade completa custaria fila
// persistente, e o defeito que isso resolve (não ver nada) é grande demais
// para esperar pela versão perfeita.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import { getSupabase, supabaseConfigurado } from "../supabase/client";
import {
  agregar,
  mensagemDoErro,
  prepararEvento,
  type EventoNovo,
  type EventoRedigido,
  type TipoDeEvento,
} from "../../modules/observability/domain/evento";

/** Janela de agregação. Curta o bastante para não perder no fechamento da aba. */
const JANELA_MS = 5_000;

/**
 * Teto por janela. Acima disso, o excedente é CONTADO e não guardado — o
 * sistema em pânico não pode gastar memória descrevendo o pânico.
 */
const MAXIMO_POR_JANELA = 50;

let fila: EventoRedigido[] = [];
let descartadosNaJanela = 0;
let agendado: ReturnType<typeof setTimeout> | null = null;

function noNavegador(): boolean {
  return typeof window !== "undefined";
}

/**
 * Conta que algo falhou. Volta na hora, e nunca lança.
 *
 * Chame de dentro do `catch`, ao lado do que você já fazia — esta função não
 * substitui o tratamento do erro, ela só garante que ele deixe rastro.
 */
export function registrarEvento(evento: EventoNovo): void {
  try {
    if (!noNavegador()) return; // no servidor, o log do runtime já é durável
    if (fila.length >= MAXIMO_POR_JANELA) {
      descartadosNaJanela++;
      return;
    }
    fila.push(prepararEvento(evento));
    agendarEnvio();
  } catch {
    // Ver a propriedade 1 no topo do arquivo.
  }
}

/** Atalho para o caso mais comum: um `catch` com um erro desconhecido. */
export function registrarFalha(
  tipo: TipoDeEvento,
  origem: string,
  bruto: unknown,
  contexto?: Record<string, unknown>
): void {
  registrarEvento({
    tipo,
    origem,
    severidade: "erro",
    mensagem: mensagemDoErro(bruto),
    contexto,
  });
}

function agendarEnvio(): void {
  if (agendado) return;
  agendado = setTimeout(() => {
    agendado = null;
    void enviar();
  }, JANELA_MS);
}

/**
 * Manda a janela. Esvazia a fila ANTES de esperar a rede — se o envio falhar,
 * os eventos não voltam para a fila de propósito: retentar indefinidamente é
 * como uma telemetria quebrada vira a causa do próximo incidente.
 */
async function enviar(): Promise<void> {
  const janela = agregar(fila);
  const descartados = descartadosNaJanela;
  fila = [];
  descartadosNaJanela = 0;
  if (janela.length === 0) return;

  const corpo = JSON.stringify({ eventos: janela, descartados });
  try {
    await fetch("/api/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
      body: corpo,
      // `keepalive` deixa a requisição sobreviver à navegação — o evento mais
      // interessante costuma ser o último antes de a pessoa sair da página.
      keepalive: true,
    });
  } catch {
    // Ver a propriedade 1. Um erro AQUI não tem a quem ser contado.
  }
}

/** Força o envio do que está na fila. Para o fechamento da aba e para testes. */
export async function esvaziarEventos(): Promise<void> {
  if (agendado) {
    clearTimeout(agendado);
    agendado = null;
  }
  await enviar();
}

/** Só para teste: o que está esperando envio. */
export function filaDeEventos(): readonly EventoRedigido[] {
  return fila;
}

if (typeof window !== "undefined") {
  // `pagehide` cobre o fechamento e a navegação, inclusive no Safari móvel,
  // onde `beforeunload` não é confiável.
  window.addEventListener("pagehide", () => {
    void esvaziarEventos();
  });
}

// ---------------------------------------------------------------------------
// Leitura — o outro lado do fio
// ---------------------------------------------------------------------------

export interface EventoRegistro {
  id: string;
  clienteId: string | null;
  tipo: TipoDeEvento;
  origem: string;
  severidade: "erro" | "aviso";
  mensagem: string;
  contexto: Record<string, unknown>;
  repeticoes: number;
  criadoEm: string;
}

/**
 * Os eventos recentes, mais novo primeiro.
 *
 * NÃO passa pelo repositório genérico de propósito. Aquele existe para as
 * entidades que precisam do modo local (o `store` de seeds, para demonstração
 * sem `.env`), e observabilidade é o oposto disso: um evento que só existe em
 * demonstração não é um evento. Sem Supabase configurado, esta lista é vazia —
 * e vazia é a resposta honesta.
 */
export async function listarEventos(limite = 200): Promise<EventoRegistro[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await getSupabase()
    .from("eventos")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limite);

  // Aqui o erro SOBE, ao contrário de tudo mais neste arquivo: esta é a tela de
  // quem foi ver o que quebrou. Ela falhar em silêncio mostraria "nenhum
  // evento" — a mesma cegueira que a tabela existe para acabar, agora com cara
  // de boa notícia.
  if (error) throw new Error(`[Zion OS] Erro ao listar eventos: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    clienteId: (row.cliente_id as string | null) ?? null,
    tipo: row.tipo as TipoDeEvento,
    origem: String(row.origem ?? ""),
    severidade: row.severidade === "aviso" ? "aviso" : "erro",
    mensagem: String(row.mensagem ?? ""),
    contexto: (row.contexto as Record<string, unknown>) ?? {},
    repeticoes: typeof row.repeticoes === "number" ? row.repeticoes : 1,
    criadoEm: String(row.criado_em ?? ""),
  }));
}
