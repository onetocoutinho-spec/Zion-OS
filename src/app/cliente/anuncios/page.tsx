"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  ShieldCheck,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Crop,
  Wand2,
  Sparkles,
  Download,
  Rocket,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import {
  agruparAnunciosPorProduto,
  filtrarPorTexto,
} from "@/modules/portal/domain/anunciosPorProduto";
import { notaExibivel, explicarVeredito } from "@/modules/portal/domain/notaExibivel";
import { quadrarCapaNoML, explicarCapaQuadrada } from "@/lib/services/quadrarCapaML";
import {
  PublicarAnuncio,
  AvisoPublicado,
  type ResultadoPublicado,
} from "@/components/client-portal/PublicarAnuncio";
import { useLiveQuery } from "@/lib/hooks";
import {
  listarAnunciosGeradosDoCliente,
  aprovarAnuncioGerado,
  rejeitarAnuncioGerado,
  ROTULO_STATUS_ANUNCIO_GERADO,
  rotuloStatusMarketplace,
} from "@/lib/services/anunciosGerados";
import { definirEstadoNoML, explicarEstado } from "@/lib/services/estadoDoAnuncioML";
import { listarProdutos } from "@/lib/services/produtos";
import { baixarVinculacaoCsv } from "@/lib/services/exportacaoErp";
import { toneScore } from "@/lib/client-portal/metrics";
import { toneFor } from "@/lib/status";
import type { AnuncioGeradoRegistro, Produto } from "@/lib/types";

const STATUS_FILTRO = ["Aguardando aprovação", "Aprovado", "Rascunho", "Rejeitado", "Publicado"] as const;
const MAPA_FILTRO: Record<string, string> = {
  "Aguardando aprovação": "aguardando_aprovacao",
  Aprovado: "aprovado",
  Rascunho: "rascunho",
  Rejeitado: "rejeitado",
  Publicado: "publicado",
};

