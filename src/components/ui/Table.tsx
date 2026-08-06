// Primitivas de tabela com o estilo padrão do Zion OS.
// Uso: <Table headers={["Cliente", "Status"]}><tr>...<Td>...</Td></tr></Table>

import { EmptyState } from "./EmptyState";
import { largurasDaLinhaDaTabela, linhasParaMostrar } from "./geometriaDoSkeleton";

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  /**
   * A busca ainda não voltou.
   *
   * ===========================================================================
   * O DEFEITO QUE ESTA PROP EXISTE PARA MATAR
   * ===========================================================================
   *
   * `useLiveQuery` devolve `data: null` enquanto carrega, e as telas escrevem
   * `(anuncios ?? [])`. Enquanto a busca está no ar, a tabela recebe uma lista
   * VAZIA e desenha o estado vazio: **"Nenhum registro encontrado com os
   * filtros atuais."**
   *
   * Isso não é um espaço em branco — é uma AFIRMAÇÃO, e ela é falsa. A lojista
   * com 400 anúncios lê que não tem nenhum, e a frase ainda culpa os filtros
   * dela. Medido em 13 das 17 telas do portal.
   *
   * "Não sei ainda" e "não há" são estados diferentes e precisam de desenhos
   * diferentes. O esqueleto diz o primeiro.
   */
  carregando?: boolean;
}

export function Table({ headers, children, carregando = false }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0e0e16]">
      {/* `aria-busy`: as linhas fantasma são `aria-hidden` (leitor de tela não
          lê cinco linhas vazias), e sem este sinal a tabela pareceria vazia na
          leitura — a mesma mentira, só que em voz alta.

          `data-cartao` + as variáveis: abaixo de 640px o CSS (globals.css)
          desmonta a tabela em cartões e usa `--col-N` como rótulo de cada
          célula. O rótulo é o PRÓPRIO `headers` — não há como divergir. */}
      <table
        className="w-full text-left text-sm"
        aria-busy={carregando || undefined}
        data-cartao=""
        style={rotulosDasColunas(headers)}
      >
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
        <tbody className="divide-y divide-white/[0.04]">
          {carregando ? <LinhasFantasma colunas={headers.length} /> : children}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Publica os cabeçalhos como variáveis CSS, para o modo cartão lê-los.
 *
 * `JSON.stringify` e não aspas à mão: `content` em CSS exige a string entre
 * aspas, e um cabeçalho com aspas dentro (ou uma barra invertida) quebraria a
 * declaração inteira em silêncio — a célula perderia o rótulo e ninguém saberia
 * por quê. O `JSON.stringify` escapa isso pela mesma regra que o CSS usa.
 */
function rotulosDasColunas(headers: string[]): React.CSSProperties {
  return Object.fromEntries(
    headers.map((h, i) => [`--col-${i + 1}`, JSON.stringify(h)])
  ) as React.CSSProperties;
}

/**
 * As linhas cinza do carregamento.
 *
 * Vive aqui e não no `Skeleton.tsx` por uma razão de HTML: aquele componente
 * desenha com `<div>`, e um `<div>` dentro de `<tbody>` é markup inválido — o
 * navegador o EXPULSA para fora da tabela, e o esqueleto aparece flutuando
 * acima dela. As proporções, essas sim, vêm de lá (`geometriaDoSkeleton`, com
 * teste): é a mesma geometria, pintada em `<tr>`/`<td>`.
 */
function LinhasFantasma({ colunas }: { colunas: number }) {
  const larguras = largurasDaLinhaDaTabela(colunas);
  return (
    <>
      {Array.from({ length: linhasParaMostrar() }, (_, linha) => (
        <tr key={linha} aria-hidden="true" data-fantasma="">
          {larguras.map((largura, coluna) => (
            <td key={coluna} className="px-4 py-3" style={{ width: `${largura}%` }}>
              <div
                className="h-3 rounded bg-white/[0.06] motion-safe:animate-pulse"
                style={{ width: coluna === 0 ? "88%" : "54%" }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
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
    <td className="px-4 py-3 align-top">
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
