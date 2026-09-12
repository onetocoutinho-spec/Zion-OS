"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormGrid, Input, Select, TextArea, ouInfoNecessaria } from "@/components/ui/form";
import { CLIENTE_STATUS, MARKETPLACES, PLANOS, RISCOS } from "@/lib/constantes";
import { atualizarCliente, criarCliente, criarLojaDaAgencia } from "@/lib/services/clientes";
import { meuPerfil } from "@/lib/services/perfil";
import { useLiveQuery } from "@/lib/hooks";
import type { Cliente, Marketplace } from "@/lib/types";

export function ClienteForm({ inicial }: { inicial?: Cliente }) {
  const router = useRouter();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    empresa: inicial?.empresa ?? "",
    responsavel: inicial?.responsavel ?? "",
    segmento: inicial?.segmento ?? "",
    marketplaces: inicial?.marketplaces ?? ([] as Marketplace[]),
    plano: inicial?.plano ?? "Início",
    status: inicial?.status ?? "Lead",
    dataEntrada: inicial?.dataEntrada ?? new Date().toISOString().slice(0, 10),
    proximaReuniao: inicial?.proximaReuniao ?? "",
    proximaAcao: inicial?.proximaAcao ?? "",
    risco: inicial?.risco ?? "Baixo",
    observacoes: inicial?.observacoes ?? "",
  });

  // O plano que a loja TEM entra na lista mesmo que não esteja no vocabulário.
  //
  // Um `<select>` com `value` que não casa com opção nenhuma não mostra nada, e
  // salvar grava o que está aparecendo — reescrevendo em silêncio o plano de
  // quem veio de fora da lista. Foi o que aconteceu com "Essencial", que agora
  // está em `PLANOS`; isto guarda o PRÓXIMO valor que aparecer antes da lista.
  const planosComOAtual = PLANOS.includes(form.plano as (typeof PLANOS)[number])
    ? [...PLANOS]
    : [form.plano, ...PLANOS];

  function set<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function toggleMarketplace(m: Marketplace) {
    set(
      "marketplaces",
      form.marketplaces.includes(m)
        ? form.marketplaces.filter((x) => x !== m)
        : [...form.marketplaces, m]
    );
  }

  const { data: perfil } = useLiveQuery(meuPerfil);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (!form.empresa.trim()) novosErros.empresa = "Informe o nome da empresa.";
    if (!form.dataEntrada) novosErros.dataEntrada = "Informe a data de entrada.";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const dados = {
      ...form,
      empresa: form.empresa.trim(),
      responsavel: ouInfoNecessaria(form.responsavel),
      segmento: ouInfoNecessaria(form.segmento),
      proximaAcao: ouInfoNecessaria(form.proximaAcao),
      proximaReuniao: form.proximaReuniao || null,
      // A agência é vinculada em Zion › Agências, não aqui; ao editar, preserva.
      agenciaId: inicial?.agenciaId ?? null,
    };

    if (inicial) {
      await atualizarCliente(inicial.id, dados);
      router.push(`/clientes/${inicial.id}`);
      return;
    }

    if (perfil?.papel === "agencia") {
      // A agência não escreve em `clientes` pelo navegador — a 054 não lhe deu
      // INSERT, de propósito. A loja nasce no servidor, com a `agencia_id`
      // vinda do PERFIL, e o resto do formulário entra logo depois por UPDATE,
      // que ela já pode fazer na própria loja (`agencia_edita_as_lojas`).
      //
      // Dois passos em vez de um para NÃO perder o que a pessoa digitou: a
      // rota aceita só o nome, e descartar os outros campos em silêncio seria
      // pior que a chamada a mais.
      const id = await criarLojaDaAgencia(dados.empresa);
      // `agenciaId` fica de fora: mandá-lo como `null` desvincularia a loja da
      // carteira no instante seguinte ao de criá-la nela.
      const { agenciaId: _ignorado, ...semVinculo } = dados;
      await atualizarCliente(id, semVinculo);
      router.push(`/clientes/${id}`);
      return;
    }

    const criado = await criarCliente(dados);
    router.push(`/clientes/${criado.id}`);
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <FormGrid>
          <Field label="Nome da empresa" required error={erros.empresa}>
            <Input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} placeholder="Ex.: TechSound Brasil" />
          </Field>
          <Field label="Responsável">
            <Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Nome do contato principal" />
          </Field>
          <Field label="Segmento">
            <Input value={form.segmento} onChange={(e) => set("segmento", e.target.value)} placeholder="Ex.: Eletrônicos / Áudio" />
          </Field>
          <Field label="Plano contratado">
            <Select options={planosComOAtual} value={form.plano} onChange={(e) => set("plano", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select options={CLIENTE_STATUS} value={form.status} onChange={(e) => set("status", e.target.value as Cliente["status"])} />
          </Field>
          <Field label="Risco">
            <Select options={RISCOS} value={form.risco} onChange={(e) => set("risco", e.target.value as Cliente["risco"])} />
          </Field>
          <Field label="Data de entrada" required error={erros.dataEntrada}>
            <Input type="date" value={form.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} />
          </Field>
          <Field label="Próxima reunião">
            <Input type="date" value={form.proximaReuniao} onChange={(e) => set("proximaReuniao", e.target.value)} />
          </Field>
        </FormGrid>

        <div className="mt-4">
          <Field label="Marketplaces ativos">
            <div className="flex flex-wrap gap-2">
              {MARKETPLACES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMarketplace(m)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    form.marketplaces.includes(m)
                      ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Próxima ação" hint="Se ficar em branco, será salvo como “Informação necessária”.">
            <Input value={form.proximaAcao} onChange={(e) => set("proximaAcao", e.target.value)} placeholder="Qual o próximo passo com este cliente?" />
          </Field>
          <Field label="Observações">
            <TextArea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit">{inicial ? "Salvar alterações" : "Criar cliente"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
