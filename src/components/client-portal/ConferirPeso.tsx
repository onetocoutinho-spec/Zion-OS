"use client";

/**
 * A conferência do PESO — deliberadamente mais curta que a do custo.
 *
 * ===========================================================================
 * POR QUE NÃO TEM ESCOLHA DE COLUNA
 * ===========================================================================
 *
 * A conferência de custo existe porque coluna de custo é AMBÍGUA: "valor",
 * "preço", "ref" e "custo" convivem numa planilha real, e adivinhar já gravou
 * R$ 30.277.872,00 como custo de um chinelo.
 *
 * Peso é o oposto, por regra do domínio: ele só aceita "peso_kg" ou "peso_g" —
 * com a unidade no nome — e só casa por SKU ou EAN, nunca por nome. Se a
 * planilha chegou nesta tela, a detecção já foi inequívoca. Pedir para a
 * lojista confirmar uma escolha que não existe seria cerimônia, e cerimônia
 * ensina a clicar sem ler.
 *
 * ===========================================================================
 * O QUE ELA CONTINUA FAZENDO
 * ===========================================================================
 *
 * A outra metade da regra vale igual: LARGAR O ARQUIVO NÃO É AUTORIZAR. Nada é
 * gravado até o clique. E o que se mostra antes do clique é o que permite
 * perceber o engano — a unidade lida, por qual chave vai casar, e as primeiras
 * linhas com o texto CRU ao lado do valor interpretado.
 *
 * A unidade é o campo que mais importa: 800 em kg e 800 em g diferem por mil
 * vezes, e o erro sairia como preço de frete, não como aviso.
 */

import { useMemo } from "react";
import type { PlanilhaLida } from "@/lib/planilha";
import { detectarColunas } from "@/modules/catalog/domain/importacaoPeso";

const AMOSTRA = 8;

export function ConferirPeso({
  planilha,
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  planilha: PlanilhaLida;
  ocupado?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const deteccao = useMemo(() => detectarColunas(planilha.headers), [planilha.headers]);

  // Não deveria acontecer — o roteador só manda para cá o que já detectou. Mas
  // se acontecer, a mensagem do domínio é melhor que um cartão vazio.
  if (!deteccao.ok) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        {deteccao.mensagem}
      </div>
    );
  }

  const c = deteccao.colunas;
  const amostra = planilha.linhas.slice(0, AMOSTRA);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <p className="text-sm text-white/80">
        Isto é uma planilha de <strong>peso</strong>, com {planilha.linhas.length} linha(s).
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Casa por</dt>
          <dd className="text-white/80">{c.tipoChave.toUpperCase()} — {c.chave}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Peso</dt>
          {/* A UNIDADE EM DESTAQUE: 800 kg e 800 g diferem por mil vezes, e o
              erro sairia como preço de frete em vez de aviso. */}
          <dd className="text-white/80">
            {c.peso} <span className="text-amber-300">({c.unidade})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">Medidas</dt>
          <dd className="text-white/60">
            {[c.altura, c.largura, c.comprimento].filter(Boolean).length > 0
              ? [c.altura, c.largura, c.comprimento].filter(Boolean).join(", ")
              : "nenhuma"}
          </dd>
        </div>
      </dl>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-white/40">
              <th className="px-2 py-1 font-medium">LINHA</th>
              <th className="px-2 py-1 font-medium">{c.chave}</th>
              <th className="px-2 py-1 font-medium">PESO LIDO</th>
            </tr>
          </thead>
          <tbody>
            {amostra.map((row: Record<string, string>, i: number) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-2 py-1 text-white/40">{i + 2}</td>
                <td className="px-2 py-1 text-white/70">{row[c.chave] || "—"}</td>
                {/* TEXTO CRU ao lado do que foi entendido — é onde a coluna
                    trocada se denuncia, mesma razão da prévia de custos. */}
                <td className="px-2 py-1 text-white/80">
                  {row[c.peso] || "—"}{" "}
                  <span className="text-white/30">{row[c.peso] ? c.unidade : ""}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {planilha.linhas.length > AMOSTRA && (
          <p className="mt-1 text-xs text-white/40">
            …e mais {planilha.linhas.length - AMOSTRA} linha(s).
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onConfirmar}
          disabled={ocupado}
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15 disabled:opacity-50"
        >
          {ocupado ? "Gravando…" : "Confere, pode gravar"}
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
    </div>
  );
}
