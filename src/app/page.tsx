"use client";

// A VISÃO GERAL DO PORTFÓLIO — "qual loja precisa de mim agora?"
//
// Esta tela era uma grade de 10 números (um repetido), sem comparação, sem
// ação e sem estado de carga — carregando e erro renderizavam zeros. E ficava
// fora do menu da agência, que não tinha home nenhuma.
// (docs/product/ux/02-PROBLEMS.md, "home / da equipe/agência")
//
// Agora ela responde as quatro perguntas do dashboard, nesta ordem:
//   1. o que está acontecendo        → KPIs clicáveis
//   2. o que precisa da minha atenção → "Precisa de atenção", com a ação exata
//   3. o que devo fazer agora         → a ação de cada linha
//   4. como está cada loja            → tabela (comparar pede colunas), não cards
//
// Equipe e agência veem a MESMA tela com conteúdos diferentes: o RLS recorta
// as lojas. A regra que transforma dados em linhas e alertas é pura e testada
// em src/lib/contexto/portfolio.ts.

import Link from "next/link";
import { Store, Megaphone, AlertTriangle, Package, ShieldAlert, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Table, Td, TdMain } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { EstadoDaLoja } from "@/components/ui/EstadoDaLoja";
import { LinkButton, Button } from "@/components/ui/Button";
import { EsqueletoDeBloco, EsqueletoDeTabela } from "@/components/ui/Skeleton";
import { useLiveQuery } from "@/lib/hooks";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { resumoDoPortfolio, type ItemDeAtencao } from "@/lib/contexto/portfolio";
import { listarClientes } from "@/lib/services/clientes";
import { listarProdutos } from "@/lib/services/produtos";
import { listarResumoDeAnuncios } from "@/lib/services/anunciosGerados";
import { listarPendencias } from "@/lib/services/pendencias";

const HEADERS = ["Loja", "Estado", "Marketplaces", "Produtos", "No ar", "Com problema", "Pendências", ""];

