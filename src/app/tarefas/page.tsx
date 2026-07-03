"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { tarefas } from "@/lib/data/tarefas";
import { formatDate, isOverdue } from "@/lib/format";

const STATUS = [
  "Não iniciado",
  "Em andamento",
  "Aguardando cliente",
  "Aguardando aprovação",
  "Em revisão",
  "Concluído",
  "Travado",
];
const PRIORIDADES = ["Baixa", "Média", "Alta", "Urgente"];
const RESPONSAVEIS = [...new Set(tarefas.map((t) => t.responsavel))];

const HEADERS = [
  "Tarefa",
  "Cliente",
  "Área",
  "Responsável",
  "Prioridade",
  "Status",
  "Prazo",
  "Agente",
  "Próxima ação",
  "Observações",
];

export default function TarefasPage() {
  const [status, setStatus] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todos");
  const [responsavel, setResponsavel] = useState("Todos");

  const filtradas = tarefas.filter(
    (t) =>
      (status === "Todos" || t.status === status) &&
      (prioridade === "Todos" || t.prioridade === prioridade) &&
      (responsavel === "Todos" || t.responsavel === responsavel)
  );

  return (
    <div>
      <PageHeader
        title="Tarefas"
        description="Tudo que está em execução na operação, por cliente e responsável."
        count={filtradas.length}
        countLabel="tarefas"
      />

      <div className="mb-4 flex flex-wrap gap-4">
        <FilterSelect label="Status" value={status} options={STATUS} onChange={setStatus} />
        <FilterSelect label="Prioridade" value={prioridade} options={PRIORIDADES} onChange={setPrioridade} />
        <FilterSelect label="Responsável" value={responsavel} options={RESPONSAVEIS} onChange={setResponsavel} />
      </div>

      <Table headers={HEADERS}>
        {filtradas.length === 0 && <EmptyRow colSpan={HEADERS.length} />}
        {filtradas.map((t) => {
          const atrasada = t.status !== "Concluído" && isOverdue(t.prazo);
          return (
            <tr key={t.id} className="hover:bg-white/[0.02]">
              <TdMain>{t.tarefa}</TdMain>
              <Td className="whitespace-nowrap">{t.cliente}</Td>
              <Td className="whitespace-nowrap">{t.area}</Td>
              <Td className="whitespace-nowrap">{t.responsavel}</Td>
              <Td><Badge>{t.prioridade}</Badge></Td>
              <Td><Badge>{t.status}</Badge></Td>
              <Td className={`whitespace-nowrap ${atrasada ? "font-medium text-red-400" : ""}`}>
                {formatDate(t.prazo)}
                {atrasada && <span className="ml-1 text-[10px] uppercase">atrasada</span>}
              </Td>
              <Td className="whitespace-nowrap text-xs">{t.agenteRelacionado ?? "—"}</Td>
              <Td className="min-w-56 text-xs text-zinc-300">{t.proximaAcao}</Td>
              <Td className="min-w-48 text-xs">{t.observacoes || "—"}</Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
