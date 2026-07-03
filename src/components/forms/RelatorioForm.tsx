"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, TextArea, ouInfoNecessaria } from "@/components/ui/form";
import { RELATORIO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { atualizarRelatorio, criarRelatorio } from "@/lib/services/relatorios";
import type { Relatorio } from "@/lib/types";

interface RelatorioFormProps {
  inicial?: Relatorio;
  clientePadrao?: string;
}

export function RelatorioForm({ inicial, clientePadrao }: RelatorioFormProps) {
  const router = useRouter();
  const { data: clientes } = useLiveQuery(listarClientes);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    cliente: inicial?.cliente ?? clientePadrao ?? "",
    periodo: inicial?.periodo ?? "",
    oQueFoiFeito: inicial?.oQueFoiFeito ?? "",
    produtosTrabalhados: inicial ? String(inicial.produtosTrabalhados) : "0",
    anunciosRevisados: inicial ? String(inicial.anunciosRevisados) : "0",
    problemasEncontrados: inicial?.problemasEncontrados ?? "",
    oportunidades: inicial?.oportunidades ?? "",
    pendencias: inicial?.pendencias ?? "",
    proximasAcoes: inicial?.proximasAcoes ?? "",
    status: inicial?.status ?? "Em elaboração",
  });

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    const clienteSelecionado = (clientes ?? []).find((c) => c.empresa === form.cliente);
    if (!clienteSelecionado) novosErros.cliente = "Selecione o cliente.";
    if (!form.periodo.trim()) novosErros.periodo = "Informe o período (ex.: Julho/2026).";
    if (!isFinite(Number(form.produtosTrabalhados)) || Number(form.produtosTrabalhados) < 0)
      novosErros.produtosTrabalhados = "Informe um número válido.";
    if (!isFinite(Number(form.anunciosRevisados)) || Number(form.anunciosRevisados) < 0)
      novosErros.anunciosRevisados = "Informe um número válido.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      ...form,
      clienteId: clienteSelecionado!.id,
      periodo: form.periodo.trim(),
      oQueFoiFeito: ouInfoNecessaria(form.oQueFoiFeito),
      produtosTrabalhados: Number(form.produtosTrabalhados),
      anunciosRevisados: Number(form.anunciosRevisados),
      problemasEncontrados: form.problemasEncontrados.trim() || "—",
      oportunidades: form.oportunidades.trim() || "—",
      pendencias: form.pendencias.trim() || "—",
      proximasAcoes: ouInfoNecessaria(form.proximasAcoes),
    } as Omit<Relatorio, "id">;

    if (inicial) {
      await atualizarRelatorio(inicial.id, dados);
    } else {
      await criarRelatorio(dados);
    }
    router.push("/relatorios");
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
          <Field label="Período" required error={erros.periodo}>
            <Input value={form.periodo} onChange={(e) => set("periodo", e.target.value)} placeholder="Ex.: Julho/2026" />
          </Field>
          <Field label="Produtos trabalhados" error={erros.produtosTrabalhados}>
            <Input inputMode="numeric" value={form.produtosTrabalhados} onChange={(e) => set("produtosTrabalhados", e.target.value)} />
          </Field>
          <Field label="Anúncios revisados" error={erros.anunciosRevisados}>
            <Input inputMode="numeric" value={form.anunciosRevisados} onChange={(e) => set("anunciosRevisados", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select options={RELATORIO_STATUS} value={form.status} onChange={(e) => set("status", e.target.value as Relatorio["status"])} />
          </Field>
        </FormGrid>

        <div className="mt-4 space-y-4">
          <Field label="O que foi feito">
            <TextArea value={form.oQueFoiFeito} onChange={(e) => set("oQueFoiFeito", e.target.value)} />
          </Field>
          <Field label="Problemas encontrados">
            <TextArea value={form.problemasEncontrados} onChange={(e) => set("problemasEncontrados", e.target.value)} />
          </Field>
          <Field label="Oportunidades">
            <TextArea value={form.oportunidades} onChange={(e) => set("oportunidades", e.target.value)} />
          </Field>
          <Field label="Pendências">
            <TextArea value={form.pendencias} onChange={(e) => set("pendencias", e.target.value)} />
          </Field>
          <Field label="Próximas ações">
            <TextArea value={form.proximasAcoes} onChange={(e) => set("proximasAcoes", e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit">{inicial ? "Salvar alterações" : "Criar relatório"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
