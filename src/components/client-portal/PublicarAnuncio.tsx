"use client";

// Publicar no Mercado Livre — pelo lojista, sozinho.
//
// A equipe revisa o payload em JSON e isso está certo para a equipe. Aqui não:
// o lojista vê o título que vai aparecer, o preço que vai cobrar e as fotos que
// vão junto. E vê ANTES de clicar tudo o que impede a publicação, de uma vez —
// descobrir os problemas em série (publica, erra, corrige, repete) é o que faz
// alguém desistir de usar a ferramenta.
//
// As duas travas já construídas continuam valendo e são reaproveitadas inteiras:
//   A1 · publicacaoML  → barra a publicação acidental (duplo clique, retry)
//   A2 · republicacao  → pergunta o que fazer quando já há anúncio no ar

import { useEffect, useState } from "react";
import { Rocket, X, AlertTriangle, CheckCircle2, ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MissaoRepublicacao } from "@/components/esteira/MissaoRepublicacao";
import {
  montarPreviewML,
  publicarNoML,
  JaPublicadoError,
  ReconectarCanalError,
} from "@/lib/services/publicacaoML";
import {
  buscarAnunciosAtivosDoProduto,
  encerrarAntigosAposPublicar,
  type AnuncioAtivo,
} from "@/lib/services/migracaoAnuncio";
import {
  montarMissaoRepublicacao,
  type MissaoRepublicacao as Missao,
} from "@/modules/publication/domain/republicacao";
import {
  resumirPublicacao,
  impedimentosDaPublicacao,
  podePublicar,
} from "@/modules/publication/domain/resumoPublicacao";
import { urlsDoProduto } from "@/lib/services/storageImagens";
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { formatBRL } from "@/lib/format";
import type { AnuncioGeradoRegistro } from "@/lib/types";

export interface ResultadoPublicado {
  id: string;
  permalink?: string;
  /** Anúncios antigos que o ML recusou encerrar — o lojista precisa saber. */
  naoEncerrados: string[];
}

