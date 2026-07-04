"use client";

import { useMemo, useState } from "react";
import { Calculator, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, FormGrid, Input, Select } from "@/components/ui/form";
import { MARKETPLACES } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { formatBRL } from "@/lib/format";
import { calcularPrecificacao, resumoVariante } from "@/lib/variantes";
import { listarVariantesDoProduto } from "@/lib/services/produtoVariantes";
import {
  criarPrecificacao,
  listarPrecificacoesDoProduto,
} from "@/lib/services/precificacaoVariantes";
import type { Produto } from "@/lib/types";

export function AbaPrecificacao({ produto }: { produto: Produto }) {
  const { data: precificacoes } = useLiveQuery(
    () => listarPrecificacoesDoProduto(produto.id),
    [produto.id]
  );
  const { data: variantes } = useLiveQuery(
    () => listarVariantesDoProduto(produto.id),
    [produto.id]
  );

  const [varianteId, setVarianteId] = useState("");
  const [marketplace, setMarketplace] = useState<Produto["marketplace"]>(produto.marketplace);
  const [f, setF] = useState({
    precoVenda: "",
    custoProduto: String(produto.custo || 0),
    embalagem: "3",
    impostoPercentual: "8",
    taxaMarketplacePercentual: "16",
    taxaFixa: "6",
    comissaoGestorPercentual: "0",
    outrosCustos: "0",
  });
  const [salvando, setSalvando] = useState(false);

  const num = (s: string) => Number(s.replace(",", ".")) || 0;
  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((cur) => ({ ...cur, [k]: v }));
  }

  const calc = useMemo(
    () =>
      calcularPrecificacao({
        precoVenda: num(f.precoVenda),
        custoProduto: num(f.custoProduto),
        embalagem: num(f.embalagem),
        impostoPercentual: num(f.impostoPercentual),
        taxaMarketplacePercentual: num(f.taxaMarketplacePercentual),
        taxaFixa: num(f.taxaFixa),
        comissaoGestorPercentual: num(f.comissaoGestorPercentual),
        outrosCustos: num(f.outrosCustos),
      }),
    [f]
  );

  const varianteSel = (variantes ?? []).find((v) => v.id === varianteId);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!varianteId || num(f.precoVenda) <= 0 || salvando) return;
    setSalvando(true);
    await criarPrecificacao({
      clienteId: produto.clienteId,
      produtoId: produto.id,
      varianteId,
      varianteResumo: varianteSel ? resumoVariante(varianteSel) : "—",
      marketplace,
      custoProduto: num(f.custoProduto),
      embalagem: num(f.embalagem),
      impostoPercentual: num(f.impostoPercentual),
      taxaMarketplacePercentual: num(f.taxaMarketplacePercentual),
      taxaFixa: num(f.taxaFixa),
      comissaoGestorPercentual: num(f.comissaoGestorPercentual),
      outrosCustos: num(f.outrosCustos),
      precoVenda: num(f.precoVenda),
      lucroBruto: calc.lucroBruto,
      lucroLiquido: calc.lucroLiquido,
      margemLiquidaPercentual: calc.margemLiquidaPercentual,
      precoMinimo: calc.precoMinimo,
      statusMargem: calc.statusMargem,
      observacoes: "",
    });
    setVarianteId("");
    set("precoVenda", "");
    setSalvando(false);
  }

  return (
    <div className="space-y-4">
      {precificacoes && precificacoes.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-semibold">Variação</th>
                <th className="px-3 py-2 font-semibold">Marketplace</th>
                <th className="px-3 py-2 text-right font-semibold">Preço</th>
                <th className="px-3 py-2 text-right font-semibold">Lucro líq.</th>
                <th className="px-3 py-2 text-right font-semibold">Margem</th>
                <th className="px-3 py-2 text-right font-semibold">Preço mín.</th>
                <th className="px-3 py-2 font-semibold">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {precificacoes.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-zinc-200">{p.varianteResumo}</td>
                  <td className="px-3 py-2"><Badge tone="gray">{p.marketplace}</Badge></td>
                  <td className="px-3 py-2 text-right text-zinc-200">{formatBRL(p.precoVenda)}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{formatBRL(p.lucroLiquido)}</td>
                  <td className="px-3 py-2 text-right">{p.margemLiquidaPercentual}%</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{formatBRL(p.precoMinimo)}</td>
                  <td className="px-3 py-2"><Badge>{p.statusMargem}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState compacto mensagem="Nenhuma precificação por variante ainda. Calcule abaixo." />
      )}

      <form onSubmit={salvar} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <Calculator size={13} /> Calcular precificação por derivação
        </p>

        {variantes && variantes.length === 0 && (
          <p className="mb-3 text-xs text-amber-400">
            Cadastre variações primeiro (aba Variações) para precificar por derivação.
          </p>
        )}

        <FormGrid>
          <Field label="Variação" required>
            <Select
              options={(variantes ?? []).map((v) => v.sku || v.id)}
              placeholder="Selecione…"
              value={(variantes ?? []).find((v) => v.id === varianteId)?.sku ?? ""}
              onChange={(e) => {
                const v = (variantes ?? []).find((x) => x.sku === e.target.value);
                setVarianteId(v?.id ?? "");
                if (v) set("custoProduto", String(v.custo));
                if (v && !f.precoVenda) set("precoVenda", String(v.precoBase));
              }}
            />
          </Field>
          <Field label="Marketplace">
            <Select options={MARKETPLACES} value={marketplace}
              onChange={(e) => setMarketplace(e.target.value as Produto["marketplace"])} />
          </Field>
          <Field label="Preço de venda (R$)" required>
            <Input inputMode="decimal" value={f.precoVenda} onChange={(e) => set("precoVenda", e.target.value)} />
          </Field>
          <Field label="Custo do produto (R$)">
            <Input inputMode="decimal" value={f.custoProduto} onChange={(e) => set("custoProduto", e.target.value)} />
          </Field>
          <Field label="Embalagem (R$)">
            <Input inputMode="decimal" value={f.embalagem} onChange={(e) => set("embalagem", e.target.value)} />
          </Field>
          <Field label="Outros custos (R$)">
            <Input inputMode="decimal" value={f.outrosCustos} onChange={(e) => set("outrosCustos", e.target.value)} />
          </Field>
          <Field label="Imposto (%)">
            <Input inputMode="decimal" value={f.impostoPercentual} onChange={(e) => set("impostoPercentual", e.target.value)} />
          </Field>
          <Field label="Taxa marketplace (%)">
            <Input inputMode="decimal" value={f.taxaMarketplacePercentual} onChange={(e) => set("taxaMarketplacePercentual", e.target.value)} />
          </Field>
          <Field label="Taxa fixa (R$)">
            <Input inputMode="decimal" value={f.taxaFixa} onChange={(e) => set("taxaFixa", e.target.value)} />
          </Field>
          <Field label="Comissão gestor (%)">
            <Input inputMode="decimal" value={f.comissaoGestorPercentual} onChange={(e) => set("comissaoGestorPercentual", e.target.value)} />
          </Field>
        </FormGrid>

        {/* Prévia do cálculo (ao vivo) */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-[11px] text-zinc-500">Lucro líquido</p>
            <p className={`text-sm font-semibold ${calc.lucroLiquido >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatBRL(calc.lucroLiquido)}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-[11px] text-zinc-500">Margem líquida</p>
            <p className="text-sm font-semibold text-zinc-200">{calc.margemLiquidaPercentual}%</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-[11px] text-zinc-500">Preço mínimo</p>
            <p className="text-sm font-semibold text-zinc-200">{formatBRL(calc.precoMinimo)}</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-[11px] text-zinc-500">Saúde</p>
            <Badge>{calc.statusMargem}</Badge>
          </div>
        </div>

        <div className="mt-4">
          <Button type="submit" disabled={!varianteId || num(f.precoVenda) <= 0 || salvando}>
            <Plus size={14} /> {salvando ? "Salvando…" : "Salvar precificação"}
          </Button>
        </div>
      </form>
    </div>
  );
}
