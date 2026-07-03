"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { EQUIPE, PRIORIDADES, TAREFA_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { concluirTarefa, listarTarefas } from "@/lib/services/tarefas";
import { formatDate, isOverdue } from "@/lib/format";

const HEADERS = [
  "Tarefa",
  "Cliente",
  "Vínculos",
  "Responsável",
  "Prioridade",
  "Status",
  "Prazo",
  "Agente",
  "Próxima ação",
  "",
];

export default function TarefasPage() {
  const [status, setStatus] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todos");
  const [responsavel, setResponsavel] = useState("Todos");
  const { data: tarefas } = useLiveQuery(listarTarefas);

  const filtradas = (tarefas ?? []).filter(
    (t) =>
      (status === "Todos" || t.status === status) &&
      (prioridade === "Todos" || t.prioridade === prioridade) &&
      (responsavel === "Todos" || t.responsavel === responsavel)
  );

  return (
    <div>
      <PageHeader
        title="Tarefas"
        description="Tudo que está em execução na operação. Clique na tarefa para editar, ou conclua direto na lista."
        count={filtradas.length}
        countLabel="tarefas"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Status" value={status} options={TAREFA_STATUS} onChange={setStatus} />
          <FilterSelect label="Prioridade" value={prioridade} options={PRIORIDADES} onChange={setPrioridade} />
          <FilterSelect label="Responsável" value={responsavel} options={EQUIPE} onChange={setResponsavel} />
        </div>
        <LinkButton href="/tarefas/nova">
          <Plus size={14} /> Nova tarefa
        </LinkButton>
      </div>

      <Table headers={HEADERS}>
        {tarefas && filtradas.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Nenhuma tarefa pendente com os filtros atuais."
            acaoLabel="Criar tarefa"
            acaoHref="/tarefas/nova"
          />
        )}
        {filtradas.map((t) => {
          const atrasada = t.status !== "Concluído" && isOverdue(t.prazo);
          return (
            <tr key={t.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 align-top">
                <Link href={`/tarefas/${t.id}/editar`}>
                  <p className="font-medium text-zinc-200 hover:text-violet-300">{t.tarefa}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{t.area}</p>
                </Link>
              </td>
              <Td className="whitespace-nowrap">{t.cliente}</Td>
              <Td className="min-w-40 text-xs">
                {t.produto && <p>📦 {t.produto}</p>}
                {t.anuncio && <p>📣 {t.anuncio}</p>}
                {!t.produto && !t.anuncio && <span className="text-zinc-600">—</span>}
              </Td>
              <Td className="whitespace-nowrap">{t.responsavel}</Td>
              <Td><Badge>{t.prioridade}</Badge></Td>
              <Td><Badge>{t.status}</Badge></Td>
              <Td className={`whitespace-nowrap ${atrasada ? "font-medium text-red-400" : ""}`}>
                {formatDate(t.prazo)}
                {atrasada && <span className="ml-1 text-[10px] uppercase">atrasada</span>}
              </Td>
              <Td className="whitespace-nowrap text-xs">{t.agenteRelacionado ?? "—"}</Td>
              <Td className="min-w-56 text-xs text-zinc-300">{t.proximaAcao}</Td>
              <Td>
                {t.status !== "Concluído" && (
                  <button
                    onClick={() => concluirTarefa(t.id)}
                    title="Marcar como concluída"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                  >
                    <Check size={14} />
                  </button>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
