// Primitivas de tabela com o estilo padrão do Zion OS.
// Uso: <Table headers={["Cliente", "Status"]}><tr>...<Td>...</Td></tr></Table>

import { Children, cloneElement, isValidElement, type ReactElement } from "react";

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
  /**
   * A caixa mestre — presente só nas tabelas que agem em lote.
   *
   * A <Table> desenha o CABEÇALHO da coluna de seleção; a célula de cada linha
   * é do chamador (`<TdSelecao>`), porque só ele sabe o id da linha.
   */
  marcaMestre?: {
    estado: "nenhum" | "parcial" | "todos";
    aoAlternar: () => void;
    rotulo: string;
  };
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
      // A CAIXA DE MARCAÇÃO NÃO CONTA COMO COLUNA.
      //
      // Este contador casa cada célula com `headers[indice]`, e a coluna de
      // seleção não está no `headers` — ela é desenhada pela própria <Table>.
      // Sem esta saída ela consome `headers[0]` e TODO o resto anda uma casa:
      // medido a 375px, o nome do produto apareceu rotulado "FALTA", o estoque
      // como "PREÇO", e assim por diante. Errado em silêncio, e só no celular.
      //
      // A COMPARAÇÃO É POR TIPO, e a primeira versão disto errou: eu testava
      // `props["data-selecao"]`, mas `TdSelecao` é um COMPONENTE — o atributo
      // só existe no `<td>` que ele renderiza, nunca nas props do elemento que
      // chega aqui. O `colSpan` acima funciona porque é passado como prop de
      // verdade; o meu marcador não era.
      if (celula.type === TdSelecao) return celula;
      const indice = coluna++;
      return cloneElement(celula as ReactElement<Record<string, unknown>>, {
        "data-rotulo": headers[indice] ?? "",
        ...(indice === 0 ? { "data-identidade": "" } : {}),
      });
    });
    return cloneElement(linha as ReactElement<Record<string, unknown>>, { children: celulas });
  });
}

export function Table({ headers, children, carregando = false, marcaMestre }: TableProps) {
  return (
    <div className="tabela-cartao rounded-xl border border-white/5 bg-surface-raised sm:overflow-x-auto">
      {/* `aria-busy`: as linhas fantasma são `aria-hidden` (o leitor de tela não
          lê cinco linhas vazias), e sem este sinal a tabela pareceria vazia na
          leitura — a mesma mentira, só que em voz alta. */}
      <table className="w-full text-left text-sm" aria-busy={carregando || undefined}>
        <thead>
          <tr className="border-b border-white/5">
            {marcaMestre && (
              <th scope="col" className="w-10 px-4 py-3">
                <CaixaDeMarca
                  marcado={marcaMestre.estado === "todos"}
                  parcial={marcaMestre.estado === "parcial"}
                  aoAlternar={marcaMestre.aoAlternar}
                  rotulo={marcaMestre.rotulo}
                />
              </th>
            )}
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
          {carregando ? (
            <LinhasFantasma colunas={headers.length + (marcaMestre ? 1 : 0)} />
          ) : (
            comRotulos(children, headers)
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A caixa de marcação, com aparência própria.
 *
 * `appearance-none` e não o checkbox do sistema: o nativo pinta um quadrado
 * branco de sistema operacional dentro de uma tabela escura, e o `accent-color`
 * resolve só o preenchimento — a borda continua clara.
 *
 * `indeterminate` não é atributo de HTML, é propriedade do elemento: só dá para
 * ligar por referência. Sem ela, "meio marcado" apareceria como "desmarcado" e
 * a caixa mestre mentiria sobre o estado da lista.
 */
function CaixaDeMarca({
  marcado,
  parcial = false,
  aoAlternar,
  rotulo,
}: {
  marcado: boolean;
  parcial?: boolean;
  aoAlternar: () => void;
  rotulo: string;
}) {
  return (
    <input
      type="checkbox"
      checked={marcado}
      ref={(el) => {
        if (el) el.indeterminate = parcial;
      }}
      onChange={aoAlternar}
      aria-label={rotulo}
      title={rotulo}
      className="size-4 cursor-pointer appearance-none rounded border border-white/25 bg-white/[0.04] transition-colors checked:border-violet-500 checked:bg-violet-500 indeterminate:border-violet-500 indeterminate:bg-violet-500/40 hover:border-white/45"
    />
  );
}

/**
 * A célula de marcação de uma linha.
 *
 * `data-selecao` não é enfeite: é por ele que `comRotulos` sabe que esta célula
 * NÃO consome uma posição do `headers` — senão todo rótulo do modo cartão
 * andaria uma casa.
 */
export function TdSelecao({
  marcado,
  aoAlternar,
  rotulo,
}: {
  marcado: boolean;
  aoAlternar: () => void;
  rotulo: string;
}) {
  return (
    <td className="px-4 py-3 align-top" data-selecao="">
      <CaixaDeMarca marcado={marcado} aoAlternar={aoAlternar} rotulo={rotulo} />
    </td>
  );
}

/**
 * As linhas cinza do carregamento.
 *
 * Vive aqui e não no `Skeleton.tsx` por uma razão de HTML: aquele componente
 * desenha com `<div>`, e um `<div>` dentro de `<tbody>` é markup inválido — o
 * navegador o EXPULSA para fora da tabela, e o esqueleto aparece flutuando
 * acima dela. As proporções, essas sim, vêm de lá (`geometriaDoSkeleton`, com
 * teste): é a mesma geometria, pintada em `<tr>`/`<td>`.
 *
 * Não passa por `comRotulos` de propósito: as linhas são `aria-hidden` e não
 * têm valor nenhum, então rótulo de coluna aqui seria enfeite invisível.
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