export default function ClienteAnuncios() {
  const { clienteId, nome } = useClientPortal();
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: produtos } = useLiveQuery(listarProdutos);

  const [fStatus, setFStatus] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msgEstado, setMsgEstado] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ajustandoCapa, setAjustandoCapa] = useState<string | null>(null);

  // "Esta foto não serve" é informação sobre o anúncio; "falhou" é problema
  // nosso. Misturar as duas faria ela tentar de novo o que nunca vai funcionar.
  async function quadrar(mlb: string) {
    setAjustandoCapa(mlb);
    setMsgEstado(null);
    try {
      const r = await quadrarCapaNoML(clienteId, mlb);
      setMsgEstado({ tipo: "ok", texto: explicarCapaQuadrada(r) });
    } catch (e) {
      setMsgEstado({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Falha ao ajustar a foto de capa.",
      });
    } finally {
      setAjustandoCapa(null);
    }
  }
  // Publicar é do lojista: ele aprova e ele coloca no ar. Não passa pela equipe.
  const [publicar, setPublicar] = useState<AnuncioGeradoRegistro | null>(null);
  const [publicado, setPublicado] = useState<ResultadoPublicado | null>(null);

  const publicados = (anuncios ?? []).filter((a) => a.status === "publicado" && a.mlItemId).length;

  // "Publicado" é a esteira do Zion; "no ar" é o Mercado Livre. Medido em
  // 2026-08-01: 104 dos 511 que o Zion dizia publicados não estavam no ar.
  // Enquanto os dois números forem o mesmo número, ninguém descobre isso.
  const comMlb = (anuncios ?? []).filter((a) => a.mlItemId);
  const noAr = comMlb.filter((a) => a.statusMarketplace === "active").length;
  const foraDoAr = comMlb.filter(
    (a) => a.statusMarketplace && a.statusMarketplace !== "active"
  ).length;
  const semEstado = comMlb.filter((a) => !a.statusMarketplace).length;

  function exportarVinculacao() {
    const mapa = new Map<string, Produto>((produtos ?? []).map((p) => [p.id, p]));
    baixarVinculacaoCsv(anuncios ?? [], mapa);
  }

  const filtrados = useMemo(() => {
    return filtrarPorTexto(
      [...(anuncios ?? [])]
        .filter((a) => fStatus === "Todos" || a.status === MAPA_FILTRO[fStatus])
        .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)),
      busca
    );
  }, [anuncios, fStatus, busca]);

  // 880 linhas viram ~80. No modelo User Products do ML cada TAMANHO é um MLB
  // próprio, e a importação grava um anúncio por MLB de propósito — é assim que
  // o ERP casa SKU com anúncio. Mas a lojista pensa em "Babuche Molekinha
  // 2591.103", um produto com vários tamanhos, que é como o painel do próprio
  // ML mostra. A separação continua no banco; o agrupamento é de LEITURA.
  const grupos = useMemo(() => agruparAnunciosPorProduto(filtrados), [filtrados]);

  // Pausar tira da vitrine e MANTÉM o histórico; encerrar é definitivo. São
  // ações de consequências muito diferentes, e por isso a mensagem diz o que
  // o ML CONFIRMOU, não o que foi pedido — reativar pode voltar
  // `under_review`, e dizer "no ar" nesse caso seria mentira.
  async function mudarEstadoNoML(a: AnuncioGeradoRegistro, estado: "paused" | "active") {
    setBusy(a.id);
    try {
      const r = await definirEstadoNoML(a, estado);
      setMsgEstado({ tipo: r.divergiu ? "erro" : "ok", texto: explicarEstado(estado, r.status) });
    } catch (e) {
      setMsgEstado({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Falha ao mudar o estado do anúncio.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function aprovar(id: string) {
    setBusy(id);
    try {
      await aprovarAnuncioGerado(id, nome || "cliente");
    } finally {
      setBusy(null);
    }
  }
  async function refazer(id: string) {
    setBusy(id);
    try {
      await rejeitarAnuncioGerado(id, "Refazer solicitado pelo cliente.");
    } finally {
      setBusy(null);
    }
  }

  const total = (anuncios ?? []).length;

  return (
    <>
      <PageHeader
        titulo="Meus Anúncios"
        subtitulo={
          comMlb.length > 0
            ? `Os anúncios que a IA gerou para você. No Mercado Livre: ${noAr} no ar` +
              (foraDoAr > 0 ? ` · ${foraDoAr} fora do ar` : "") +
              (semEstado > 0 ? ` · ${semEstado} sem estado conhecido` : "") +
              "."
            : "Os anúncios que a IA gerou para você. Revise e aprove os que estiverem prontos."
        }
        acao={
          /* `flex-wrap` — sem ele os quatro botões não quebram, empurram a
              largura e deslocam a PÁGINA inteira. Visto num print da conta real
              em 06/08/2026: o conteúdo aparecia cortado à esquerda e o título
              fora da tela. O `PageHeader` já quebrava linha; era este grupo de
              dentro que não. */
          <div className="flex flex-wrap items-center gap-2">
            {publicados > 0 && (
              <Button
                variant="ghost"
                onClick={exportarVinculacao}
                title="Baixar o arquivo SKU↔MLB para importar (vincular) no seu ERP"
              >
                <Download size={15} /> Vincular no ERP ({publicados})
              </Button>
            )}
            {/* inline-flex: `a` é inline por padrão e mede menor que o botão
                dentro dele — o toque acerta, mas a auditoria acusa. Caixa
                ambígua em auditoria vira ruído, e ruído se aprende a ignorar. */}
            <Link href="/cliente/anunciar" className="inline-flex">
              <Button>
                <Wand2 size={15} /> Otimizar com IA
              </Button>
            </Link>
          </div>
        }
      />

      {publicado && <AvisoPublicado resultado={publicado} />}

      {msgEstado && (
        <p
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            msgEstado.tipo === "ok"
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
              : "border-amber-500/20 bg-amber-500/5 text-amber-400"
          }`}
        >
          {msgEstado.tipo === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}{" "}
          {msgEstado.texto}
        </p>
      )}

      {total === 0 ? (
        <VazioAmigavel
          icon={Megaphone}
          titulo="Você ainda não tem anúncios gerados"
          descricao="Use a otimização com IA para criar títulos, descrições e ficha técnica prontos a partir dos seus produtos."
          acao={
            <Link href="/cliente/anunciar">
              <Button>
                <Sparkles size={15} /> Otimizar com IA
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {/* 880 linhas sem como achar uma. A busca casa nome do produto,
                título e MLB — os três jeitos pelos quais ela procura: pelo
                modelo ("2591.103"), pelo nome, ou colando o MLB do painel. */}
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por produto, título ou MLB…"
                className="w-64 rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <FilterSelect label="Status" value={fStatus} options={STATUS_FILTRO} onChange={setFStatus} />
            <span className="ml-auto text-xs text-zinc-500">
              {filtrados.length} de {total} anúncios
            </span>
          </div>

          <Table
            // Duas colunas saíram, por motivos DIFERENTES:
            //   "Marketplace" — 1 valor em 590 anúncios. Não informava nada.
            //   "Prioridade"  — variava, mas era DERIVADA de Score e Problema
            //                   principal, que estão ali ao lado. Redundância,
            //                   não constância. Decisão do dono do produto.
            headers={["Anúncio", "Score", "Problema principal", "Status", "Ação"]}
          >
            {grupos.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              grupos.flatMap((g) => {
                // Grupo de UM não vira linha-pai: seria um clique a mais para
                // ver o que já cabia na tela.
                const unico = g.anuncios.length === 1;
                const abertoGrupo = grupoAberto === g.chave;
                const cabecalho = unico ? null : (
                  <tr
                    key={`g-${g.chave}`}
                    className="cursor-pointer bg-white/[0.02] hover:bg-white/[0.04]"
                    onClick={() => setGrupoAberto(abertoGrupo ? null : g.chave)}
                  >
                    <TdMain sub={`${g.anuncios.length} anúncios`}>
                      <span className="inline-flex items-center gap-1.5">
                        {abertoGrupo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {g.nome}
                      </span>
                    </TdMain>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>
                      {/* O estado do GRUPO em uma linha: é o que ela quer saber
                          antes de abrir. "12 no ar · 7 fora" decide se vale. */}
                      <span className="flex flex-wrap gap-1">
                        {g.noAr > 0 && <Pill tone="green">{g.noAr} no ar</Pill>}
                        {g.foraDoAr > 0 && <Pill tone="yellow">{g.foraDoAr} fora do ar</Pill>}
                        {g.semEstado > 0 && <Pill tone="gray">{g.semEstado} sem estado</Pill>}
                      </span>
                    </Td>
                    <Td>—</Td>
                  </tr>
                );
                const linhas = !unico && !abertoGrupo ? [] : g.anuncios.map((a) => {
                const problema = a.anuncio?.pendencias?.[0] ?? "—";
                const podeAprovar = a.vereditoA10 === "aprovado" && a.qtdPendencias === 0;
                const expandido = aberto === a.id;
                return (
                  <Fragment key={a.id}>
                    <tr className="hover:bg-white/[0.02]">
                      <TdMain sub={a.produto || undefined}>
                        {a.anuncio?.tituloOtimizado || a.produto || "Anúncio"}
                      </TdMain>
                      <Td>
                        {/* `null` NUNCA vira 0 aqui: um traço diz "não medimos",
                            e um `0/100` vermelho diz "medimos e é péssimo". */}
                        {notaExibivel(a) === null ? (
                          <span className="text-zinc-600" title="A IA não avaliou este anúncio">
                            —
                          </span>
                        ) : (
                          <Pill tone={toneScore(a.notaDiagnostico)}>{a.notaDiagnostico}/100</Pill>
                        )}
                      </Td>
                      <Td className="max-w-56 truncate" >
                        {problema}
                      </Td>
                      <Td>
                        <Pill tone={toneFor(a.status)}>
                          {ROTULO_STATUS_ANUNCIO_GERADO[a.status] ?? a.status}
                        </Pill>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setAberto(expandido ? null : a.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-zinc-300 hover:border-white/20 [@media(pointer:coarse)]:min-h-11"
                          >
                            Detalhes
                            <ChevronDown
                              size={12}
                              className={`transition-transform ${expandido ? "rotate-180" : ""}`}
                            />
                          </button>
                          {a.status === "aprovado" && (
                            <Button
                              className="px-2 py-1 text-xs"
                              onClick={() => setPublicar(a)}
                              title={`Colocar no ar no ${a.marketplace}`}
                            >
                              <Rocket size={12} /> Publicar
                            </Button>
                          )}
                          {a.mlItemId && (() => {
                            const r = rotuloStatusMarketplace(a.statusMarketplace);
                            const cor =
                              r.tom === "ok"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : r.tom === "atencao"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  : r.tom === "ruim"
                                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                                    : "border-white/10 bg-white/[0.03] text-zinc-400";
                            return (
                              <span
                                className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${cor}`}
                                title={
                                  a.statusMarketplaceEm
                                    ? `Lido do ${a.marketplace} em ${new Date(a.statusMarketplaceEm).toLocaleString("pt-BR")}`
                                    : `O Zion ainda não leu o estado deste anúncio no ${a.marketplace}. Use "Só conferir" para atualizar.`
                                }
                              >
                                {r.texto}
                              </span>
                            );
                          })()}
                          {/* A ação mora onde o item está. A busca é aqui, e
                              mandar a lojista para outra tela para consertar o
                              que ela acabou de encontrar é fazer ela procurar
                              duas vezes.
                              
                              Não depende de diagnóstico prévio: a rota lê a foto
                              do anúncio e RECUSA com motivo se já estiver no
                              padrão ou se não houver pixel para completar. */}
                          {/* DESLIGADO em 03/08/2026 — ver PendenciasDaConta:
                              o ML reprocessa a imagem e corta a faixa branca, e
                              cada clique só acrescentava uma foto ao anúncio. */}
                          {false && a.mlItemId && (
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              disabled={ajustandoCapa === a.mlItemId}
                              onClick={() => quadrar(a.mlItemId as string)}
                              title="Deixa a foto de capa quadrada completando as laterais com branco. As fotos atuais continuam no anúncio."
                            >
                              <Crop size={12} />
                              {ajustandoCapa === a.mlItemId ? "Ajustando…" : "Ajustar capa"}
                            </Button>
                          )}
                          {a.mlItemId && a.statusMarketplace === "active" && (
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              disabled={busy === a.id}
                              onClick={() => mudarEstadoNoML(a, "paused")}
                              title="Tira da vitrine sem encerrar: o anúncio mantém o id e o histórico, e você reativa quando quiser"
                            >
                              <PauseCircle size={12} /> Pausar
                            </Button>
                          )}
                          {a.mlItemId && a.statusMarketplace === "paused" && (
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              disabled={busy === a.id}
                              onClick={() => mudarEstadoNoML(a, "active")}
                              title="Devolve o anúncio à vitrine. O Mercado Livre pode revisar antes de recolocar."
                            >
                              <PlayCircle size={12} /> Reativar
                            </Button>
                          )}
                          {a.status === "publicado" && a.mlPermalink && (
                            <a
                              href={a.mlPermalink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/20 [@media(pointer:coarse)]:min-h-11"
                            >
                              <ExternalLink size={12} /> Ver no ML
                            </a>
                          )}
                          {(a.status === "aguardando_aprovacao" || a.status === "rascunho") && (
                            <>
                              {podeAprovar ? (
                                <Button
                                  variant="success"
                                  className="px-2 py-1 text-xs"
                                  onClick={() => aprovar(a.id)}
                                  disabled={busy === a.id}
                                >
                                  <ShieldCheck size={12} /> Aprovar
                                </Button>
                              ) : (
                                <Button
                                  variant="danger"
                                  className="px-2 py-1 text-xs"
                                  onClick={() => refazer(a.id)}
                                  disabled={busy === a.id}
                                >
                                  <XCircle size={12} /> Refazer
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                    {expandido && a.anuncio && (
                      <tr className="bg-white/[0.015]">
                        <td colSpan={5} className="px-4 py-4">
                          <DetalheAnuncio registro={a} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
                });
                return cabecalho ? [cabecalho, ...linhas] : linhas;
              })
            )}
          </Table>
        </>
      )}

      {publicar && (
        <PublicarAnuncio
          registro={publicar}
          onFechar={() => setPublicar(null)}
          onPublicado={(r) => {
            setPublicado(r);
            setPublicar(null);
          }}
        />
      )}
    </>
  );
}

