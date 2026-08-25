"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Wand2,
  FileText,
  Search,
  Ruler,
  ListChecks,
  Calculator,
  Image as ImageIcon,
  ClipboardCheck,
  MessagesSquare,
  ListTodo,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Play,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Gauge,
  Package,
  Copy,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { EsqueletoDeBloco } from "@/components/ui/Skeleton";
import { useLiveQuery } from "@/lib/hooks";
import { montarContexto } from "@/lib/contexto";
import { listarProdutos } from "@/lib/services/produtos";
import { listarVariantesDoProduto } from "@/lib/services/produtoVariantes";
import { listarTabelasDoCliente } from "@/lib/services/tabelasMedidasCliente";
import {
  criarAnuncioGerado,
  listarAnunciosGeradosDoCliente,
  aprovarAnuncioGerado,
  rejeitarAnuncioGerado,
} from "@/lib/services/anunciosGerados";
import { rodarEsteira } from "@/lib/services/esteira";
import {
  enfileirarProdutos,
  statusFila,
  limparConcluidos,
  type StatusFila,
} from "@/lib/services/filaOtimizacaoProduto";
import { rodarAgentePortal } from "@/lib/services/agentePortal";
import { quotaEsteira } from "@/lib/services/perfil";
import { estadoDaCota } from "@/modules/workspace/domain/cotaDaEsteira";
import type { FerramentaPortal } from "@/lib/agentes/catalogo";
import { precoMinimo, MARGEM_MINIMA_PADRAO } from "@/modules/pricing/domain/modeloPreco";
import { margemMinimaDoCliente } from "@/lib/services/margemCliente";
import { foiAvaliadoPelaIA, explicarVeredito } from "@/modules/portal/domain/notaExibivel";
import { saudeMargem } from "@/lib/client-portal/metrics";
import { formatBRL } from "@/lib/format";
import type { AnuncioGeradoRegistro, Produto } from "@/lib/types";
import type { AnuncioGerado } from "@/lib/agentes/esteira";
import type { LucideIcon } from "lucide-react";

type Campo =
  | "titulo"
  | "descricao"
  | "seo"
  | "tabela_medidas"
  | "ficha_tecnica"
  | "preco"
  | "imagens"
  | "auditoria"
  | "faq"
  | "plano";

interface Ferramenta {
  key: Campo;
  nome: string;
  descricao: string;
  quando: string;
  icon: LucideIcon;
  tone: "violet" | "blue" | "green" | "orange" | "cyan" | "yellow";
  /**
   * Como a ferramenta executa:
   * - "agente": roda só o agente real do catálogo (rápido, 1 chamada, Markdown).
   * - "esteira": roda a esteira completa (estruturado, aprovável).
   * - "local": cálculo local, sem IA (preço/margem).
   */
  modo: "agente" | "esteira" | "local";
  /** Agente do catálogo, quando modo = "agente". */
  agente?: FerramentaPortal;
}

const TONE_ICON: Record<Ferramenta["tone"], string> = {
  violet: "bg-violet-500/10 text-violet-400",
  blue: "bg-sky-500/10 text-sky-400",
  green: "bg-emerald-500/10 text-emerald-400",
  orange: "bg-orange-500/10 text-orange-400",
  cyan: "bg-cyan-500/10 text-cyan-400",
  yellow: "bg-amber-500/10 text-amber-400",
};

