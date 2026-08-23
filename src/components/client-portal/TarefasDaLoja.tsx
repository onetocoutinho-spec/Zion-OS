"use client";

// "SUAS TAREFAS" — a lista que a loja decidiu fazer (tabela `tarefas_da_loja`,
// 069). Nasce das confirmações do Copilot ("cria as tarefas") e fica aqui, na
// home, até ser feita ou descartada. Some quando não há nada — uma seção
// vazia com "nenhuma tarefa" seria ruído na tela que mais se abre.

import { useState } from "react";
import Link from "next/link";
import { Check, ListTodo, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useLiveQuery } from "@/lib/hooks";
import { notificarMudanca } from "@/lib/store";
import { useClientPortal } from "./context";
import { concluirTarefa, listarTarefasAbertas } from "@/lib/services/tarefasDaLoja";

export function TarefasDaLoja() {
  const { clienteId } = useClientPortal();
  const { data, erro } = useLiveQuery(() => listarTarefasAbertas(clienteId), [clienteId]);
  const [mexendo, setMexendo] = useState<string | null>(null);
  const tarefas = data ?? [];
  // Tabela ainda não existe (069 não aplicada) ou nada aberto: a seção some.
  if (erro || tarefas.length === 0) return null;

  async function concluir(id: string, status: "feita" | "descartada") {
    setMexendo(id);
    try {
      await concluirTarefa(id, status);
      notificarMudanca();
    } finally {
      setMexendo(null);
    }
  }

  const cor = { alta: "text-amber-300", media: "text-zinc-400", baixa: "text-zinc-500" } as const;

  return (
    <Card title={`Suas tarefas (${tarefas.length})`}>
      <ul className="divide-y divide-white/5">
        {tarefas.map((t) => (
          <li key={t.id} className="flex items-start gap-3 py-2.5">
            <ListTodo size={14} className="mt-0.5 shrink-0 text-violet-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-100">
                {t.produtoId ? (
                  <Link href={`/cliente/anunciar?produto=${t.produtoId}`} className="hover:text-violet-300">
                    {t.titulo}
                  </Link>
                ) : (
                  t.titulo
                )}
              </p>
              {t.motivo && <p className="text-xs text-zinc-500">{t.motivo}</p>}
              <p className={`text-[10px] uppercase ${cor[t.prioridade]}`}>
                {t.prioridade}
                {t.origem === "copilot" ? " · pelo assistente" : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => void concluir(t.id, "feita")}
                disabled={mexendo === t.id}
                aria-label="Marcar como feita"
                className="rounded-lg p-1.5 text-emerald-300 transition hover:bg-white/5 disabled:opacity-40 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => void concluir(t.id, "descartada")}
                disabled={mexendo === t.id}
                aria-label="Descartar"
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-40 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
              >
                <X size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
