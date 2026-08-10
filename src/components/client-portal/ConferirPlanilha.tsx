"use client";

// A conferência que faltava entre ler a planilha e gravar no banco.
//
// A importação de custos lia, adivinhava as colunas e escrevia. Numa planilha
// real isso gravou 87 "custos" que eram referências de modelo — um chinelo com
// R$ 30.277.872,00 de custo, marcado como confiança alta. A planilha tinha
// linhas com as colunas deslocadas, e ninguém teve chance de perceber.
//
// Cada cliente traz a planilha do ERP dele. Detectar melhor não resolve: a
// regra nova acerta a planilha de hoje e erra a de amanhã, do mesmo jeito
// silencioso. O que resolve é mostrar o que se entendeu e esperar um "sim".
//
// A prévia mostra o TEXTO CRU do custo ao lado do valor interpretado, porque é
// aí que a coluna trocada se denuncia: "3.505" ao lado de um preço de R$ 49,99
// salta aos olhos de quem conhece o próprio catálogo, e não saltaria nunca de
// dentro de um relatório de "1374 linhas processadas".

import { useMemo, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatBRLExato } from "@/lib/format";
import type { PlanilhaLida } from "@/lib/planilha";
import { alcancePorNome } from "@/lib/services/importacaoCustos";
import {
  colunaDoPapel,
  montarPrevia,
  NOME_DO_PAPEL,
  PAPEIS,
  podeImportar,
  sinaisDaPlanilha,
  sugerirMapeamento,
  type Mapeamento,
  type PapelColuna,
} from "@/modules/catalog/domain/mapeamentoPlanilha";

interface Props {
  planilha: PlanilhaLida;
  /**
   * Os nomes do catálogo — para dizer QUANTOS produtos cada linha atinge.
   *
   * Opcional: sem eles a conferência funciona como antes, só não avisa sobre
   * espalhamento. Melhor isso do que uma tela que não abre.
   */
  nomesDoCatalogo?: readonly string[];
  onCancelar: () => void;
  onConfirmar: (mapa: Mapeamento) => void;
  ocupado?: boolean;
}

export function ConferirPlanilha({
  planilha,
  nomesDoCatalogo,
  onCancelar,
  onConfirmar,
  ocupado,
}: Props) {
  const [mapa, setMapa] = useState<Mapeamento>(() => sugerirMapeamento(planilha.headers));

  const previa = useMemo(() => montarPrevia(planilha.linhas, mapa), [planilha.linhas, mapa]);

  /**
   * QUANTOS produtos cada linha atinge pelo nome.
   *
   * Uma linha que atinge dois produtos não é erro — pode ser o mesmo modelo em
   * duas cores, e espalhar é o que ela quer. Mas é decisão dela, e sem esta
   * coluna a decisão era tomada em silêncio pelo casamento de nomes.
   *
   * O caso medido: "Babuche Yvate FEMININA Eva 1816" atingiu também o
   * MASCULINO. Os dois tinham o mesmo custo e ninguém percebeu.
   */
  const alcance = useMemo(
    () => alcancePorNome(planilha.linhas, colunaDoPapel(mapa, "nome") ?? null, nomesDoCatalogo ?? []),
    [planilha.linhas, mapa, nomesDoCatalogo]
  );
  const linhasQueEspalham = alcance.size;
  const alertas = useMemo(() => sinaisDaPlanilha(planilha.linhas, mapa), [planilha.linhas, mapa]);
  const liberado = podeImportar(alertas);

  function trocar(header: string, papel: PapelColuna) {
    setMapa((m) => {
      // Um papel pertence a uma coluna só. Trocar libera a anterior em vez de
      // deixar duas colunas disputando "custo" — que é como se erra caro.
      const novo: Mapeamento = { ...m };
      if (papel !== "ignorar") {
        for (const h of Object.keys(novo)) if (novo[h] === papel) novo[h] = "ignorar";
      }
      novo[header] = papel;
      return novo;
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div>
        <h3 className="text-sm font-semibold">Confira antes de gravar</h3>
        <p className="mt-1 text-xs text-white/50">
          {planilha.linhas.length} linha(s). Diga o que é cada coluna — o Zion sugeriu, mas quem
          conhece a planilha é você.
        </p>
      </div>

      {/* ── As colunas e seus papéis ────────────────────────────────────── */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {planilha.headers.map((h) => (
          <label key={h} className="flex flex-col gap-1">
            <span className="truncate text-xs text-white/60" title={h}>
              {h || "(coluna sem nome)"}
            </span>
            <select
              value={mapa[h] ?? "ignorar"}
              onChange={(e) => trocar(h, e.target.value as PapelColuna)}
              disabled={ocupado}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-violet-500"
            >
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {NOME_DO_PAPEL[p]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {/* ── O que a planilha denuncia sobre si mesma ────────────────────── */}
      {alertas.map((a) => (
        <p
          key={a.tipo}
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            a.grave
              ? "border-red-500/25 bg-red-500/10 text-red-300"
              : "border-amber-500/20 bg-amber-500/5 text-amber-300"
          }`}
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {a.mensagem}
        </p>
      ))}

      {/* ── As primeiras linhas, como o sistema as leria ────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-3 py-2 font-medium">Linha</th>
              <th className="px-3 py-2 font-medium">Identificação</th>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Atinge</th>
              <th className="px-3 py-2 font-medium">Custo lido</th>
              <th className="px-3 py-2 font-medium">Preço de venda</th>
            </tr>
          </thead>
          <tbody>
            {previa.map((l) => (
              <tr key={l.numero} className="border-t border-white/5">
                <td className="px-3 py-2 text-white/40">{l.numero}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-white/70">{l.chave || "—"}</td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-white/70" title={l.nome}>
                  {l.nome || "—"}
                </td>
                <td className="px-3 py-2">
                  {(() => {
                    const atinge = alcance.get(l.numero - 2);
                    if (!atinge) return <span className="text-white/30">1 produto</span>;
                    return (
                      <span
                        className="text-amber-300"
                        title={atinge.join(", ")}
                      >
                        {atinge.length} produtos
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2">
                  {l.custo === null ? (
                    <span className="text-white/30">—</span>
                  ) : (
                    <>
                      <span className="font-medium">{formatBRLExato(l.custo)}</span>
                      {/* O cru ao lado do interpretado: é a diferença entre os
                          dois que revela a coluna trocada. */}
                      <span className="ml-1.5 text-xs text-white/35">({l.custoCru.trim()})</span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-white/70">
                  {l.precoVenda === null ? "—" : formatBRLExato(l.precoVenda)}
                </td>
              </tr>
            ))}
            {previa.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-white/40">
                  A planilha não tem linhas de dados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onConfirmar(mapa)} disabled={!liberado || ocupado}>
          <Check size={15} /> {ocupado ? "Gravando…" : "Está certo, pode gravar"}
        </Button>
        <Button variant="ghost" onClick={onCancelar} disabled={ocupado}>
          <X size={15} /> Cancelar
        </Button>
        {!liberado && (
          <span className="text-xs text-red-300">
            Resolva o que está em vermelho — gravar assim escreveria dado errado na sua base.
          </span>
        )}
      </div>
    </div>
  );
}
