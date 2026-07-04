"use client";

import { CheckCircle2, Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveQuery } from "@/lib/hooks";
import { listarTemplates } from "@/lib/services/categoriaTemplates";

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{titulo}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {itens.map((i) => (
          <span key={i} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { data: templates } = useLiveQuery(listarTemplates);

  return (
    <div>
      <PageHeader
        title="Templates de categoria"
        description="O molde de cada nicho: o que é obrigatório, como varia e o que checar antes de publicar. Guia da equipe e contexto dos agentes."
        count={templates?.length}
        countLabel="templates"
      />

      {templates && templates.length === 0 && (
        <EmptyState mensagem="Nenhum template cadastrado ainda." />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {(templates ?? []).map((t) => (
          <Card
            key={t.id}
            title={t.nomeTemplate}
            action={<Badge tone="gray">{t.marketplace}</Badge>}
          >
            <div className="mb-3 flex items-center gap-2">
              <Layers size={15} className="text-violet-400" />
              <span className="text-sm text-zinc-300">{t.categoriaZion}</span>
            </div>
            <p className="mb-4 text-sm text-zinc-400">{t.descricao}</p>

            <div className="space-y-4">
              <Bloco titulo="Campos obrigatórios" itens={t.camposObrigatorios} />
              <Bloco titulo="Campos recomendados" itens={t.camposRecomendados} />
              <Bloco titulo="Atributos do marketplace" itens={t.atributosMarketplace} />

              {t.regrasVariacao && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Regras de variação</p>
                  <p className="mt-1 text-sm text-zinc-300">{t.regrasVariacao}</p>
                </div>
              )}

              {t.checklistCategoria.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Checklist do anúncio</p>
                  <ul className="mt-1.5 space-y-1">
                    {t.checklistCategoria.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-zinc-300">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500/70" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Bloco titulo="Agentes recomendados" itens={t.agentesRecomendados} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
