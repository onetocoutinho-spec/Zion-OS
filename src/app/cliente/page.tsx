"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Megaphone,
  AlertTriangle,
  Package,
  Gauge,
  ListChecks,
  FileText,
  Sparkles,
  ArrowRight,
  Wand2,
  Upload,
  Calculator,
  ClipboardCheck,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { PageHeader, ActionTile, Section, Pill } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutosComPeso } from "@/lib/services/pesoDeProduto";
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { listarTodasImagens } from "@/lib/services/imagensProduto";
import {
  lacunasDaLoja,
  type EstadoDaLoja,
} from "@/modules/publication/domain/prontidaoDaLoja";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import { listarAuditorias } from "@/lib/services/auditorias";
import { listarPendenciasDoCliente } from "@/lib/services/pendencias";
import { listarRelatoriosDoCliente } from "@/lib/services/relatorios";
import { portalProximasAcoes, quotaEsteira } from "@/lib/services/perfil";

export default function ClienteHome() {
  const { clienteId, nome } = useClientPortal();

  // A home precisa do PESO, não só do produto: é o peso que decide se a
  // precificação existe, e era justamente ele que não aparecia em lugar nenhum.
  const { data: produtos } = useLiveQuery(
    () => listarProdutosComPeso(clienteId),
    [clienteId]
  );
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: auditorias } = useLiveQuery(listarAuditorias);
  const { data: pendencias } = useLiveQuery(
    () => listarPendenciasDoCliente(clienteId),
    [clienteId]
  );
  const { data: relatorios } = useLiveQuery(
    () => listarRelatoriosDoCliente(clienteId),
    [clienteId]
  );
  const { data: imagens } = useLiveQuery(listarTodasImagens);
  const { data: canal } = useLiveQuery(
    () => buscarCanal(clienteId, "Mercado Livre"),
    [clienteId]
  );
  const { data: proximas } = useLiveQuery(portalProximasAcoes);
  const { data: quota } = useLiveQuery(quotaEsteira);

  const m = useMemo(() => {
    const prods = produtos ?? [];
    const ans = anuncios ?? [];
    const auds = auditorias ?? [];
    const pends = (pendencias ?? []).filter((p) => !p.resolvida);

    const produtosComAnuncio = new Set(ans.map((a) => a.produtoId).filter(Boolean));
    const ativos = ans.filter((a) => a.status === "aprovado" || a.status === "publicado").length;
    const comProblema = ans.filter(
      (a) => a.qtdPendencias > 0 || (a.status !== "aprovado" && a.status !== "publicado")
    ).length;
    const semOtimizacao = prods.filter((p) => !produtosComAnuncio.has(p.id)).length;

    const notas = ans.map((a) => a.notaDiagnostico).filter((n) => n > 0);
    const scoreAnuncios = notas.length
      ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length)
      : null;
    const scoreAuditoria = auds.length
      ? Math.round(auds.reduce((s, a) => s + a.scoreQualidade, 0) / auds.length)
      : null;
    const score = scoreAnuncios ?? scoreAuditoria;

    return {
      total: prods.length,
      ativos,
      comProblema,
      semOtimizacao,
      score,
      pendencias: pends.length,
      relatorios: (relatorios ?? []).length,
      auditados: auds.length,
    };
  }, [produtos, anuncios, auditorias, pendencias, relatorios]);

  /**
   * O QUE FALTA — a lista honesta, na ordem em que resolver produz resultado.
   *
   * Substitui as antigas "sugestões da IA", que mandavam otimizar e auditar
   * enquanto a precificação estava morta por falta de peso — e nunca diziam
   * isso. O lojista não tinha como descobrir sozinho.
   */
  const lacunas = useMemo(() => {
    const prods = produtos ?? [];
    const ans = anuncios ?? [];
    const produtosComAnuncio = new Set(ans.map((a) => a.produtoId).filter(Boolean));
    const comFoto = new Set((imagens ?? []).map((i) => i.produtoId).filter(Boolean));

    const estado: EstadoDaLoja = {
      produtos: prods.length,
      comPeso: prods.filter((p) => p.pesoGramas > 0).length,
      comCusto: prods.filter((p) => p.custo > 0).length,
      // MEDIDO, não deduzido: o menor entre "com custo" e "com peso" parece um
      // teto honesto e é chute — os conjuntos podem não se sobrepor.
      prontosParaPrecificar: prods.filter((p) => p.custo > 0 && p.pesoGramas > 0).length,
      comFoto: prods.filter((p) => comFoto.has(p.id)).length,
      comAnuncio: prods.filter((p) => produtosComAnuncio.has(p.id)).length,
      aguardandoAprovacao: ans.filter((a) => a.status === "aguardando_aprovacao").length,
      aprovadosNaoPublicados: ans.filter((a) => a.status === "aprovado").length,
      conectadoAoMarketplace: Boolean(canal?.ativo),
    };
    return { lista: lacunasDaLoja(estado), estado };
  }, [produtos, anuncios, imagens, canal]);

  return (
    <>
      <PageHeader
        titulo={`Olá, ${nome} 👋`}
        subtitulo="Este é o seu painel. Aqui você acompanha a saúde da sua loja e otimiza seus anúncios com a ajuda da IA."
        acao={
          quota ? (
            <Pill tone={quota.restante > 0 ? "violet" : "yellow"}>
              <Gauge size={12} /> {quota.usado}/{quota.limite} otimizações no mês
            </Pill>
          ) : undefined
        }
      />

      {/* Cards de visão geral */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Anúncios ativos" value={m.ativos} icon={Megaphone} tone="green" />
        <StatCard
          label="Anúncios com problemas"
          value={m.comProblema}
          icon={AlertTriangle}
          tone={m.comProblema > 0 ? "yellow" : "gray"}
        />
        <StatCard
          label="Produtos sem otimização"
          value={m.semOtimizacao}
          icon={Package}
          tone={m.semOtimizacao > 0 ? "orange" : "gray"}
        />
        <StatCard
          label="Score médio"
          value={m.score != null ? `${m.score}` : "—"}
          hint={m.score != null ? "de 100" : "otimize para gerar"}
          icon={Gauge}
          tone={m.score != null && m.score >= 70 ? "green" : m.score != null ? "yellow" : "gray"}
        />
        <StatCard
          label="Pendências abertas"
          value={m.pendencias}
          icon={ListChecks}
          tone={m.pendencias > 0 ? "yellow" : "gray"}
        />
        <StatCard label="Relatórios" value={m.relatorios} icon={FileText} tone="blue" />
        <StatCard label="Pontos a resolver" value={lacunas.lista.length} icon={Sparkles} tone="violet" />
        <StatCard label="Próximas ações" value={(proximas ?? []).length} icon={ArrowRight} tone="cyan" />
      </div>

      {/* O que você quer fazer hoje? */}
      <Section titulo="O que você quer fazer hoje?" descricao="Escolha uma ação para começar.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionTile
            href="/cliente/anunciar"
            icon={Wand2}
            titulo="Otimizar meus anúncios"
            descricao="A IA cria títulos, descrições e ficha técnica prontos."
            tone="violet"
          />
          <ActionTile
            href="/cliente/produtos"
            icon={Upload}
            titulo="Importar produtos"
            descricao="Suba sua planilha e monte sua base em minutos."
            tone="cyan"
          />
          <ActionTile
            href="/cliente/precificacao"
            icon={Calculator}
            titulo="Analisar preço e margem"
            descricao="Veja o lucro real de cada produto e o preço ideal."
            tone="green"
          />
          <ActionTile
            href="/cliente/auditoria"
            icon={ClipboardCheck}
            titulo="Ver problemas da loja"
            descricao="Descubra o que corrigir primeiro para vender mais."
            tone="orange"
          />
          <ActionTile
            href="/cliente/anuncios"
            icon={Megaphone}
            titulo="Revisar meus anúncios"
            descricao="Aprove ou refaça o que a IA já gerou para você."
            tone="blue"
          />
          <ActionTile
            href="/cliente/relatorios"
            icon={FileText}
            titulo="Gerar relatório"
            descricao="Acompanhe o que foi feito e o que precisa de atenção."
            tone="violet"
          />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sugestões da IA */}
        <Section
          titulo="O que falta"
          descricao="Na ordem em que resolver destrava o resto."
        >
          <Card>
            {lacunas.lista.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Nada travado. Sua loja está em dia.
              </div>
            ) : (
              <ul className="space-y-3">
                {lacunas.lista.map((l) => (
                  <li key={l.tipo} className="flex items-start gap-3">
                    {/* Vermelho só para o que trava TUDO. Se tudo fosse urgente,
                        nada seria — e a lista viraria ruído a se ignorar. */}
                    {l.bloqueiaTudo ? (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
                    ) : (
                      <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200">{l.titulo}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{l.trava}</p>
                      <Link
                        href={l.href}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
                      >
                        {l.cta} <ArrowRight size={12} />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {lacunas.estado.produtos > 0 && (
              <p className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
                <strong className="text-zinc-300">{lacunas.estado.prontosParaPrecificar}</strong> de{" "}
                {lacunas.estado.produtos} produto(s) têm custo e peso — os únicos com preço mínimo
                calculado.
              </p>
            )}
          </Card>
        </Section>

        {/* Próximas ações */}
        <Section titulo="Próximas ações" descricao="O que a equipe Zion planejou para você.">
          <Card>
            {(proximas ?? []).length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <CheckCircle2 size={16} className="text-emerald-400" /> Nenhuma ação pendente no momento.
              </div>
            ) : (
              <ul className="space-y-3">
                {(proximas ?? []).slice(0, 6).map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-300">{a.proxima_acao || a.tarefa}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {a.tarefa}
                        {a.prazo ? ` · prazo ${a.prazo}` : ""}
                      </p>
                    </div>
                    <Pill tone="gray">{a.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
      </div>
    </>
  );
}
