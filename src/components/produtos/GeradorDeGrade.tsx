"use client";

// Gerador de grade de variações: o usuário informa os valores de cada eixo
// (ex.: Cores "Preto, Avelã" × Tamanhos "34,35,36") e o sistema cria todas as
// combinações de uma vez, cada uma com SKU/custo/preço/estoque.

import { useState } from "react";
import { Grid3x3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EIXOS_VARIACAO } from "@/lib/constantes";
import { gerarGrade, resumoVariante, type ValoresPorEixo } from "@/lib/variantes";
import { criarVariantesEmLote } from "@/lib/services/produtoVariantes";
import type { Produto, ProdutoVariante } from "@/lib/types";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas diacríticas)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function GeradorDeGrade({
  produto,
  onGerado,
}: {
  produto: Produto;
  onGerado: () => void;
}) {
  const [entradas, setEntradas] = useState<Record<string, string>>({});
  const [custo, setCusto] = useState(String(produto.custo || 0));
  const [preco, setPreco] = useState(String(produto.precoVenda || 0));
  const [estoque, setEstoque] = useState("0");
  const [gerando, setGerando] = useState(false);

  // Converte "Preto, Avelã" → ["Preto","Avelã"] por eixo preenchido
  const valores: ValoresPorEixo = {};
  for (const eixo of EIXOS_VARIACAO) {
    const bruto = entradas[eixo.chave] ?? "";
    const lista = bruto
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (lista.length > 0) valores[eixo.chave] = lista;
  }

  const combinacoes = gerarGrade(valores);
  const temEixos = Object.keys(valores).length > 0;

  async function gerar() {
    if (!temEixos || gerando) return;
    setGerando(true);
    const skuBase = produto.sku || slug(produto.nome).slice(0, 8);
    const novas: Omit<ProdutoVariante, "id">[] = combinacoes.map((c) => {
      const sufixo = Object.values(c).map(slug).join("-");
      return {
        produtoId: produto.id,
        clienteId: produto.clienteId,
        produto: produto.nome,
        sku: sufixo ? `${skuBase}-${sufixo}` : skuBase,
        codigoInterno: "",
        ean: "",
        cor: c.cor ?? "",
        tamanho: c.tamanho ?? "",
        voltagem: c.voltagem ?? "",
        sabor: c.sabor ?? "",
        aroma: c.aroma ?? "",
        modeloVariacao: c.modeloVariacao ?? "",
        custo: Number(custo.replace(",", ".")) || 0,
        precoBase: Number(preco.replace(",", ".")) || 0,
        estoque: Number(estoque) || 0,
        peso: 0,
        altura: 0,
        largura: 0,
        comprimento: 0,
        status: "Ativa",
        observacoes: "",
      };
    });
    await criarVariantesEmLote(novas);
    setEntradas({});
    setGerando(false);
    onGerado();
  }

  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Grid3x3 size={16} className="text-violet-400" />
        <p className="text-sm font-medium text-zinc-200">Gerar grade de variações</p>
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        Informe os valores de cada eixo separados por vírgula. O sistema cria todas as combinações.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EIXOS_VARIACAO.map((eixo) => (
          <label key={eixo.chave} className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">{eixo.rotulo}</span>
            <input
              value={entradas[eixo.chave] ?? ""}
              onChange={(e) => setEntradas((s) => ({ ...s, [eixo.chave]: e.target.value }))}
              placeholder={
                eixo.chave === "cor"
                  ? "Preto, Avelã, Branco"
                  : eixo.chave === "tamanho"
                    ? "34, 35, 36, 37"
                    : "valores separados por vírgula"
              }
              className="w-full rounded-lg border border-white/10 bg-surface-input px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 hover:border-white/20 focus:border-violet-500"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">Custo padrão (R$)</span>
          <input inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface-input px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">Preço padrão (R$)</span>
          <input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface-input px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">Estoque padrão</span>
          <input inputMode="numeric" value={estoque} onChange={(e) => setEstoque(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface-input px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500" />
        </label>
      </div>

      {temEixos && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-zinc-400">
            {combinacoes.length} variação(ões) a gerar:
          </p>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {combinacoes.slice(0, 40).map((c, i) => (
              <span key={i} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-300">
                {resumoVariante(c)}
              </span>
            ))}
            {combinacoes.length > 40 && (
              <span className="px-2 py-0.5 text-[11px] text-zinc-500">+{combinacoes.length - 40}…</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Button onClick={gerar} disabled={!temEixos || gerando}>
          <Sparkles size={14} />
          {gerando ? "Gerando…" : `Gerar ${temEixos ? combinacoes.length : ""} variações`}
        </Button>
      </div>
    </div>
  );
}
