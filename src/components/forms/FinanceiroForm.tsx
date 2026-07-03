"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, TextArea } from "@/components/ui/form";
import { PAGAMENTO_STATUS, PLANOS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import {
  atualizarRegistroFinanceiro,
  criarRegistroFinanceiro,
} from "@/lib/services/financeiro";
import type { RegistroFinanceiro } from "@/lib/types";

interface FinanceiroFormProps {
  inicial?: RegistroFinanceiro;
  clientePadrao?: string;
}

export function FinanceiroForm({ inicial, clientePadrao }: FinanceiroFormProps) {
  const router = useRouter();
  const { data: clientes } = useLiveQuery(listarClientes);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    cliente: inicial?.cliente ?? clientePadrao ?? "",
    plano: inicial?.plano ?? "Início",
    valorMensal: inicial ? String(inicial.valorMensal) : "",
    dataVencimento: inicial?.dataVencimento ?? "",
    statusPagamento: inicial?.statusPagamento ?? "Pendente",
    servicosExtras: inicial?.servicosExtras ?? "",
    custoOperacional: inicial ? String(inicial.custoOperacional) : "0",
    lucroEstimado: inicial ? String(inicial.lucroEstimado) : "",
    observacoes: inicial?.observacoes ?? "",
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
    if (!form.valorMensal || !isFinite(numero(form.valorMensal)) || numero(form.valorMensal) < 0)
      novosErros.valorMensal = "Informe um valor mensal válido.";
    if (!form.dataVencimento) novosErros.dataVencimento = "Informe a data de vencimento.";
    if (!isFinite(numero(form.custoOperacional)) || numero(form.custoOperacional) < 0)
      novosErros.custoOperacional = "Informe um custo válido.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const valorMensal = numero(form.valorMensal);
    const custoOperacional = numero(form.custoOperacional);
    // Lucro: usa o informado; se em branco, calcula valor - custo.
    const lucroEstimado = form.lucroEstimado
      ? numero(form.lucroEstimado)
      : valorMensal - custoOperacional;

    const dados = {
      ...form,
      clienteId: clienteSelecionado!.id,
      valorMensal,
      custoOperacional,
      lucroEstimado,
      servicosExtras: form.servicosExtras.trim() || "—",
    } as Omit<RegistroFinanceiro, "id">;

    if (inicial) {
      await atualizarRegistroFinanceiro(inicial.id, dados);
    } else {
      await criarRegistroFinanceiro(dados);
    }
    router.push("/financeiro");
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
          <Field label="Plano contratado">
            <Select options={PLANOS} value={form.plano} onChange={(e) => set("plano", e.target.value)} />
          </Field>
          <Field label="Valor mensal (R$)" required error={erros.valorMensal}>
            <Input inputMode="decimal" value={form.valorMensal} onChange={(e) => set("valorMensal", e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Data de vencimento" required error={erros.dataVencimento}>
            <Input type="date" value={form.dataVencimento} onChange={(e) => set("dataVencimento", e.target.value)} />
          </Field>
          <Field label="Status de pagamento">
            <Select options={PAGAMENTO_STATUS} value={form.statusPagamento} onChange={(e) => set("statusPagamento", e.target.value as RegistroFinanceiro["statusPagamento"])} />
          </Field>
          <Field label="Custo operacional estimado (R$)" error={erros.custoOperacional}>
            <Input inputMode="decimal" value={form.custoOperacional} onChange={(e) => set("custoOperacional", e.target.value)} />
          </Field>
          <Field label="Lucro estimado (R$)" hint="Se ficar em branco, é calculado como valor − custo.">
            <Input inputMode="decimal" value={form.lucroEstimado} onChange={(e) => set("lucroEstimado", e.target.value)} />
          </Field>
        </FormGrid>

        <div className="mt-4 space-y-4">
          <Field label="Serviços extras">
            <Input value={form.servicosExtras} onChange={(e) => set("servicosExtras", e.target.value)} placeholder="Ex.: Pacote de imagens (R$ 600)" />
          </Field>
          <Field label="Observações">
            <TextArea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit">{inicial ? "Salvar alterações" : "Criar registro"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
