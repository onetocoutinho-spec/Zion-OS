"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Upload,
  ListPlus,
  FileText,
  ClipboardList,
  PackageSearch,
  AlertTriangle,
  Gauge,
  ListFilter,
  CheckCircle2,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { useLiveQuery } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import { MARKETPLACES } from "@/lib/constantes";
import {
  ROTULO_ORIGEM,
  ROTULO_STATUS_IMPORTACAO,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_AUDITORIA,
  ROTULO_TIPO_EXECUCAO,
  ROTULO_STATUS_EXECUCAO,
} from "@/lib/auditoria";
import type { Tone } from "@/lib/status";
import type { ClassificacaoABC, PrioridadeAuditoria } from "@/lib/types";
import { listarImportacoes } from "@/lib/services/importacoes";
import { listarAuditorias } from "@/lib/services/auditorias";
import { listarFila, enviarAuditoriaParaFila } from "@/lib/services/filaOtimizacao";
import { listarExecucoesLote, criarExecucaoLote } from "@/lib/services/execucoesLote";

const TONE_ABC: Record<ClassificacaoABC, Tone> = { A: "green", B: "blue", C: "gray" };
const TONE_PRIORIDADE: Record<PrioridadeAuditoria, Tone> = {
  critica: "red",
  alta: "orange",
  media: "blue",
  baixa: "gray",
};
const PESO_PRIORIDADE: Record<PrioridadeAuditoria, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

const HEADERS_IMP = [
  "Cliente",
  "Marketplace",
  "Arquivo",
  "Origem",
  "Anúncios",
  "Processados",
  "Status",
  "Data",
  "Responsável",
];

const HEADERS_AUD = [
  "Anúncio / Categoria",
  "Marketplace",
  "Score",
  "ABC",
  "Prioridade",
  "Vendas",
  "Visitas",
  "Conversão",
  "Principais problemas",
  "Status",
];

const PAGINA = 20;

