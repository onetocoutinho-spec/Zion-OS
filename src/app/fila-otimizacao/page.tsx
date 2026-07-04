"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, ListFilter, Clock, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLiveQuery } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import { listarFila, alterarStatusFila } from "@/lib/services/filaOtimizacao";
import {
  ROTULO_PRIORIDADE,
  ROTULO_TIPO_ACAO,
  ROTULO_STATUS_FILA,
} from "@/lib/auditoria";
import type { Tone } from "@/lib/status";
import type { PrioridadeAuditoria } from "@/lib/types";

const TONE_PRIORIDADE: Record<PrioridadeAuditoria, Tone> = {
  critica: "red",
  alta: "orange",
  media: "blue",
  baixa: "gray",
};
const PESO_PRIORIDADE: Record<PrioridadeAuditoria, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

const HEADERS = [
  "Anúncio",
  "Cliente",
  "Prioridade",
  "Ação",
  "Agente",
  "Responsável",
  "Prazo",
  "Resultado esperado",
  "Status",
  "",
];

export default function FilaOtimizacaoPage() {
  const [cliente, setCliente] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [busy, setBusy] = useState(false);

  const { data: filaData } = useLiveQuery(listarFila);
  const fila = filaData ?? [];

  const clientes = useMemo(() => [...new Set(fila.map((f) => f.cliente))], [fila]);

  const pendentes = fila.filter((f) => f.status === "pendente").length;
  const emAndamento = fila.filter((f) => f.status === "em_andamento").length;
  const concluidos = fila.filter((f) => f.status === "concluido").length;

  const filtrada = useMemo(() => {
    return fila
      .filter(
        (f) =>
          (cliente === "Todos" || f.cliente === cliente) &&
          (prioridade === "Todos" || ROTULO_PRIORIDADE[f.prioridade] === prioridade) &&
          (status === "Todos" || ROTULO_STATUS_FILA[f.status] === status)
      )
      .sort(
        (a, b) =>
          PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
          a.prazo.localeCompare(b.prazo)
      );
  }, [fila, cliente, prioridade, status]);

  async function mudarStatus(id: string, novo: "concluido" | "travado") {
    setBusy(true);
    try {
      await alterarStatusFila(id, novo);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fila de Otimização"
        description="Ordem de execução da equipe: os anúncios mais críticos primeiro. Cada item aponta a ação, o agente e o resultado esperado."
        count={fila.length}
        countLabel="itens na fila"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total na fila" value={fila.length} icon={ListFilter} tone="violet" />
        <StatCard label="Pendentes" value={pendentes} icon={Clock} tone="yellow" />
        <StatCard label="Em andamento" value={emAndamento} icon={PlayCircle} tone="blue" />
        <StatCard label="Concluídos" value={concluidos} icon={CheckCircle2} tone="green" />
      </div>

      <div className="flex flex-wrap gap-4">
        <FilterSelect label="Cliente" value={cliente} options={clientes} onChange={setCliente} />
        <FilterSelect label="Prioridade" value={prioridade} options={Object.values(ROTULO_PRIORIDADE)} onChange={setPrioridade} />
        <FilterSelect label="Status" value={status} options={Object.values(ROTULO_STATUS_FILA)} onChange={setStatus} />
      </div>

      <Table headers={HEADERS}>
        {filaData && filtrada.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Fila vazia. Envie anúncios pela Auditoria em Massa."
            acaoLabel="Ir para Auditoria em Massa"
            acaoHref="/auditoria-massa"
          />
        )}
        {filtrada.map((f) => (
          <tr key={f.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3 align-top">
              <Link href={`/auditoria-massa/${f.auditoriaId}`}>
                <p className="max-w-56 truncate font-medium text-zinc-200 hover:text-violet-300">
                  {f.tituloAnuncio ?? "Anúncio auditado"}
                </p>
              </Link>
            </td>
            <Td className="whitespace-nowrap">{f.cliente}</Td>
            <Td><Badge tone={TONE_PRIORIDADE[f.prioridade]}>{ROTULO_PRIORIDADE[f.prioridade]}</Badge></Td>
            <Td><Badge tone="gray">{ROTULO_TIPO_ACAO[f.tipoAcao]}</Badge></Td>
            <Td className="whitespace-nowrap text-xs text-zinc-300">{f.agenteResponsavel || "—"}</Td>
            <Td className="whitespace-nowrap">{f.responsavelHumano || "—"}</Td>
            <Td className="whitespace-nowrap">{formatDate(f.prazo)}</Td>
            <Td className="min-w-56 max-w-72 text-xs text-zinc-300">{f.resultadoEsperado}</Td>
            <Td><Badge>{ROTULO_STATUS_FILA[f.status]}</Badge></Td>
            <Td>
              <div className="flex gap-1.5">
                <Button
                  variant="success"
                  className="px-2 py-1 text-xs"
                  onClick={() => mudarStatus(f.id, "concluido")}
                  disabled={busy || f.status === "concluido"}
                >
                  <CheckCircle2 size={13} /> Concluir
                </Button>
                <Button
                  variant="danger"
                  className="px-2 py-1 text-xs"
                  onClick={() => mudarStatus(f.id, "travado")}
                  disabled={busy || f.status === "travado"}
                >
                  <Lock size={13} /> Travar
                </Button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