const FERRAMENTAS: Ferramenta[] = [
  { key: "titulo", nome: "Melhorar título", descricao: "Cria um título otimizado com as palavras que os clientes buscam.", quando: "Quando o título está fraco ou genérico.", icon: Wand2, tone: "violet", modo: "agente", agente: "titulo" },
  { key: "descricao", nome: "Criar descrição de alta conversão", descricao: "Escreve uma descrição completa que vende e tira dúvidas.", quando: "Quando falta descrição ou ela é curta demais.", icon: FileText, tone: "blue", modo: "agente", agente: "descricao" },
  { key: "seo", nome: "Analisar SEO", descricao: "Sugere palavras-chave para o produto aparecer nas buscas.", quando: "Para melhorar a posição do anúncio.", icon: Search, tone: "cyan", modo: "agente", agente: "seo" },
  { key: "tabela_medidas", nome: "Criar tabela de medidas", descricao: "Monta a tabela de tamanhos e como medir corretamente.", quando: "Produtos com numeração ou tamanhos.", icon: Ruler, tone: "orange", modo: "agente", agente: "tabela_medidas" },
  { key: "ficha_tecnica", nome: "Revisar ficha técnica", descricao: "Preenche os atributos obrigatórios do marketplace.", quando: "Para não perder pontos de qualidade.", icon: ListChecks, tone: "green", modo: "agente", agente: "ficha_tecnica" },
  { key: "preco", nome: "Analisar preço e margem", descricao: "Mostra o lucro real e o preço ideal pelo modelo Zion.", quando: "Antes de definir ou revisar o preço.", icon: Calculator, tone: "green", modo: "local" },
  { key: "imagens", nome: "Criar sugestões de imagem", descricao: "Lista as fotos ideais e o que cada uma deve mostrar.", quando: "Para melhorar a apresentação visual.", icon: ImageIcon, tone: "violet", modo: "agente", agente: "imagens" },
  { key: "auditoria", nome: "Fazer auditoria completa", descricao: "Analisa tudo e dá uma nota, com o que corrigir primeiro.", quando: "Para uma visão geral do anúncio.", icon: ClipboardCheck, tone: "orange", modo: "esteira" },
  { key: "faq", nome: "Gerar FAQ", descricao: "Cria perguntas e respostas frequentes para o anúncio.", quando: "Para reduzir dúvidas e devoluções.", icon: MessagesSquare, tone: "blue", modo: "esteira" },
  { key: "plano", nome: "Criar plano de ação", descricao: "Lista os próximos passos para deixar o anúncio pronto.", quando: "Quando não sabe por onde começar.", icon: ListTodo, tone: "yellow", modo: "esteira" },
];

