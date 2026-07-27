"use client";

// A Missão de republicação — a interface da decisão.
//
// Não decide nada e não sabe publicar: recebe a Missão já montada pelo núcleo
// puro (`modules/publication/domain/republicacao`) e devolve a escolha de quem
// vende. Toda a regra — quais caminhos existem, qual é o recomendado, o que
// exige declaração — vem de lá; aqui só se pinta.

import { useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DECLARACAO_DIFERENCA,
  escolhaPodeSeguir,
  type EscolhaRepublicacao,
  type MissaoRepublicacao as Missao,
} from "@/modules/publication/domain/republicacao";

export function MissaoRepublicacao({
  missao,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  missao: Missao;
  ocupado: boolean;
  onConfirmar: (escolha: Exclude<EscolhaRepublicacao, "cancelar">) => void;
  onCancelar: () => void;
}) {
  const [escolha, setEscolha] = useState<EscolhaRepublicacao | null>(null);
  const [declarou, setDeclarou] = useState(false);

  const opcaoAtual = missao.opcoes.find((o) => o.escolha === escolha);
  const podeSeguir = escolhaPodeSeguir(missao, escolha, declarou) && !ocupado;

  function confirmar() {
    if (!podeSeguir || !escolha) return;
    if (escolha === "cancelar") return onCancelar();
    onConfirmar(escolha);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-amber-500/30 bg-[#0e0e16]">
        <div className="flex items-start gap-2.5 border-b border-white/5 px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-white">{missao.titulo}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{missao.situacao}</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {missao.ativos.some((a) => a.mlPermalink) && (
            <div className="flex flex-wrap gap-2">
              {missao.ativos.map((a) =>
                a.mlPermalink ? (
                  <a
                    key={a.registroId}
                    href={a.mlPermalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/20"
                  >
                    <ExternalLink size={12} /> {a.mlItemId}
                  </a>
                ) : null
              )}
            </div>
          )}

          {missao.opcoes.map((o) => {
            const ativa = escolha === o.escolha;
            return (
              <label
                key={o.escolha}
                className={`block cursor-pointer rounded-lg border p-3 transition ${
                  ativa
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="escolha-republicacao"
                    className="mt-1 accent-violet-500"
                    checked={ativa}
                    onChange={() => {
                      setEscolha(o.escolha);
                      setDeclarou(false); // trocar de caminho reabre a trava
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {o.rotulo}
                      {o.recomendada && (
                        <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                          recomendado
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{o.consequencia}</p>
                  </div>
                </div>
              </label>
            );
          })}

          {opcaoAtual?.exigeDeclaracao && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
              <input
                type="checkbox"
                className="mt-0.5 accent-amber-500"
                checked={declarou}
                onChange={(e) => setDeclarou(e.target.checked)}
              />
              <span className="text-xs leading-relaxed text-amber-300">{DECLARACAO_DIFERENCA}</span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3">
          <Button variant="ghost" onClick={onCancelar} disabled={ocupado}>
            Voltar
          </Button>
          <Button onClick={confirmar} disabled={!podeSeguir}>
            {ocupado ? "Executando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
