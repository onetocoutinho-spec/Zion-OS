"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  XCircle,
  Clock,
  CheckCircle2,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLiveQuery } from "@/lib/hooks";
import { formatDateTime } from "@/lib/format";
import {
  listarAnunciosGerados,
  aprovarAnuncioGerado,
  rejeitarAnuncioGerado,
  ROTULO_STATUS_ANUNCIO_GERADO,
} from "@/lib/services/anunciosGerados";

const HEADERS = [
  "Anúncio gerado",
  "Nota",
  "A10",
  "Pend.",
  "Origem",
  "Tipo",
  "Status",
  "Criado",
  "",
];

export default function AprovacoesPage() {
  const [cliente, setCliente] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [busy, setBusy] = useState(false);

  const { data } = useLiveQuery(listarAnunciosGerados);
  const registros = data ?? [];

  const clientes = useMemo(() => [...new Set(registros.map((r) => r.cliente))], [registros]);

  const aguardando = registros.filter((r) => r.status === "aguardando_aprovacao").length;
  const rascunhos = registros.filter((r) => r.status === "rascunho").length;
  const aprovadosN = registros.filter((r) => r.status === "aprovado").length;
  const publicados = registros.filter((r) => r.status === "publicado").length;

  const filtrados = registros.filter(
    (r) =>
      (cliente === "Todos" || r.cliente === cliente) &&
      (status === "Todos" || ROTULO_STATUS_ANUNCIO_GERADO[r.status] === status)
  );

  async function aprovar(id: string) {
    setBusy(true);
    try {
      await aprovarAnuncioGerado(id);
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar(id: string) {
    setBusy(true);
    try {
      await rejeitarAnuncioGerado(id, "Rejeitado na revisão da equipe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/esteira" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> Esteira de Anúncio
        </Link>
        <PageHeader
          title="Aprovações"
          description="Tudo que a esteira produz fica salvo aqui com status. A trava: só aprova quem passou no A10 sem pendências. Os aprovados são a fila que a publicação (Fase 2) consome."
          count={registros.length}
          countLabel="anúncios gerados"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aguardando aprovação" value={aguardando} icon={Clock} tone="yellow" hint="Passaram no A10 — revisar e aprovar" />
        <StatCard label="Rascunhos" value={rascunhos} icon={ShieldCheck} tone="gray" hint="Com pendências ou A10 reprovado" />
        <StatCard label="Aprovados" value={aprovadosN} icon={CheckCircle2} tone="green" hint="Prontos para publicar (Fase 2)" />
        <StatCard label="Publicados" value={publicados} icon={Send} tone="violet" hint="Já enviados ao marketplace" />
      </div>

      <div className="flex flex-wrap gap-4">
        <FilterSelect label="Cliente" value={cliente} options={clientes} onChange={setCliente} />
        <FilterSelect
          label="Status"
          value={status}
          options={Object.values(ROTULO_STATUS_ANUNCIO_GERADO)}
          onChange={setStatus}
        />
      </div>

      <Table headers={HEADERS}>
        {data && filtrados.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Nada por aqui ainda. Rode a esteira (com um cliente selecionado) para popular a fila."
            acaoLabel="Ir para a Esteira"
            acaoHref="/esteira"
          />
        )}
        {filtrados.map((r) => {
          const passouA10 = r.vereditoA10 === "aprovado" && r.qtdPendencias === 0;
          const podeAprovar =
            passouA10 && (r.status === "aguardando_aprovacao" || r.status === "rascunho");
          const podeRejeitar = r.status !== "rejeitado" && r.status !== "publicado";
          return (
            <tr key={r.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 align-top">
                <p className="max-w-72 truncate font-medium text-zinc-200">
                  {r.anuncio?.tituloOtimizado || "(sem título)"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {r.cliente}
                  {r.produto ? ` · ${r.produto}` : ""} · {r.marketplace}
                </p>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-violet-400 hover:text-violet-300">
                    ver detalhes
                  </summary>
                  <div className="mt-1.5 max-w-xl space-y-1 rounded-lg bg-black/20 p-2.5 text-xs text-zinc-400">
                    <p className="whitespace-pre-wrap">{r.anuncio?.descricaoCurta || "—"}</p>
                    {r.anuncio?.pendencias?.length > 0 && (
                      <ul className="ml-4 list-disc text-amber-400">
                        {r.anuncio.pendencias.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    )}
                    {r.aprovadoEm && (
                      <p className="text-zinc-500">
                        Aprovado em {formatDateTime(r.aprovadoEm)}
                        {r.aprovadoPor ? ` por ${r.aprovadoPor}` : ""}
                      </p>
                    )}
                  </div>
                </details>
              </td>
              <Td>
                <Badge tone={r.notaDiagnostico >= 75 ? "green" : r.notaDiagnostico >= 55 ? "yellow" : "red"}>
                  {`${r.notaDiagnostico}`}
                </Badge>
              </Td>
              <Td>
                <Badge tone={r.vereditoA10 === "aprovado" ? "green" : "red"}>
                  {r.vereditoA10 === "aprovado" ? "OK" : "Reprovado"}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-zinc-300">{r.qtdPendencias}</Td>
              <Td>
                <Badge tone="gray">{r.origem === "esteira_lote" ? "Lote" : "Esteira"}</Badge>
              </Td>
              <Td><Badge>{r.tipoExecucao}</Badge></Td>
              <Td><Badge>{ROTULO_STATUS_ANUNCIO_GERADO[r.status]}</Badge></Td>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(r.criadoEm)}</Td>
              <Td>
                <div className="flex gap-1.5">
                  <Button
                    variant="success"
                    className="px-2 py-1 text-xs"
                    onClick={() => aprovar(r.id)}
                    disabled={busy || !podeAprovar}
                    title={podeAprovar ? "Aprovar para publicação" : "Trava: A10 + zero pendências"}
                  >
                    <ShieldCheck size={13} /> Aprovar
                  </Button>
                  <Button
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    onClick={() => rejeitar(r.id)}
                    disabled={busy || !podeRejeitar}
                  >
                    <XCircle size={13} /> Rejeitar
                  </Button>
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}