"use client";

// Assistente de importação de base (CSV) do Portal do Cliente.
//
// 3 passos: (1) escolher o arquivo → (2) MAPEAR as colunas do ERP para os
// campos da Zion (com presets Bling/Tiny/Magazord + ajuste manual) → (3)
// revisar e importar. Funciona com a planilha de qualquer ERP.

import { useState } from "react";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useClientPortal } from "./context";
import {
  analisarProdutosCsv,
  confirmarImportacaoProdutos,
  gerarTemplateProdutosCsv,
  lerCabecalho,
  autoMapear,
  aplicarPreset,
  CAMPOS_MAPEAVEIS,
  PRESETS_ERP,
  type AnaliseProdutos,
} from "@/lib/services/importacaoProdutos";

const SEM_COLUNA = "";

export function ImportarProdutos({ onImportado }: { onImportado?: () => void }) {
  const { clienteId, nome } = useClientPortal();

  const [etapa, setEtapa] = useState<"arquivo" | "mapear" | "revisar">("arquivo");
  const [texto, setTexto] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [exemplos, setExemplos] = useState<Record<string, string>>({});
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [analise, setAnalise] = useState<AnaliseProdutos | null>(null);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setAnalise(null);
    const conteudo = await file.text();
    const { headers: hs, exemplos: ex } = lerCabecalho(conteudo);
    if (hs.length === 0) {
      setMsg({ tipo: "erro", texto: "Não consegui ler as colunas do arquivo. Confira se é um CSV." });
      return;
    }
    setTexto(conteudo);
    setHeaders(hs);
    setExemplos(ex);
    setMapeamento(autoMapear(hs));
    setEtapa("mapear");
  }

  function usarPreset(preset: string) {
    setMapeamento({ ...autoMapear(headers), ...aplicarPreset(preset, headers) });
  }
  function setCampo(campo: string, header: string) {
    setMapeamento((m) => {
      const novo = { ...m };
      if (header === SEM_COLUNA) delete novo[campo];
      else novo[campo] = header;
      return novo;
    });
  }

  function analisar() {
    const a = analisarProdutosCsv(texto, "Mercado Livre", mapeamento);
    setAnalise(a);
    setEtapa("revisar");
  }

  async function importar() {
    if (!analise || analise.total === 0 || importando) return;
    setImportando(true);
    setMsg(null);
    try {
      const r = await confirmarImportacaoProdutos({ clienteId, cliente: nome, linhas: analise.linhas });
      setMsg({
        tipo: "ok",
        texto: `${r.total} produtos importados${r.totalVariacoes > 0 ? ` e ${r.totalVariacoes} variações` : ""}.`,
      });
      setEtapa("arquivo");
      setTexto("");
      setAnalise(null);
      onImportado?.();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao importar." });
    } finally {
      setImportando(false);
    }
  }

  function baixarModelo() {
    const blob = new Blob([String.fromCharCode(0xfeff) + gerarTemplateProdutosCsv()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const faltaNome = !mapeamento.nome;
  const naoUsadas = headers.filter((h) => !Object.values(mapeamento).includes(h));

  return (
    <div className="rounded-xl border border-white/5 bg-[#0e0e16] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <FileSpreadsheet size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">Importar base de produtos</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Exporte a planilha do seu ERP (Bling, Tiny, Magazord, Linx…) e suba aqui. O assistente
            mapeia as colunas — não precisa arrumar o arquivo.
          </p>

          {/* Passo 1 — arquivo */}
          {etapa === "arquivo" && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={aoEscolher}
                className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500"
              />
              <Button variant="ghost" onClick={baixarModelo}>
                <Download size={14} /> Baixar modelo
              </Button>
            </div>
          )}

          {/* Passo 2 — mapear colunas */}
          {etapa === "mapear" && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">Meu ERP é:</span>
                {Object.keys(PRESETS_ERP).map((p) => (
                  <button
                    key={p}
                    onClick={() => usarPreset(p)}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-violet-500/40 hover:text-white"
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setMapeamento(autoMapear(headers))}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-violet-300 hover:border-violet-500/40"
                >
                  <Wand2 size={12} /> Detectar automático
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-white/5">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-3 py-2 font-semibold">Campo da Zion</th>
                      <th className="px-3 py-2 font-semibold">Coluna da sua planilha</th>
                      <th className="px-3 py-2 font-semibold">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {CAMPOS_MAPEAVEIS.map((c) => {
                      const sel = mapeamento[c.campo] ?? SEM_COLUNA;
                      const semObrig = c.obrigatorio && !sel;
                      return (
                        <tr key={c.campo} className="align-top">
                          <td className="px-3 py-2">
                            <span className="text-zinc-200">{c.rotulo}</span>
                            {c.obrigatorio && <span className="ml-1 text-amber-400">*</span>}
                            {c.dica && <p className="text-[11px] text-zinc-600">{c.dica}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={sel}
                              onChange={(e) => setCampo(c.campo, e.target.value)}
                              className={`w-full rounded-lg border bg-[#12121c] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500/50 ${
                                semObrig ? "border-amber-500/50" : "border-white/10"
                              }`}
                            >
                              <option value={SEM_COLUNA}>— não usar —</option>
                              {headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-xs text-zinc-500">
                            {sel ? exemplos[sel] || "—" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {naoUsadas.length > 0 && (
                <p className="text-[11px] text-zinc-600">
                  Colunas não usadas: {naoUsadas.join(", ")}
                </p>
              )}
              {faltaNome && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle size={13} /> Mapeie ao menos o <b>Nome do produto</b> para continuar.
                </p>
              )}

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setEtapa("arquivo")}>
                  <ArrowLeft size={14} /> Trocar arquivo
                </Button>
                <Button onClick={analisar} disabled={faltaNome}>
                  Revisar <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Passo 3 — revisar e importar */}
          {etapa === "revisar" && analise && (
            <div className="mt-3 space-y-3">
              {analise.erro ? (
                <p className="flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle size={15} /> {analise.erro}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm">
                    <span className="text-zinc-300">
                      <span className="font-semibold text-white">{analise.total}</span> produtos
                      {analise.modo === "agrupado" ? ` · ${analise.totalVariacoes} variações` : ""}
                    </span>
                    {analise.amostra[0] && (
                      <span className="text-xs text-zinc-500">
                        Ex.: {analise.amostra[0].base.nome} · R$ {analise.amostra[0].base.precoVenda}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setEtapa("mapear")}>
                      <ArrowLeft size={14} /> Ajustar mapeamento
                    </Button>
                    <Button onClick={importar} disabled={importando || analise.total === 0}>
                      <Upload size={14} /> {importando ? "Importando…" : `Importar ${analise.total}`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {msg && (
            <p
              className={`mt-3 flex items-center gap-2 text-sm ${
                msg.tipo === "ok" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {msg.tipo === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {msg.texto}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
