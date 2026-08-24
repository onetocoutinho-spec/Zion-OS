"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  XCircle,
  Clock,
  CheckCircle2,
  Send,
  Rocket,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FiltroDeLoja } from "@/components/ui/FiltroDeLoja";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { useFiltroNaUrl } from "@/lib/contexto/useFiltroNaUrl";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td, TdSelecao, EmptyRow } from "@/components/ui/Table";
import { estadoDaMarcaMestre, alternarTodos, alternarUm } from "@/modules/portal/domain/selecaoEmLote";
import {
  executarLote,
  faixaDaNota,
  fraseDoResultado,
  motivosDaTrava,
  passouATrava,
  planejarLote,
  podeAprovar as podeAprovarRegistro,
  podeRejeitar as podeRejeitarRegistro,
  type AcaoEmLote,
} from "./loteDeAprovacao";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useLiveQuery } from "@/lib/hooks";
import { EsqueletoDeTabela } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/format";
import {
  listarAnunciosGerados,
  aprovarAnuncioGerado,
  rejeitarAnuncioGerado,
  ROTULO_STATUS_ANUNCIO_GERADO,
} from "@/lib/services/anunciosGerados";
import { montarPreviewML, publicarNoML } from "@/lib/services/publicacaoML";
import {
  buscarAnunciosAtivosDoProduto,
  encerrarAntigosAposPublicar,
  type AnuncioAtivo,
} from "@/lib/services/migracaoAnuncio";
import { montarMissaoRepublicacao, type MissaoRepublicacao as Missao } from "@/modules/publication/domain/republicacao";
import { MissaoRepublicacao } from "@/components/esteira/MissaoRepublicacao";
import { urlsDoProduto } from "@/lib/services/storageImagens";
import type { AnuncioGeradoRegistro } from "@/lib/types";

const HEADERS = [
  "Anúncio gerado",
  // UMA coluna no lugar de Nota, A10 e Pend. As três respondiam a mesma
  // pergunta — "dá para aprovar isto?" — sem nenhuma delas dar a resposta:
  // quem operava lia "Reprovado" numa, "2" noutra, e concluía sozinho o que a
  // trava já sabe. A regra é pura e testada, em ./loteDeAprovacao.ts.
  "Trava",
  "Origem",
  "Tipo",
  "Situação",
  "Criado",
  "",
];

export default function AprovacoesPage() {
  const { lojaId } = useLojaAtual();
  // Filtro na URL (?status=): sobrevive ao F5 e vai no link.
  const [status, setStatus] = useFiltroNaUrl("status", "Todos", Object.values(ROTULO_STATUS_ANUNCIO_GERADO));
  // `busy` por ID, não global: um clique em "Aprovar" desabilitava Aprovar e
  // Rejeitar de TODAS as linhas sem dizer qual estava em andamento.
  const [busy, setBusy] = useState<string | null>(null);
  const [msgAcao, setMsgAcao] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  // A seleção para agir em massa. Regra em ./loteDeAprovacao.ts.
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [loteRodando, setLoteRodando] = useState<AcaoEmLote | null>(null);

  const { data, carregando } = useLiveQuery(listarAnunciosGerados);
  const registros = data ?? [];

  const lojasComRegistro = useMemo(() => [...new Set(registros.map((r) => r.clienteId))], [registros]);

  const aguardando = registros.filter((r) => r.status === "aguardando_aprovacao").length;
  const rascunhos = registros.filter((r) => r.status === "rascunho").length;
  const aprovadosN = registros.filter((r) => r.status === "aprovado").length;
  const publicados = registros.filter((r) => r.status === "publicado").length;

  const filtrados = registros.filter(
    (r) =>
      (!lojaId || r.clienteId === lojaId) &&
      (status === "Todos" || ROTULO_STATUS_ANUNCIO_GERADO[r.status] === status)
  );

  // Antes: try/finally sem catch. Falha → `busy` voltava a false e NADA
  // aparecia; sucesso também não confirmava (dependia da lista revalidar).
  async function executar(id: string, rotulo: string, acao: () => Promise<unknown>) {
    setBusy(id);
    setMsgAcao(null);
    try {
      await acao();
      setMsgAcao({ tipo: "ok", texto: `${rotulo} — feito.` });
    } catch (e) {
      setMsgAcao({
        tipo: "erro",
        texto: `${rotulo} falhou: ${e instanceof Error ? e.message : "erro desconhecido"}. Tente de novo.`,
      });
    } finally {
      setBusy(null);
    }
  }

  function aprovar(id: string) {
    return executar(id, "Aprovar", () => aprovarAnuncioGerado(id));
  }

  function rejeitar(id: string) {
    return executar(id, "Rejeitar", () =>
      rejeitarAnuncioGerado(id, "Rejeitado na revisão da equipe.")
    );
  }

  async function agirEmLote(acao: AcaoEmLote) {
    if (loteRodando || busy) return;
    const plano = planejarLote(acao, marcados, registros);
    if (plano.entram.length === 0 && plano.pulados === 0) return;
    setLoteRodando(acao);
    setMsgAcao(null);
    const r = await executarLote(plano, (id) =>
      acao === "aprovar"
        ? aprovarAnuncioGerado(id)
        : rejeitarAnuncioGerado(id, "Rejeitado na revisão da equipe.")
    );
    setMsgAcao({ tipo: r.falhas > 0 ? "erro" : "ok", texto: fraseDoResultado(acao, r) });
    // Quem foi feito sai da seleção; quem falhou ou foi pulado fica marcado
    // para a pessoa ver o que sobrou e decidir.
    setMarcados((m) => {
      const novo = new Set(m);
      for (const id of r.feitosIds) novo.delete(id);
      return novo;
    });
    setLoteRodando(null);
  }

  return (
    <>
      <ConteudoAprovacoes
        registros={registros}
        filtrados={filtrados}
        lojasComRegistro={lojasComRegistro}
        status={status}
        setStatus={setStatus}
        busy={busy}
        msgAcao={msgAcao}
        selecao={{ marcados, setMarcados, loteRodando, agirEmLote }}
        aprovar={aprovar}
        rejeitar={rejeitar}
        stats={{ aguardando, rascunhos, aprovadosN, publicados }}
        data={data}
        carregando={carregando}
      />
    </>
  );
}

