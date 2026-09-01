// Os acessos que quem está olhando pode ver e criar.
//
// Passa por `/api/usuarios` nos DOIS sentidos, e não pelo Supabase do
// navegador: a agência não lê `perfis` pelo RLS (054), e quem decide o recorte
// da leitura e o vínculo do convite é o servidor.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import { lerPapel, type PapelPerfil } from "../auth/roteamentoPapel";

export interface AcessoListado {
  id: string;
  nome: string;
  papel: PapelPerfil | null;
  clienteId: string | null;
  agenciaId: string | null;
  ativo: boolean;
}

interface LinhaDaApi {
  id: string;
  nome: string;
  papel: string;
  clienteId: string | null;
  agenciaId: string | null;
  ativo: boolean;
}

export async function listarAcessos(): Promise<AcessoListado[]> {
  const resposta = await fetch("/api/usuarios", { headers: await cabecalhoAutenticacao() });
  if (!resposta.ok) throw new Error("Não foi possível ler os acessos.");
  const dados = (await resposta.json()) as { pessoas?: LinhaDaApi[] };
  return (dados.pessoas ?? []).map((p) => ({ ...p, papel: lerPapel(p.papel) }));
}

export interface PedidoDeAcesso {
  nome: string;
  email: string;
  papel: "cliente" | "agencia";
  /** Só para `papel: "cliente"` — e o servidor confere que a loja é da carteira. */
  clienteId?: string;
}

export type ResultadoDoConvite = { ok: true } | { ok: false; erro: string };

export async function convidarAcesso(pedido: PedidoDeAcesso): Promise<ResultadoDoConvite> {
  const resposta = await fetch("/api/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify(pedido),
  });
  const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
  if (!resposta.ok) {
    return { ok: false, erro: dados.erro ?? "Não foi possível enviar o convite." };
  }
  return { ok: true };
}