export default function AuditoriaMassaPage() {
  const [cliente, setCliente] = useState("Todos");
  const [marketplace, setMarketplace] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todos");
  const [abc, setAbc] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [limite, setLimite] = useState(PAGINA);
  const [busy, setBusy] = useState(false);

  const { data: importacoesData } = useLiveQuery(listarImportacoes);
  const { data: auditoriasData } = useLiveQuery(listarAuditorias);
  const { data: filaData } = useLiveQuery(listarFila);
  const { data: execucoesData } = useLiveQuery(listarExecucoesLote);

  const importacoes = importacoesData ?? [];
  const auditorias = auditoriasData ?? [];
  const fila = filaData ?? [];
  const execucoes = execucoesData ?? [];

  // ---- Indicadores ----
  const totalImportados = importacoes.reduce((s, i) => s + i.quantidadeAnuncios, 0);
  const criticos = auditorias.filter((a) => a.prioridade === "critica").length;
  const altaPrioridade = auditorias.filter((a) => a.prioridade === "alta").length;
  const scoreMedio =
    auditorias.length > 0
      ? Math.round(auditorias.reduce((s, a) => s + a.scoreQualidade, 0) / auditorias.length)
      : 0;
  const naFila = fila.filter((f) => f.status !== "concluido" && f.status !== "ignorado").length;
  const otimizacoesConcluidas =
    auditorias.filter((a) => a.statusAuditoria === "otimizado").length +
    fila.filter((f) => f.status === "concluido").length;

  // ---- Filtros ----
  const clientes = useMemo(
    () => [...new Set(auditorias.map((a) => a.cliente))],
    [auditorias]
  );
  const clienteParaId = useMemo(() => {
    const m = new Map<string, string>();
    auditorias.forEach((a) => m.set(a.cliente, a.clienteId));
    importacoes.forEach((i) => m.set(i.cliente, i.clienteId));
    return m;
  }, [auditorias, importacoes]);

  const filtradas = useMemo(() => {
    return auditorias
      .filter(
        (a) =>
          (cliente === "Todos" || a.cliente === cliente) &&
          (marketplace === "Todos" || a.marketplace === marketplace) &&
          (prioridade === "Todos" || ROTULO_PRIORIDADE[a.prioridade] === prioridade) &&
          (abc === "Todos" || a.classificacaoAbc === abc) &&
          (status === "Todos" || ROTULO_STATUS_AUDITORIA[a.statusAuditoria] === status)
      )
      .sort(
        (a, b) =>
          PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
          a.scoreQualidade - b.scoreQualidade
      );
  }, [auditorias, cliente, marketplace, prioridade, abc, status]);

  const visiveis = filtradas.slice(0, limite);

  const filaAuditoriaIds = useMemo(() => new Set(fila.map((f) => f.auditoriaId)), [fila]);

  // ---- Cliente base para ações (respeita o filtro de cliente) ----
  function resolverClienteBase(): { clienteId: string; cliente: string } | null {
    if (cliente !== "Todos") {
      const id = clienteParaId.get(cliente);
      if (id) return { clienteId: id, cliente };
    }
    if (importacoes[0]) return { clienteId: importacoes[0].clienteId, cliente: importacoes[0].cliente };
    if (auditorias[0]) return { clienteId: auditorias[0].clienteId, cliente: auditorias[0].cliente };
    return null;
  }

  async function acaoCriarFila() {
    const alvos = filtradas
      .filter((a) => a.prioridade === "critica" || a.prioridade === "alta")
      .filter((a) => !filaAuditoriaIds.has(a.id))
      .slice(0, 20);
    if (alvos.length === 0) return;
    setBusy(true);
    try {
      for (const a of alvos) {
        await enviarAuditoriaParaFila(a, a.prioridade === "critica" ? "otimizar_completo" : "revisar_titulo");
      }
    } finally {
      setBusy(false);
    }
  }

  async function acaoGerarRelatorio() {
    const base = resolverClienteBase();
    if (!base) return;
    setBusy(true);
    try {
      await criarExecucaoLote({
        clienteId: base.clienteId,
        cliente: base.cliente,
        agenteId: "agt-27",
        agente: "Zion Relatório de Base Grande",
        tipoExecucao: "relatorio_cliente",
        quantidadeItens: auditorias.filter((a) => a.cliente === base.cliente).length,
        status: "concluida",
        entradaResumo: `Auditoria da base de ${base.cliente}`,
        saidaResumo: `Score médio ${scoreMedio}/100 · ${criticos} críticos · ${altaPrioridade} de alta prioridade · ${naFila} na fila.`,
        erros: "",
        responsavel: "Lucas",
      });
    } finally {
      setBusy(false);
    }
  }

  const execucoesRecentes = [...execucoes].slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria em Massa"
        description="Importe a base de anúncios do cliente (500, 1.000+), audite em lote e priorize onde a otimização gera mais retorno."
        count={auditorias.length}
        countLabel="anúncios auditados"
      />

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Anúncios importados" value={totalImportados} icon={PackageSearch} tone="blue" hint="Somando todas as importações" />
        <StatCard label="Auditados" value={auditorias.length} icon={ClipboardList} tone="violet" hint="Amostra representativa carregada" />
        <StatCard label="Críticos" value={criticos} icon={AlertTriangle} tone="red" hint="Alto valor + score baixo" />
        <StatCard label="Alta prioridade" value={altaPrioridade} icon={AlertTriangle} tone="orange" hint="Otimizar em seguida" />
        <StatCard label="Score médio" value={`${scoreMedio}/100`} icon={Gauge} tone="cyan" hint="Saúde geral da base" />
        <StatCard label="Na fila de otimização" value={naFila} icon={ListFilter} tone="yellow" hint="Aguardando execução" />
        <StatCard label="Otimizações concluídas" value={otimizacoesConcluidas} icon={CheckCircle2} tone="green" hint="Anúncios recuperados" />
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/auditoria-massa/importar" variant="primary">
          <Upload size={14} /> Importar CSV/planilha
        </LinkButton>
        <LinkButton href="/esteira/lote" variant="ghost">
          <Workflow size={14} /> Rodar esteira em lote
        </LinkButton>
        <Button variant="ghost" onClick={acaoCriarFila} disabled={busy}>
          <ListPlus size={14} /> Criar fila de otimização
        </Button>
        <Button variant="ghost" onClick={acaoGerarRelatorio} disabled={busy}>
          <FileText size={14} /> Gerar relatório
        </Button>
      </div>

      {/* Importações */}
      <Card title="Importações de anúncios">
        <div className="-m-5">
          <Table headers={HEADERS_IMP}>
            {importacoesData && importacoes.length === 0 && (
              <EmptyRow colSpan={HEADERS_IMP.length} mensagem="Nenhuma importação ainda. Use “Importar CSV/planilha”." />
            )}
            {importacoes.map((i) => (
              <tr key={i.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 align-top">
                  <p className="whitespace-nowrap font-medium text-zinc-200">{i.cliente}</p>
                </td>
                <Td><Badge tone="gray">{i.marketplace}</Badge></Td>
                <Td className="text-xs text-zinc-300">{i.nomeArquivo || "—"}</Td>
                <Td><Badge tone="gray">{ROTULO_ORIGEM[i.origem]}</Badge></Td>
                <Td className="whitespace-nowrap text-zinc-300">{i.quantidadeAnuncios.toLocaleString("pt-BR")}</Td>
                <Td className="whitespace-nowrap text-zinc-300">{i.quantidadeProcessada.toLocaleString("pt-BR")}</Td>
                <Td><Badge>{ROTULO_STATUS_IMPORTACAO[i.status]}</Badge></Td>
                <Td className="whitespace-nowrap">{formatDate(i.dataImportacao)}</Td>
                <Td className="whitespace-nowrap">{i.responsavel}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      {/* Filtros das auditorias */}
      <div className="flex flex-wrap gap-4">
        <FilterSelect label="Cliente" value={cliente} options={clientes} onChange={setCliente} />
        <FilterSelect label="Marketplace" value={marketplace} options={MARKETPLACES} onChange={setMarketplace} />
        <FilterSelect label="Prioridade" value={prioridade} options={Object.values(ROTULO_PRIORIDADE)} onChange={setPrioridade} />
        <FilterSelect label="ABC" value={abc} options={["A", "B", "C"]} onChange={setAbc} />
        <FilterSelect label="Status" value={status} options={Object.values(ROTULO_STATUS_AUDITORIA)} onChange={setStatus} />
      </div>

      {/* Auditorias */}
      <Table headers={HEADERS_AUD}>
        {auditoriasData && filtradas.length === 0 && (
          <EmptyRow colSpan={HEADERS_AUD.length} mensagem="Nenhum anúncio com os filtros atuais." />
        )}
        {visiveis.map((a) => (
          <tr key={a.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3 align-top">
              <Link href={`/auditoria-massa/${a.id}`}>
                <p className="max-w-64 truncate font-medium text-zinc-200 hover:text-violet-300">{a.tituloAtual}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{a.categoria} · {a.cliente}</p>
              </Link>
            </td>
            <Td><Badge tone="gray">{a.marketplace}</Badge></Td>
            <Td><Badge tone={a.scoreQualidade >= 75 ? "green" : a.scoreQualidade >= 55 ? "yellow" : "red"}>{`${a.scoreQualidade}`}</Badge></Td>
            <Td><Badge tone={TONE_ABC[a.classificacaoAbc]}>{a.classificacaoAbc}</Badge></Td>
            <Td><Badge tone={TONE_PRIORIDADE[a.prioridade]}>{ROTULO_PRIORIDADE[a.prioridade]}</Badge></Td>
            <Td className="whitespace-nowrap text-zinc-300">{a.vendas}</Td>
            <Td className="whitespace-nowrap text-zinc-300">{a.visitas}</Td>
            <Td className="whitespace-nowrap text-zinc-300">{a.conversao.toFixed(1)}%</Td>
            <Td className="min-w-56 max-w-72 text-xs text-zinc-300">{a.problemasEncontrados}</Td>
            <Td><Badge>{ROTULO_STATUS_AUDITORIA[a.statusAuditoria]}</Badge></Td>
          </tr>
        ))}
      </Table>

      {filtradas.length > visiveis.length && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => setLimite((n) => n + PAGINA)}>
            Carregar mais ({filtradas.length - visiveis.length} restantes)
          </Button>
        </div>
      )}

      {/* Execuções em lote recentes */}
      <Card title="Execuções em lote recentes">
        {execucoesRecentes.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma execução em lote registrada.</p>
        ) : (
          <ul className="space-y-3">
            {execucoesRecentes.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">
                    {ROTULO_TIPO_EXECUCAO[e.tipoExecucao]} · {e.agente ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {e.cliente} · {e.quantidadeItens} itens · {e.saidaResumo || e.entradaResumo}
                  </p>
                </div>
                <Badge>{ROTULO_STATUS_EXECUCAO[e.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
