"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select } from "@/components/ui/form";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { listarTarefas } from "@/lib/services/tarefas";
import { criarPendencia } from "@/lib/services/pendencias";

interface PendenciaFormProps {
  clientePadrao?: string;
}

export function PendenciaForm({ clientePadrao }: PendenciaFormProps) {
  const router = useRouter();
  const { data: clientes } = useLiveQuery(listarClientes);
  const { data: tarefas } = useLiveQuery(listarTarefas);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    cliente: clientePadrao ?? "",
    descricao: "",
    tarefa: "",
  });

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // Tarefas do cliente selecionado (vínculo opcional)
  const tarefasDoCliente = (tarefas ?? []).filter(
    (t) => !form.cliente || t.cliente === form.cliente
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    const clienteSelecionado = (clientes ?? []).find((c) => c.empresa === form.cliente);
    if (!clienteSelecionado) novosErros.cliente = "Selecione o cliente.";
    if (!form.descricao.trim()) novosErros.descricao = "Descreva a pendência.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const tarefaSelecionada = tarefasDoCliente.find((t) => t.tarefa === form.tarefa);

    await criarPendencia({
      clienteId: clienteSelecionado!.id,
      cliente: clienteSelecionado!.empresa,
      tarefaId: tarefaSelecionada?.id ?? null,
      tarefa: tarefaSelecionada?.tarefa ?? null,
      descricao: form.descricao.trim(),
      resolvida: false,
    });
    router.push("/pendencias");
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <div className="mb-4">
          <Field label="Pendência" required error={erros.descricao}>
            <Input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="O que o cliente precisa enviar ou resolver?" />
          </Field>
        </div>

        <FormGrid>
          <Field label="Cliente" required error={erros.cliente}>
            <Select
              options={(clientes ?? []).map((c) => c.empresa)}
              placeholder="Selecione o cliente…"
              value={form.cliente}
              onChange={(e) => {
                set("cliente", e.target.value);
                set("tarefa", "");
              }}
            />
          </Field>
          <Field label="Tarefa vinculada (opcional)">
            <Select
              options={tarefasDoCliente.map((t) => t.tarefa)}
              placeholder="Nenhuma"
              value={form.tarefa}
              onChange={(e) => set("tarefa", e.target.value)}
            />
          </Field>
        </FormGrid>

        <div className="mt-6 flex gap-3">
          <Button type="submit">Criar pendência</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
