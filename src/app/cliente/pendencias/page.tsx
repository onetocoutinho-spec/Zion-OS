"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListChecks, CheckCircle2, Clock } from "lucide-react";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { PendenciasDaConta } from "@/components/client-portal/PendenciasDaConta";
import { useLiveQuery } from "@/lib/hooks";
import { EsqueletoDeTabela } from "@/components/ui/Skeleton";
import { listarPendenciasDoCliente } from "@/lib/services/pendencias";
import type { Pendencia } from "@/lib/types";

const STATUS = ["Pendente", "Resolvido"] as const;

function statusDe(p: Pendencia) {
  return p.resolvida ? "Resolvido" : "Pendente";
}

export default function ClientePendencias() {
  const { clienteId, nome } = useClientPortal();
  // `estado` e não `data ?? []`: esta tela mostrava "Nenhuma pendência 🎉 — Você
  // está em dia!" em TRÊS situações diferentes — sem pendências, carregando, e
  // quando a consulta falhava. As duas últimas são mentiras, e a última é uma
  // mentira animada sobre o estado da operação de alguém.
  const consulta = useLiveQuery(() => listarPendenciasDoCliente(clienteId), [clienteId]);
  const { data: pendencias, estado, erro, reload, revalidando } = consulta;

  const [fStatus, setFStatus] = useState("Todos");

  // `useMemo` e não `pendencias ?? []` solto: sem ele o fallback cria um array
  // novo a cada render e o `useMemo` de `filtradas` abaixo nunca memoiza. Era um
  // aviso do lint anterior a esta vertical, e cabia numa linha.
  const lista = useMemo(() => pendencias ?? [], [pendencias]);
  const abertas = lista.filter((p) => !p.resolvida).length;
  const resolvidas = lista.filter((p) => p.resolvida).length;

  const filtradas = useMemo(
    () => lista.filter((p) => fStatus === "Todos" || statusDe(p) === fStatus),
    [lista, fStatus]
  );

  return (
    <>
      <PageHeader
        titulo="Pendências"
        subtitulo="O que ainda falta — nos seus anúncios e na sua conta do Mercado Livre."
      />

      {/* A conta do Mercado Livre vem PRIMEIRO, e fica acima da tabela.
          A tabela abaixo lista o que a esteira do Zion ainda não fechou; esta
          seção lista o que o próprio Mercado Livre está cobrando — e é a que
          pode custar a conta dela. Para a lojista é tudo "o que precisa de
          mim", então mora na mesma tela; a ordem é que diz o que dói mais. */}
      <PendenciasDaConta clienteId={clienteId} cliente={nome} />

      {estado === "carregando" ? (
        // Esqueleto de tabela e não "está em dia": a geometria do que vem, sem
        // afirmar nada sobre o conteúdo.
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <EsqueletoDeTabela colunas={4} />
        </div>
      ) : estado === "erro" ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-200">
          <p className="font-medium">Não consegui carregar suas pendências.</p>
          {/* Dizer "você está em dia" aqui seria afirmar sobre a operação dele o
              oposto do que sabemos: não sabemos nada. */}
          <p className="mt-1 text-amber-200/70">
            Isto é uma falha nossa ao buscar os dados — não significa que não há
            pendências.
          </p>
          <p className="mt-2 text-xs text-amber-200/50">{erro?.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-md border border-amber-400/30 px-2.5 py-1 text-xs transition hover:bg-amber-400/10"
          >
            Tentar de novo
          </button>
        </div>
      ) : estado === "vazio" ? (
        <VazioAmigavel
          icon={CheckCircle2}
          titulo="Nenhuma pendência 🎉"
          descricao="Você está em dia! Quando houver algo dependendo de você ou da Zion, aparece aqui."
          acao={
            <Link href="/cliente" className="text-sm text-violet-400 hover:text-violet-300">
              Voltar ao início →
            </Link>
          }
        />
      ) : (
        // `revalidando`: o store mudou e uma nova busca está em voo. O conteúdo
        // atual continua legível e visivelmente não-final — trocar por esqueleto
        // apagaria a tela a cada escrita em qualquer lugar do portal.
        <div className={revalidando ? "space-y-6 opacity-60 transition-opacity" : "space-y-6"}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Abertas" value={abertas} icon={Clock} tone={abertas ? "yellow" : "gray"} />
            <StatCard label="Resolvidas" value={resolvidas} icon={CheckCircle2} tone="green" />
            <StatCard label="Total" value={lista.length} icon={ListChecks} tone="violet" />
          </div>

          <div className="flex items-center gap-3">
            <FilterSelect label="Status" value={fStatus} options={STATUS} onChange={setFStatus} />
            <span className="ml-auto text-xs text-zinc-500">
              {filtradas.length} de {lista.length}
            </span>
          </div>

          <Table headers={["Pendência", "Origem", "Status", "Ação"]}>
            {filtradas.length === 0 ? (
              <EmptyRow colSpan={4} />
            ) : (
              filtradas.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <TdMain>{p.descricao}</TdMain>
                  <Td>{p.tarefa || "Geral"}</Td>
                  <Td>
                    <Pill tone={p.resolvida ? "green" : "yellow"}>{statusDe(p)}</Pill>
                  </Td>
                  <Td>
                    {p.resolvida ? (
                      <span className="text-zinc-600">—</span>
                    ) : (
                      <span className="text-xs text-zinc-500">Em acompanhamento pela Zion</span>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </Table>
        </div>
      )}
    </>
  );
}
