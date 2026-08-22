"use client";

// A agência e as lojas dela — onde o vínculo `clientes.agencia_id` é feito.
//
// A regra de negócio é a da migração 054: uma loja pertence a NO MÁXIMO uma
// agência. Por isso a lista "disponíveis" mostra só lojas sem agência; para
// mover uma loja de agência, desvincule na outra primeiro — de propósito,
// para a troca nunca acontecer sem alguém ver.

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Link2, Unlink, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EstadoDaLoja } from "@/components/ui/EstadoDaLoja";
import { useLiveQuery } from "@/lib/hooks";
import { buscarAgencia, vincularLojaAAgencia } from "@/lib/services/agencias";
import { listarClientes } from "@/lib/services/clientes";
import { listarPerfis } from "@/lib/services/perfis";
import { saudeDaLoja } from "@/lib/contexto/saudeDaLoja";

export default function AgenciaPage() {
  const { id } = useParams<{ id: string }>();
  const { data: agencia, carregando } = useLiveQuery(() => buscarAgencia(id), [id]);
  const { data: lojas, reload } = useLiveQuery(listarClientes);
  const { data: perfis } = useLiveQuery(listarPerfis);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState("");

  if (carregando) return null;
  if (!agencia) {
    return <EmptyState mensagem="Agência não encontrada." acaoLabel="Voltar para agências" acaoHref="/agencias" />;
  }

  const vinculadas = (lojas ?? []).filter((l) => l.agenciaId === id);
  const disponiveis = (lojas ?? []).filter((l) => !l.agenciaId);
  const usuarios = (perfis ?? []).filter((p) => p.agenciaId === id);

  async function mudar(clienteId: string, para: string | null) {
    setOcupado(clienteId);
    setErro(null);
    try {
      await vincularLojaAAgencia(clienteId, para);
      setEscolhida("");
      reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar o vínculo.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/agencias" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft size={13} /> Agências
      </Link>
      <PageHeader title={agencia.nome} description={`${vinculadas.length} lojas · ${usuarios.length} usuários`} />

      {erro && (
        <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {erro}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Lojas que esta agência opera">
          {vinculadas.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma loja vinculada ainda. Vincule abaixo.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {vinculadas.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <EstadoDaLoja saude={saudeDaLoja(l)} />
                    <Link href={`/clientes/${l.id}`} className="truncate text-sm text-zinc-200 hover:text-violet-300">
                      {l.empresa}
                    </Link>
                    <Badge>{l.status}</Badge>
                  </div>
                  <Button variant="ghost" className="text-xs" disabled={ocupado === l.id} onClick={() => mudar(l.id, null)}>
                    <Unlink size={12} /> Desvincular
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
            <select
              value={escolhida}
              onChange={(e) => setEscolhida(e.target.value)}
              aria-label="Loja a vincular"
              className="min-w-56 flex-1 rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500 [@media(pointer:coarse)]:min-h-11"
            >
              <option value="">Vincular uma loja sem agência…</option>
              {disponiveis.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.empresa}
                </option>
              ))}
            </select>
            <Button disabled={!escolhida || ocupado !== null} onClick={() => escolhida && mudar(escolhida, id)}>
              <Link2 size={13} /> Vincular
            </Button>
          </div>
          {disponiveis.length === 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Todas as lojas já têm agência. Para mover uma, desvincule-a na agência atual.
            </p>
          )}
        </Card>

        <Card title="Usuários da agência">
          {usuarios.length === 0 ? (
            <p className="text-sm text-zinc-500">Ninguém ainda. Convide o primeiro usuário.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {usuarios.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <span className="truncate text-zinc-200">{u.nome || "(sem nome)"}</span>
                  <Badge tone={u.ativo ? "green" : "gray"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-white/5 pt-4">
            <LinkButton href={`/usuarios/novo?papel=agencia&agencia=${id}`} variant="ghost" className="text-xs">
              <UserPlus size={13} /> Convidar usuário
            </LinkButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
