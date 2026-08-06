"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Play, CheckCircle2, AlertTriangle, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { listarProdutosDoCliente } from "@/lib/services/produtos";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import {
  enfileirarProdutos,
  statusFila,
  limparConcluidos,
  type StatusFila,
} from "@/lib/services/filaOtimizacaoProduto";
import type { Produto } from "@/lib/types";

const SELECT =
  "rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-sm text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500";

export default function OtimizarLoteEquipe() {
  const { data: clientes } = useLiveQuery(listarClientes);
  const [clienteId, setClienteId] = useState("");

  useEffect(() => {
    if (!clienteId && clientes && clientes.length > 0) setClienteId(clientes[0].id);
  }, [clientes, clienteId]);

  const { data: produtos } = useLiveQuery(
    () => (clienteId ? listarProdutosDoCliente(clienteId) : Promise.resolve<Produto[]>([])),
    [clienteId]
  );
  const { data: anuncios, reload: reloadAnuncios } = useLiveQuery(
    () => (clienteId ? listarAnunciosGeradosDoCliente(clienteId) : Promise.resolve([])),
    [clienteId]
  );

  // Otimizações reais (anúncios importados do ML não contam).
  const otimizados = useMemo(() => {
    const s = new Set<string>();
    for (const a of anuncios ?? []) {
      if (a.produtoId && !(a.observacoes ?? "").startsWith("Importado")) s.add(a.produtoId);
    }
    return s;
  }, [anuncios]);
  const pendentes = useMemo(
    () => (produtos ?? []).filter((p) => !otimizados.has(p.id)),
    [produtos, otimizados]
  );

  const [fila, setFila] = useState<StatusFila | null>(null);
  const [enfileirando, setEnfileirando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ativosAntes = useRef(0);

  useEffect(() => {
    if (!clienteId) {
      setFila(null);
      return;
    }
    let vivo = true;
    async function tick() {
      try {
        const s = await statusFila(clienteId);
        if (!vivo) return;
        setFila(s);
        const ativos = s.pendente + s.processando;
        if (ativosAntes.current > 0 && ativos === 0) reloadAnuncios();
        ativosAntes.current = ativos;
      } catch {
        /* ignora polling */
      }
    }
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [clienteId, reloadAnuncios]);

  async function enfileirar(lista: Produto[]) {
    if (enfileirando || !clienteId || lista.length === 0) return;
    const cliente = clientes?.find((c) => c.id === clienteId)?.empresa ?? "o cliente";
    if (
      !window.confirm(
        `Enfileirar ${lista.length} produto(s) de ${cliente} para a IA otimizar no servidor (roda sozinho, sem aba aberta)?`
      )
    )
      return;
    setEnfileirando(true);
    setErro(null);
    setMsg(null);
    try {
      const n = await enfileirarProdutos(clienteId, lista.map((p) => p.id));
      setMsg(`${n} produto(s) na fila. O servidor processa sozinho — acompanhe abaixo.`);
      setFila(await statusFila(clienteId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enfileirar.");
    } finally {
      setEnfileirando(false);
    }
  }

  async function limpar() {
    try {
      await limparConcluidos(clienteId);
      setFila(await statusFila(clienteId));
    } catch {
      /* ignora */
    }
  }

  const total = (produtos ?? []).length;
  const ativos = (fila?.pendente ?? 0) + (fila?.processando ?? 0);
  const feito = fila ? fila.concluido + fila.erro : 0;
  const pct = fila && fila.total > 0 ? Math.round((feito / fila.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Otimizar em Massa"
        description="Enfileira a esteira completa (título, descrição, SEO, ficha, medidas, FAQ e plano) de um cliente. Roda no servidor, sem depender da aba aberta."
      />

      <Card title="Cliente">
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={SELECT}>
          {(clientes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.empresa}
            </option>
          ))}
        </select>

        {clienteId && total === 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-zinc-500">
            <Package size={16} /> Esse cliente ainda não tem produtos na base.
          </p>
        )}

        {clienteId && total > 0 && (
          <div className="mt-4 rounded-xl border border-violet-500/15 bg-violet-500/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  <Sparkles size={15} className="text-violet-400" /> Otimizar tudo
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {pendentes.length} de {total} produto(s) ainda sem otimização.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pendentes.length > 0 && (
                  <Button onClick={() => enfileirar(pendentes)} disabled={enfileirando}>
                    <Play size={14} /> Otimizar tudo ({pendentes.length})
                  </Button>
                )}
                <Button
                  variant={pendentes.length > 0 ? "ghost" : "primary"}
                  onClick={() => enfileirar(produtos ?? [])}
                  disabled={enfileirando}
                >
                  <Sparkles size={14} /> Reotimizar todos ({total})
                </Button>
              </div>
            </div>

            {fila && fila.total > 0 && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <span className="text-emerald-400">{fila.concluido} concluídos</span>
                  {fila.processando > 0 && <span className="text-violet-300">{fila.processando} processando</span>}
                  <span>{fila.pendente} na fila</span>
                  {fila.erro > 0 && <span className="text-amber-400">{fila.erro} com erro</span>}
                  {ativos > 0 ? (
                    <span className="ml-auto flex items-center gap-1 text-violet-300">
                      <Sparkles size={12} className="animate-pulse" /> processando no servidor…
                    </span>
                  ) : fila.concluido > 0 || fila.erro > 0 ? (
                    <button onClick={limpar} className="ml-auto text-zinc-500 hover:text-zinc-300">
                      Limpar finalizados
                    </button>
                  ) : null}
                </div>
                {ativos === 0 && feito > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 size={13} /> Terminou — anúncios atualizados (veja em Anúncios/Aprovações).
                  </p>
                )}
              </div>
            )}

            {msg && (
              <p className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={15} /> {msg}
              </p>
            )}
            {erro && (
              <p className="mt-2 flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle size={15} /> {erro}
              </p>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
