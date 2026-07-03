// Primitivas de tabela com o estilo padrão do Zion OS.
// Uso: <Table headers={["Cliente", "Status"]}><tr>...<Td>...</Td></tr></Table>

import { EmptyState } from "./EmptyState";

interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0e0e16]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/5">
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-top text-zinc-400 ${className}`}>
      {children}
    </td>
  );
}

/** Célula de destaque (primeira coluna, nome do registro). */
export function TdMain({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <td className="px-4 py-3 align-top">
      <p className="font-medium text-zinc-200 whitespace-nowrap">{children}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </td>
  );
}

interface EmptyRowProps {
  colSpan: number;
  mensagem?: string;
  acaoLabel?: string;
  acaoHref?: string;
}

export function EmptyRow({
  colSpan,
  mensagem = "Nenhum registro encontrado com os filtros atuais.",
  acaoLabel,
  acaoHref,
}: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState mensagem={mensagem} acaoLabel={acaoLabel} acaoHref={acaoHref} />
      </td>
    </tr>
  );
}
