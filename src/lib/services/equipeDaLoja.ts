// A equipe da loja — quem tem acesso a ESTA loja.
//
// Lê `perfis` pelo RLS. Antes da migração 086 a lojista só enxergava a própria
// linha (`perfil_proprio`), e a lista voltava com uma pessoa só; a política
// `perfil_da_propria_loja` (086) é o que faz esta consulta ter sentido.
//
// Não há e-mail aqui: `perfis` guarda id, cliente_id, papel, nome e ativo. O
// e-mail mora no Auth e só o servidor o vê — quem convida sabe para qual
// endereço mandou, e a lista mostra quem já entrou.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerTudoPaginado } from "../supabase/paginado";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import { lerPapel, type PapelPerfil } from "../auth/roteamentoPapel";

export interface PessoaDaLoja {
  id: string;
  nome: string;
  papel: PapelPerfil | null;
  ativo: boolean;
}

interface Linha {
  id: string;
  nome: string | null;
  papel: string;
  ativo: boolean | null;
}

/**
 * Paginado como toda leitura multi-linha do projeto.
 *
 * A equipe de uma loja é pequena hoje, e "hoje" não é argumento: o corte do
 * PostgREST não avisa quando trunca, e uma lista de acessos que esconde a
 * última pessoa é pior que uma que demora um pouco mais.
 */
export async function listarEquipeDaLoja(clienteId: string | null): Promise<PessoaDaLoja[]> {
  if (!supabaseConfigurado || !clienteId) return [];
  const linhas = await lerTudoPaginado<Linha>("perfis", (de, ate) =>
    getSupabase()
      .from("perfis")
      .select("id, nome, papel, ativo")
      .eq("cliente_id", clienteId)
      .order("nome")
      .range(de, ate)
  );
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome ?? "",
    papel: lerPapel(l.papel),
    ativo: l.ativo !== false,
  }));
}

export type ResultadoConvite = { ok: true } | { ok: false; erro: string };

/**
 * Convida alguém para esta loja.
 *
 * O `clienteId` vai no corpo porque `validarPayloadNovoUsuario` o exige — mas
 * ele NÃO é o que decide: o servidor tira a loja do perfil de quem chama e
 * recusa com 403 se o corpo nomear outra (`decidirConvite`). Mandar daqui é
 * conveniência do validador, nunca autoridade.
 *
 * O cabeçalho de sessão é montado AQUI, e não recebido da tela: `/api/usuarios`
 * é rota protegida, e quem chama sem o cabeçalho recebe "Não autenticado" na
 * cara de quem clicou.
 */
export async function convidarParaALoja(
  clienteId: string,
  nome: string,
  email: string
): Promise<ResultadoConvite> {
  const resposta = await fetch("/api/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ nome, email, papel: "cliente", clienteId }),
  });
  const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
  if (!resposta.ok) {
    return { ok: false, erro: dados.erro ?? "Não foi possível enviar o convite." };
  }
  return { ok: true };
}
