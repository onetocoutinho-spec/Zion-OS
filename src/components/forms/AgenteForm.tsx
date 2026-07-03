"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, TextArea, ouInfoNecessaria } from "@/components/ui/form";
import { AREAS_AGENTE, FREQUENCIAS_USO, IMPLANTACAO_STATUS } from "@/lib/constantes";
import { atualizarAgente, criarAgente } from "@/lib/services/agentes";
import type { AgenteIA } from "@/lib/types";

export function AgenteForm({ inicial }: { inicial?: AgenteIA }) {
  const router = useRouter();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    nome: inicial?.nome ?? "",
    area: inicial?.area ?? "Agência",
    objetivo: inicial?.objetivo ?? "",
    quandoUsar: inicial?.quandoUsar ?? "",
    entradaNecessaria: inicial?.entradaNecessaria ?? "",
    saidaEsperada: inicial?.saidaEsperada ?? "",
    promptResumido: inicial?.promptResumido ?? "",
    statusImplantacao: inicial?.statusImplantacao ?? "Planejado",
    frequenciaUso: inicial?.frequenciaUso ?? "Sob demanda",
    agentesConectados: inicial?.agentesConectados.join(", ") ?? "",
  });

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (!form.nome.trim()) novosErros.nome = "Informe o nome do agente.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      ...form,
      nome: form.nome.trim(),
      objetivo: ouInfoNecessaria(form.objetivo),
      quandoUsar: ouInfoNecessaria(form.quandoUsar),
      entradaNecessaria: ouInfoNecessaria(form.entradaNecessaria),
      saidaEsperada: ouInfoNecessaria(form.saidaEsperada),
      promptResumido: ouInfoNecessaria(form.promptResumido),
      agentesConectados: form.agentesConectados
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    } as Omit<AgenteIA, "id">;

    if (inicial) {
      await atualizarAgente(inicial.id, dados);
      router.push(`/agentes/${inicial.id}`);
    } else {
      const criado = await criarAgente(dados);
      router.push(`/agentes/${criado.id}`);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <FormGrid>
          <Field label="Nome do agente" required error={erros.nome}>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Zion SEO ML" />
          </Field>
          <Field label="Área">
            <Select options={AREAS_AGENTE} value={form.area} onChange={(e) => set("area", e.target.value as AgenteIA["area"])} />
          </Field>
          <Field label="Status de implantação">
            <Select options={IMPLANTACAO_STATUS} value={form.statusImplantacao} onChange={(e) => set("statusImplantacao", e.target.value as AgenteIA["statusImplantacao"])} />
          </Field>
          <Field label="Frequência de uso">
            <Select options={FREQUENCIAS_USO} value={form.frequenciaUso} onChange={(e) => set("frequenciaUso", e.target.value as AgenteIA["frequenciaUso"])} />
          </Field>
        </FormGrid>

        <div className="mt-4 space-y-4">
          <Field label="Objetivo">
            <Input value={form.objetivo} onChange={(e) => set("objetivo", e.target.value)} />
          </Field>
          <Field label="Quando usar">
            <Input value={form.quandoUsar} onChange={(e) => set("quandoUsar", e.target.value)} />
          </Field>
          <Field label="Entrada necessária">
            <Input value={form.entradaNecessaria} onChange={(e) => set("entradaNecessaria", e.target.value)} />
          </Field>
          <Field label="Saída esperada">
            <Input value={form.saidaEsperada} onChange={(e) => set("saidaEsperada", e.target.value)} />
          </Field>
          <Field label="Prompt resumido">
            <TextArea value={form.promptResumido} onChange={(e) => set("promptResumido", e.target.value)} />
          </Field>
          <Field label="Agentes conectados" hint="Separe por vírgula. Ex.: Zion SEO ML, Zion Precificação">
            <Input value={form.agentesConectados} onChange={(e) => set("agentesConectados", e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit">{inicial ? "Salvar alterações" : "Criar agente"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
