"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, TextArea } from "@/components/ui/form";
import { REUNIAO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { atualizarReuniao, criarReuniao } from "@/lib/services/reunioes";
import type { Reuniao } from "@/lib/types";

interface ReuniaoFormProps {
  inicial?: Reuniao;
  clientePadrao?: string;
}

export function ReuniaoForm({ inicial, clientePadrao }: ReuniaoFormProps) {
  const router = useRouter();
  const { data: clientes } = useLiveQuery(listarClientes);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    cliente: inicial?.cliente ?? clientePadrao ?? "",
    titulo: inicial?.titulo ?? "",
    dataHora: inicial?.dataHora ? inicial.dataHora.slice(0, 16) : "",
    pauta: inicial?.pauta ?? "",
    status: inicial?.status ?? "Agendada",
  });

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    const clienteSelecionado = (clientes ?? []).find((c) => c.empresa === form.cliente);
    if (!clienteSelecionado) novosErros.cliente = "Selecione o cliente.";
    if (!form.titulo.trim()) novosErros.titulo = "Informe o título da reunião.";
    if (!form.dataHora) novosErros.dataHora = "Informe data e hora.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      clienteId: clienteSelecionado!.id,
      cliente: clienteSelecionado!.empresa,
      titulo: form.titulo.trim(),
      dataHora: form.dataHora,
      pauta: form.pauta.trim(),
      status: form.status as Reuniao["status"],
    };

    if (inicial) {
      await atualizarReuniao(inicial.id, dados);
    } else {
      await criarReuniao(dados);
    }
    router.push("/reunioes");
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <div className="mb-4">
          <Field label="Título" required error={erros.titulo}>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex.: Reunião mensal de resultados" />
          </Field>
        </div>

        <FormGrid>
          <Field label="Cliente" required error={erros.cliente}>
            <Select
              options={(clientes ?? []).map((c) => c.empresa)}
              placeholder="Selecione o cliente…"
              value={form.cliente}
              onChange={(e) => set("cliente", e.target.value)}
            />
          </Field>
          <Field label="Data e hora" required error={erros.dataHora}>
            <Input type="datetime-local" value={form.dataHora} onChange={(e) => set("dataHora", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select options={REUNIAO_STATUS} value={form.status} onChange={(e) => set("status", e.target.value as Reuniao["status"])} />
          </Field>
        </FormGrid>

        <div className="mt-4">
          <Field label="Pauta">
            <TextArea value={form.pauta} onChange={(e) => set("pauta", e.target.value)} placeholder="O que será tratado nesta reunião?" />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit">{inicial ? "Salvar alterações" : "Agendar reunião"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
