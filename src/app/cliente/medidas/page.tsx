"use client";

import { useMemo, useRef, useState } from "react";
import {
  Ruler,
  Plus,
  Upload,
  Trash2,
  Save,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import {
  listarTabelasDoCliente,
  criarTabelaMedida,
  atualizarTabelaMedida,
  excluirTabelaMedida,
  criarTabelasBulk,
} from "@/lib/services/tabelasMedidasCliente";
import { MODELOS_PADRAO } from "@/modules/catalog/domain/tabelasMedidas";
import { normalizarHeader } from "@/lib/csv";
import { lerPlanilha, type PlanilhaLida } from "@/lib/planilha";
import type { LinhaMedida, TabelaMedida } from "@/lib/types";

interface Rascunho {
  id: string | null;
  nome: string;
  marca: string;
  comoMedir: string;
  linhasTexto: string;
}

const VAZIO: Rascunho = { id: null, nome: "", marca: "", comoMedir: "", linhasTexto: "" };

function parseLinhas(texto: string): LinhaMedida[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.+?)\s*(?:\t|=|;|\s{2,})\s*(.+)$/);
      return m ? { rotulo: m[1].trim(), valor: m[2].trim() } : { rotulo: l, valor: "" };
    });
}

function formatLinhas(linhas: LinhaMedida[]): string {
  return linhas.map((l) => `${l.rotulo} = ${l.valor}`).join("\n");
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Agrupa uma planilha (marca, numeração, medida) em tabelas por marca. */
function planilhaParaTabelas(planilha: PlanilhaLida): { marca: string; linhas: LinhaMedida[] }[] {
  const { headers, linhas } = planilha;
  const acha = (nomes: string[]) => headers.find((h) => nomes.includes(normalizarHeader(h)));
  const hMarca = acha(["marca"]);
  const hRot = acha(["numeracao", "tamanho", "rotulo", "numero", "num"]);
  const hVal = acha(["medida", "cm", "valor", "comprimento", "palmilha", "comp_palmilha", "pe"]);
  if (!hMarca || !hRot) return [];
  const mapa = new Map<string, LinhaMedida[]>();
  for (const row of linhas) {
    const marca = (row[hMarca] ?? "").trim();
    const rotulo = (row[hRot] ?? "").trim();
    const valor = (hVal ? row[hVal] ?? "" : "").trim();
    if (!marca || !rotulo) continue;
    const arr = mapa.get(marca) ?? [];
    arr.push({ rotulo, valor });
    mapa.set(marca, arr);
  }
  return [...mapa.entries()].map(([marca, ls]) => ({ marca, linhas: ls }));
}

export default function ClienteMedidas() {
  const { clienteId } = useClientPortal();
  const { data: tabelas, reload } = useLiveQuery(
    () => listarTabelasDoCliente(clienteId),
    [clienteId]
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const [rasc, setRasc] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const marcasExistentes = useMemo(
    () => new Set((tabelas ?? []).map((t) => norm(t.marca)).filter(Boolean)),
    [tabelas]
  );

  function novo() {
    setMsg(null);
    setRasc({ ...VAZIO });
  }
  function editar(t: TabelaMedida) {
    setMsg(null);
    setRasc({
      id: t.id,
      nome: t.nome,
      marca: t.marca,
      comoMedir: t.comoMedir,
      linhasTexto: formatLinhas(t.linhas),
    });
  }

  async function salvar() {
    if (!rasc || salvando) return;
    const linhas = parseLinhas(rasc.linhasTexto);
    if (!rasc.nome.trim() && !rasc.marca.trim()) {
      setMsg({ tipo: "erro", texto: "Dê um nome ou uma marca à tabela." });
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        nome: rasc.nome.trim() || rasc.marca.trim(),
        marca: rasc.marca.trim(),
        comoMedir: rasc.comoMedir.trim(),
        linhas,
      };
      if (rasc.id) await atualizarTabelaMedida(rasc.id, dados);
      else await criarTabelaMedida({ ...dados, clienteId });
      setRasc(null);
      setMsg({ tipo: "ok", texto: "Tabela salva." });
      reload();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setSalvando(false);
    }
  }

  async function remover(t: TabelaMedida) {
    if (!window.confirm(`Excluir a tabela "${t.nome || t.marca}"?`)) return;
    setBusy(true);
    try {
      await excluirTabelaMedida(t.id);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function importarModelos() {
    setBusy(true);
    setMsg(null);
    try {
      const novos = MODELOS_PADRAO.filter((m) => !marcasExistentes.has(norm(m.marca))).map((m) => ({
        clienteId,
        nome: m.nome,
        marca: m.marca,
        comoMedir: m.comoMedir,
        linhas: m.linhas,
      }));
      if (novos.length === 0) {
        setMsg({ tipo: "ok", texto: "Todos os modelos já estavam cadastrados." });
      } else {
        await criarTabelasBulk(novos);
        setMsg({ tipo: "ok", texto: `${novos.length} tabela(s) de modelo importadas. Edite à vontade.` });
        reload();
      }
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao importar modelos." });
    } finally {
      setBusy(false);
    }
  }

  async function importarCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const planilha = await lerPlanilha(file);
      const grupos = planilhaParaTabelas(planilha);
      if (grupos.length === 0) {
        setMsg({ tipo: "erro", texto: "Planilha sem colunas reconhecidas (marca, numeração, medida)." });
        return;
      }
      const novos = grupos
        .filter((g) => !marcasExistentes.has(norm(g.marca)))
        .map((g) => ({ clienteId, nome: g.marca, marca: g.marca, comoMedir: "", linhas: g.linhas }));
      const pulados = grupos.length - novos.length;
      if (novos.length > 0) await criarTabelasBulk(novos);
      setMsg({
        tipo: "ok",
        texto: `${novos.length} tabela(s) importada(s)${pulados > 0 ? ` · ${pulados} já existiam (marca)` : ""}.`,
      });
      reload();
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao ler o CSV." });
    } finally {
      setBusy(false);
    }
  }

  const lista = tabelas ?? [];

  return (
    <>
      <PageHeader
        titulo="Tabelas de medidas"
        subtitulo="Suas tabelas por marca (ou avulsas). A com marca preenchida vale para todos os produtos daquela marca — a IA usa na hora de otimizar."
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={importarModelos} disabled={busy}>
              <Sparkles size={15} /> Importar modelos
            </Button>
            <Button variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload size={15} /> Importar planilha
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={importarCsv}
              />
            </Button>
            <Button onClick={novo}>
              <Plus size={15} /> Nova tabela
            </Button>
          </div>
        }
      />

      {msg && (
        <p
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            msg.tipo === "ok"
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
              : "border-amber-500/20 bg-amber-500/5 text-amber-400"
          }`}
        >
          {msg.tipo === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {msg.texto}
        </p>
      )}

      {rasc && (
        <Card title={rasc.id ? "Editar tabela" : "Nova tabela"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">
              Nome
              <input
                value={rasc.nome}
                onChange={(e) => setRasc({ ...rasc, nome: e.target.value })}
                placeholder="Ex.: Havaianas / Camiseta P-M-G"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500"
              />
            </label>
            <label className="text-xs text-zinc-400">
              Marca (aplica a todos os produtos desta marca)
              <input
                value={rasc.marca}
                onChange={(e) => setRasc({ ...rasc, marca: e.target.value })}
                placeholder="Ex.: Havaianas (deixe vazio se for avulsa)"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500"
              />
            </label>
          </div>
          <label className="mt-3 block text-xs text-zinc-400">
            Linhas — uma por linha, no formato <span className="text-zinc-300">rótulo = valor</span>
            <textarea
              value={rasc.linhasTexto}
              onChange={(e) => setRasc({ ...rasc, linhasTexto: e.target.value })}
              rows={8}
              placeholder={"37/38 = 24,5 cm\n39/40 = 25,8 cm\nP = 60cm de busto\nM = 64cm de busto"}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-violet-500"
            />
          </label>
          <label className="mt-3 block text-xs text-zinc-400">
            Como medir (opcional)
            <textarea
              value={rasc.comoMedir}
              onChange={(e) => setRasc({ ...rasc, comoMedir: e.target.value })}
              rows={2}
              placeholder="Ex.: meça o pé descalço do calcanhar ao dedo maior…"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500"
            />
          </label>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
            </Button>
            <button onClick={() => setRasc(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
              Cancelar
            </button>
          </div>
        </Card>
      )}

      {lista.length === 0 && !rasc ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-[#0e0e16] px-6 py-8 text-center text-sm text-zinc-500">
          <Ruler size={20} className="mx-auto mb-2 text-zinc-600" />
          Nenhuma tabela ainda. Clique em <b>Importar modelos</b> (já vem com as marcas prontas),
          suba um <b>CSV</b>, ou crie uma <b>nova tabela</b>.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl border border-white/5 bg-[#0e0e16] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{t.nome || "(sem nome)"}</p>
                  {t.marca ? (
                    <Pill tone="violet">marca: {t.marca}</Pill>
                  ) : (
                    <Pill tone="gray">avulsa</Pill>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => editar(t)} className="rounded p-1 text-zinc-500 hover:text-violet-300" title="Editar">
                    <Ruler size={14} />
                  </button>
                  <button onClick={() => remover(t)} disabled={busy} className="rounded p-1 text-zinc-500 hover:text-red-400" title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{t.linhas.length} linha(s)</p>
              <div className="mt-1 max-h-28 overflow-y-auto text-xs text-zinc-400">
                {t.linhas.slice(0, 6).map((l, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{l.rotulo}</span>
                    <span className="text-zinc-300">{l.valor}</span>
                  </div>
                ))}
                {t.linhas.length > 6 && <div className="text-zinc-600">…+{t.linhas.length - 6}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
        <X size={12} className="opacity-0" /> Prioridade da IA: medida do produto (override) → tabela da
        marca → padrão. Planilha (CSV/Excel): colunas <code>marca, numeração, medida</code>.
      </p>
    </>
  );
}
