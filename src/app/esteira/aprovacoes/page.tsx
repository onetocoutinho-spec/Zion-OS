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
  X,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FiltroDeLoja } from "@/components/ui/FiltroDeLoja";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLiveQuery } from "@/lib/hooks";
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
  "Nota",
  "A10",
  "Pend.",
  "Origem",
  "Tipo",
  "Status",
  "Criado",
  "",
];

export default function AprovacoesPage() {
  const { lojaId } = useLojaAtual();
  const [status, setStatus] = useState("Todos");
  const [busy, setBusy] = useState(false);

  const { data } = useLiveQuery(listarAnunciosGerados);
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

  async function aprovar(id: string) {
    setBusy(true);
    try {
      await aprovarAnuncioGerado(id);
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar(id: string) {
    setBusy(true);
    try {
      await rejeitarAnuncioGerado(id, "Rejeitado na revisão da equipe.");
    } finally {
      setBusy(false);
    }
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
        aprovar={aprovar}
        rejeitar={rejeitar}
        stats={{ aguardando, rascunhos, aprovadosN, publicados }}
        data={data}
      />
    </>
  );
}

function ConteudoAprovacoes({
  registros,
  filtrados,
  lojasComRegistro,
  status,
  setStatus,
  busy,
  aprovar,
  rejeitar,
  stats,
  data,
}: {
  registros: AnuncioGeradoRegistro[];
  filtrados: AnuncioGeradoRegistro[];
  lojasComRegistro: string[];
  status: string;
  setStatus: (v: string) => void;
  busy: boolean;
  aprovar: (id: string) => void;
  rejeitar: (id: string) => void;
  stats: { aguardando: number; rascunhos: number; aprovadosN: number; publicados: number };
  data: AnuncioGeradoRegistro[] | null | undefined;
}) {
  const { aguardando, rascunhos, aprovadosN, publicados } = stats;
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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

      {msgPub && (
        <p
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            msgPub.tipo === "ok"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {msgPub.tipo === "ok" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          {msgPub.texto}
        </p>
      )}

      <Table headers={HEADERS}>
        {data && filtrados.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Nada por aqui ainda. Rode a esteira (com um cliente selecionado) para popular a fila."
            acaoLabel="Ir para a Esteira"
            acaoHref="/esteira"
          />
        )}
        {filtrados.map((r) => {
          const passouA10 = r.vereditoA10 === "aprovado" && r.qtdPendencias === 0;
          const podeAprovar =
            passouA10 && (r.status === "aguardando_aprovacao" || r.status === "rascunho");
          const podeRejeitar = r.status !== "rejeitado" && r.status !== "publicado";
          return (
            <tr key={r.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 align-top">
                <p className="max-w-72 truncate font-medium text-zinc-200">
                  {r.anuncio?.tituloOtimizado || "(sem título)"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {r.cliente}
                  {r.produto ? ` · ${r.produto}` : ""} · {r.marketplace}
                </p>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-violet-400 hover:text-violet-300">
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
                <Badge tone={r.notaDiagnostico >= 75 ? "green" : r.notaDiagnostico >= 55 ? "yellow" : "red"}>
                  {`${r.notaDiagnostico}`}
                </Badge>
              </Td>
              <Td>
                <Badge tone={r.vereditoA10 === "aprovado" ? "green" : "red"}>
                  {r.vereditoA10 === "aprovado" ? "OK" : "Reprovado"}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-zinc-300">{r.qtdPendencias}</Td>
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
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/20"
                    >
                      <ExternalLink size={12} /> Ver no ML
                    </a>
                  )}
                  <Button
                    variant="success"
                    className="px-2 py-1 text-xs"
                    onClick={() => aprovar(r.id)}
                    disabled={busy || !podeAprovar}
                    title={podeAprovar ? "Aprovar para publicação" : "Trava: A10 + zero pendências"}
                  >
                    <ShieldCheck size={13} /> Aprovar
                  </Button>
                  <Button
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    onClick={() => rejeitar(r.id)}
                    disabled={busy || !podeRejeitar}
                  >
                    <XCircle size={13} /> Rejeitar
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#0e0e16]">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Publicar no Mercado Livre</p>
            <p className="text-xs text-zinc-500">{registro.anuncio?.tituloOtimizado}</p>
          </div>
          <button onClick={onFechar} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
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
      </div>
    </div>
  );
}