export default function VisaoGeralPage() {
  const { definirLoja } = useLojaAtual();
  const lojas = useLiveQuery(listarClientes);
  const produtos = useLiveQuery(listarProdutos);
  const anuncios = useLiveQuery(listarResumoDeAnuncios);
  const pendencias = useLiveQuery(listarPendencias);

  const consultas = [lojas, produtos, anuncios, pendencias];
  const carregando = consultas.some((c) => c.carregando);
  const erro = consultas.find((c) => c.erro)?.erro ?? null;

  function tentarDeNovo() {
    consultas.forEach((c) => c.reload());
  }

  if (erro) {
    return (
      <div className="space-y-6">
        <Cabecalho />
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} /> Não consegui ler o portfólio agora. {erro.message}
          </span>
          <Button variant="ghost" onClick={tentarDeNovo}>
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Cabecalho />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <EsqueletoDeBloco key={i} altura="h-24" />
          ))}
        </div>
        <EsqueletoDeBloco altura="h-32" />
        <EsqueletoDeTabela linhas={6} colunas={7} />
      </div>
    );
  }

  const r = resumoDoPortfolio(lojas.data ?? [], anuncios.data ?? [], produtos.data ?? [], pendencias.data ?? []);

  if (r.totais.lojas === 0) {
    return (
      <div className="space-y-6">
        <Cabecalho />
        <EmptyState
          mensagem="Você ainda não opera nenhuma loja. Adicione a primeira para começar — ou peça à Zion para vincular lojas à sua agência."
          acaoLabel="Adicionar loja"
          acaoHref="/clientes/novo"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Cabecalho />

      {/* 1. O que está acontecendo — cada número é uma porta. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard label="Lojas" value={r.totais.lojas} hint={`${r.totais.lojasAtivas} ativas`} icon={Store} tone="violet" href="/clientes" />
        <StatCard label="Anúncios no ar" value={r.totais.noAr} hint="na palavra do Mercado Livre" icon={Megaphone} tone="green" href="/esteira/aprovacoes" />
        <StatCard
          label="Anúncios com problema"
          value={r.totais.comProblema}
          hint="infração ou parados na esteira"
          icon={AlertTriangle}
          tone={r.totais.comProblema > 0 ? "yellow" : "gray"}
          href="/esteira/aprovacoes"
        />
        <StatCard label="Produtos em cadastro" value={r.totais.produtosEmCadastro} hint="ainda não publicados" icon={Package} tone="blue" href="/produtos" />
        <StatCard
          label="Precisam de atenção"
          value={r.totais.precisamDeAtencao}
          hint={r.totais.precisamDeAtencao === 0 ? "nada exige ação agora" : "lojas com algo a resolver"}
          icon={ShieldAlert}
          tone={r.totais.precisamDeAtencao > 0 ? "orange" : "gray"}
          href="#atencao"
        />
      </div>

      {/* 2–3. O que precisa de mim, e o que fazer — acima da tabela: urgência antes de panorama. */}
      <Card title="Precisa de atenção">
        <div id="atencao" />
        {r.atencao.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <span aria-hidden="true">●</span> Nada exige atenção agora. Todas as lojas estão saudáveis.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {r.atencao.slice(0, 6).map((item) => (
              <LinhaDeAtencao key={item.lojaId} item={item} aoEntrar={() => definirLoja(item.lojaId, { soContexto: true })} />
            ))}
            {r.atencao.length > 6 && (
              <li className="pt-3 text-xs text-zinc-500">
                + {r.atencao.length - 6} lojas na tabela abaixo, ordenadas por gravidade.
              </li>
            )}
          </ul>
        )}
      </Card>

      {/* 4. Como está cada loja — tabela, porque a tarefa é comparar. */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Lojas</h2>
            <p className="text-xs text-zinc-500">Clique na loja para operá-la — o contexto muda em todas as telas.</p>
          </div>
          <LinkButton href="/clientes" variant="ghost" className="text-xs">
            Todas as lojas <ArrowRight size={13} />
          </LinkButton>
        </div>
        <Table headers={HEADERS}>
          {r.linhas.map((l) => (
            <tr key={l.loja.id} className="hover:bg-white/[0.02]">
              <TdMain>
                <Link
                  href={`/clientes/${l.loja.id}`}
                  onClick={() => definirLoja(l.loja.id, { soContexto: true })}
                  className="font-medium text-zinc-200 hover:text-violet-300"
                >
                  {l.loja.empresa}
                </Link>
                <p className="mt-0.5 text-xs text-zinc-500">{l.loja.status}</p>
              </TdMain>
              <Td>
                <EstadoDaLoja saude={l.saude} comRotulo />
              </Td>
              <Td className="text-xs">{l.loja.marketplaces.length > 0 ? l.loja.marketplaces.join(", ") : <span className="text-amber-400">nenhum</span>}</Td>
              <Td className="tabular-nums">{l.produtos}</Td>
              <Td className="tabular-nums">{l.noAr}</Td>
              <Td className={`tabular-nums ${l.comProblema + l.comInfracao > 0 ? "text-amber-400" : ""}`}>{l.comProblema + l.comInfracao}</Td>
              <Td className="tabular-nums">{l.pendenciasAbertas}</Td>
              <Td>
                <Link
                  href={`/clientes/${l.loja.id}`}
                  onClick={() => definirLoja(l.loja.id, { soContexto: true })}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-violet-400 hover:text-violet-300"
                >
                  Operar <ArrowRight size={12} />
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}

function Cabecalho() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-white">Visão geral</h1>
      <p className="mt-1 text-sm text-zinc-500">Qual loja precisa de você agora, e como está cada uma.</p>
    </div>
  );
}

const COR_DO_NIVEL: Record<ItemDeAtencao["nivel"], string> = {
  ok: "text-emerald-400",
  atencao: "text-amber-400",
  risco: "text-red-400",
};

function LinhaDeAtencao({ item, aoEntrar }: { item: ItemDeAtencao; aoEntrar: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className={`mt-0.5 text-xs ${COR_DO_NIVEL[item.nivel]}`}>
          {item.nivel === "risco" ? "▲" : "⚠"}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200">{item.loja}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{item.motivo}</p>
        </div>
      </div>
      {/* A ação leva à tela onde se resolve, já com a loja no contexto. */}
      <LinkButton href={item.href} variant="ghost" className="shrink-0 text-xs" onClick={aoEntrar}>
        {item.acao} <ArrowRight size={12} />
      </LinkButton>
    </li>
  );
}
