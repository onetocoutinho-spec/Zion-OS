"use client";

// Painel de importação de base (CSV) para o Portal do Cliente.
// Prévia → confirmar → salvar. Reaproveita o importador com variações.

import { useState } from "react";
import { Upload, Download, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useClientPortal } from "./context";
import {
  analisarProdutosCsv,
  confirmarImportacaoProdutos,
  gerarTemplateProdutosCsv,
  type AnaliseProdutos,
} from "@/lib/services/importacaoProdutos";

export function ImportarProdutos({ onImportado }: { onImportado?: () => void }) {
  const { clienteId, nome } = useClientPortal();
  const [analise, setAnalise] = useState<AnaliseProdutos | null>(null);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setAnalise(analisarProdutosCsv(await file.text()));
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

  async function importar() {
    if (!analise || analise.total === 0 || importando) return;
    setImportando(true);
    setMsg(null);
    try {
      const r = await confirmarImportacaoProdutos({
        clienteId,
        cliente: nome,
        linhas: analise.linhas,
      });
      setMsg({
        tipo: "ok",
        texto: `${r.total} produtos importados${
          r.totalVariacoes > 0 ? ` e ${r.totalVariacoes} variações` : ""
        }.`,
      });
      setAnalise(null);
      onImportado?.();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao importar." });
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/5 bg-[#0e0e16] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <FileSpreadsheet size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">Importar base de produtos</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Suba um arquivo CSV com nome, custo, preço e estoque. Aceita SKU pai + variações.
          </p>

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

          {analise && analise.erro && (
            <p className="mt-3 flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle size={15} /> {analise.erro}
            </p>
          )}

          {analise && !analise.erro && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm">
              <span className="text-zinc-300">
                <span className="font-semibold text-white">{analise.total}</span> produtos
                {analise.modo === "agrupado" ? ` · ${analise.totalVariacoes} variações` : ""}
              </span>
              <Button onClick={importar} disabled={importando}>
                <Upload size={14} /> {importando ? "Importando…" : "Importar"}
              </Button>
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
