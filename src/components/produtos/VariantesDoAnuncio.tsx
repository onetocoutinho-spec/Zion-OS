"use client";

import { useState } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/form";
import { STATUS_ENVIO_VARIANTE } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { resumoVariante } from "@/lib/variantes";
import { listarVariantesDoProduto } from "@/lib/services/produtoVariantes";
import {
  atualizarAnuncioVariante,
  desvincularVariante,
  listarVariantesDoAnuncio,
  vincularVarianteAoAnuncio,
} from "@/lib/services/anuncioVariantes";
import type { Anuncio, AnuncioVariante } from "@/lib/types";

const inputCls =
  "rounded border border-white/10 bg-[#12121c] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500";

export function VariantesDoAnuncio({ anuncio }: { anuncio: Anuncio }) {
  const { data: vinculadas, reload } = useLiveQuery(
    () => listarVariantesDoAnuncio(anuncio.id),
    [anuncio.id]
  );
  const { data: variantesProduto } = useLiveQuery(
    () => listarVariantesDoProduto(anuncio.produtoId),
    [anuncio.produtoId]
  );
  const [selecionada, setSelecionada] = useState("");

  const idsVinculados = new Set((vinculadas ?? []).map((v) => v.varianteId));
  const disponiveis = (variantesProduto ?? []).filter((v) => !idsVinculados.has(v.id));

  async function vincular() {
    const v = disponiveis.find((x) => x.id === selecionada);
    if (!v) return;
    await vincularVarianteAoAnuncio({
      anuncioId: anuncio.id,
      produtoId: anuncio.produtoId,
      varianteId: v.id,
      clienteId: anuncio.clienteId,
      skuEnviado: v.sku,
      precoEnviado: v.precoBase,
      estoqueEnviado: v.estoque,
      statusEnvio: "Não enviada",
      idVariacaoMarketplace: "",
      observacoes: "",
      varianteResumo: resumoVariante(v),
    });
    setSelecionada("");
    reload();
  }

  async function desvincular(av: AnuncioVariante) {
    if (!window.confirm(`Desvincular a variação "${av.varianteResumo}" deste anúncio?`)) return;
    await desvincularVariante(av.id);
    reload();
  }

  return (
    <div className="space-y-4">
      {/* Vincular nova */}
      <div className="flex flex-wrap items-end gap-2">
        <Select
          options={disponiveis.map((v) => `${resumoVariante(v)} · ${v.sku}`)}
          placeholder={
            (variantesProduto?.length ?? 0) === 0
              ? "Produto sem variações — cadastre na página do produto"
              : disponiveis.length === 0
                ? "Todas as variações já vinculadas"
                : "Selecione uma variação…"
          }
          value={selecionada ? `${resumoVariante(disponiveis.find((v) => v.id === selecionada)!)} · ${disponiveis.find((v) => v.id === selecionada)!.sku}` : ""}
          onChange={(e) => {
            const v = disponiveis.find((x) => `${resumoVariante(x)} · ${x.sku}` === e.target.value);
            setSelecionada(v?.id ?? "");
          }}
          className="!w-auto min-w-64"
        />
        <Button variant="ghost" onClick={vincular} disabled={!selecionada}>
          <Link2 size={14} /> Vincular ao anúncio
        </Button>
      </div>

      {vinculadas && vinculadas.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-semibold">Variação</th>
                <th className="px-3 py-2 font-semibold">SKU enviado</th>
                <th className="px-3 py-2 text-right font-semibold">Preço</th>
                <th className="px-3 py-2 text-right font-semibold">Estoque</th>
                <th className="px-3 py-2 font-semibold">ID no marketplace</th>
                <th className="px-3 py-2 font-semibold">Envio</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {vinculadas.map((av) => (
                <LinhaAnuncioVariante key={av.id} av={av} onExcluir={() => desvincular(av)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          compacto
          mensagem="Nenhuma variação vinculada a este anúncio. Selecione acima para enviar cada derivação ao marketplace."
        />
      )}
    </div>
  );
}

function LinhaAnuncioVariante({
  av,
  onExcluir,
}: {
  av: AnuncioVariante;
  onExcluir: () => void;
}) {
  const [preco, setPreco] = useState(String(av.precoEnviado));
  const [estoque, setEstoque] = useState(String(av.estoqueEnviado));
  const [idMkt, setIdMkt] = useState(av.idVariacaoMarketplace);
  const num = (s: string) => Number(s.replace(",", ".")) || 0;

  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="px-3 py-2 text-zinc-200">{av.varianteResumo}</td>
      <td className="px-3 py-2 font-mono text-xs text-zinc-400">{av.skuEnviado}</td>
      <td className="px-3 py-2 text-right">
        <input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)}
          onBlur={() => num(preco) !== av.precoEnviado && atualizarAnuncioVariante(av.id, { precoEnviado: num(preco) })}
          className={inputCls + " w-20 text-right"} />
      </td>
      <td className="px-3 py-2 text-right">
        <input inputMode="numeric" value={estoque} onChange={(e) => setEstoque(e.target.value)}
          onBlur={() => num(estoque) !== av.estoqueEnviado && atualizarAnuncioVariante(av.id, { estoqueEnviado: num(estoque) })}
          className={inputCls + " w-16 text-right"} />
      </td>
      <td className="px-3 py-2">
        <input value={idMkt} onChange={(e) => setIdMkt(e.target.value)}
          onBlur={() => idMkt !== av.idVariacaoMarketplace && atualizarAnuncioVariante(av.id, { idVariacaoMarketplace: idMkt })}
          className={inputCls + " w-28 font-mono"} placeholder="—" />
      </td>
      <td className="px-3 py-2">
        <select value={av.statusEnvio}
          onChange={(e) => atualizarAnuncioVariante(av.id, { statusEnvio: e.target.value as AnuncioVariante["statusEnvio"] })}
          className={inputCls + " cursor-pointer"}>
          {STATUS_ENVIO_VARIANTE.map((s) => (
            <option key={s} value={s} className="bg-[#12121c]">{s}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button onClick={onExcluir} title="Desvincular"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}
