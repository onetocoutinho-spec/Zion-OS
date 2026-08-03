"use client";

// O que o Mercado Livre está cobrando da conta — em ordem de fazer.
//
// ===========================================================================
// POR QUE ESTE BLOCO EXISTE
// ===========================================================================
//
// Em 02/08/2026 a leitura completa da conta produziu o primeiro retrato
// honesto da loja — e ele apareceu numa FAIXA DE UMA LINHA que some quando a
// tela recarrega:
//
//     "535 fora (menores: MLB4819774959 165x93, ...)"
//
// Número agregado, sem ordem, sem link, sem dizer por onde começar. A lojista
// lia "535 capas fora do padrão" e não tinha o que fazer com a frase.
//
// ===========================================================================
// DUAS DECISÕES
// ===========================================================================
//
// NÃO grava nada. Usa o modo `medir`, o mesmo do "Só conferir": lê o Mercado
// Livre e não toca no banco. Uma tela de diagnóstico que altera o catálogo
// enquanto diagnostica é uma tela em que ninguém clica duas vezes.
//
// NÃO carrega sozinha. São 781 anúncios e ~40 requisições ao ML; disparar isso
// a cada abertura de página gastaria a cota da conta dela para mostrar um
// número que ela talvez não tenha vindo ver. O botão é o consentimento.

import { useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, ShieldAlert, TrendingDown, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { importarAnunciosDoCliente } from "@/lib/services/importarAnunciosML";
import type { PendenciaDaConta, Gravidade } from "@/modules/integration/domain/pendenciasDaConta";

const ROTULO: Record<PendenciaDaConta["tipo"], string> = {
  bloqueado: "Bloqueados pelo Mercado Livre",
  capa: "Foto de capa fora do padrão",
  "sem-estoque": "Sem estoque",
  "em-revisao": "Aguardando correção",
  "sem-motivo": "Fora do ar sem motivo informado",
};

const TOM: Record<Gravidade, { caixa: string; icone: typeof ShieldAlert; texto: string }> = {
  conta: { caixa: "border-red-500/30 bg-red-500/[0.04]", icone: ShieldAlert, texto: "text-red-300" },
  receita: {
    caixa: "border-amber-500/30 bg-amber-500/[0.04]",
    icone: TrendingDown,
    texto: "text-amber-300",
  },
  atencao: { caixa: "border-white/10 bg-white/[0.02]", icone: Info, texto: "text-zinc-300" },
};

const EXPLICACAO: Record<Gravidade, string> = {
  // A ordem precisa se explicar, senão parece arbitrária — e ordem que parece
  // arbitrária é ignorada.
  conta: "Pode custar a conta inteira, não só o anúncio. Resolva estes primeiro.",
  receita: "Está impedindo de vender agora. Em ordem de estoque parado.",
  atencao: "Bom saber. Sem urgência.",
};

export function PendenciasDaConta({ clienteId, cliente }: { clienteId: string; cliente: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    itens: PendenciaDaConta[];
    totais: { tipo: PendenciaDaConta["tipo"]; quantas: number }[];
    estoqueTravado: number;
    lidos: number;
  } | null>(null);

  async function conferir() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await importarAnunciosDoCliente(clienteId, cliente, "medir");
      if (!r.medicao) {
        setErro(r.aviso ?? "Não consegui ler os anúncios no Mercado Livre.");
        return;
      }
      const p = r.medicao.pendenciasDaConta;
      setResultado({ ...p, lidos: r.medicao.anuncios });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao conferir a conta.");
    } finally {
      setCarregando(false);
    }
  }

  const grupos: Gravidade[] = ["conta", "receita", "atencao"];

  return (
    <section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">O que o Mercado Livre está cobrando</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Lê a sua conta e lista o que precisa de você, em ordem. Não altera nada.
          </p>
        </div>
        <Button variant="ghost" onClick={conferir} disabled={carregando}>
          <RefreshCw size={15} className={carregando ? "animate-spin" : undefined} />
          {carregando ? "Conferindo…" : "Conferir agora"}
        </Button>
      </div>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

      {resultado && resultado.itens.length === 0 && !erro && (
        // "Nada pendente" só pode ser dito depois de ter lido. Antes disso a
        // seção não afirma coisa nenhuma — foi o defeito que esta mesma tela já
        // teve: dizer "você está em dia" enquanto carregava.
        <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400">
          Li {resultado.lidos} anúncios e não encontrei nada que precise de você agora.
        </p>
      )}

      {resultado && resultado.itens.length > 0 && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-zinc-500">
            {resultado.lidos} anúncios lidos ·{" "}
            {resultado.totais.map((t) => `${t.quantas} ${ROTULO[t.tipo].toLowerCase()}`).join(" · ")}
            {resultado.estoqueTravado > 0 && (
              <>
                {" "}
                · <strong className="text-amber-400">{resultado.estoqueTravado} peças</strong> paradas
                atrás disso
              </>
            )}
          </p>

          {grupos.map((g) => {
            const doGrupo = resultado.itens.filter((p) => p.gravidade === g);
            if (doGrupo.length === 0) return null;
            const { caixa, icone: Icone, texto } = TOM[g];
            const total = resultado.totais
              .filter((t) => doGrupo.some((p) => p.tipo === t.tipo))
              .reduce((n, t) => n + t.quantas, 0);
            return (
              <div key={g} className={`rounded-lg border p-3 ${caixa}`}>
                <p className={`flex items-center gap-1.5 text-sm font-medium ${texto}`}>
                  <Icone size={15} /> {EXPLICACAO[g]}
                </p>
                <ul className="mt-2 space-y-2">
                  {doGrupo.map((p) => (
                    <li key={`${p.tipo}-${p.mlb}`} className="text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-zinc-200">{p.titulo}</span>
                        {p.estoque > 0 && (
                          <span className="text-xs text-zinc-500">{p.estoque} em estoque</span>
                        )}
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-300 underline hover:text-violet-200"
                        >
                          <ExternalLink size={11} /> abrir no ML
                        </a>
                      </div>
                      <p className="text-xs text-zinc-400">{p.oQueFazer}</p>
                      <p className="text-xs text-zinc-600">{p.porque}</p>
                    </li>
                  ))}
                </ul>
                {/* O recorte é DITO. Mostrar 25 de 535 é útil; deixar parecer
                    que são 25 seria a mesma mentira do agregado sem ordem. */}
                {total > doGrupo.length && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Mostrando {doGrupo.length} de {total}. Resolva estes e confira de novo.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
