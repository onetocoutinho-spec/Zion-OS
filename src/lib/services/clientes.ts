// Serviço de Clientes.
// Com NEXT_PUBLIC_SUPABASE_* configurados, usa o Supabase; sem eles,
// cai para o modo demonstração em localStorage. As telas não sabem a diferença.

import { criarRepositorio } from "../repositorio";
import { clienteParaApp, clienteParaBanco } from "../supabase/mappers";
import type { ClienteRow } from "../supabase/database.types";
import type { Cliente, ClienteStatus } from "../types";
import { cabecalhoAutenticacao } from "../supabase/sessao";

const repo = criarRepositorio<Cliente, ClienteRow>({
  tabela: "clientes",
  colecao: "clientes",
  prefixoIdLocal: "cli",
  selecao: "*",
  paraApp: clienteParaApp,
  paraBanco: clienteParaBanco,
});

export async function listarClientes(): Promise<Cliente[]> {
  return repo.listar();
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  return repo.buscar(id);
}

export async function criarCliente(dados: Omit<Cliente, "id">): Promise<Cliente> {
  return repo.criar(dados);
}

export async function atualizarCliente(
  id: string,
  dados: Partial<Cliente>
): Promise<Cliente | null> {
  return repo.atualizar(id, dados);
}

export async function excluirCliente(id: string): Promise<void> {
  return repo.excluir(id);
}

export async function alterarStatusCliente(
  id: string,
  status: ClienteStatus
): Promise<Cliente | null> {
  return repo.atualizar(id, { status });
}

/**
 * A agência cria uma loja NOVA na própria carteira.
 *
 * Não é `criarCliente`: aquele escreve pelo navegador, e `clientes` não tem
 * política de INSERT para agência (054, de propósito). O vínculo com a agência
 * sai do PERFIL no servidor — o corpo leva só o nome.
 */
export async function criarLojaDaAgencia(nomeDaLoja: string): Promise<string> {
  const resposta = await fetch("/api/agencia/loja", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ nomeDaLoja }),
  });
  const dados = (await resposta.json().catch(() => ({}))) as { clienteId?: string; erro?: string };
  if (!resposta.ok || !dados.clienteId) {
    throw new Error(dados.erro ?? "Não foi possível criar a loja.");
  }
  return dados.clienteId;
}