export function PublicarAnuncio({
  registro,
  onFechar,
  onPublicado,
}: {
  registro: AnuncioGeradoRegistro;
  onFechar: () => void;
  onPublicado: (r: ResultadoPublicado) => void;
}) {
  const [fotos, setFotos] = useState<string[] | null>(null);
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // `conectado` responde "existe conexão?" (o flag `ativo`), que é uma coisa
  // diferente de "a credencial ainda vale". A segunda só se descobre USANDO —
  // e quando o ML recusa, o lojista precisa do mesmo caminho de reconexão que
  // já existe para quem nunca conectou.
  const [precisaReconectar, setPrecisaReconectar] = useState(false);
  const [missao, setMissao] = useState<{ missao: Missao; ativos: AnuncioAtivo[] } | null>(null);

  // Fotos reais do produto e estado da conexão: os dois fatos que mudam se o
  // botão pode ser clicado. Enquanto não chegam, nada é afirmado.
  useEffect(() => {
    let vivo = true;
    (registro.produtoId ? urlsDoProduto(registro.produtoId) : Promise.resolve([]))
      .then((u) => vivo && setFotos(u))
      .catch(() => vivo && setFotos([]));
    buscarCanal(registro.clienteId, registro.marketplace)
      .then((c) => vivo && setConectado(Boolean(c?.ativo)))
      .catch(() => vivo && setConectado(false));
    return () => {
      vivo = false;
    };
  }, [registro.produtoId, registro.clienteId, registro.marketplace]);

  const carregando = fotos === null || conectado === null;
  const payload = montarPreviewML(registro, { pictures: fotos ?? [] });
  const resumo = resumirPublicacao(payload);
  const impedimentos = impedimentosDaPublicacao(payload);
  const liberado = podePublicar(payload) && conectado === true && !carregando;

  async function iniciar() {
    if (!liberado || publicando) return;
    setErro(null);
    setPrecisaReconectar(false);
    let ativos: AnuncioAtivo[] = [];
    try {
      ativos = await buscarAnunciosAtivosDoProduto(registro.clienteId, registro.produtoId, registro.id);
    } catch {
      // Não conseguir checar não bloqueia — mas também não vira "está tudo
      // certo": segue sem afirmar o que não se sabe.
      ativos = [];
    }
    const m = montarMissaoRepublicacao(ativos);
    if (m) return setMissao({ missao: m, ativos });
    await publicar(null);
  }

  async function publicar(migrar: AnuncioAtivo[] | null) {
    setPublicando(true);
    setErro(null);
    setPrecisaReconectar(false);
    try {
      const r = await publicarNoML(registro, true);
      let naoEncerrados: string[] = [];
      if (migrar?.length) {
        // Encerra DEPOIS de o novo entrar no ar (ver migracaoAnuncio): o inverso
        // deixaria o lojista sem anúncio nenhum se a publicação falhasse.
        const { falharam } = await encerrarAntigosAposPublicar(
          registro.clienteId,
          migrar,
          registro.marketplace
        );
        naoEncerrados = falharam.map((f) => f.mlItemId);
      }
      setMissao(null);
      onPublicado({ id: r.id as string, permalink: r.permalink, naoEncerrados });
    } catch (e) {
      // O botão continua liberado: o lojista pode reconectar em outra aba e
      // tentar de novo sem fechar e reabrir esta tela.
      if (e instanceof ReconectarCanalError) setPrecisaReconectar(true);
      setErro(
        e instanceof JaPublicadoError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Não foi possível publicar agora."
      );
      setMissao(null);
    } finally {
      setPublicando(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onFechar} />
        <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-white/10 bg-[#0e0e16]">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Publicar no {registro.marketplace}</p>
              <p className="text-xs text-zinc-500">Confira antes de colocar no ar.</p>
            </div>
            <button onClick={onFechar} className="text-zinc-500 hover:text-white" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {carregando ? (
              <p className="py-6 text-center text-sm text-zinc-500">Carregando o anúncio…</p>
            ) : (
              <>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">Título que vai aparecer</p>
                  <p className="mt-0.5 text-sm text-zinc-100">{resumo.titulo || "—"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Dado rotulo="Preço" valor={resumo.preco === null ? "—" : formatBRL(resumo.preco)} />
                  <Dado rotulo="Estoque" valor={`${resumo.estoque}`} />
                  <Dado rotulo="Fotos" valor={`${resumo.quantidadeFotos}`} />
                  {resumo.quantidadeVariacoes > 0 && (
                    <Dado rotulo="Variações" valor={`${resumo.quantidadeVariacoes}`} />
                  )}
                  <Dado rotulo="Frete grátis" valor={resumo.freteGratis ? "Sim" : "Não"} />
                </div>

                {(fotos ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(fotos ?? []).slice(0, 6).map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={u}
                        alt={`Foto ${i + 1}`}
                        className="h-14 w-14 rounded-lg border border-white/10 object-cover"
                      />
                    ))}
                  </div>
                )}

                {conectado === false && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-300">
                    <Link2 size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Sua conta do {registro.marketplace} ainda não está conectada.{" "}
                      <Link href="/cliente/conectar-ml" className="underline hover:text-amber-200">
                        Conectar agora
                      </Link>
                      .
                    </span>
                  </div>
                )}

                {precisaReconectar && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-300">
                    <Link2 size={14} className="mt-0.5 shrink-0" />
                    <span>
                      {erro}{" "}
                      <Link href="/cliente/conectar-ml" className="underline hover:text-amber-200">
                        Reconectar agora
                      </Link>
                      .
                    </span>
                  </div>
                )}

                {impedimentos.length > 0 && (
                  <ul className="space-y-1.5">
                    {impedimentos.map((i) => (
                      <li
                        key={i.campo}
                        className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                          i.gravidade === "bloqueia"
                            ? "border-red-500/25 bg-red-500/5 text-red-300"
                            : "border-amber-500/20 bg-amber-500/5 text-amber-300"
                        }`}
                      >
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        {i.texto}
                      </li>
                    ))}
                  </ul>
                )}

                {impedimentos.length === 0 && conectado && (
                  <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs text-emerald-400">
                    <CheckCircle2 size={13} /> Tudo pronto para ir ao ar.
                  </p>
                )}

                {/* `!precisaReconectar`: a mesma mensagem já está no aviso âmbar
                    acima, ali com o caminho de saída. Repetir em vermelho faria
                    o lojista ler duas vezes e agir na cópia sem link. */}
                {erro && !precisaReconectar && (
                  <p className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    {erro}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3">
            <Button variant="ghost" onClick={onFechar} disabled={publicando}>
              Voltar
            </Button>
            <Button onClick={iniciar} disabled={!liberado || publicando}>
              <Rocket size={14} /> {publicando ? "Publicando…" : "Publicar agora"}
            </Button>
          </div>
        </div>
      </div>

      {missao && (
        <MissaoRepublicacao
          missao={missao.missao}
          ocupado={publicando}
          onCancelar={() => setMissao(null)}
          onConfirmar={(escolha) => publicar(escolha === "migrar" ? missao.ativos : null)}
        />
      )}
    </>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{rotulo}</p>
      <p className="mt-0.5 text-sm font-medium text-zinc-200">{valor}</p>
    </div>
  );
}

/** Aviso de sucesso reutilizável — inclui o link do anúncio no ar. */
export function AvisoPublicado({ resultado }: { resultado: ResultadoPublicado }) {
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
        <CheckCircle2 size={15} className="shrink-0" />
        Anúncio no ar ({resultado.id}).
        {resultado.permalink && (
          <a
            href={resultado.permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline hover:text-emerald-300"
          >
            <ExternalLink size={12} /> Ver no Mercado Livre
          </a>
        )}
      </p>
      {resultado.naoEncerrados.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Não foi possível encerrar {resultado.naoEncerrados.join(", ")}. Encerre manualmente no
          Mercado Livre para não ficar com anúncio duplicado.
        </p>
      )}
    </div>
  );
}