/**
 * A célula "Trava" — dá para aprovar isto, e se não, por quê.
 *
 * A NOTA CONTINUA VISÍVEL nos dois casos, e não é redundância: ela não faz
 * parte da trava (um anúncio passa com nota 58) mas é o sinal de qualidade que
 * decide QUAL aprovar primeiro quando há trinta liberados. Juntar as colunas
 * era para tirar a leitura de três lugares, não para jogar dado fora.
 */
function ATrava({ registro }: { registro: AnuncioGeradoRegistro }) {
  const motivos = motivosDaTrava(registro);
  const faixa = faixaDaNota(registro.notaDiagnostico);
  const tomDaNota = faixa === "boa" ? "green" : faixa === "atenção" ? "yellow" : "red";

  return (
    <div className="flex flex-col gap-1">
      {passouATrava(registro) ? (
        <span
          className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300"
          title="Passou no A10 e não tem pendências — pode aprovar."
        >
          <ShieldCheck size={11} /> liberado
        </span>
      ) : (
        <span className="flex flex-wrap gap-1">
          {motivos.map((m) => (
            // O ícone acompanha a cor porque cor sozinha não informa; o rótulo
            // é texto, e o title diz o que resolve — as colunas antigas diziam
            // "Reprovado" e "2", nunca o que fazer com isso.
            <span
              key={m.tipo}
              title={m.explica}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-300"
            >
              <XCircle size={11} /> {m.rotulo}
            </span>
          ))}
        </span>
      )}
      {/* A nota é o desempate, então vem discreta, debaixo da resposta. */}
      <Badge tone={tomDaNota}>
        {registro.notaDiagnostico}
        <span className="ml-1 opacity-70">{faixa}</span>
      </Badge>
    </div>
  );
}

