// Consulta de peso em linguagem natural — a ponte entre a tela e a rota.
//
// Só transporta. A interpretação é do modelo (na rota, no servidor) e a
// resolução é do domínio (`catalog/domain/consultaDePeso`, no cliente, contra
// os produtos que a tela já carregou). Este arquivo não decide nada.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import type { CriterioDePeso, UsoDaConsulta } from "../../modules/catalog/domain/consultaDePeso";

export async function interpretarConsulta(
  frase: string,
  marcas: readonly string[]
): Promise<CriterioDePeso> {
  const resposta = await fetch("/api/consulta-peso", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ frase, marcas }),
  });
  const dados = (await resposta.json()) as { criterio?: CriterioDePeso; erro?: string };
  if (!resposta.ok || !dados.criterio) {
    throw new Error(dados.erro ?? "Não consegui interpretar a consulta.");
  }
  return dados.criterio;
}

/**
 * Telemetria do experimento — EVENTOS, não texto.
 *
 * A frase do operador NÃO é gravada. Ele digita nome de fornecedor, código
 * interno, observação comercial; guardar isso indefinidamente para responder
 * "escrever ou clicar?" seria pagar caro por uma pergunta barata. O que importa
 * é o comportamento: usou texto ou filtro, que desfecho deu, quantos produtos,
 * e se mexeu nos filtros depois.
 *
 * Vive em localStorage de propósito: um operador, uma máquina, e nada disso
 * merece migração antes de sabermos se a superfície fica de pé. A limitação é
 * real e declarada — não atravessa dispositivo nem navegador.
 */
const CHAVE = "zion:uso-consulta-peso";
const LIMITE = 500;

export function registrarUso(uso: UsoDaConsulta): void {
  try {
    const atual = lerUsos();
    localStorage.setItem(CHAVE, JSON.stringify([...atual, uso].slice(-LIMITE)));
  } catch {
    // sem storage a tela continua funcionando — só não medimos esta sessão
  }
}

export function lerUsos(): UsoDaConsulta[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? (lista as UsoDaConsulta[]) : [];
  } catch {
    return [];
  }
}
