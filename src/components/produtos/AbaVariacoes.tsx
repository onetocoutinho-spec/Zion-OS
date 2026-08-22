"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GeradorDeGrade } from "./GeradorDeGrade";
import { VARIANTE_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { resumoVariante } from "@/lib/variantes";
import {
  atualizarVariante,
  criarVariante,
  excluirVariante,
  listarVariantesDoProduto,
} from "@/lib/services/produtoVariantes";
import type { Produto, ProdutoVariante } from "@/lib/types";

const inputCls =
  "w-full rounded border border-white/10 bg-surface-input px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500";
const numeroCls = inputCls + " text-right";

/** Linha editável de uma variante — salva no onBlur/onChange. */
function LinhaVariante({ v }: { v: ProdutoVariante }) {
  const [sku, setSku] = useState(v.sku);
  const [ean, setEan] = useState(v.ean);
  const [custo, setCusto] = useState(String(v.custo));
  const [preco, setPreco] = useState(String(v.precoBase));
  const [estoque, setEstoque] = useState(String(v.estoque));

  const num = (s: string) => Number(s.replace(",", ".")) || 0;

  async function excluir() {
    if (!window.confirm(`Excluir a variante "${resumoVariante(v)}" (${v.sku})?`)) return;
    await excluirVariante(v.id);
  }

  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="px-2 py-2">
        <p className="whitespace-nowrap text-sm text-zinc-200">{resumoVariante(v)}</p>
      </td>
      <td className="px-2 py-2">
        <input value={sku} onChange={(e) => setSku(e.target.value)}
          onBlur={() => sku !== v.sku && atualizarVariante(v.id, { sku })}
          className={inputCls + " font-mono w-32"} />
      </td>
      <td className="px-2 py-2">
        <input value={ean} onChange={(e) => setEan(e.target.value)}
          onBlur={() => ean !== v.ean && atualizarVariante(v.id, { ean })}
          className={inputCls + " font-mono w-32"} placeholder="EAN" />
      </td>
      <td className="px-2 py-2">
        <input inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)}
          onBlur={() => num(custo) !== v.custo && atualizarVariante(v.id, { custo: num(custo) })}
          className={numeroCls + " w-20"} />
      </td>
      <td className="px-2 py-2">
        <input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)}
          onBlur={() => num(preco) !== v.precoBase && atualizarVariante(v.id, { precoBase: num(preco) })}
          className={numeroCls + " w-20"} />
      </td>
      <td className="px-2 py-2">
        <input inputMode="numeric" value={estoque} onChange={(e) => setEstoque(e.target.value)}
          onBlur={() => num(estoque) !== v.estoque && atualizarVariante(v.id, { estoque: num(estoque) })}
          className={numeroCls + " w-16"} />
      </td>
      <td className="px-2 py-2">
        <select value={v.status}
          onChange={(e) => atualizarVariante(v.id, { status: e.target.value as ProdutoVariante["status"] })}
          className={inputCls + " cursor-pointer"}>
          {VARIANTE_STATUS.map((s) => (
            <option key={s} value={s} className="bg-surface-input">{s}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <button onClick={excluir} title="Excluir variante" aria-label="Excluir esta variante"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

export function AbaVariacoes({ produto }: { produto: Produto }) {
  const [mostrarGerador, setMostrarGerador] = useState(false);
  const { data: variantes, reload } = useLiveQuery(
    () => listarVariantesDoProduto(produto.id),
    [produto.id]
  );

  const totalEstoque = (variantes ?? []).reduce((s, v) => s + v.estoque, 0);

  async function adicionarUma() {
    await criarVariante({
      produtoId: produto.id,
      clienteId: produto.clienteId,
      produto: produto.nome,
      sku: `${produto.sku || "SKU"}-${(variantes?.length ?? 0) + 1}`,
      codigoInterno: "",
      ean: "",
      cor: "",
      tamanho: "",
      voltagem: "",
      sabor: "",
      aroma: "",
      modeloVariacao: "",
      custo: produto.custo,
      precoBase: produto.precoVenda,
      estoque: 0,
      peso: 0,
      altura: 0,
      largura: 0,
      comprimento: 0,
      status: "Ativa",
      observacoes: "",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-400">
            {variantes?.length ?? 0} variação(ões) · {totalEstoque} un. em estoque
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setMostrarGerador((v) => !v)}>
            {mostrarGerador ? "Fechar gerador" : "Gerar grade de variações"}
          </Button>
          <Button variant="ghost" onClick={adicionarUma}>
            <Plus size={14} /> Adicionar variação
          </Button>
        </div>
      </div>

      {mostrarGerador && (
        <GeradorDeGrade
          produto={produto}
          onGerado={() => {
            setMostrarGerador(false);
            reload();
          }}
        />
      )}

      {variantes && variantes.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-2 py-2 font-semibold">Variação</th>
                <th className="px-2 py-2 font-semibold">SKU</th>
                <th className="px-2 py-2 font-semibold">EAN</th>
                <th className="px-2 py-2 text-right font-semibold">Custo</th>
                <th className="px-2 py-2 text-right font-semibold">Preço</th>
                <th className="px-2 py-2 text-right font-semibold">Estoque</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {variantes.map((v) => (
                <LinhaVariante key={v.id} v={v} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          mensagem="Nenhuma variação cadastrada. Use o gerador de grade ou adicione uma a uma."
        />
      )}

      {(variantes?.length ?? 0) > 0 && (
        <p className="text-[11px] text-zinc-600">
          <Badge tone="gray">dica</Badge> Edite SKU, EAN, custo, preço e estoque direto na tabela —
          salva ao sair do campo.
        </p>
      )}
    </div>
  );
}
