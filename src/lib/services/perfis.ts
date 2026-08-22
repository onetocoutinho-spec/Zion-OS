// Serviço de Perfis — a lista de quem tem acesso, para a tela Zion › Usuários.
//
// Lê `perfis` pelo RLS (`perfil_proprio`: a equipe lê todos). O e-mail mora no
// Auth e só o servidor o vê; aqui fica o que o banco público sabe: nome, papel,
// vínculo e se está ativo. Paginado pela régua do repositório.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerTudoPaginado } from "../supabase/paginado";
import { lerPapel, type PapelPerfil } from "../auth/roteamentoPapel";

export interface PerfilListado {
  id: string;
  nome: string;
  papel: PapelPerfil | null;
  clienteId: string | null;
  agenciaId: string | null;
  ativo: boolean;
}

interface Linha {
  id: string;
  nome: string | null;
  papel: string;
  cliente_id: string | null;
  agencia_id: string | null;
  ativo: boolean | null;
}

export async function listarPerfis(): Promise<PerfilListado[]> {
  if (!supabaseConfigurado) return [];
  const linhas = await lerTudoPaginado<Linha>("perfis", (de, ate) =>
    getSupabase()
      .from("perfis")
      .select("id, nome, papel, cliente_id, agencia_id, ativo")
      .order("nome")
      .range(de, ate)
  );
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome ?? "",
    papel: lerPapel(l.papel),
    clienteId: l.cliente_id,
    agenciaId: l.agencia_id,
    ativo: l.ativo !== false,
  }));
}
