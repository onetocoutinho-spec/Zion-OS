"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { useLiveQuery } from "@/lib/hooks";
import { decodificarTexto } from "@/lib/textoDeArquivo";
import { listarClientes } from "@/lib/services/clientes";
import { formatBRL } from "@/lib/format";
import {
  analisarProdutosCsv,
  confirmarImportacaoProdutos,
  gerarTemplateProdutosCsv,
  COLUNAS_PRODUTOS,
  type AnaliseProdutos,
} from "@/lib/services/importacaoProdutos";

const selectClasses =
  "rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-sm text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500";

const HEADERS_PREVIEW = ["Nome", "Categoria", "SKU", "Custo", "Preço", "Estoque", "Margem Zion"];

export default function ImportarProdutosPage() {
  const router = useRouter();
  const { data: clientesData } = useLiveQuery(listarClientes);
  const clientes = clientesData ?? [];

  const [clienteId, setClienteId] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [analise, setAnalise] = useState<AnaliseProdutos | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const clienteNome = useMemo(
    () => clientes.find((c) => c.id === clienteId)?.empresa ?? "",
    [clientes, clienteId]
  );

  const semNome = analise?.faltandoObrigatorias.includes("nome") ?? false;
  const podeConfirmar =
    Boolean(analise) && analise!.total > 0 && Boolean(clienteId) && !semNome && !busy;

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResultado(null);
    // decodificarTexto, não file.text(): o Excel do Windows exporta em
    // Windows-1252 e file.text() força UTF-8, corrompendo todo acento.
    const texto = decodificarTexto(await file.arrayBuffer()).texto;
    setNomeArquivo(file.name);
    setAnalise(analisarProdutosCsv(texto));
  }

  function baixarTemplate() {
    const csv = gerarTemplateProdutosCsv();
    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-base-produtos-zion.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirmar() {
    if (!analise || !clienteId) return;
    setBusy(true);
    try {
      const resumo = await confirmarImportacaoProdutos({
        clienteId,
        cliente: clienteNome,
        linhas: analise.linhas,
      });
      setResultado(
        `Importados ${resumo.total} produtos${resumo.totalVariacoes > 0 ? ` e ${resumo.totalVariacoes} variações` : ""}${resumo.comMargemBaixa > 0 ? ` · ${resumo.comMargemBaixa} com margem abaixo de 5%` : ""}.`
      );
      setTimeout(() => router.push("/produtos"), 1000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/produtos" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> Produtos
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-white">Importar base de produtos (CSV)</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Traga a base completa de produtos do cliente (do ERP) para o Zion OS e comece o cadastramento.
          O <strong>marketplace é destino</strong> — o canal (ML, TikTok…) é escolhido depois, ao criar o anúncio.
        </p>
      </div>

      <Card title="1. Cliente e arquivo">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-xs text-zinc-500">
            Cliente
            <select className={selectClasses} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Selecione…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.empresa}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-zinc-500">
            Arquivo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={aoEscolherArquivo}
              className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500"
            />
          </label>

          <Button variant="ghost" onClick={baixarTemplate}>
            <Download size={14} /> Baixar modelo
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-zinc-500">
          <span className="text-zinc-400">Colunas reconhecidas</span> (aceita acento/maiúscula e nomes comuns):{" "}
          <span className="text-zinc-300">{COLUNAS_PRODUTOS.join(", ")}</span>. Obrigatória:{" "}
          <span className="text-zinc-300">nome</span>. A <span className="text-zinc-300">Margem Zion</span> é calculada
          de custo × preço (piso 5%).
          <br />
          <span className="text-zinc-400">Com variações:</span> inclua <span className="text-zinc-300">sku_pai</span> e{" "}
          <span className="text-zinc-300">sku_variacao</span> (+ cor, tamanho, mlb) — o Zion agrupa por SKU Pai e cria o
          produto pai com suas derivações. O <span className="text-zinc-300">SKU do produto = SKU Pai</span> (o MLB vira id do anúncio, não o SKU).
        </div>
      </Card>

      {analise && (
        <Card title="2. Prévia da base">
          {analise.erro ? (
            <p className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle size={15} /> {analise.erro}
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-zinc-300">
                  <span className="font-semibold text-white">{analise.total}</span> produtos
                  {analise.modo === "agrupado" && (
                    <span className="text-zinc-400"> · <span className="font-semibold text-white">{analise.totalVariacoes}</span> variações</span>
                  )}
                  {" "}no arquivo
                </span>
                <span className="text-zinc-500">
                  Reconhecidas: <span className="text-zinc-300">{analise.colunasReconhecidas.join(", ") || "nenhuma"}</span>
                </span>
                {analise.colunasIgnoradas.length > 0 && (
                  <span className="text-zinc-500">Ignoradas: <span className="text-zinc-400">{analise.colunasIgnoradas.join(", ")}</span></span>
                )}
              </div>

              {semNome && (
                <p className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-inset ring-red-500/20">
                  <AlertTriangle size={15} /> Não encontrei a coluna <strong>nome</strong> (obrigatória). Ajuste o cabeçalho e suba de novo.
                </p>
              )}

              <div className="-mx-5">
                <Table headers={HEADERS_PREVIEW}>
                  {analise.amostra.length === 0 && <EmptyRow colSpan={HEADERS_PREVIEW.length} />}
                  {analise.amostra.map((l, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 align-top">
                        <p className="max-w-64 truncate text-zinc-200">{l.base.nome}</p>
                        <p className="text-xs text-zinc-500">{l.base.marca || "—"} · {l.base.marketplace}</p>
                      </td>
                      <Td className="text-xs text-zinc-400">{l.base.categoria || "—"}</Td>
                      <Td className="text-xs text-zinc-400">{l.base.sku || "—"}</Td>
                      <Td className="whitespace-nowrap text-zinc-300">{formatBRL(l.base.custo)}</Td>
                      <Td className="whitespace-nowrap text-zinc-300">{formatBRL(l.base.precoVenda)}</Td>
                      <Td className="whitespace-nowrap text-zinc-300">{l.base.estoque}</Td>
                      <Td>
                        {l.margem === null ? (
                          <Badge tone="gray">a definir</Badge>
                        ) : (
                          <Badge tone={l.margem >= 5 ? "green" : l.margem >= 0 ? "yellow" : "red"}>{`${l.margem}%`}</Badge>
                        )}
                      </Td>
                    </tr>
                  ))}
                </Table>
              </div>
              {analise.total > analise.amostra.length && (
                <p className="mt-3 text-xs text-zinc-500">
                  Mostrando {analise.amostra.length} de {analise.total}. Todos serão importados.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {analise && !analise.erro && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={confirmar} disabled={!podeConfirmar}>
            <Upload size={14} /> Importar base {analise.total > 0 ? `(${analise.total})` : ""}
          </Button>
          {!clienteId && <span className="text-xs text-amber-400">Selecione o cliente para importar.</span>}
          {resultado && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 size={15} /> {resultado}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
