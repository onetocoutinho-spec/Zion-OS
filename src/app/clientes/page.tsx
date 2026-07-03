"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { clientes } from "@/lib/data/clientes";
import { formatDate } from "@/lib/format";

const STATUS = ["Lead", "Em proposta", "Onboarding", "Ativo", "Em risco", "Pausado", "Cancelado"];
const RISCOS = ["Baixo", "Médio", "Alto"];

const HEADERS = [
  "Empresa",
  "Segmento",
  "Marketplaces",
  "Plano",
  "Status",
  "Risco",
  "Entrada",
  "Próxima reunião",
  "Próxima ação",
  "Observações",
];

export default function ClientesPage() {
  const [status, setStatus] = useState("Todos");
  const [risco, setRisco] = useState("Todos");

  const filtrados = clientes.filter(
    (c) =>
      (status === "Todos" || c.status === status) &&
      (risco === "Todos" || c.risco === risco)
  );

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Carteira completa da agência, do lead ao cliente ativo."
        count={filtrados.length}
        countLabel="clientes"
      />

      <div className="mb-4 flex flex-wrap gap-4">
        <FilterSelect label="Status" value={status} options={STATUS} onChange={setStatus} />
        <FilterSelect label="Risco" value={risco} options={RISCOS} onChange={setRisco} />
      </div>

      <Table headers={HEADERS}>
        {filtrados.length === 0 && <EmptyRow colSpan={HEADERS.length} />}
        {filtrados.map((c) => (
          <tr key={c.id} className="hover:bg-white/[0.02]">
            <TdMain sub={c.responsavel}>{c.empresa}</TdMain>
            <Td className="whitespace-nowrap">{c.segmento}</Td>
            <Td>
              <div className="flex max-w-45 flex-wrap gap-1">
                {c.marketplaces.length === 0 && <span className="text-zinc-600">—</span>}
                {c.marketplaces.map((m) => (
                  <Badge key={m} tone="gray">{m}</Badge>
                ))}
              </div>
            </Td>
            <Td className="whitespace-nowrap">{c.plano}</Td>
            <Td><Badge>{c.status}</Badge></Td>
            <Td><Badge>{c.risco}</Badge></Td>
            <Td className="whitespace-nowrap">{formatDate(c.dataEntrada)}</Td>
            <Td className="whitespace-nowrap">{formatDate(c.proximaReuniao)}</Td>
            <Td className="min-w-56 text-zinc-300">{c.proximaAcao}</Td>
            <Td className="min-w-56 text-xs">{c.observacoes || "—"}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
