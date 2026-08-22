"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Plug } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { CLIENTE_STATUS, RISCOS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { lojasConectadas } from "@/lib/services/canaisMarketplace";
import { formatDate } from "@/lib/format";

const HEADERS = [
  "Loja",
  "Segmento",
  "Marketplaces",
  "Mercado Livre",
  "Plano",
  "Situação",
  "Risco",
  "Entrada",
  "Próxima reunião",
  "Próxima ação",
];

export default function ClientesPage() {
  const [status, setStatus] = useState("Todos");
  const [risco, setRisco] = useState("Todos");
  const { data: clientes } = useLiveQuery(listarClientes);
  // Uma consulta para a lista inteira: o RLS ja limita ao que quem pergunta
  // alcanca, entao equipe recebe todas e agencia recebe as dela.
  const { data: conectadasData } = useLiveQuery(() => lojasConectadas());
  const conectadas = conectadasData ?? new Set<string>();

  const filtrados = (clientes ?? []).filter(
    (c) =>
      (status === "Todos" || c.status === status) &&
      (risco === "Todos" || c.risco === risco)
  );

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Carteira completa da agência, do lead ao cliente ativo. Clique em um cliente para abrir a visão 360°."
        count={filtrados.length}
        countLabel="clientes"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Status" value={status} options={CLIENTE_STATUS} onChange={setStatus} />
          <FilterSelect label="Risco" value={risco} options={RISCOS} onChange={setRisco} />
        </div>
        <LinkButton href="/clientes/novo">
          <Plus size={14} /> Novo cliente
        </LinkButton>
      </div>

      <Table headers={HEADERS}>
        {clientes && filtrados.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Nenhum cliente encontrado."
            acaoLabel="Criar cliente"
            acaoHref="/clientes/novo"
          />
        )}
        {filtrados.map((c) => (
          <tr key={c.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3 align-top">
              <Link href={`/clientes/${c.id}`}>
                <p className="whitespace-nowrap font-medium text-zinc-200 hover:text-violet-300">
                  {c.empresa}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{c.responsavel}</p>
              </Link>
            </td>
            <Td className="whitespace-nowrap">{c.segmento}</Td>
            <Td>
              <div className="flex max-w-45 flex-wrap gap-1">
                {c.marketplaces.length === 0 && <span className="text-zinc-600">—</span>}
                {c.marketplaces.map((m) => (
                  <Badge key={m} tone="gray">{m}</Badge>
                ))}
              </div>
            </Td>
            {/* A PERGUNTA DA MANHÃ DE UMA AGÊNCIA: quais lojas ainda faltam
                conectar. Ela estava respondível só entrando loja por loja.
                O botão leva à aterrissagem do OAuth com a loja no endereço —
                que não é autoridade: o servidor só cria o ticket se quem
                clicou operar aquela loja, e recusa com 403 se não. */}
            <Td>
              {conectadas.has(c.id) ? (
                <Badge tone="green">Conectado</Badge>
              ) : (
                <Link
                  href={`/cliente/conectar-ml?cliente=${c.id}`}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
                >
                  <Plug size={12} /> Conectar
                </Link>
              )}
            </Td>
            <Td className="whitespace-nowrap">{c.plano}</Td>
            <Td><Badge>{c.status}</Badge></Td>
            <Td><Badge>{c.risco}</Badge></Td>
            <Td className="whitespace-nowrap">{formatDate(c.dataEntrada)}</Td>
            <Td className="whitespace-nowrap">{formatDate(c.proximaReuniao)}</Td>
            <Td className="min-w-56 text-zinc-300">{c.proximaAcao}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
