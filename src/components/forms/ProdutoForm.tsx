"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, TextArea, ouInfoNecessaria } from "@/components/ui/form";
import { CADASTRO_STATUS, ETAPA_STATUS, MARKETPLACES, PRIORIDADES, TIPOS_PRODUTO } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { atualizarProduto, criarProduto } from "@/lib/services/produtos";
import { MemoriaContextual } from "@/components/ail/MemoriaContextual";
import type { Produto } from "@/lib/types";

interface ProdutoFormProps {
  inicial?: Produto;
  /** Pré-seleciona o cliente (ex.: botão "Criar produto" na página do cliente). */
  clientePadrao?: string;
}

export function ProdutoForm({ inicial, clientePadrao }: ProdutoFormProps) {
  const router = useRouter();
  const { data: clientes } = useLiveQuery(listarClientes);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    cliente: inicial?.cliente ?? clientePadrao ?? "",
    nome: inicial?.nome ?? "",
    marca: inicial?.marca ?? "",
    modelo: inicial?.modelo ?? "",
    categoria: inicial?.categoria ?? "",
    sku: inicial?.sku ?? "",
    cor: inicial?.cor ?? "",
    tamanho: inicial?.tamanho ?? "",
    custo: inicial ? String(inicial.custo) : "",
    precoVenda: inicial ? String(inicial.precoVenda) : "",
    estoque: inicial ? String(inicial.estoque) : "0",
    marketplace: inicial?.marketplace ?? "Mercado Livre",
    statusCadastro: inicial?.statusCadastro ?? "Não iniciado",
    statusSeo: inicial?.statusSeo ?? "Pendente",
    statusDescricao: inicial?.statusDescricao ?? "Pendente",
    statusImagens: inicial?.statusImagens ?? "Pendente",
    statusPrecificacao: inicial?.statusPrecificacao ?? "Pendente",
    prioridade: inicial?.prioridade ?? "Média",
    observacoes: inicial?.observacoes ?? "",
    tipoProduto: inicial?.tipoProduto ?? "simples",
    categoriaMarketplaceSugerida: inicial?.categoriaMarketplaceSugerida ?? "",
    descricaoBase: inicial?.descricaoBase ?? "",
    beneficios: inicial?.beneficios ?? "",
    cuidados: inicial?.cuidados ?? "",
  });

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function numero(texto: string): number {
    return Number(texto.replace(",", "."));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    const clienteSelecionado = (clientes ?? []).find((c) => c.empresa === form.cliente);
    if (!clienteSelecionado) novosErros.cliente = "Selecione o cliente.";
    if (!form.nome.trim()) novosErros.nome = "Informe o nome do produto.";
    if (form.custo && (!isFinite(numero(form.custo)) || numero(form.custo) < 0))
      novosErros.custo = "Custo deve ser um número válido.";
    if (form.precoVenda && (!isFinite(numero(form.precoVenda)) || numero(form.precoVenda) < 0))
      novosErros.precoVenda = "Preço deve ser um número válido.";
    if (!isFinite(numero(form.estoque)) || numero(form.estoque) < 0)
      novosErros.estoque = "Estoque deve ser um número válido.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      ...form,
      clienteId: clienteSelecionado!.id,
      nome: form.nome.trim(),
      marca: ouInfoNecessaria(form.marca),
      modelo: ouInfoNecessaria(form.modelo),
      categoria: ouInfoNecessaria(form.categoria),
      sku: ouInfoNecessaria(form.sku),
      cor: form.cor.trim() || "—",
      tamanho: form.tamanho.trim() || "—",
      custo: form.custo ? numero(form.custo) : 0,
      precoVenda: form.precoVenda ? numero(form.precoVenda) : 0,
      estoque: numero(form.estoque),
      observacoes: form.observacoes,
      tipoProduto: form.tipoProduto as Produto["tipoProduto"],
      categoriaMarketplaceSugerida: form.categoriaMarketplaceSugerida,
      descricaoBase: form.descricaoBase,
      beneficios: form.beneficios,
      cuidados: form.cuidados,
    } as Omit<Produto, "id">;

    if (inicial) {
      await atualizarProduto(inicial.id, dados);
      router.push(`/produtos/${inicial.id}`);
    } else {
      const criado = await criarProduto(dados);
      router.push(`/produtos/${criado.id}`);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <FormGrid>
          <Field label="Cliente" required error={erros.cliente}>
            <Select
              options={(clientes ?? []).map((c) => c.empresa)}
              placeholder="Selecione o cliente…"
              value={form.cliente}
              onChange={(e) => set("cliente", e.target.value)}
            />
          </Field>
          <Field label="Nome do produto" required error={erros.nome}>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </Field>
          <Field label="Tipo de produto" hint="Com variação → controle cada derivação (SKU) na aba Variações.">
            <select
              value={form.tipoProduto}
              onChange={(e) => set("tipoProduto", e.target.value as (typeof form)["tipoProduto"])}
              className="w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500/60"
            >
              {TIPOS_PRODUTO.map((t) => (
                <option key={t.valor} value={t.valor}>{t.rotulo}</option>
              ))}
            </select>
          </Field>
          <Field label="Categoria marketplace sugerida" hint="Ex.: MLB1276 - Calçados > Tênis">
            <Input value={form.categoriaMarketplaceSugerida} onChange={(e) => set("categoriaMarketplaceSugerida", e.target.value)} />
          </Field>
          {/* Memória Contextual (E4.1): evidência, nunca comando — silenciosa sem memória. */}
          <div className="sm:col-span-2">
            <MemoriaContextual
              empresa={(clientes ?? []).find((c) => c.empresa === form.cliente)?.id}
              contexto="catalogo"
              campo="categoriaMarketplace"
              proposta={form.categoriaMarketplaceSugerida}
            />
          </div>
          <Field label="Marca">
            <Input value={form.marca} onChange={(e) => set("marca", e.target.value)} />
          </Field>
          <Field label="Modelo">
            <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} />
          </Field>
          <Field label="Categoria">
            <Input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex.: Áudio > Fones" />
          </Field>
          <Field label="SKU">
            <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          </Field>
          <Field label="Cor">
            <Input value={form.cor} onChange={(e) => set("cor", e.target.value)} />
          </Field>
          <Field label="Tamanho">
            <Input value={form.tamanho} onChange={(e) => set("tamanho", e.target.value)} />
          </Field>
          <Field label="Custo (R$)" error={erros.custo}>
            <Input inputMode="decimal" value={form.custo} onChange={(e) => set("custo", e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Preço de venda (R$)" error={erros.precoVenda}>
            <Input inputMode="decimal" value={form.precoVenda} onChange={(e) => set("precoVenda", e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Estoque" error={erros.estoque}>
            <Input inputMode="numeric" value={form.estoque} onChange={(e) => set("estoque", e.target.value)} />
          </Field>
          <Field label="Marketplace">
            <Select options={MARKETPLACES} value={form.marketplace} onChange={(e) => set("marketplace", e.target.value as Produto["marketplace"])} />
          </Field>
          <Field label="Status do cadastro">
            <Select options={CADASTRO_STATUS} value={form.statusCadastro} onChange={(e) => set("statusCadastro", e.target.value as Produto["statusCadastro"])} />
          </Field>
          <Field label="Prioridade">
            <Select options={PRIORIDADES} value={form.prioridade} onChange={(e) => set("prioridade", e.target.value as Produto["prioridade"])} />
          </Field>
          <Field label="Status SEO">
            <Select options={ETAPA_STATUS} value={form.statusSeo} onChange={(e) => set("statusSeo", e.target.value as Produto["statusSeo"])} />
          </Field>
          <Field label="Status descrição">
            <Select options={ETAPA_STATUS} value={form.statusDescricao} onChange={(e) => set("statusDescricao", e.target.value as Produto["statusDescricao"])} />
          </Field>
          <Field label="Status imagens">
            <Select options={ETAPA_STATUS} value={form.statusImagens} onChange={(e) => set("statusImagens", e.target.value as Produto["statusImagens"])} />
          </Field>
          <Field label="Status precificação">
            <Select options={ETAPA_STATUS} value={form.statusPrecificacao} onChange={(e) => set("statusPrecificacao", e.target.value as Produto["statusPrecificacao"])} />
          </Field>
        </FormGrid>

        <div className="mt-4 space-y-4">
          <Field label="Descrição base">
            <TextArea value={form.descricaoBase} onChange={(e) => set("descricaoBase", e.target.value)} placeholder="Descrição do produto que serve de base para os anúncios." />
          </Field>
          <Field label="Benefícios">
            <TextArea value={form.beneficios} onChange={(e) => set("beneficios", e.target.value)} rows={2} />
          </Field>
          <Field label="Cuidados">
            <TextArea value={form.cuidados} onChange={(e) => set("cuidados", e.target.value)} rows={2} />
          </Field>
          <Field label="Observações">
            <TextArea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit">{inicial ? "Salvar alterações" : "Criar produto"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