export default function ClienteOtimizar() {
  const { clienteId, nome } = useClientPortal();
  const { data: produtos, estado: estadoDosProdutos } = useLiveQuery(listarProdutos);
  const { data: anuncios, reload: recarregarAnuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: quota } = useLiveQuery(quotaEsteira);
  const { data: tabelasMedidas } = useLiveQuery(
    () => listarTabelasDoCliente(clienteId),
    [clienteId]
  );

  const [ferramentaKey, setFerramentaKey] = useState<Campo | null>(null);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [buscaProd, setBuscaProd] = useState("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultadoAgente, setResultadoAgente] = useState<{
    markdown: string;
    agente: string;
    tipo: "IA" | "Simulada";
  } | null>(null);

  const ferramenta = FERRAMENTAS.find((f) => f.key === ferramentaKey) ?? null;
  const produto = (produtos ?? []).find((p) => p.id === produtoId) ?? null;

  // Anúncio mais recente por produto (resultado existente).
  const anuncioPorProduto = useMemo(() => {
    const m = new Map<string, AnuncioGeradoRegistro>();
    [...(anuncios ?? [])]
      .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
      .forEach((a) => {
        if (a.produtoId && !m.has(a.produtoId)) m.set(a.produtoId, a);
      });
    return m;
  }, [anuncios]);

  // Otimizações REAIS (feitas pela IA) — os anúncios importados do ML não
  // contam, senão a base inteira apareceria como "já otimizada".
  const otimizadosReais = useMemo(() => {
    const s = new Set<string>();
    for (const a of anuncios ?? []) {
      if (a.produtoId && !(a.observacoes ?? "").startsWith("Importado")) s.add(a.produtoId);
    }
    return s;
  }, [anuncios]);

  const registro = produtoId ? anuncioPorProduto.get(produtoId) ?? null : null;
  // A COTA VEM DO DOMÍNIO, e "não sei" não bloqueia.
  //
  // Era `semCota = Boolean(quota) && restante <= 0`, e `quotaEsteira()`
  // devolvia `{limite:0,usado:0,restante:0}` quando a LEITURA FALHAVA — então
  // uma falha de rede mostrava "você usou todas as otimizações deste mês",
  // travava o botão Gerar e mandava a lojista falar com a Zion. Ver
  // `cotaDaEsteira`: `null` é "não conseguimos ler", e é fail-open.
  const cota = estadoDaCota(quota ?? null, new Date());
  const restante = cota.tipo === "tem" ? cota.restante : 0;
  const semCota = !cota.podeGerar;

  const passo = !ferramentaKey ? 1 : !produtoId ? 2 : 3;

  function voltar() {
    setErro(null);
    setResultadoAgente(null);
    if (passo === 3) setProdutoId(null);
    else if (passo === 2) setFerramentaKey(null);
  }
  function recomecar() {
    setFerramentaKey(null);
    setProdutoId(null);
    setErro(null);
    setResultadoAgente(null);
  }

  async function gerarAgente() {
    if (!produto || !ferramenta?.agente || rodando) return;
    setRodando(true);
    setErro(null);
    setResultadoAgente(null);
    try {
      const variantes = await listarVariantesDoProduto(produto.id);
      const r = await rodarAgentePortal(ferramenta.agente, {
        contexto: montarContexto({ produto, variantes, tabelasMedidas: tabelasMedidas ?? [] }),
        produto: produto.nome,
      });
      setResultadoAgente(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar. Tente novamente.");
    } finally {
      setRodando(false);
    }
  }

  async function gerar() {
    if (!produto || rodando || semCota) return;
    setRodando(true);
    setErro(null);
    try {
      const variantes = await listarVariantesDoProduto(produto.id);
      const r = await rodarEsteira("", {
        contexto: montarContexto({ produto, variantes, tabelasMedidas: tabelasMedidas ?? [] }),
        produto: produto.nome,
        variantes,
        precoVenda: produto.precoVenda,
      });
      const passouA10 = r.anuncio.vereditoA10 === "aprovado" && r.anuncio.pendencias.length === 0;
      await criarAnuncioGerado({
        clienteId,
        cliente: nome,
        produtoId: produto.id,
        produto: produto.nome,
        auditoriaId: null,
        marketplace: produto.marketplace ?? "Mercado Livre",
        origem: "esteira",
        tipoExecucao: r.tipo,
        notaDiagnostico: r.anuncio.notaDiagnostico,
        vereditoA10: r.anuncio.vereditoA10,
        qtdPendencias: r.anuncio.pendencias.length,
        anuncio: r.anuncio,
        status: passouA10 ? "aguardando_aprovacao" : "rascunho",
        aprovadoPor: "",
        aprovadoEm: null,
        criadoEm: new Date().toISOString(),
        observacoes: "",
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar. Tente novamente.");
    } finally {
      setRodando(false);
    }
  }

  async function aprovar() {
    if (!registro) return;
    setBusy(true);
    try {
      await aprovarAnuncioGerado(registro.id, nome || "cliente");
    } finally {
      setBusy(false);
    }
  }
  async function refazer() {
    if (!produto || rodando) return;
    // Rejeita o anúncio atual e gera um NOVO com o contexto de agora
    // (variações + tabela de medidas + kit). O novo vira o mais recente.
    if (registro) {
      try {
        await rejeitarAnuncioGerado(registro.id, "Refazer solicitado pelo cliente.");
      } catch {
        /* segue para regenerar mesmo assim */
      }
    }
    await gerar();
  }

  const produtosFiltrados = useMemo(() => {
    const q = buscaProd.trim().toLowerCase();
    return (produtos ?? []).filter(
      (p) => !q || `${p.nome} ${p.sku}`.toLowerCase().includes(q)
    );
  }, [produtos, buscaProd]);

  // "IMPORTE SEUS PRODUTOS" A QUEM TEM OITENTA.
  //
  // O ramo abaixo faz `(produtos ?? []).length === 0` e RETORNA. O `?? []`
  // transforma "ainda não sei" em "não há", e enquanto a busca está no ar a
  // tela inteira vira um convite para importar uma base que já existe.
  if (estadoDosProdutos === "carregando") {
    return (
      <>
        <PageHeader titulo="Otimizar com IA" subtitulo="As ferramentas de IA da Zion trabalham a partir dos seus produtos." />
        <EsqueletoDeBloco altura="h-40" />
      </>
    );
  }

  if ((produtos ?? []).length === 0) {
    return (
      <>
        <PageHeader titulo="Otimizar com IA" subtitulo="As ferramentas de IA da Zion trabalham a partir dos seus produtos." />
        <VazioAmigavel
          icon={Package}
          titulo="Importe seus produtos primeiro"
          descricao="A IA precisa dos seus produtos para gerar títulos, descrições e ficha técnica. Comece importando sua base."
          acao={
            <Link href="/cliente/produtos">
              <Button>
                <Package size={15} /> Ir para Meus Produtos
              </Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Otimizar com IA"
        subtitulo="Escolha uma ferramenta, o produto e deixe a IA criar o conteúdo para você."
        acao={
          quota ? (
            <Pill tone={semCota ? "yellow" : "violet"}>
              <Gauge size={12} /> {quota.usado}/{quota.limite} no mês
            </Pill>
          ) : undefined
        }
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {["Ferramenta", "Produto", "Resultado"].map((label, i) => {
          const n = i + 1;
          const ativo = passo === n;
          const feito = passo > n;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium ${
                  ativo
                    ? "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30"
                    : feito
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-white/[0.03] text-zinc-500"
                }`}
              >
                {feito ? <CheckCircle2 size={12} /> : <span>{n}</span>} {label}
              </span>
              {i < 2 && <ArrowRight size={13} className="text-zinc-700" />}
            </div>
          );
        })}
        {passo > 1 && (
          <button onClick={voltar} className="ml-auto inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300">
            <ArrowLeft size={13} /> Voltar
          </button>
        )}
      </div>

      {erro && (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertTriangle size={15} /> {erro}
        </p>
      )}

      {/* Passo 1 — otimização em massa + escolher ferramenta */}
      {passo === 1 && (
        <OtimizarEmMassa
          clienteId={clienteId}
          produtos={produtos ?? []}
          otimizados={otimizadosReais}
          restante={quota?.restante ?? 0}
          onConcluido={recarregarAnuncios}
        />
      )}
      {passo === 1 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FERRAMENTAS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFerramentaKey(f.key)}
                className="group flex h-full flex-col rounded-xl border border-white/5 bg-surface-raised p-4 text-left transition-colors hover:border-violet-500/30"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_ICON[f.tone]}`}>
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-medium text-zinc-100">{f.nome}</p>
                </div>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-500">{f.descricao}</p>
                <p className="mt-2 text-[11px] text-zinc-600">{f.quando}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-400 opacity-0 transition-opacity group-hover:opacity-100">
                  Começar <ArrowRight size={12} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Passo 2 — escolher produto */}
      {passo === 2 && ferramenta && (
        <Card title={`${ferramenta.nome} · escolha o produto`}>
          <input
            value={buscaProd}
            onChange={(e) => setBuscaProd(e.target.value)}
            placeholder="Buscar produto…"
            className="mb-3 w-full rounded-lg border border-white/10 bg-surface-input px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500"
          />
          <ul className="max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
            {produtosFiltrados.map((p) => {
              const otimizado = otimizadosReais.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setProdutoId(p.id)}
                    className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-200">{p.nome}</p>
                      <p className="text-xs text-zinc-500">
                        {p.marketplace} · {formatBRL(p.precoVenda)}
                      </p>
                    </div>
                    {otimizado ? <Pill tone="green">Já otimizado</Pill> : <Pill tone="gray">Novo</Pill>}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Passo 3 — resultado */}
      {passo === 3 && ferramenta && produto && (
        <ResultadoPasso
          ferramenta={ferramenta}
          produto={produto}
          registro={registro}
          rodando={rodando}
          busy={busy}
          semCota={semCota}
          fraseDaCota={cota.frase}
          resultadoAgente={resultadoAgente}
          onGerar={gerar}
          onGerarAgente={gerarAgente}
          onAprovar={aprovar}
          onRefazer={refazer}
          onOutro={recomecar}
        />
      )}
    </>
  );
}

function OtimizarEmMassa({
  clienteId,
  produtos,
  otimizados,
  restante,
  onConcluido,
}: {
  clienteId: string;
  produtos: Produto[];
  /** IDs de produtos que JÁ têm otimização real (feita pela IA). */
  otimizados: Set<string>;
  restante: number;
  /** Chamado quando a fila termina — recarrega os anúncios (sem F5). */
  onConcluido: () => void;
}) {
  const pendentes = useMemo(
    () => produtos.filter((p) => !otimizados.has(p.id)),
    [produtos, otimizados]
  );
  const [fila, setFila] = useState<StatusFila | null>(null);
  const [enfileirando, setEnfileirando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ativosAntes = useRef(0);

  // Acompanha a fila (o worker processa no servidor) — atualiza a cada 4s.
  useEffect(() => {
    let vivo = true;
    async function tick() {
      try {
        const s = await statusFila(clienteId);
        if (!vivo) return;
        setFila(s);
        // Transição "processando → vazio": a fila terminou → recarrega os
        // anúncios sozinho (some a necessidade de F5).
        const ativos = s.pendente + s.processando;
        if (ativosAntes.current > 0 && ativos === 0) onConcluido();
        ativosAntes.current = ativos;
      } catch {
        /* ignora falha de polling */
      }
    }
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [clienteId, onConcluido]);

  async function enfileirar(lista: Produto[]) {
    const alvo = lista.slice(0, Math.max(0, restante));
    if (enfileirando || alvo.length === 0) return;
    if (
      !window.confirm(
        `Enfileirar ${alvo.length} produto(s) para a IA otimizar no servidor (título, descrição, SEO, ficha, medidas, FAQ e plano)? Roda sozinho — você pode fechar a aba.`
      )
    )
      return;
    setEnfileirando(true);
    setErro(null);
    setMsg(null);
    try {
      const n = await enfileirarProdutos(clienteId, alvo.map((p) => p.id));
      setMsg(`${n} produto(s) na fila. A IA processa no servidor — acompanhe abaixo (pode fechar a aba).`);
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

  const total = produtos.length;
  const capFaltam = Math.min(pendentes.length, Math.max(0, restante));
  const capTodos = Math.min(total, Math.max(0, restante));
  const ativos = (fila?.pendente ?? 0) + (fila?.processando ?? 0);
  const feito = fila ? fila.concluido + fila.erro : 0;
  const pct = fila && fila.total > 0 ? Math.round((feito / fila.total) * 100) : 0;

  return (
    <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Sparkles size={15} className="text-violet-400" /> Otimizar tudo
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            A IA gera título, descrição, SEO, ficha, medidas, FAQ e plano de cada produto — tudo de
            uma vez, <span className="text-zinc-400">no servidor</span> (pode fechar a aba).{" "}
            {pendentes.length} de {total} ainda sem otimização.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendentes.length > 0 && (
            <Button onClick={() => enfileirar(pendentes)} disabled={enfileirando || capFaltam <= 0}>
              <Play size={14} /> Otimizar tudo ({capFaltam})
            </Button>
          )}
          <Button
            variant={pendentes.length > 0 ? "ghost" : "primary"}
            onClick={() => enfileirar(produtos)}
            disabled={enfileirando || capTodos <= 0}
          >
            <Sparkles size={14} /> Reotimizar todos ({capTodos})
          </Button>
        </div>
      </div>

      {restante < total && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
          <Gauge size={12} /> Sua cota permite {restante} este mês — o restante fica para depois.
        </p>
      )}

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
              <CheckCircle2 size={13} /> Terminou — anúncios atualizados. Revise em{" "}
              <span className="text-zinc-300">Meus Anúncios</span>.
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
  );
}

function ResultadoPasso({
  ferramenta,
  produto,
  registro,
  rodando,
  busy,
  semCota,
  fraseDaCota,
  resultadoAgente,
  onGerar,
  onGerarAgente,
  onAprovar,
  onRefazer,
  onOutro,
}: {
  ferramenta: Ferramenta;
  produto: Produto;
  registro: AnuncioGeradoRegistro | null;
  rodando: boolean;
  busy: boolean;
  semCota: boolean;
  /** A frase do domínio. A tela não redige cota — ver `cotaDaEsteira`. */
  fraseDaCota: string;
  resultadoAgente: { markdown: string; agente: string; tipo: "IA" | "Simulada" } | null;
  onGerar: () => void;
  onGerarAgente: () => void;
  onAprovar: () => void;
  onRefazer: () => void;
  onOutro: () => void;
}) {
  // Preço: cálculo local, sem IA.
  if (ferramenta.modo === "local") {
    return <PrecoResultado produto={produto} onOutro={onOutro} />;
  }

  // Agente único: roda só o agente da ferramenta (rápido) e mostra o resultado.
  if (ferramenta.modo === "agente") {
    return (
      <AgenteResultado
        ferramenta={ferramenta}
        produto={produto}
        rodando={rodando}
        resultado={resultadoAgente}
        onGerar={onGerarAgente}
        onOutro={onOutro}
      />
    );
  }

  const anuncio = registro?.anuncio ?? null;

  return (
    <Card
      title={`${ferramenta.nome} · ${produto.nome}`}
      action={
        <button onClick={onOutro} className="text-xs text-zinc-500 hover:text-zinc-300">
          Otimizar outro
        </button>
      }
    >
      {rodando ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Sparkles size={26} className="animate-pulse text-violet-400" />
          <p className="mt-3 text-sm text-zinc-300">A IA está trabalhando no seu anúncio…</p>
          <p className="mt-1 text-xs text-zinc-500">Isso leva alguns segundos.</p>
        </div>
      ) : !anuncio ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            A IA vai analisar este produto e gerar o conteúdo. Confira os dados antes de começar:
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm sm:grid-cols-3">
            <Dado label="Produto" valor={produto.nome} />
            <Dado label="Marca" valor={produto.marca || "—"} />
            <Dado label="Categoria" valor={produto.categoria || "—"} />
            <Dado label="Marketplace" valor={produto.marketplace} />
            <Dado label="Preço" valor={formatBRL(produto.precoVenda)} />
            <Dado label="Estoque" valor={String(produto.estoque)} />
          </div>
          {semCota ? (
            <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400 ring-1 ring-inset ring-amber-500/20">
              <AlertTriangle size={14} /> {fraseDaCota}
            </p>
          ) : (
            <Button onClick={onGerar}>
              <Play size={15} /> Gerar com IA
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* A CONTRADIÇÃO DE 03/08 ESTAVA AQUI TAMBÉM.
              *
              * Dois selos diziam metades do mesmo fato — "Nota 0/100" e
              * "Veredito: aprovado", com o valor cru em minúscula. Num anúncio
              * importado do ML, onde a nota é zero por AUSÊNCIA de medição, os
              * dois juntos formavam a frase impossível que `notaExibivel`
              * existe para impedir: ninguém tira zero e é aprovado.
              *
              * `explicarVeredito` já sabe as três coisas — se houve avaliação,
              * o julgamento em palavra de gente, e a nota. Um selo, uma frase,
              * a mesma função que a lista de anúncios já usava. */}
            <Pill
              tone={
                !foiAvaliadoPelaIA(registro!)
                  ? "gray"
                  : registro!.vereditoA10 === "aprovado"
                    ? "green"
                    : "yellow"
              }
            >
              {explicarVeredito(registro!)}
            </Pill>
            {registro!.qtdPendencias > 0 && (
              <Pill tone="yellow">
                {registro!.qtdPendencias === 1
                  ? "1 pendência"
                  : `${registro!.qtdPendencias} pendências`}
              </Pill>
            )}
          </div>

          <ConteudoFerramenta campo={ferramenta.key} anuncio={anuncio} />

          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
            {registro!.vereditoA10 === "aprovado" && registro!.qtdPendencias === 0 ? (
              <Button variant="success" onClick={onAprovar} disabled={busy}>
                <ShieldCheck size={15} /> Aprovar anúncio
              </Button>
            ) : (
              <Pill tone="yellow">Revise as pendências antes de aprovar</Pill>
            )}
            <Button variant="danger" onClick={onRefazer} disabled={busy}>
              <XCircle size={15} /> Refazer
            </Button>
            <Link href="/cliente/anuncios" className="ml-auto text-xs text-violet-400 hover:text-violet-300">
              Ver todos os anúncios →
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

function Dado({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="truncate text-zinc-200">{valor}</p>
    </div>
  );
}

/** Resultado de uma ferramenta que roda só o SEU agente (rápido, Markdown). */
function AgenteResultado({
  ferramenta,
  produto,
  rodando,
  resultado,
  onGerar,
  onOutro,
}: {
  ferramenta: Ferramenta;
  produto: Produto;
  rodando: boolean;
  resultado: { markdown: string; agente: string; tipo: "IA" | "Simulada" } | null;
  onGerar: () => void;
  onOutro: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.markdown);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  return (
    <Card
      title={`${ferramenta.nome} · ${produto.nome}`}
      action={
        <button onClick={onOutro} className="text-xs text-zinc-500 hover:text-zinc-300">
          Otimizar outro
        </button>
      }
    >
      {rodando ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Sparkles size={26} className="animate-pulse text-violet-400" />
          <p className="mt-3 text-sm text-zinc-300">A IA está gerando…</p>
          <p className="mt-1 text-xs text-zinc-500">É rápido — só esta ferramenta.</p>
        </div>
      ) : !resultado ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            A IA vai usar os dados abaixo para {ferramenta.nome.toLowerCase()}. Confira antes de gerar:
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm sm:grid-cols-3">
            <Dado label="Produto" valor={produto.nome} />
            <Dado label="Marca" valor={produto.marca || "—"} />
            <Dado label="Categoria" valor={produto.categoria || "—"} />
            <Dado label="Marketplace" valor={produto.marketplace} />
            <Dado label="Preço" valor={formatBRL(produto.precoVenda)} />
            <Dado label="Estoque" valor={String(produto.estoque)} />
          </div>
          <Button onClick={onGerar}>
            <Play size={15} /> Gerar com IA
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pill tone={resultado.tipo === "Simulada" ? "yellow" : "violet"}>
              {resultado.tipo === "Simulada" ? "Exemplo (IA não configurada)" : `Gerado pelo agente ${resultado.agente}`}
            </Pill>
            <button
              onClick={copiar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300 hover:border-white/20"
            >
              {copiado ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/20 p-4 text-sm leading-relaxed text-zinc-200">
            {resultado.markdown}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            <Button variant="ghost" onClick={onGerar}>
              <Play size={14} /> Gerar de novo
            </Button>
            <Link href="/cliente/otimizar" onClick={onOutro} className="ml-auto text-xs text-violet-400 hover:text-violet-300">
              Usar outra ferramenta →
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Renderiza a seção específica da ferramenta escolhida a partir do anúncio gerado. */
function ConteudoFerramenta({ campo, anuncio }: { campo: Campo; anuncio: AnuncioGerado }) {
  const Bloco = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{titulo}</p>
      <div className="mt-1 text-sm text-zinc-200">{children}</div>
    </div>
  );

  switch (campo) {
    case "titulo":
      return <Bloco titulo="Título otimizado">{anuncio.tituloOtimizado}</Bloco>;
    case "descricao":
      return (
        <div className="space-y-3">
          <Bloco titulo="Descrição completa">
            <p className="whitespace-pre-line">{anuncio.descricaoCompleta}</p>
          </Bloco>
          {anuncio.descricaoCurta && (
            <Bloco titulo="Descrição curta">
              <p className="whitespace-pre-line text-zinc-300">{anuncio.descricaoCurta}</p>
            </Bloco>
          )}
        </div>
      );
    case "seo":
      return (
        <div className="space-y-3">
          <Bloco titulo="Palavras-chave principais">
            <div className="flex flex-wrap gap-1.5">
              {anuncio.palavrasChavePrincipais.map((k, i) => (
                <Pill key={i} tone="violet">{k}</Pill>
              ))}
            </div>
          </Bloco>
          {anuncio.palavrasChaveSecundarias?.length > 0 && (
            <Bloco titulo="Secundárias">
              <div className="flex flex-wrap gap-1.5">
                {anuncio.palavrasChaveSecundarias.map((k, i) => (
                  <Pill key={i} tone="gray">{k}</Pill>
                ))}
              </div>
            </Bloco>
          )}
        </div>
      );
    case "tabela_medidas":
      return (
        <div className="space-y-3">
          <Bloco titulo="Tabela de medidas">
            <p className="whitespace-pre-line font-mono text-xs text-zinc-300">{anuncio.tabelaMedidas || "—"}</p>
          </Bloco>
          {anuncio.comoMedir && <Bloco titulo="Como medir"><p className="whitespace-pre-line text-zinc-300">{anuncio.comoMedir}</p></Bloco>}
        </div>
      );
    case "ficha_tecnica":
      return (
        <Bloco titulo="Ficha técnica">
          <ul className="divide-y divide-white/[0.04] rounded-lg border border-white/5">
            {anuncio.fichaTecnica.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                {/* Sem o asterisco de "obrigatório": ele vinha do modelo, que
                    não sabe o que o marketplace exige — a lista é do ML e varia
                    por categoria (D5 do DES-001). Marcar era afirmar. */}
                <span className="text-zinc-500">{f.atributo}</span>
                <span className="text-zinc-200">{f.valor || "—"}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      );
    case "imagens":
      return (
        <Bloco titulo="Sugestões de imagem">
          <ol className="space-y-2">
            {anuncio.imagensSugeridas.map((img, i) => (
              <li key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <p className="text-xs font-medium text-zinc-300">
                  {i + 1}. {img.tipo}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{img.prompt}</p>
              </li>
            ))}
          </ol>
        </Bloco>
      );
    case "faq":
      return (
        <Bloco titulo="Perguntas frequentes">
          <ul className="space-y-2">
            {anuncio.faq.map((q, i) => (
              <li key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <p className="text-sm font-medium text-zinc-200">{q.pergunta}</p>
                <p className="mt-0.5 text-sm text-zinc-400">{q.resposta}</p>
              </li>
            ))}
          </ul>
        </Bloco>
      );
    case "plano":
      return (
        <div className="space-y-3">
          <Bloco titulo="Diagnóstico da IA"><p className="text-zinc-300">{anuncio.motivoVeredito}</p></Bloco>
          <Bloco titulo="Próximos passos">
            {anuncio.pendencias.length === 0 ? (
              <p className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 size={14} /> Nada pendente — o anúncio está pronto.
              </p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-amber-300/90">
                {anuncio.pendencias.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      );
    case "auditoria":
    default:
      return (
        <div className="space-y-3">
          <Bloco titulo="Título otimizado">{anuncio.tituloOtimizado}</Bloco>
          <Bloco titulo="Diagnóstico"><p className="text-zinc-300">{anuncio.motivoVeredito}</p></Bloco>
          {anuncio.pendencias.length > 0 && (
            <Bloco titulo="O que corrigir primeiro">
              <ul className="list-disc space-y-1 pl-5 text-amber-300/90">
                {anuncio.pendencias.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </Bloco>
          )}
        </div>
      );
  }
}

/** Resultado da ferramenta de preço — usa a margem que o LOJISTA escolheu. */
function PrecoResultado({ produto, onOutro }: { produto: Produto; onOutro: () => void }) {
  // Sem isto, esta tela e /cliente/precificacao mostrariam preços mínimos
  // diferentes para o mesmo produto — o portal se contradizendo.
  const [margemMinima, setMargemMinima] = useState(MARGEM_MINIMA_PADRAO);
  useEffect(() => {
    let vivo = true;
    margemMinimaDoCliente().then((m) => vivo && setMargemMinima(m));
    return () => {
      vivo = false;
    };
  }, []);

  const { margem, status, tone } = saudeMargem(produto, margemMinima);
  const piso = produto.custo > 0 ? precoMinimo(produto.custo, margemMinima) : null;
  const precoMin = piso?.ok ? piso.preco : null;
  const pendenciaFrete = piso && !piso.ok && piso.motivo === "sem_peso" ? piso.pendencia : null;

  return (
    <Card
      title={`Análise de preço · ${produto.nome}`}
      action={
        <button onClick={onOutro} className="text-xs text-zinc-500 hover:text-zinc-300">
          Analisar outro
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dado label="Custo" valor={formatBRL(produto.custo)} />
        <Dado label="Preço atual" valor={formatBRL(produto.precoVenda)} />
        <Dado label="Margem Zion" valor={margem != null ? `${margem}%` : "—"} />
        <Dado label="Preço mínimo" valor={precoMin != null ? formatBRL(precoMin) : "—"} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Pill tone={tone}>{status}</Pill>
        {precoMin != null && produto.precoVenda < precoMin && (
          <span className="text-sm text-amber-400">
            Abaixo do preço mínimo — considere ajustar para {formatBRL(precoMin)}.
          </span>
        )}
        {pendenciaFrete && <span className="text-sm text-amber-400">{pendenciaFrete}</span>}
        {margem != null && margem >= 20 && (
          <span className="text-sm text-emerald-400">Margem saudável para vender com folga.</span>
        )}
      </div>
      <p className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
        Comissão do Mercado Livre por tipo de anúncio, custo fixo por faixa de preço e frete por
        peso. Onde falta o frete, o preço mínimo aparece como pendência em vez de estimativa.
      </p>
      <div className="mt-3">
        <Link href="/cliente/precificacao" className="text-xs text-violet-400 hover:text-violet-300">
          Ver todos os preços →
        </Link>
      </div>
    </Card>
  );
}
