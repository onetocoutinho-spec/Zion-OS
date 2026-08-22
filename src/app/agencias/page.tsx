"use client";

// Zion › Agências — "quais agências existem e quantas lojas cada uma opera?"
//
// Até a fatia 6 (docs/product/ux) a agência só nascia por insert manual no
// banco. Esta tela é a porta: criar, ver as lojas vinculadas, convidar.

import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td, TdMain } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveQuery } from "@/lib/hooks";
import { listarAgencias } from "@/lib/services/agencias";
import { listarClientes } from "@/lib/services/clientes";
import { listarPerfis } from "@/lib/services/perfis";
import { supabaseConfigurado } from "@/lib/supabase/client";

const HEADERS = ["Agência", "Lojas", "Usuários", "Situação", ""];

export default function AgenciasPage() {
  const { data: agencias, carregando } = useLiveQuery(listarAgencias);
  const { data: lojas } = useLiveQuery(listarClientes);
  const { data: perfis } = useLiveQuery(listarPerfis);

  const lojasPor = new Map<string, number>();
  for (const l of lojas ?? []) if (l.agenciaId) lojasPor.set(l.agenciaId, (lojasPor.get(l.agenciaId) ?? 0) + 1);
  const usuariosPor = new Map<string, number>();
  for (const p of perfis ?? []) if (p.agenciaId) usuariosPor.set(p.agenciaId, (usuariosPor.get(p.agenciaId) ?? 0) + 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Agências"
          description="Quem opera várias lojas. Uma agência não é uma loja: não tem produto, canal nem preço — ela opera as lojas vinculadas a ela."
          count={agencias?.length}
          countLabel="agências"
        />
        <LinkButton href="/agencias/nova">
          <Plus size={14} /> Nova agência
        </LinkButton>
      </div>

      {!supabaseConfigurado && (
        <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          Modo demonstração: agências vivem no Supabase e não aparecem sem ele.
        </p>
      )}

      {agencias && agencias.length === 0 && !carregando ? (
        <EmptyState
          mensagem="Nenhuma agência ainda. Crie a primeira e vincule as lojas que ela vai operar."
          acaoLabel="Nova agência"
          acaoHref="/agencias/nova"
        />
      ) : (
        <Table headers={HEADERS} carregando={carregando}>
          {(agencias ?? []).map((a) => (
            <tr key={a.id} className="hover:bg-white/[0.02]">
              <TdMain>
                <Link href={`/agencias/${a.id}`} className="font-medium text-zinc-200 hover:text-violet-300">
                  {a.nome}
                </Link>
              </TdMain>
              <Td className="tabular-nums">{lojasPor.get(a.id) ?? 0}</Td>
              <Td className="tabular-nums">{usuariosPor.get(a.id) ?? 0}</Td>
              <Td>
                <Badge tone={a.ativo ? "green" : "gray"}>{a.ativo ? "Ativa" : "Inativa"}</Badge>
              </Td>
              <Td>
                <Link href={`/agencias/${a.id}`} className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                  Abrir <ArrowRight size={12} />
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
