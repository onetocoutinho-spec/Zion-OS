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
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { MARKETPLACES } from "@/lib/constantes";
import { ROTULO_PRIORIDADE } from "@/lib/auditoria";
import type { Tone } from "@/lib/status";
import type { ClassificacaoABC, Marketplace, PrioridadeAuditoria } from "@/lib/types";
import {
  analisarCsv,
  confirmarImportacaoCsv,
  gerarTemplateCsv,
  COLUNAS_TEMPLATE,
  type ResultadoAnalise,
} from "@/lib/services/importacaoCsv";

const TONE_ABC: Record<ClassificacaoABC, Tone> = { A: "green", B: "blue", C: "gray" };
const TONE_PRIORIDADE: Record<PrioridadeAuditoria, Tone> = {
  critica: "red",
  alta: "orange",
  media: "blue",
  baixa: "gray",
};

const selectClasses =
  "rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-sm text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500";

const HEADERS_PREVIEW = ["Título", "Categoria", "Preço", "Score", "ABC", "Prioridade", "Problemas"];

export default function ImportarCsvPage() {
  const router = useRouter();
  // A loja vem do contexto global; o select abaixo só o escreve.
  const { lojaId, lojas, definirLoja } = useLojaAtual();
  const clientes = lojas ?? [];
  const clienteId = lojaId ?? "";
  const [marketplace, setMarketplace] = useState<Marketplace>("Mercado Livre");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [analise, setAnalise] = useState<ResultadoAnalise | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const clienteNome = useMemo(
    () => clientes.find((c) => c.id === clienteId)?.empresa ?? "",
    [clientes, clienteId]
  );

  const semTitulo = analise?.faltandoObrigatorias.includes("titulo") ?? false;
  const semPreco = analise?.faltandoObrigatorias.includes("preco") ?? false;
  const podeConfirmar =
    Boolean(analise) && analise!.total > 0 && Boolean(clienteId) && !semTitulo && !busy;

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResultado(null);
    // decodificarTexto, não file.text(): o Excel do Windows exporta em
    // Windows-1252 e file.text() força UTF-8, corrompendo todo acento.
    const texto = decodificarTexto(await file.arrayBuffer()).texto;
    setNomeArquivo(file.name);
    setAnalise(analisarCsv(texto, marketplace));
  }

  function baixarTemplate() {
    const csv = gerarTemplateCsv();
    const bom = String.fromCharCode(0xfeff); // ajuda o Excel a abrir com acento correto
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-anuncios-zion.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirmar() {
    if (!analise || !clienteId) return;
    setBusy(true);
    try {
      const resumo = await confirmarImportacaoCsv({
        clienteId,
        cliente: clienteNome,
        marketplace,
        nomeArquivo,
        linhas: analise.linhas,
      });
      setResultado(
        `Importado! ${resumo.totalAuditorias} auditorias e ${resumo.totalProblemas} problemas gerados.`
      );
      setTimeout(() => router.push("/auditoria-massa"), 900);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/auditoria-massa" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> Auditoria em Massa
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-white">Importar base de anúncios (CSV)</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Suba o arquivo exportado do marketplace. O Zion lê cada anúncio, calcula o score de
          qualidade, classifica em ABC e prioriza — tudo em lote.
        </p>
      </div>

      <Card title="1. Loja e arquivo">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-xs text-zinc-500">
            Loja
            <select className={selectClasses} value={clienteId} onChange={(e) => definirLoja(e.target.value || null)}>
              <option value="">Selecione…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.empresa}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-zinc-500">
            Marketplace padrão
            <select
              className={selectClasses}
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value as Marketplace)}
            >
              {MARKETPLACES.map((m) => (
                <option key={m} value={m}>{m}</option>
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
          <span className="text-zinc-400">Colunas reconhecidas</span> (aceita acento/maiúscula e nomes comuns do ML):{" "}
          <span className="text-zinc-300">{COLUNAS_TEMPLATE.metricas.join(", ")}</span>.{" "}
          Opcionais de qualidade (0/1):{" "}
          <span className="text-zinc-300">{COLUNAS_TEMPLATE.sinais.join(", ")}</span>.
          Obrigatórias: <span className="text-zinc-300">titulo</span> e <span className="text-zinc-300">preco</span>.
        </div>
      </Card>

      {analise && (
        <Card title="2. Prévia da importação">
          {analise.erro ? (
            <p className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle size={15} /> {analise.erro}
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-zinc-300">
                  <span className="font-semibold text-white">{analise.total}</span> anúncios no arquivo
                </span>
                {analise.coldStart && (
                  <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-400 ring-1 ring-inset ring-cyan-500/20">
                    Base cold-start — prioridade por potencial (estoque × score), não por venda
                  </span>
                )}
                <span className="text-zinc-500">
                  Colunas reconhecidas: <span className="text-zinc-300">{analise.colunasReconhecidas.join(", ") || "nenhuma"}</span>
                </span>
                {analise.colunasIgnoradas.length > 0 && (
                  <span className="text-zinc-500">
                    Ignoradas: <span className="text-zinc-400">{analise.colunasIgnoradas.join(", ")}</span>
                  </span>
                )}
              </div>

              {semTitulo && (
                <p className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-inset ring-red-500/20">
                  <AlertTriangle size={15} /> Não encontrei a coluna <strong>titulo</strong>. Ela é obrigatória — ajuste o cabeçalho e suba de novo.
                </p>
              )}
              {!semTitulo && semPreco && (
                <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-400 ring-1 ring-inset ring-amber-500/20">
                  <AlertTriangle size={15} /> Sem a coluna <strong>preco</strong> a classificação ABC fica imprecisa. Você pode importar mesmo assim.
                </p>
              )}

              <div className="-mx-5">
                <Table headers={HEADERS_PREVIEW}>
                  {analise.amostra.length === 0 && <EmptyRow colSpan={HEADERS_PREVIEW.length} />}
                  {analise.amostra.map((l, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 align-top">
                        <p className="max-w-64 truncate text-zinc-200">{l.base.tituloAtual}</p>
                      </td>
                      <Td className="text-xs text-zinc-400">{l.base.categoria || "—"}</Td>
                      <Td className="whitespace-nowrap text-zinc-300">
                        {l.base.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </Td>
                      <Td><Badge tone={l.base.scoreQualidade >= 75 ? "green" : l.base.scoreQualidade >= 55 ? "yellow" : "red"}>{`${l.base.scoreQualidade}`}</Badge></Td>
                      <Td><Badge tone={TONE_ABC[l.base.classificacaoAbc]}>{l.base.classificacaoAbc}</Badge></Td>
                      <Td><Badge tone={TONE_PRIORIDADE[l.base.prioridade]}>{ROTULO_PRIORIDADE[l.base.prioridade]}</Badge></Td>
                      <Td className="min-w-48 max-w-72 text-xs text-zinc-400">{l.base.problemasEncontrados}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
              {analise.total > analise.amostra.length && (
                <p className="mt-3 text-xs text-zinc-500">
                  Mostrando os primeiros {analise.amostra.length} de {analise.total}. Todos serão importados.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {analise && !analise.erro && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={confirmar} disabled={!podeConfirmar}>
            <Upload size={14} /> Confirmar importação {analise.total > 0 ? `(${analise.total})` : ""}
          </Button>
          {!clienteId && <span className="text-xs text-amber-400">Selecione a loja para confirmar.</span>}
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
