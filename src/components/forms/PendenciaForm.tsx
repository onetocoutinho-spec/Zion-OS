"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select } from "@/components/ui/form";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { criarPendencia } from "@/lib/services/pendencias";

interface PendenciaFormProps {
  clientePadrao?: string;
}

export function PendenciaForm({ clientePadrao }: PendenciaFormProps) {
  const router = useRouter();
  const { data: clientes } = useLiveQuery(listarClientes);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    cliente: clientePadrao ?? "",
    descricao: "",
  });

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    const clienteSelecionado = (clientes ?? []).find((c) => c.empresa === form.cliente);
    if (!clienteSelecionado) novosErros.cliente = "Selecione o cliente.";
    if (!form.descricao.trim()) novosErros.descricao = "Descreva a pendência.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    // O vinculo com tarefa saiu junto com a tela de Tarefas (07/08). A coluna
    // continua no banco e continua aceitando null — que e o que toda pendencia
    // criada por aqui sempre foi, ja que a tabela nunca teve uma linha.
    await criarPendencia({
      clienteId: clienteSelecionado!.id,
      cliente: clienteSelecionado!.empresa,
      tarefaId: null,
      tarefa: null,
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
              onChange={(e) => set("cliente", e.target.value)}
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
