"use client";

/**
 * A conferência do CATÁLOGO — a única importação que CRIA.
 *
 * ===========================================================================
 * POR QUE ESTA TELA DIZ O VERBO
 * ===========================================================================
 *
 * Custo e peso ATUALIZAM linhas que já existem: errar escreve um número errado
 * num produto que já era dela. Catálogo CRIA: errar não escreve número errado,
 * escreve produtos duplicados — e desfazer isso é trabalho manual, produto a
 * produto.
 *
 * Por isso a frase de cima diz "vai CRIAR N produtos", não "vai importar N
 * linhas". Importar é o que o software faz; criar é o que acontece com a base
 * dela, e é isso que ela precisa ler antes de clicar.
 *
 * ===========================================================================
 * AS COLUNAS IGNORADAS SÃO MOSTRADAS, E ISSO NÃO É DETALHE
 * ===========================================================================
 *
 * `analisarProdutosCsv` reconhece por apelido e ignora o resto em silêncio. Uma
 * planilha do ERP com "vlr_custo" em vez de "custo" importa cinquenta produtos
 * SEM CUSTO NENHUM, e o relatório diria "50 produtos criados" — sucesso
 * completo, aparentemente.
 *
 * A coluna ignorada é o único lugar onde esse silêncio aparece antes de virar
 * base.
 */

import type { AnaliseProdutos } from "@/lib/services/importacaoProdutos";

const AMOSTRA = 6;

export function ConferirCatalogo({
  analise,
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  analise: AnaliseProdutos;
  ocupado?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const impede = analise.faltandoObrigatorias.length > 0 || !!analise.erro;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      {/* O VERBO, e o número, antes de qualquer outra coisa. */}
      <p className="text-sm text-white/80">
        Isto vai <strong className="text-amber-300">criar {analise.total} produto(s)</strong>
        {analise.modo === "agrupado" && ` e ${analise.totalVariacoes} variação(ões)`} na sua base.
      </p>
      <p className="mt-1 text-xs text-white/50">
        Produto novo, não atualização dos que você já tem. Se a intenção era corrigir custo ou peso
        do que já existe, descarte e mande a planilha só com aquela coluna.
      </p>

      {analise.erro && (
        <p className="mt-3 rounded border border-rose-500/30 bg-rose-500/5 p-2 text-sm text-rose-200">
          {analise.erro}
        </p>
      )}

      {analise.faltandoObrigatorias.length > 0 && (
        <p className="mt-3 rounded border border-rose-500/30 bg-rose-500/5 p-2 text-sm text-rose-200">
          Falta a coluna obrigatória: {analise.faltandoObrigatorias.join(", ")}. Sem ela não dá para
          saber o que criar.
        </p>
      )}

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Colunas que entram</dt>
          <dd className="text-white/70">{analise.colunasReconhecidas.join(", ") || "nenhuma"}</dd>
        </div>
        <div>
          {/* IGNORADAS EM ÂMBAR: é onde "vlr_custo" em vez de "custo" aparece
              antes de virar cinquenta produtos sem custo. */}
          <dt className="text-xs uppercase tracking-wide text-white/40">Colunas ignoradas</dt>
          <dd className={analise.colunasIgnoradas.length > 0 ? "text-amber-300" : "text-white/40"}>
            {analise.colunasIgnoradas.join(", ") || "nenhuma"}
          </dd>
        </div>
      </dl>

      {analise.colunasIgnoradas.length > 0 && (
        <p className="mt-2 text-xs text-white/50">
          O que está em âmbar não vai entrar. Se alguma delas era importante, renomeie na planilha e
          mande de novo — nada foi gravado ainda.
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-white/40">
              <th className="px-2 py-1 font-medium">NOME</th>
              <th className="px-2 py-1 font-medium">SKU</th>
              <th className="px-2 py-1 font-medium">CUSTO</th>
              <th className="px-2 py-1 font-medium">PREÇO</th>
            </tr>
          </thead>
          <tbody>
            {analise.amostra.slice(0, AMOSTRA).map((l, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-2 py-1 text-white/80">{l.base.nome || "—"}</td>
                <td className="px-2 py-1 text-white/60">{l.base.sku || l.base.codErp || "—"}</td>
                <td className="px-2 py-1 text-white/60">{l.base.custo ?? "—"}</td>
                <td className="px-2 py-1 text-white/60">{l.base.precoVenda ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {analise.total > AMOSTRA && (
          <p className="mt-1 text-xs text-white/40">…e mais {analise.total - AMOSTRA} produto(s).</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onConfirmar}
          disabled={ocupado || impede}
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15 disabled:opacity-50"
        >
          {ocupado ? "Criando…" : `Criar ${analise.total} produto(s)`}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={ocupado}
          className="rounded-md px-3 py-1.5 text-sm text-white/60 hover:text-white disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
      {impede && (
        <p className="mt-2 text-xs text-rose-300">
          Resolva o que está em vermelho — criar assim deixaria produtos incompletos na sua base.
        </p>
      )}
    </div>
  );
}