function DetalheAnuncio({ registro }: { registro: AnuncioGeradoRegistro }) {
  const a = registro.anuncio!;
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Título otimizado</p>
        <p className="mt-0.5 text-zinc-200">{a.tituloOtimizado}</p>
      </div>
      {a.descricaoCurta && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Descrição curta</p>
          <p className="mt-0.5 whitespace-pre-line text-zinc-300">{a.descricaoCurta}</p>
        </div>
      )}
      {a.palavrasChavePrincipais?.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Palavras-chave</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {a.palavrasChavePrincipais.map((k, i) => (
              <Pill key={i} tone="violet">
                {k}
              </Pill>
            ))}
          </div>
        </div>
      )}
      {a.pendencias?.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-amber-400">Pendências a revisar</p>
          <ul className="mt-1 list-disc pl-5 text-amber-300/90">
            {a.pendencias.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {/* Outra cor e outro título porque é outra coisa: isto não trava. */}
      {a.sugestoes?.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-sky-400">
            Dá para melhorar (não impede publicar)
          </p>
          <ul className="mt-1 list-disc pl-5 text-sky-300/90">
            {a.sugestoes.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {/* "aprovado · nota 0/100" era contradição: ninguém tira zero e é
          aprovado. `nota_diagnostico` é NOT NULL default 0, então "não
          avaliado" e "tirou zero" caíam no mesmo valor. */}
      <p className="text-xs text-zinc-500">{explicarVeredito(registro)}</p>
    </div>
  );
}
