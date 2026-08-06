"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Check,
  History,
  Link2,
  ListPlus,
  Pencil,
  Play,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, TextArea } from "@/components/ui/form";
import { IMPLANTACAO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import {
  alterarStatusImplantacao,
  buscarAgente,
  executarAgenteIA,
  listarExecucoesDoAgente,
  type TarefaSugerida,
} from "@/lib/services/agentes";
import { listarClientes } from "@/lib/services/clientes";
import { listarProdutos } from "@/lib/services/produtos";
import { atualizarAnuncio, listarAnuncios } from "@/lib/services/anuncios";
import { criarTarefa } from "@/lib/services/tarefas";
import { montarContexto, resumoDoContexto } from "@/lib/contexto";
import { formatDateTime } from "@/lib/format";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-300">{children}</p>
    </div>
  );
}

const SELECT_CLASSES =
  "w-full rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-xs text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500";

function SelectContexto({
  label,
  valor,
  opcoes,
  onChange,
}: {
  label: string;
  valor: string;
  opcoes: { id: string; nome: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-zinc-500">{label}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASSES}>
        <option value="">Nenhum</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AgenteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();

  const [entrada, setEntrada] = useState("");
  const [clienteId, setClienteId] = useState(params.get("cliente") ?? "");
  const [produtoId, setProdutoId] = useState(params.get("produto") ?? "");
  const [anuncioId, setAnuncioId] = useState(params.get("anuncio") ?? "");
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [tipoResultado, setTipoResultado] = useState<"IA" | "Simulada" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tituloSugerido, setTituloSugerido] = useState<string | null>(null);
  const [tituloAplicado, setTituloAplicado] = useState(false);
  const [tarefasSugeridas, setTarefasSugeridas] = useState<TarefaSugerida[]>([]);
  const [tarefasCriadas, setTarefasCriadas] = useState<number[]>([]);

  const { data: agente, carregando } = useLiveQuery(() => buscarAgente(id), [id]);
  const { data: execucoes } = useLiveQuery(() => listarExecucoesDoAgente(id), [id]);
  const { data: clientes } = useLiveQuery(listarClientes);
  const { data: produtos } = useLiveQuery(listarProdutos);
  const { data: anuncios } = useLiveQuery(listarAnuncios);

  if (carregando) return null;
  if (!agente)
    return <EmptyState mensagem="Agente não encontrado." acaoLabel="Voltar para agentes" acaoHref="/agentes" />;

  // Entidades selecionadas para o contexto
  const cliente = (clientes ?? []).find((c) => c.id === clienteId) ?? null;
  const produtosFiltrados = (produtos ?? []).filter((p) => !clienteId || p.clienteId === clienteId);
  const anunciosFiltrados = (anuncios ?? []).filter((a) => !clienteId || a.clienteId === clienteId);
  const produto = produtosFiltrados.find((p) => p.id === produtoId) ?? null;
  const anuncio = anunciosFiltrados.find((a) => a.id === anuncioId) ?? null;

  const contexto = montarContexto({ cliente, produto, anuncio });
  const resumoContexto = resumoDoContexto({ cliente, produto, anuncio });
  const podeExecutar = Boolean(entrada.trim() || contexto);

  function selecionarProduto(idSel: string) {
    setProdutoId(idSel);
    const p = (produtos ?? []).find((x) => x.id === idSel);
    if (p && !clienteId) setClienteId(p.clienteId);
  }

  function selecionarAnuncio(idSel: string) {
    setAnuncioId(idSel);
    const a = (anuncios ?? []).find((x) => x.id === idSel);
    if (a && !clienteId) setClienteId(a.clienteId);
  }

  function selecionarCliente(idSel: string) {
    setClienteId(idSel);
    setProdutoId("");
    setAnuncioId("");
  }

  async function executar(e: React.FormEvent) {
    e.preventDefault();
    if (!agente || !podeExecutar || executando) return;
    setExecutando(true);
    setErro(null);
    setAviso(null);
    setResultado(null);
    setTipoResultado(null);
    setTituloSugerido(null);
    setTituloAplicado(false);
    setTarefasSugeridas([]);
    setTarefasCriadas([]);
    try {
      const retorno = await executarAgenteIA(agente, entrada.trim(), {
        contexto: contexto || undefined,
        resumoContexto: resumoContexto || undefined,
        contemAnuncio: Boolean(anuncio),
      });
      setResultado(retorno.resultado);
      setTipoResultado(retorno.tipo);
      setAviso(retorno.aviso ?? null);
      setTituloSugerido(retorno.tituloOtimizado ?? null);
      setTarefasSugeridas(retorno.tarefasSugeridas ?? []);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao executar o agente.");
    } finally {
      setExecutando(false);
    }
  }

  // Cliente para vincular as tarefas criadas (direto ou derivado do contexto)
  const clienteVinculo = cliente ?? null;
  const clienteVinculoId = clienteVinculo?.id ?? produto?.clienteId ?? anuncio?.clienteId ?? "";
  const clienteVinculoNome = clienteVinculo?.empresa ?? produto?.cliente ?? anuncio?.cliente ?? "";

  async function aplicarTitulo() {
    if (!anuncio || !tituloSugerido) return;
    await atualizarAnuncio(anuncio.id, { tituloOtimizado: tituloSugerido });
    setTituloAplicado(true);
  }

  async function criarTarefaSugerida(sugestao: TarefaSugerida, indice: number) {
    if (!agente || !clienteVinculoId || tarefasCriadas.includes(indice)) return;
    const prazo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await criarTarefa({
      clienteId: clienteVinculoId,
      cliente: clienteVinculoNome,
      produtoId: produto?.id ?? null,
      produto: produto?.nome ?? null,
      anuncioId: anuncio?.id ?? null,
      anuncio: anuncio?.produto ?? null,
      agenteId: agente.id,
      agenteRelacionado: agente.nome,
      area: agente.area,
      tarefa: sugestao.tarefa,
      responsavel: "Informação necessária",
      prioridade: sugestao.prioridade,
      status: "Não iniciado",
      prazo,
      proximaAcao: sugestao.proximaAcao,
      observacoes: `Criada a partir de execução do agente ${agente.nome}.`,
    });
    setTarefasCriadas((atuais) => [...atuais, indice]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <Bot size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-white">{agente.nome}</h1>
              <Badge>{agente.statusImplantacao}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {agente.area} · uso {agente.frequenciaUso.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Implantação
            <Select
              options={IMPLANTACAO_STATUS}
              value={agente.statusImplantacao}
              onChange={(e) =>
                alterarStatusImplantacao(id, e.target.value as typeof agente.statusImplantacao)
              }
              className="!w-auto py-1.5"
            />
          </label>
          <LinkButton href={`/agentes/${id}/editar`} variant="ghost">
            <Pencil size={14} /> Editar
          </LinkButton>
        </div>
      </div>

      {/* Painel de execução via API Claude */}
      <Card title="Executar agente">
        <form onSubmit={executar}>
          {/* Contexto do sistema (opcional) */}
          <div className="mb-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Contexto do sistema (opcional)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectContexto
                label="Cliente"
                valor={clienteId}
                opcoes={(clientes ?? []).map((c) => ({ id: c.id, nome: c.empresa }))}
                onChange={selecionarCliente}
              />
              <SelectContexto
                label="Produto"
                valor={produtoId}
                opcoes={produtosFiltrados.map((p) => ({
                  id: p.id,
                  nome: clienteId ? p.nome : `${p.nome} (${p.cliente})`,
                }))}
                onChange={selecionarProduto}
              />
              <SelectContexto
                label="Anúncio"
                valor={anuncioId}
                opcoes={anunciosFiltrados.map((a) => ({
                  id: a.id,
                  nome: clienteId
                    ? `${a.produto} · ${a.marketplace}`
                    : `${a.produto} · ${a.marketplace} (${a.cliente})`,
                }))}
                onChange={selecionarAnuncio}
              />
            </div>
            {contexto && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-violet-400 hover:text-violet-300">
                  Contexto selecionado: {resumoContexto} — ver dados que serão enviados
                </summary>
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                  {contexto}
                </pre>
              </details>
            )}
          </div>

          <TextArea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            rows={4}
            placeholder={
              contexto
                ? "Instrução adicional (opcional) — se vazio, o agente executa sua função com base no contexto acima."
                : `Entrada para o agente — ${agente.entradaNecessaria}`
            }
          />
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit" disabled={executando || !podeExecutar}>
              {executando ? (
                <>
                  <Sparkles size={14} className="animate-pulse" /> Executando com IA…
                </>
              ) : (
                <>
                  <Play size={14} /> Executar agente
                </>
              )}
            </Button>
            <span className="text-[11px] text-zinc-600">
              Usa a API Claude quando a ANTHROPIC_API_KEY está configurada no servidor.
            </span>
          </div>
        </form>

        {erro && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        {aviso && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {aviso}
          </p>
        )}

        {resultado && (
          <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                Resultado
              </p>
              {tipoResultado && <Badge>{tipoResultado}</Badge>}
            </div>
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {resultado}
            </div>

            {/* Ações: aplicar o resultado de volta no sistema */}
            {(tituloSugerido || tarefasSugeridas.length > 0) && (
              <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Aplicar no sistema
                </p>

                {tituloSugerido && anuncio && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-zinc-500">
                        Título otimizado para “{anuncio.produto}”
                      </p>
                      <p className="truncate text-sm text-zinc-200">{tituloSugerido}</p>
                    </div>
                    <Button
                      variant={tituloAplicado ? "success" : "primary"}
                      onClick={aplicarTitulo}
                      disabled={tituloAplicado}
                    >
                      {tituloAplicado ? (
                        <>
                          <Check size={14} /> Aplicado no anúncio
                        </>
                      ) : (
                        <>
                          <Wand2 size={14} /> Aplicar no anúncio
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {tarefasSugeridas.length > 0 && (
                  <div className="space-y-2">
                    {tarefasSugeridas.map((sugestao, indice) => (
                      <div
                        key={indice}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge>{sugestao.prioridade}</Badge>
                            <p className="truncate text-sm text-zinc-200">{sugestao.tarefa}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-zinc-500">
                            {sugestao.proximaAcao}
                          </p>
                        </div>
                        {clienteVinculoId ? (
                          <Button
                            variant={tarefasCriadas.includes(indice) ? "success" : "ghost"}
                            onClick={() => criarTarefaSugerida(sugestao, indice)}
                            disabled={tarefasCriadas.includes(indice)}
                          >
                            {tarefasCriadas.includes(indice) ? (
                              <>
                                <Check size={14} /> Tarefa criada
                              </>
                            ) : (
                              <>
                                <ListPlus size={14} /> Criar tarefa
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-zinc-600">
                            Selecione um cliente no contexto para criar
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Definição do agente">
          <div className="space-y-4">
            <Info label="Objetivo">{agente.objetivo}</Info>
            <Info label="Quando usar">{agente.quandoUsar}</Info>
            <Info label="Entrada necessária">{agente.entradaNecessaria}</Info>
            <Info label="Saída esperada">{agente.saidaEsperada}</Info>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Prompt resumido</p>
              <p className="mt-1 rounded-lg bg-white/[0.03] p-3 font-mono text-xs leading-relaxed text-zinc-400">
                {agente.promptResumido}
              </p>
            </div>
            {agente.agentesConectados.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Agentes conectados</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {agente.agentesConectados.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400">
                      <Link2 size={11} /> {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title={`Histórico de execuções (${execucoes?.length ?? 0})`}>
          {execucoes && execucoes.length > 0 ? (
            <ul className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {execucoes.map((e) => (
                <li key={e.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                      <History size={12} /> {formatDateTime(e.dataHora)}
                    </span>
                    <Badge>{e.tipo}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{e.contexto}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-zinc-500">
                    {e.resultado}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Este agente ainda não foi executado." />
          )}
        </Card>
      </div>
    </div>
  );
}
