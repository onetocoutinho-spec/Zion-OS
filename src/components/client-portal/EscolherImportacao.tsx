"use client";

// A pergunta que substituiu cinco botões: "o que você tem?"
//
// O cabeçalho de Meus Produtos tinha sete botões, seis deles portas de entrada
// de dado, cada um com o nome do NOSSO recorte — "Planilha", "Custos", "Peso" —
// e o que cada um aceitava escondido num `title=`. Ninguém sabe se o arquivo
// dela é "Planilha" ou "Custos". Ela sabe o que o fornecedor mandou.
//
// Aqui cada opção diz, ANTES do clique, o que é e o que precisa ter. Descobrir
// que faltava uma coluna depois de escolher o arquivo é a forma cara de
// aprender — o erro só chega quando a escolha já foi feita.
//
// Este componente não importa nada: ele escolhe. Quem importa continua sendo
// quem já importava.

import { FileText, FileSpreadsheet, Store, Calculator, Weight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  FONTES_DE_IMPORTACAO,
  type FonteDeImportacao,
} from "@/modules/catalog/domain/fontesDeImportacao";

const ICONE: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  catalogo: FileText,
  planilha: FileSpreadsheet,
  ml: Store,
  custos: Calculator,
  peso: Weight,
};

export function EscolherImportacao({
  onEscolher,
  onFechar,
  ocupado,
  baseVazia,
}: {
  onEscolher: (fonte: FonteDeImportacao) => void;
  onFechar: () => void;
  /** Trava tudo enquanto uma importação roda — duas ao mesmo tempo se atropelam. */
  ocupado?: boolean;
  /** Sem produto nenhum, as que só COMPLETAM não têm o que completar. */
  baseVazia?: boolean;
}) {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">O que você tem?</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Escolha de onde os dados vêm. Nada é gravado sem você conferir antes.
          </p>
        </div>
        <Button variant="ghost" onClick={onFechar} disabled={ocupado}>
          <X size={15} /> Fechar
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FONTES_DE_IMPORTACAO.map((f) => {
          const Icone = ICONE[f.id] ?? FileSpreadsheet;
          // Sem produto na base, "só os custos" não tem o que completar. Fica
          // visível e desligado, com o motivo — some do nada ensinaria menos.
          const semAlvo = Boolean(baseVazia) && !f.cria;
          const travado = Boolean(ocupado) || semAlvo;
          return (
            <button
              key={f.id}
              type="button"
              disabled={travado}
              onClick={() => onEscolher(f)}
              className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-violet-500/40 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/[0.02]"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <Icone size={15} className="shrink-0 text-violet-400" />
                {f.titulo}
              </span>
              <span className="text-xs leading-relaxed text-zinc-500">{f.frase}</span>
              {semAlvo ? (
                <span className="text-[11px] text-amber-400/80">
                  Importe seus produtos primeiro — não há o que completar ainda.
                </span>
              ) : (
                f.exige && <span className="text-[11px] text-zinc-600">Precisa: {f.exige}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
