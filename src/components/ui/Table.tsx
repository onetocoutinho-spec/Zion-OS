// Primitivas de tabela com o estilo padrão do Zion OS.
// Uso: <Table headers={["Cliente", "Status"]}><tr>...<Td>...</Td></tr></Table>

import { Children, cloneElement, isValidElement, type ReactElement } from "react";

import { EmptyState } from "./EmptyState";

interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

/**
 * Põe em cada `<td>` o nome da coluna a que ele pertence.
 *
 * NO CELULAR A TABELA VIRA CARTÃO (ver `globals.css`), e num cartão o valor
 * precisa carregar o próprio rótulo — senão a lojista lê "40/100" sem saber que
 * aquilo é o score. O rótulo vem dos MESMOS `headers` que o cabeçalho usa: duas
 * listas para a mesma coisa envelheceriam em direções diferentes, e foi assim
 * que a página de um produto já apareceu ao lado de outro neste projeto.
 *
 * A primeira coluna é marcada como IDENTIDADE. Ela é o título do cartão, sem
 * rótulo e em largura inteira — é justamente ela que a rolagem horizontal
 * escondia, deixando a lojista a um toque de "Otimizar" sem saber em qual
 * produto.
 *
 * Só mexe em `<td>` DIRETO de `<tr>`: célula com `colSpan` (o estado vazio) não
 * é par rótulo/valor e passa intacta.
 */
function comRotulos(children: React.ReactNode, headers: string[]): React.ReactNode {
  return Children.map(children, (linha) => {
    if (!isValidElement(linha)) return linha;
    const props = linha.props as { children?: React.ReactNode };
    if (props.children === undefined) return linha;
    let coluna = 0;
    const celulas = Children.map(props.children, (celula) => {
      if (!isValidElement(celula)) return celula;
      const cp = celula.props as { colSpan?: number };
      if (cp.colSpan) return celula;
      const indice = coluna++;
      return cloneElement(celula as ReactElement<Record<string, unknown>>, {
        "data-rotulo": headers[indice] ?? "",
        ...(indice === 0 ? { "data-identidade": "" } : {}),
      });
    });
    return cloneElement(linha as ReactElement<Record<string, unknown>>, { children: celulas });
  });
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className="tabela-cartao rounded-xl border border-white/5 bg-[#0e0e16] sm:overflow-x-auto">
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
        <tbody className="divide-y divide-white/[0.04] max-sm:divide-y-0">
          {comRotulos(children, headers)}
        </tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  className = "",
  ...resto
}: {
  children: React.ReactNode;
  className?: string;
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  // `...resto` existe para os `data-rotulo`/`data-identidade` que `Table`
  // injeta. Sem ele o clone acontece e o atributo morre no caminho — a tabela
  // viraria cartão com todos os valores sem nome, que é pior que a tabela
  // rolando.
  return (
    <td {...resto} className={`px-4 py-3 align-top text-zinc-400 ${className}`}>
      {children}
    </td>
  );
}

/** Célula de destaque (primeira coluna, nome do registro). */
export function TdMain({
  children,
  sub,
  ...resto
}: {
  children: React.ReactNode;
  sub?: string;
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  // SEM `whitespace-nowrap`, e é o ponto desta célula.
  //
  // Ela guarda o NOME do registro, e nomes de produto são longos — "Chinelo
  // Ortopedico Modare Feminino Esporao Massageador Macio". Proibindo a quebra,
  // esta coluna passava a ter a largura do nome mais comprido da lista inteira,
  // empurrava a tabela além da tela e nascia a barra de rolagem horizontal.
  //
  // Nas telas de 7 colunas isso escondia as três últimas — inclusive a de AÇÃO,
  // que é onde a pessoa clica. Uma tabela que esconde o botão é pior que uma
  // tabela com o nome em duas linhas.
  return (
    <td {...resto} className="px-4 py-3 align-top">
      <p className="font-medium text-zinc-200">{children}</p>
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
