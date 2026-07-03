"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, ouInfoNecessaria } from "@/components/ui/form";
import { EQUIPE, ETAPA_STATUS, MARKETPLACES, PUBLICACAO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { listarProdutos } from "@/lib/services/produtos";
import { atualizarAnuncio, criarAnuncio } from "@/lib/services/anuncios";
import type { Anuncio } from "@/lib/types";

interface AnuncioFormProps {
  inicial?: Anuncio;
  clientePadrao?: string;
  produtoPadrao?: string;
}

export function AnuncioForm({ inicial, clientePadrao, produtoPadrao }: AnuncioFormProps) {
  const router = useRouter();
  const { data: clientes } = useLiveQuery(listarClientes);
  const { data: produtos } = useLiveQuery(listarProdutos);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    cliente: inicial?.cliente ?? clientePadrao ?? "",
    produto: inicial?.produto ?? produtoPadrao ?? "",
    marketplace: inicial?.marketplace ?? "Mercado Livre",
    link: inicial?.link ?? "",
    tituloAtual: inicial?.tituloAtual ?? "",
    tituloOtimizado: inicial?.tituloOtimizado ?? "",
    statusSeo: inicial?.statusSeo ?? "Pendente",
    statusDescricao: inicial?.statusDescricao ?? "Pendente",
    statusImagens: inicial?.statusImagens ?? "Pendente",
    statusPrecificacao: inicial?.statusPrecificacao ?? "Pendente",
    statusConcorrencia: inicial?.statusConcorrencia ?? "Pendente",
    statusRevisao: inicial?.statusRevisao ?? "Pendente",
    statusPublicacao: inicial?.statusPublicacao ?? "Pendente",
    proximaAcao: inicial?.proximaAcao ?? "",
    responsavel: inicial?.responsavel ?? "",
  });

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // Produtos do cliente selecionado (ou todos, se nenhum cliente escolhido)
  const produtosDoCliente = (produtos ?? []).filter(
    (p) => !form.cliente || p.cliente === form.cliente
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (!form.cliente) novosErros.cliente = "Selecione o cliente.";
    if (!form.produto) novosErros.produto = "Selecione o produto.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      ...form,
      link: form.link.trim() || "—",
      tituloAtual: form.tituloAtual.trim() || "—",
      tituloOtimizado: ouInfoNecessaria(form.tituloOtimizado),
      proximaAcao: ouInfoNecessaria(form.proximaAcao),
      responsavel: ouInfoNecessaria(form.responsavel),
    } as Omit<Anuncio, "id">;

    if (inicial) {
      await atualizarAnuncio(inicial.id, dados);
      router.push(`/anuncios/${inicial.id}`);
    } else {
      const criado = await criarAnuncio(dados);
      router.push(`/anuncios/${criado.id}`);
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
              onChange={(e) => {
                set("cliente", e.target.value);
                set("produto", "");
              }}
            />
          </Field>
          <Field label="Produto" required error={erros.produto}>
            <Select
              options={produtosDoCliente.map((p) => p.nome)}
              placeholder="Selecione o produto…"
              value={form.produto}
              onChange={(e) => set("produto", e.target.value)}
            />
          </Field>
          <Field label="Marketplace">
            <Select options={MARKETPLACES} value={form.marketplace} onChange={(e) => set("marketplace", e.target.value as Anuncio["marketplace"])} />
          </Field>
          <Field label="Responsável">
            <Select options={EQUIPE} placeholder="Selecione…" value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
          </Field>
        </FormGrid>

        <div className="mt-4 space-y-4">
          <Field label="Link do anúncio">
            <Input value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Título atual">
            <Input value={form.tituloAtual} onChange={(e) => set("tituloAtual", e.target.value)} />
          </Field>
          <Field label="Título otimizado" hint="Se ficar em branco, será salvo como “Informação necessária”.">
            <Input value={form.tituloOtimizado} onChange={(e) => set("tituloOtimizado", e.target.value)} />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="SEO">
            <Select options={ETAPA_STATUS} value={form.statusSeo} onChange={(e) => set("statusSeo", e.target.value as Anuncio["statusSeo"])} />
          </Field>
          <Field label="Descrição">
            <Select options={ETAPA_STATUS} value={form.statusDescricao} onChange={(e) => set("statusDescricao", e.target.value as Anuncio["statusDescricao"])} />
          </Field>
          <Field label="Imagens">
            <Select options={ETAPA_STATUS} value={form.statusImagens} onChange={(e) => set("statusImagens", e.target.value as Anuncio["statusImagens"])} />
          </Field>
          <Field label="Precificação">
            <Select options={ETAPA_STATUS} value={form.statusPrecificacao} onChange={(e) => set("statusPrecificacao", e.target.value as Anuncio["statusPrecificacao"])} />
          </Field>
          <Field label="Concorrência">
            <Select options={ETAPA_STATUS} value={form.statusConcorrencia} onChange={(e) => set("statusConcorrencia", e.target.value as Anuncio["statusConcorrencia"])} />
          </Field>
          <Field label="Revisão">
            <Select options={ETAPA_STATUS} value={form.statusRevisao} onChange={(e) => set("statusRevisao", e.target.value as Anuncio["statusRevisao"])} />
          </Field>
          <Field label="Publicação">
            <Select options={PUBLICACAO_STATUS} value={form.statusPublicacao} onChange={(e) => set("statusPublicacao", e.target.value as Anuncio["statusPublicacao"])} />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Próxima ação">
            <Input value={form.proximaAcao} onChange={(e) => set("proximaAcao", e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit">{inicial ? "Salvar alterações" : "Criar anúncio"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
