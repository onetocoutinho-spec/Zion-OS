"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Package, Search, Wand2, Upload, X, Store, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { ImportarProdutos } from "@/components/client-portal/ImportarProdutos";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { importarAnunciosDoCliente } from "@/lib/services/importarAnunciosML";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import { listarAuditorias } from "@/lib/services/auditorias";
import { mapaScorePorProduto, toneScore } from "@/lib/client-portal/metrics";
import { formatBRL } from "@/lib/format";
import { toneFor } from "@/lib/status";
import type { Produto } from "@/lib/types";

const MARKETPLACES = ["Mercado Livre", "TikTok Shop", "Shopee", "Amazon"] as const;
const STATUS = ["Otimizado", "Em revisão", "Sem otimização"] as const;
const SCORES = ["Alto (70+)", "Médio (40-69)", "Baixo (0-39)", "Sem score"] as const;

export default function ClienteProdutos() {
  const { clienteId, nome } = useClientPortal();
  const { data: produtos, reload } = useLiveQuery(listarProdutos);
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: auditorias } = useLiveQuery(listarAuditorias);

  const [fMarket, setFMarket] = useState("Todos");
  const [fStatus, setFStatus] = useState("Todos");
  const [fScore, setFScore] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [mostrarImport, setMostrarImport] = useState(false);
  const [importandoML, setImportandoML] = useState(false);
  const [msgML, setMsgML] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function importarDoML() {
    if (importandoML) return;
    if (
      !window.confirm(
        "Importar do Mercado Livre substitui a importação anterior do ML (produtos e anúncios vindos do ML) e traz tudo de novo, agrupado. Continuar?"
      )
    )
      return;
    setImportandoML(true);
    setMsgML(null);
    try {
      const r = await importarAnunciosDoCliente(clienteId, nome);
      if (r.aviso) {
        setMsgML({ tipo: "erro", texto: r.aviso });
      } else {
        setMsgML({
          tipo: "ok",
          texto:
            r.produtos === 0
              ? `Nenhum anúncio novo (todos os ${r.pulados} já estavam importados).`
              : `${r.produtos} produtos · ${r.anuncios} anúncios do ML${r.variacoes > 0 ? ` · ${r.variacoes} variações` : ""}${r.pulados > 0 ? ` · ${r.pulados} já existiam` : ""}.`,
        });
        reload();
      }
    } catch (e) {
      setMsgML({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao importar do ML." });
    } finally {
      setImportandoML(false);
    }
  }

  const scorePorProduto = useMemo(
    () => mapaScorePorProduto(anuncios ?? [], auditorias ?? []),
    [anuncios, auditorias]
  );

  // Estado de otimização por produto (a partir do anúncio mais recente).
  const estadoPorProduto = useMemo(() => {
    const mapa = new Map<string, "Otimizado" | "Em revisão" | "Sem otimização">();
    [...(anuncios ?? [])]
      .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
      .forEach((a) => {
        if (!a.produtoId || mapa.has(a.produtoId)) return;
        mapa.set(
          a.produtoId,
          a.status === "aprovado" || a.status === "publicado" ? "Otimizado" : "Em revisão"
        );
      });
    return mapa;
  }, [anuncios]);

  function statusDoProduto(p: Produto) {
    return estadoPorProduto.get(p.id) ?? "Sem otimização";
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (produtos ?? []).filter((p) => {
      if (fMarket !== "Todos" && p.marketplace !== fMarket) return false;
      if (fStatus !== "Todos" && statusDoProduto(p) !== fStatus) return false;
      if (fScore !== "Todos") {
        const s = scorePorProduto.get(p.id) ?? null;
        const faixa =
          s == null ? "Sem score" : s >= 70 ? "Alto (70+)" : s >= 40 ? "Médio (40-69)" : "Baixo (0-39)";
        if (faixa !== fScore) return false;
      }
      if (q && !`${p.nome} ${p.sku} ${p.codErp ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, fMarket, fStatus, fScore, busca, estadoPorProduto, scorePorProduto]);

  const total = (produtos ?? []).length;

  return (
    <>
      <PageHeader
        titulo="Meus Produtos"
        subtitulo="Sua base de produtos. Otimize cada um com a IA para vender melhor."
        acao={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={importarDoML} disabled={importandoML} title="Puxar os anúncios já cadastrados na sua conta do Mercado Livre">
              {importandoML ? <Loader2 size={15} className="animate-spin" /> : <Store size={15} />}{" "}
              {importandoML ? "Importando…" : "Importar do ML"}
            </Button>
            <Button variant="ghost" onClick={() => setMostrarImport((v) => !v)}>
              {mostrarImport ? <X size={15} /> : <Upload size={15} />}{" "}
              {mostrarImport ? "Fechar" : "Planilha"}
            </Button>
            <Link href="/cliente/otimizar">
              <Button>
                <Wand2 size={15} /> Otimizar com IA
              </Button>
            </Link>
          </div>
        }
      />

      {msgML && (
        <p
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            msgML.tipo === "ok"
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
              : "border-amber-500/20 bg-amber-500/5 text-amber-400"
          }`}
        >
          {msgML.tipo === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {msgML.texto}
        </p>
      )}

      {(mostrarImport || total === 0) && (
        <ImportarProdutos onImportado={() => setMostrarImport(false)} />
      )}

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-[#0e0e16] px-6 py-8 text-center text-sm text-zinc-500">
          <Package size={20} className="mx-auto mb-2 text-zinc-600" />
          Sua base ainda está vazia. Importe sua planilha acima para começar.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-zinc-500 focus-within:border-violet-500/50">
              <Search size={14} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-500"
              />
            </div>
            <FilterSelect label="Marketplace" value={fMarket} options={MARKETPLACES} onChange={setFMarket} />
            <FilterSelect label="Status" value={fStatus} options={STATUS} onChange={setFStatus} />
            <FilterSelect label="Score" value={fScore} options={SCORES} onChange={setFScore} />
            <span className="ml-auto text-xs text-zinc-500">
              {filtrados.length} de {total} produtos
            </span>
          </div>

          <Table headers={["Produto", "Marketplace", "Estoque", "Preço", "Status", "Score IA", "Ação"]}>
            {filtrados.length === 0 ? (
              <EmptyRow colSpan={7} />
            ) : (
              filtrados.map((p) => {
                const status = statusDoProduto(p);
                const score = scorePorProduto.get(p.id) ?? null;
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <TdMain sub={p.sku || p.codErp || undefined}>{p.nome}</TdMain>
                    <Td>{p.marketplace}</Td>
                    <Td className={p.estoque <= 0 ? "text-red-400" : ""}>{p.estoque}</Td>
                    <Td>{formatBRL(p.precoVenda)}</Td>
                    <Td>
                      <Pill tone={toneFor(status)}>{status}</Pill>
                    </Td>
                    <Td>
                      {score != null ? (
                        <Pill tone={toneScore(score)}>{score}/100</Pill>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </Td>
                    <Td>
                      <Link
                        href="/cliente/otimizar"
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
                      >
                        <Wand2 size={12} /> Otimizar
                      </Link>
                    </Td>
                  </tr>
                );
              })
            )}
          </Table>
        </>
      )}
    </>
  );
}
