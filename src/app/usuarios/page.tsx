"use client";

// Zion › Usuários — "quem tem acesso, e a quê?"
// O item "Novo usuário" era um menu sem lista; agora a lista existe.

import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td, TdMain } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { useLiveQuery } from "@/lib/hooks";
import { listarPerfis } from "@/lib/services/perfis";
import { listarClientes } from "@/lib/services/clientes";
import { listarAgencias } from "@/lib/services/agencias";
import { supabaseConfigurado } from "@/lib/supabase/client";

const HEADERS = ["Nome", "Papel", "Vínculo", "Situação"];
const ROTULO: Record<string, string> = { equipe: "Equipe Zion", cliente: "Lojista", agencia: "Agência" };

export default function UsuariosPage() {
  const { data: perfis, carregando } = useLiveQuery(listarPerfis);
  const { data: lojas } = useLiveQuery(listarClientes);
  const { data: agencias } = useLiveQuery(listarAgencias);
  const nomeDaLoja = new Map((lojas ?? []).map((l) => [l.id, l.empresa]));
  const nomeDaAgencia = new Map((agencias ?? []).map((a) => [a.id, a.nome]));

  function vinculo(p: { clienteId: string | null; agenciaId: string | null }) {
    if (p.clienteId) return nomeDaLoja.get(p.clienteId) ?? p.clienteId;
    if (p.agenciaId) return nomeDaAgencia.get(p.agenciaId) ?? p.agenciaId;
    return "—";
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Usuários"
          description="Quem tem acesso ao Zion OS e a qual loja ou agência."
          count={perfis?.length}
          countLabel="usuários"
        />
        <LinkButton href="/usuarios/novo">
          <Plus size={14} /> Novo usuário
        </LinkButton>
      </div>
      {!supabaseConfigurado && (
        <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          Modo demonstração: sem Supabase não há usuários para listar.
        </p>
      )}
      <Table headers={HEADERS} carregando={carregando}>
        {(perfis ?? []).map((p) => (
          <tr key={p.id} className="hover:bg-white/[0.02]">
            <TdMain>{p.nome || <span className="text-zinc-500">(sem nome)</span>}</TdMain>
            <Td>{p.papel ? ROTULO[p.papel] : <span className="text-red-400">papel desconhecido</span>}</Td>
            <Td className="text-xs text-zinc-400">{vinculo(p)}</Td>
            <Td>
              <Badge tone={p.ativo ? "green" : "gray"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
