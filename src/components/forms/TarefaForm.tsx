"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, TextArea, ouInfoNecessaria } from "@/components/ui/form";
import { AREAS_TAREFA, EQUIPE, PRIORIDADES, TAREFA_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { listarProdutos } from "@/lib/services/produtos";
import { listarAnuncios } from "@/lib/services/anuncios";
import { listarAgentes } from "@/lib/services/agentes";
import { atualizarTarefa, criarTarefa } from "@/lib/services/tarefas";
import type { Tarefa } from "@/lib/types";

interface TarefaFormProps {
  inicial?: Tarefa;
  clientePadrao?: string;
  produtoPadrao?: string;
  anuncioPadrao?: string;
}

export function TarefaForm({
  inicial,
  clientePadrao,
  produtoPadrao,
  anuncioPadrao,
}: TarefaFormProps) {
  const router = useRouter();
  const { data: clientes } = useLiveQuery(listarClientes);
  const { data: produtos } = useLiveQuery(listarProdutos);
  const { data: anuncios } = useLiveQuery(listarAnuncios);
  const { data: agentes } = useLiveQuery(listarAgentes);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    cliente: inicial?.cliente ?? clientePadrao ?? "",
    produto: inicial?.produto ?? produtoPadrao ?? "",
    anuncio: inicial?.anuncio ?? anuncioPadrao ?? "",
    area: inicial?.area ?? "Agência",
    tarefa: inicial?.tarefa ?? "",
    responsavel: inicial?.responsavel ?? "",
    prioridade: inicial?.prioridade ?? "Média",
    status: inicial?.status ?? "Não iniciado",
    prazo: inicial?.prazo ?? "",
    agenteRelacionado: inicial?.agenteRelacionado ?? "",
    proximaAcao: inicial?.proximaAcao ?? "",
    observacoes: inicial?.observacoes ?? "",
  });

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  const produtosDoCliente = (produtos ?? []).filter(
    (p) => !form.cliente || p.cliente === form.cliente
  );
  const anunciosDoCliente = (anuncios ?? []).filter(
    (a) => !form.cliente || a.cliente === form.cliente
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (!form.cliente) novosErros.cliente = "Selecione o cliente.";
    if (!form.tarefa.trim()) novosErros.tarefa = "Descreva a tarefa.";
    if (!form.prazo) novosErros.prazo = "Informe o prazo.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      ...form,
      tarefa: form.tarefa.trim(),
      produto: form.produto || null,
      anuncio: form.anuncio || null,
      responsavel: ouInfoNecessaria(form.responsavel),
      agenteRelacionado: form.agenteRelacionado || null,
      proximaAcao: ouInfoNecessaria(form.proximaAcao),
    } as Omit<Tarefa, "id">;

    if (inicial) {
      await atualizarTarefa(inicial.id, dados);
    } else {
      await criarTarefa(dados);
    }
    router.push("/tarefas");
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <div className="mb-4">
          <Field label="Tarefa" required error={erros.tarefa}>
            <Input value={form.tarefa} onChange={(e) => set("tarefa", e.target.value)} placeholder="O que precisa ser feito?" />
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
                set("produto", "");
                set("anuncio", "");
              }}
            />
          </Field>
          <Field label="Área">
            <Select options={AREAS_TAREFA} value={form.area} onChange={(e) => set("area", e.target.value)} />
          </Field>
          <Field label="Produto vinculado (opcional)">
            <Select
              options={produtosDoCliente.map((p) => p.nome)}
              placeholder="Nenhum"
              value={form.produto}
              onChange={(e) => set("produto", e.target.value)}
            />
          </Field>
          <Field label="Anúncio vinculado (opcional)">
            <Select
              options={anunciosDoCliente.map((a) => a.produto)}
              placeholder="Nenhum"
              value={form.anuncio}
              onChange={(e) => set("anuncio", e.target.value)}
            />
          </Field>
          <Field label="Responsável">
            <Select options={EQUIPE} placeholder="Selecione…" value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
          </Field>
          <Field label="Agente relacionado (opcional)">
            <Select
              options={(agentes ?? []).map((a) => a.nome)}
              placeholder="Nenhum"
              value={form.agenteRelacionado}
              onChange={(e) => set("agenteRelacionado", e.target.value)}
            />
          </Field>
          <Field label="Prioridade">
            <Select options={PRIORIDADES} value={form.prioridade} onChange={(e) => set("prioridade", e.target.value as Tarefa["prioridade"])} />
          </Field>
          <Field label="Status">
            <Select options={TAREFA_STATUS} value={form.status} onChange={(e) => set("status", e.target.value as Tarefa["status"])} />
          </Field>
          <Field label="Prazo" required error={erros.prazo}>
            <Input type="date" value={form.prazo} onChange={(e) => set("prazo", e.target.value)} />
          </Field>
          <Field label="Próxima ação">
            <Input value={form.proximaAcao} onChange={(e) => set("proximaAcao", e.target.value)} />
          </Field>
        </FormGrid>

        <div className="mt-4">
          <Field label="Observações">
            <TextArea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit">{inicial ? "Salvar alterações" : "Criar tarefa"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
