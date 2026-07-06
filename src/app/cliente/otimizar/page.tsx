"use client";

import { useMemo, useState } from "react";
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
import { useLiveQuery } from "@/lib/hooks";
import { montarContexto } from "@/lib/contexto";
import { listarProdutos } from "@/lib/services/produtos";
import {
  criarAnuncioGerado,
  listarAnunciosGeradosDoCliente,
  aprovarAnuncioGerado,
  rejeitarAnuncioGerado,
} from "@/lib/services/anunciosGerados";
import { rodarEsteira } from "@/lib/services/esteira";
import { rodarAgentePortal } from "@/lib/services/agentePortal";
import { quotaEsteira } from "@/lib/services/perfil";
import type { FerramentaPortal } from "@/lib/agentes/catalogo";
import { precoMinimoZion } from "@/lib/services/importacaoProdutos";
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
  const { data: produtos } = useLiveQuery(listarProdutos);
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: quota } = useLiveQuery(quotaEsteira);

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

  const registro = produtoId ? anuncioPorProduto.get(produtoId) ?? null : null;
  const restante = quota?.restante ?? 0;
  const semCota = Boolean(quota) && restante <= 0;

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
      const r = await rodarAgentePortal(ferramenta.agente, {
        contexto: montarContexto({ produto }),
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
      const r = await rodarEsteira("", {
        contexto: montarContexto({ produto }),
        produto: produto.nome,
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
    if (!registro) return;
    setBusy(true);
    try {
      await rejeitarAnuncioGerado(registro.id, "Refazer solicitado pelo cliente.");
    } finally {
      setBusy(false);
    }
  }

  const produtosFiltrados = useMemo(() => {
    const q = buscaProd.trim().toLowerCase();
    return (produtos ?? []).filter(
      (p) => !q || `${p.nome} ${p.sku}`.toLowerCase().includes(q)
    );
  }, [produtos, buscaProd]);

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

      {/* Passo 1 — escolher ferramenta */}
      {passo === 1 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FERRAMENTAS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFerramentaKey(f.key)}
                className="group flex h-full flex-col rounded-xl border border-white/5 bg-[#0e0e16] p-4 text-left transition-colors hover:border-violet-500/30"
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
            className="mb-3 w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500/50"
          />
          <ul className="max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
            {produtosFiltrados.map((p) => {
              const otimizado = anuncioPorProduto.has(p.id);
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

function ResultadoPasso({
  ferramenta,
  produto,
  registro,
  rodando,
  busy,
  semCota,
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
              <AlertTriangle size={14} /> Você usou todas as otimizações do seu plano este mês. Fale com a Zion para ampliar.
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
            <Pill tone={registro!.vereditoA10 === "aprovado" ? "green" : "yellow"}>
              Nota {registro!.notaDiagnostico}/100
            </Pill>
            <Pill tone={registro!.vereditoA10 === "aprovado" ? "green" : "yellow"}>
              Veredito: {registro!.vereditoA10}
            </Pill>
            {registro!.qtdPendencias > 0 && <Pill tone="yellow">{registro!.qtdPendencias} pendência(s)</Pill>}
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
                <span className="text-zinc-500">
                  {f.atributo}
                  {f.obrigatorio && <span className="ml-1 text-amber-400">*</span>}
                </span>
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

/** Resultado da ferramenta de preço — cálculo local (modelo Zion). */
function PrecoResultado({ produto, onOutro }: { produto: Produto; onOutro: () => void }) {
  const { margem, status, tone } = saudeMargem(produto);
  const precoMin = produto.custo > 0 ? precoMinimoZion(produto.custo) : null;

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
        {margem != null && margem >= 20 && (
          <span className="text-sm text-emerald-400">Margem saudável para vender com folga.</span>
        )}
      </div>
      <p className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
        Cálculo pelo modelo Zion (taxa do marketplace, tarifa fixa e frete estimado). Para ajustar o
        preço em massa, fale com a equipe Zion.
      </p>
      <div className="mt-3">
        <Link href="/cliente/precificacao" className="text-xs text-violet-400 hover:text-violet-300">
          Ver todos os preços →
        </Link>
      </div>
    </Card>
  );
}