function ConteudoAprovacoes({
  registros,
  filtrados,
  lojasComRegistro,
  status,
  setStatus,
  busy,
  msgAcao,
  selecao,
  aprovar,
  rejeitar,
  stats,
  data,
  carregando,
}: {
  registros: AnuncioGeradoRegistro[];
  filtrados: AnuncioGeradoRegistro[];
  lojasComRegistro: string[];
  status: string;
  setStatus: (v: string) => void;
  /** ID do registro cuja ação está em andamento; null quando nenhuma. */
  busy: string | null;
  msgAcao: { tipo: "ok" | "erro"; texto: string } | null;
  selecao: {
    marcados: ReadonlySet<string>;
    setMarcados: (f: (m: ReadonlySet<string>) => ReadonlySet<string>) => void;
    loteRodando: AcaoEmLote | null;
    agirEmLote: (acao: AcaoEmLote) => void;
  };
  aprovar: (id: string) => void;
  rejeitar: (id: string) => void;
  stats: { aguardando: number; rascunhos: number; aprovadosN: number; publicados: number };
  data: AnuncioGeradoRegistro[] | null | undefined;
  carregando: boolean;
}) {
  const { aguardando, rascunhos, aprovadosN, publicados } = stats;
  const { marcados, setMarcados, loteRodando, agirEmLote } = selecao;
  const idsVisiveis = filtrados.map((r) => r.id);
  const estadoDaMestre = estadoDaMarcaMestre(idsVisiveis, marcados);
  const planoAprovar = planejarLote("aprovar", marcados, registros);
  const planoRejeitar = planejarLote("rejeitar", marcados, registros);
  const [preview, setPreview] = useState<AnuncioGeradoRegistro | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [msgPub, setMsgPub] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  // A Missão só existe quando há algo real a perguntar (anúncio ativo do mesmo
  // produto). Sem isso, publicar segue direto — nada de atrito inventado.
  const [missao, setMissao] = useState<{ missao: Missao; ativos: AnuncioAtivo[] } | null>(null);

  /** Antes de publicar: o produto já tem anúncio no ar? Se tem, quem decide é o lojista. */
  async function publicarReal() {
    if (!preview || publicando) return;
    setMsgPub(null);
    let ativos: AnuncioAtivo[] = [];
    try {
      ativos = await buscarAnunciosAtivosDoProduto(preview.clienteId, preview.produtoId, preview.id);
    } catch {
      // Não conseguir checar não pode bloquear a publicação — mas também não
      // vira um "está tudo certo": segue sem afirmar o que não se sabe.
      ativos = [];
    }
    const m = montarMissaoRepublicacao(ativos);
    if (m) return setMissao({ missao: m, ativos });
    await publicar(null);
  }

  /**
   * `migrar` = os antigos são encerrados DEPOIS que o novo entra no ar.
   * A ordem importa: se encerrasse antes e a publicação falhasse, o lojista
   * ficaria sem anúncio nenhum — prejuízo causado pela ferramenta.
   */
  async function publicar(migrar: AnuncioAtivo[] | null) {
    if (!preview) return;
    setPublicando(true);
    setMsgPub(null);
    try {
      const r = await publicarNoML(preview, true);
      let texto = `Publicado no ML: ${r.id}`;
      if (migrar?.length) {
        const { encerrados, falharam } = await encerrarAntigosAposPublicar(
          preview.clienteId,
          migrar,
          preview.marketplace
        );
        if (encerrados.length) texto += ` · encerrado: ${encerrados.join(", ")}`;
        // Falha ao encerrar deixa DOIS anúncios no ar. Isso nunca é omitido.
        if (falharam.length) {
          setMsgPub({
            tipo: "erro",
            texto: `${texto}. ATENÇÃO: não foi possível encerrar ${falharam
              .map((f) => f.mlItemId)
              .join(", ")} — encerre manualmente no Mercado Livre para não ficar com anúncio duplicado.`,
          });
          setMissao(null);
          setPreview(null);
          return;
        }
      }
      setMsgPub({ tipo: "ok", texto });
      setMissao(null);
      setPreview(null);
    } catch (e) {
      setMsgPub({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao publicar." });
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/esteira" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> Esteira de Anúncio
        </Link>
        <PageHeader
          title="Aprovações"
          description="Tudo que a esteira produz fica salvo aqui com status. A trava: só aprova quem passou no A10 sem pendências. Os aprovados são a fila que a publicação (Fase 2) consome."
          count={registros.length}
          countLabel="anúncios gerados"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-busy={carregando && !data ? "true" : undefined}>
        <StatCard label="Aguardando aprovação" value={aguardando} icon={Clock} tone="yellow" hint="Passaram no A10 — revisar e aprovar" />
        <StatCard label="Rascunhos" value={rascunhos} icon={ShieldCheck} tone="gray" hint="Com pendências ou A10 reprovado" />
        <StatCard label="Aprovados" value={aprovadosN} icon={CheckCircle2} tone="green" hint="Prontos para publicar (Fase 2)" />
        <StatCard label="Publicados" value={publicados} icon={Send} tone="violet" hint="Já enviados ao marketplace" />
      </div>

      <div className="flex flex-wrap gap-4">
        <FiltroDeLoja apenasIds={lojasComRegistro} />
        <FilterSelect
          label="Status"
          value={status}
          options={Object.values(ROTULO_STATUS_ANUNCIO_GERADO)}
          onChange={setStatus}
        />
      </div>

      {/* As mensagens nascem longe da linha que as gerou (a ação sai de um botão
          da tabela ou do modal, que fecha antes). role="alert"/"status" faz o
          leitor de tela anunciar em vez de esperar que a pessoa ache. */}
      {[msgPub, msgAcao].filter(Boolean).map((m, i) => (
        <p
          key={i}
          role={m!.tipo === "ok" ? "status" : "alert"}
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            m!.tipo === "ok"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {m!.tipo === "ok" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          {m!.texto}
        </p>
      ))}

      {carregando && !data && (
        <div aria-busy="true" className="rounded-lg border border-white/5 p-4">
          <EsqueletoDeTabela colunas={6} linhas={5} />
        </div>
      )}

      {/* A barra de ações em massa só existe com seleção: barra vazia permanente
          é mais um elemento competindo com a fila. A trava é a MESMA da linha:
          o botão já diz quantos entram e quantos a trava vai pular. */}
      {marcados.size > 0 && (
        <div
          role="region"
          aria-label="Ações para os anúncios selecionados"
          className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/25 bg-[#15121f]/95 px-4 py-3 backdrop-blur"
        >
          <p className="text-sm font-medium text-zinc-100">
            {marcados.size} {marcados.size === 1 ? "anúncio selecionado" : "anúncios selecionados"}
            {planoAprovar.pulados > 0 && (
              <span className="ml-2 text-xs font-normal text-amber-400">
                {planoAprovar.pulados} não {planoAprovar.pulados === 1 ? "passa" : "passam"} na trava A10
              </span>
            )}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="success"
              onClick={() => agirEmLote("aprovar")}
              disabled={loteRodando !== null || busy !== null || planoAprovar.entram.length === 0}
            >
              {loteRodando === "aprovar" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Aprovar {planoAprovar.entram.length}
            </Button>
            <Button
              variant="danger"
              onClick={() => agirEmLote("rejeitar")}
              disabled={loteRodando !== null || busy !== null || planoRejeitar.entram.length === 0}
            >
              {loteRodando === "rejeitar" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Rejeitar {planoRejeitar.entram.length}
            </Button>
            <Button variant="ghost" onClick={() => setMarcados(() => new Set())}>
              Limpar seleção
            </Button>
          </div>
        </div>
      )}

      <Table
        headers={HEADERS}
        // Ainda sobra: medido a 1280px com uma linha real, 1010px num container
        // de 964. Juntar Nota/A10/Pend. tirou 71 dos 117px de excesso, não os
        // 117 — então a ação continua grudada à direita para não ser o que a
        // rolagem come.
        acaoFixa
        marcaMestre={{
          estado: estadoDaMestre,
          aoAlternar: () => setMarcados((m) => alternarTodos(idsVisiveis, m)),
          rotulo:
            estadoDaMestre === "todos"
              ? `Desmarcar os ${idsVisiveis.length} anúncios desta lista`
              : `Marcar os ${idsVisiveis.length} anúncios desta lista`,
        }}
      >
        {data && filtrados.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length + 1}
            mensagem="Nada por aqui ainda. Rode a esteira (com um cliente selecionado) para popular a fila."
            acaoLabel="Ir para a Esteira"
            acaoHref="/esteira"
          />
        )}
        {filtrados.map((r) => {
          // A trava mora em ./loteDeAprovacao.ts — a mesma da ação em massa.
          const podeAprovar = podeAprovarRegistro(r);
          const podeRejeitar = podeRejeitarRegistro(r);
          return (
            <tr key={r.id} className={marcados.has(r.id) ? "bg-violet-500/[0.06]" : "hover:bg-white/[0.02]"}>
              <TdSelecao
                marcado={marcados.has(r.id)}
                aoAlternar={() => setMarcados((m) => alternarUm(r.id, m))}
                rotulo={`Selecionar ${r.anuncio?.tituloOtimizado || "anúncio sem título"}`}
              />
              <td className="px-4 py-3 align-top">
                <p className="max-w-72 truncate font-medium text-zinc-200">
                  {r.anuncio?.tituloOtimizado || "(sem título)"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {r.cliente}
                  {r.produto ? ` · ${r.produto}` : ""} · {r.marketplace}
                </p>
                <details className="mt-1">
                  <summary className="inline-flex items-center text-[11px] text-violet-400 hover:text-violet-300 [@media(pointer:coarse)]:min-h-11">
                    ver detalhes
                  </summary>
                  <div className="mt-1.5 max-w-xl space-y-1 rounded-lg bg-black/20 p-2.5 text-xs text-zinc-400">
                    <p className="whitespace-pre-wrap">{r.anuncio?.descricaoCurta || "—"}</p>
                    {r.anuncio?.pendencias?.length > 0 && (
                      <ul className="ml-4 list-disc text-amber-400">
                        {r.anuncio.pendencias.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    )}
                    {r.aprovadoEm && (
                      <p className="text-zinc-500">
                        Aprovado em {formatDateTime(r.aprovadoEm)}
                        {r.aprovadoPor ? ` por ${r.aprovadoPor}` : ""}
                      </p>
                    )}
                  </div>
                </details>
              </td>
              <Td>
                <ATrava registro={r} />
              </Td>
              <Td>
                <Badge tone="gray">{r.origem === "esteira_lote" ? "Lote" : "Esteira"}</Badge>
              </Td>
              <Td><Badge>{r.tipoExecucao}</Badge></Td>
              <Td><Badge>{ROTULO_STATUS_ANUNCIO_GERADO[r.status]}</Badge></Td>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(r.criadoEm)}</Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  {r.status === "aprovado" && (
                    <Button
                      className="px-2 py-1 text-xs"
                      onClick={() => setPreview(r)}
                      title="Revisar o payload e publicar no Mercado Livre"
                    >
                      <Rocket size={13} /> Publicar
                    </Button>
                  )}
                  {r.status === "publicado" && r.mlPermalink && (
                    <a
                      href={r.mlPermalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/20 [@media(pointer:coarse)]:min-h-11"
                    >
                      <ExternalLink size={12} /> Ver no ML
                    </a>
                  )}
                  <Button
                    variant="success"
                    className="px-2 py-1 text-xs"
                    onClick={() => aprovar(r.id)}
                    disabled={busy !== null || !podeAprovar}
                    title={podeAprovar ? "Aprovar para publicação" : "Trava: A10 + zero pendências"}
                  >
                    {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Aprovar
                  </Button>
                  <Button
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    onClick={() => rejeitar(r.id)}
                    disabled={busy !== null || !podeRejeitar}
                  >
                    {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Rejeitar
                  </Button>
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>

      {preview && (
        <ModalPublicar
          registro={preview}
          publicando={publicando}
          onPublicar={publicarReal}
          onFechar={() => setPreview(null)}
        />
      )}

      {missao && (
        <MissaoRepublicacao
          missao={missao.missao}
          ocupado={publicando}
          onCancelar={() => setMissao(null)}
          onConfirmar={(escolha) => publicar(escolha === "migrar" ? missao.ativos : null)}
        />
      )}
    </div>
  );
}

/** Modal de publicação: mostra o payload (dry-run) e permite publicar de verdade. */
function ModalPublicar({
  registro,
  publicando,
  onPublicar,
  onFechar,
}: {
  registro: AnuncioGeradoRegistro;
  publicando: boolean;
  onPublicar: () => void;
  onFechar: () => void;
}) {
  const [pics, setPics] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    if (registro.produtoId) {
      urlsDoProduto(registro.produtoId)
        .then((u) => vivo && setPics(u))
        .catch(() => vivo && setPics([]));
    }
    return () => {
      vivo = false;
    };
  }, [registro.produtoId]);

  const payload = montarPreviewML(registro, { pictures: pics });
  const semCategoria = !payload.category_id;
  const semFotos = !Array.isArray(payload.pictures) || payload.pictures.length === 0;

  return (
    // A moldura é a primitiva Dialog (foco preso, Esc, aria-modal) — antes
    // era um fixed inset-0 escrito à mão, sem nada disso.
    <Dialog aberto aoFechar={onFechar} titulo="Publicar no Mercado Livre" descricao={registro.anuncio?.tituloOtimizado}>
        <div className="px-5 py-4">
          <p className="mb-2 text-xs text-zinc-400">
            Prévia do que será enviado ao ML (dry-run). Revise antes de publicar de verdade.
          </p>
          {(semCategoria || semFotos) && (
            <ul className="mb-3 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-amber-400">
              {semCategoria && (
                <li className="flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Categoria será prevista pelo título no envio (ou informe manualmente).
                </li>
              )}
              {semFotos && (
                <li className="flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Sem fotos: o ML exige imagens reais (URLs). O item pode ficar incompleto.
                </li>
              )}
            </ul>
          )}
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
          <span className="text-[11px] text-zinc-600">
            Publicação real exige ML_CLIENT_ID/SECRET no servidor + cliente conectado.
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onFechar}>Fechar</Button>
            <Button onClick={onPublicar} disabled={publicando}>
              <Rocket size={14} /> {publicando ? "Publicando…" : "Publicar de verdade"}
            </Button>
          </div>
        </div>
    </Dialog>
  );
}