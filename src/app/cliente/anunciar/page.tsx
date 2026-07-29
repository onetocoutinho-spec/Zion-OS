"use client";

// A jornada — do produto ao anúncio no ar, num caminho só.
//
// A tela de otimização é um menu de dez ferramentas. Cada uma devolve um pedaço
// de texto, e quem sabe em que ordem usá-las é quem já conhece o processo — a
// equipe. O lojista fica olhando dez portas sem saber qual abrir.
//
// Aqui existe uma porta por vez. A trilha inteira fica visível (para a pessoa
// aprender o processo), mas só um passo está ativo, e a regra de qual passo é
// esse vive no núcleo puro: modules/publication/domain/jornada.
//
// As ferramentas avulsas continuam em /cliente/otimizar para quem quer uma só.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Circle,
  Lock,
  Loader2,
  Sparkles,
  ShieldCheck,
  Rocket,
  ExternalLink,
  RefreshCw,
  Package,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useContextoDaPergunta } from "@/components/client-portal/useEstadoDaLoja";
import { useClientPortal } from "@/components/client-portal/context";
import { CadastrarProduto } from "@/components/client-portal/CadastrarProduto";
import {
  PublicarAnuncio,
  AvisoPublicado,
  type ResultadoPublicado,
} from "@/components/client-portal/PublicarAnuncio";
import { FotosDoProduto } from "@/components/client-portal/FotosDoProduto";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { listarVariantesDoProduto } from "@/lib/services/produtoVariantes";
import { montarContexto } from "@/lib/contexto";
import {
  briefingDosAtributos,
  resolverObrigatorios,
} from "@/modules/publication/domain/atributosDoMarketplace";
import {
  listarAnunciosGeradosDoCliente,
  aprovarAnuncioGerado,
  rejeitarAnuncioGerado,
  criarAnuncioGerado,
} from "@/lib/services/anunciosGerados";
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { urlsDoProduto } from "@/lib/services/storageImagens";
import { quotaEsteira } from "@/lib/services/perfil";
import { INTERMEDIARIOS, rodarCadeiaEsteira, type PassoCadeia } from "@/lib/services/cadeiaEsteira";
import {
  montarJornada,
  proximaAcao,
  etapaAtual,
  concluida,
  type ContextoJornada,
} from "@/modules/publication/domain/jornada";
import { produtoParaRetomar, chaveUltimoProduto } from "@/modules/publication/domain/retomada";
import {
  chaveAnuncioPendente,
  lerAnuncioPendente,
  serveParaOProduto,
  type AnuncioPendenteDeGravacao,
} from "@/modules/publication/domain/anuncioNaoGravado";
import {
  chaveProgresso,
  etapasRetomaveis,
  impressaoDoBriefing,
  lerProgresso,
  type EtapaConcluida,
} from "@/modules/publication/domain/progressoGeracao";
import { formatBRL } from "@/lib/format";
import type { AnuncioGeradoRegistro, Produto } from "@/lib/types";

export default function ClienteAnunciar() {
  // useSearchParams exige Suspense no App Router.
  return (
    <Suspense fallback={null}>
      <Jornada />
    </Suspense>
  );
}

function Jornada() {
  const { clienteId, nome, marketplace } = useClientPortal();
  const { data: produtos } = useLiveQuery(listarProdutos);
  const { data: anuncios, reload: recarregarAnuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );

  const router = useRouter();
  const params = useSearchParams();

  const [produtoId, setProdutoIdBruto] = useState<string | null>(null);
  /** O que o chat desta tela pode responder e sobre quais produtos. */
  const chat = useContextoDaPergunta(clienteId, produtoId);
  /** Já retomamos uma vez? Sem isto, a retomada brigaria com a escolha manual. */
  const [retomou, setRetomou] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [passos, setPassos] = useState<PassoCadeia[]>([]);
  /** Entregas de IA de uma geração interrompida, prontas para reaproveitar. */
  const [retomavel, setRetomavel] = useState<EtapaConcluida[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado] = useState<ResultadoPublicado | null>(null);
  const [conectado, setConectado] = useState(false);
  // Sem foto o ML recusa o anúncio — por isso as fotos são um passo da jornada,
  // e não uma tela separada que o lojista descobre ao bater na parede.
  const [fotos, setFotos] = useState<string[]>([]);
  const [quota, setQuota] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /** Anúncio já montado, esperando gravação. Aparece só quando é DESTE produto. */
  const [pendente, setPendente] = useState<AnuncioPendenteDeGravacao | null>(null);
  /** Piscar o painel do anúncio quando a pessoa pede para revisar. */
  const [destacarAnuncio, setDestacarAnuncio] = useState(false);

  useEffect(() => {
    let vivo = true;
    buscarCanal(clienteId, marketplace)
      .then((c) => vivo && setConectado(Boolean(c?.ativo)))
      .catch(() => vivo && setConectado(false));
    quotaEsteira()
      .then((q) => vivo && setQuota(q.restante))
      .catch(() => vivo && setQuota(0));
    return () => {
      vivo = false;
    };
  }, [clienteId, marketplace]);

  /**
   * Escolher um produto grava onde o lojista está: no endereço (para o voltar
   * do navegador e um link compartilhável funcionarem) e localmente (para quem
   * fecha o Zion e volta depois cair no mesmo lugar).
   */
  const setProdutoId = useCallback(
    (id: string | null) => {
      setProdutoIdBruto(id);
      const q = new URLSearchParams(Array.from(params.entries()));
      if (id) q.set("produto", id);
      else q.delete("produto");
      router.replace(q.toString() ? `?${q}` : "/cliente/anunciar", { scroll: false });
      try {
        const chave = chaveUltimoProduto(clienteId);
        if (id) localStorage.setItem(chave, id);
        else localStorage.removeItem(chave);
      } catch {
        // storage indisponível (aba anônima, cota): a URL sozinha já retoma
      }
    },
    [params, router, clienteId]
  );

  // Retomada: acontece UMA vez, quando a lista de produtos chega. Depois disso
  // quem manda é a escolha do lojista — reaplicar sobrescreveria o que ele fez.
  useEffect(() => {
    if (retomou || !produtos) return;
    setRetomou(true);
    let ultimo: string | null = null;
    try {
      ultimo = localStorage.getItem(chaveUltimoProduto(clienteId));
    } catch {
      ultimo = null;
    }
    const alvo = produtoParaRetomar({
      daUrl: params.get("produto"),
      ultimoUsado: ultimo,
      disponiveis: produtos.map((p) => p.id),
    });
    if (alvo) setProdutoIdBruto(alvo);
  }, [retomou, produtos, params, clienteId]);

  const produto = useMemo(
    () => (produtos ?? []).find((p) => p.id === produtoId) ?? null,
    [produtos, produtoId]
  );

  /**
   * O briefing de agora. É ele que os agentes leram, então é a impressão dele
   * que diz se o trabalho guardado ainda fala do mesmo produto.
   */
  const briefing = useMemo(() => (produto ? montarBriefing(produto) : ""), [produto]);

  /**
   * Grava as entregas já prontas. Chamado a cada agente que termina — é isso
   * que faz a geração sobreviver a um "sair e voltar": sem gravar, os minutos
   * de espera e as chamadas de IA já pagas iam para o lixo na 1ª navegação.
   */
  const gravarProgresso = useCallback(
    (etapas: EtapaConcluida[]) => {
      if (!produto) return;
      try {
        localStorage.setItem(
          chaveProgresso(clienteId),
          JSON.stringify({
            produtoId: produto.id,
            impressaoBriefing: impressaoDoBriefing(briefing),
            etapas,
            atualizadoEm: new Date().toISOString(),
          })
        );
      } catch {
        // Sem storage (aba anônima, cota estourada) a geração roda igual — só
        // deixa de sobreviver a uma saída. Não é motivo para interromper nada.
      }
    },
    [produto, clienteId, briefing]
  );

  // ── O anúncio montado que ainda não chegou ao banco ────────────────────────
  //
  // Três gerações em 29/07 registraram `POST /api/agentes/esteira 200` e nenhuma
  // linha entrou em `anuncios_gerados`. O anúncio existia inteiro e sumia.
  const lerPendente = useCallback((): AnuncioPendenteDeGravacao | null => {
    try {
      return lerAnuncioPendente(localStorage.getItem(chaveAnuncioPendente(clienteId)));
    } catch {
      return null;
    }
  }, [clienteId]);

  const guardarPendente = useCallback(
    (p: AnuncioPendenteDeGravacao) => {
      try {
        localStorage.setItem(chaveAnuncioPendente(clienteId), JSON.stringify(p));
      } catch {
        // Sem storage a geração roda igual — só deixa de ser resgatável.
      }
    },
    [clienteId]
  );

  const descartarPendente = useCallback(() => {
    try {
      localStorage.removeItem(chaveAnuncioPendente(clienteId));
    } catch {
      /* nada a fazer */
    }
  }, [clienteId]);

  useEffect(() => {
    const p = lerPendente();
    setPendente(serveParaOProduto(p, produtoId) ? p : null);
  }, [produtoId, lerPendente]);

  const limparProgresso = useCallback(() => {
    try {
      localStorage.removeItem(chaveProgresso(clienteId));
    } catch {
      // sem storage não havia o que limpar
    }
  }, [clienteId]);

  // Ao abrir num produto, procura trabalho de uma geração que ficou pela metade.
  useEffect(() => {
    if (!produto) {
      setRetomavel([]);
      return;
    }
    let bruto: string | null = null;
    try {
      bruto = localStorage.getItem(chaveProgresso(clienteId));
    } catch {
      bruto = null;
    }
    setRetomavel(
      etapasRetomaveis(lerProgresso(bruto), {
        produtoId: produto.id,
        impressaoBriefing: impressaoDoBriefing(briefing),
        ordem: INTERMEDIARIOS,
        agora: new Date().toISOString(),
      })
    );
  }, [produto, clienteId, briefing]);

  const recarregarFotos = useCallback(async () => {
    if (!produtoId) return setFotos([]);
    try {
      setFotos(await urlsDoProduto(produtoId));
    } catch {
      setFotos([]); // não conseguir ler não afirma que existem
    }
  }, [produtoId]);

  useEffect(() => {
    void recarregarFotos();
  }, [recarregarFotos]);

  /** O anúncio mais recente DESTE produto — a jornada se orienta por ele. */
  const registro: AnuncioGeradoRegistro | null = useMemo(() => {
    if (!produtoId) return null;
    return (
      [...(anuncios ?? [])]
        .filter((a) => a.produtoId === produtoId)
        .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))[0] ?? null
    );
  }, [anuncios, produtoId]);

  const ctx: ContextoJornada = {
    temProduto: Boolean(produto),
    quantidadeFotos: fotos.length,
    anuncio: registro
      ? {
          status: registro.status,
          vereditoA10: registro.vereditoA10,
          qtdPendencias: registro.qtdPendencias,
          mlItemId: registro.mlItemId,
          mlPermalink: registro.mlPermalink,
        }
      : null,
    conectado,
    // Enquanto a quota não chega, não se bloqueia por algo que não se sabe.
    quotaRestante: quota ?? 1,
  };

  const trilha = montarJornada(ctx);
  const acao = proximaAcao(ctx);
  const etapa = etapaAtual(ctx);
  const fim = concluida(ctx);

  const gerar = useCallback(async () => {
    if (!produto || rodando) return;
    setRodando(true);
    setErro(null);
    setAviso(null);
    setPassos([]);
    try {
      // A grade cadastrada vai JUNTO. Sem ela a esteira pedia cor, tamanho,
      // SKU, EAN e estoque à IA tendo mandado só o nome do produto — e um
      // babuche branco voltou "Arco Iris" com SKU inventado.
      const variantes = await listarVariantesDoProduto(produto.id);
      // O CONTEXTO estava faltando, e era ele que faltava.
      //
      // A cadeia recebia só o NOME do produto. O A10 então listava como
      // pendência o custo (R$ 44,31 cadastrado), o SKU (que estava no próprio
      // anúncio), a cor e as fotos (8 delas) — de um produto completo. Ele não
      // alucinava: respondia honestamente sobre um briefing incompleto.
      //
      // Pendência falsa é pior que pendência ausente: publicar exige a lista
      // vazia, então uma acusação sobre dado presente trava o anúncio para
      // sempre. `/esteira` (a tela da equipe) já passava contexto; a tela do
      // cliente, não.
      // Os 6 obrigatórios do ML, resolvidos contra o cadastro. Marca e cor vêm
      // de campo; gênero e tipo, do nome — e null quando o nome não diz, que
      // vira pergunta em vez de chute.
      const atributos = briefingDosAtributos(
        resolverObrigatorios({
          nome: produto.nome,
          marca: produto.marca,
          modelo: produto.modelo,
          cores: [...new Set(variantes.map((v) => v.cor).filter(Boolean))],
          tamanhos: [...new Set(variantes.map((v) => v.tamanho).filter(Boolean))],
        })
      );
      const contexto = montarContexto({
        produto,
        variantes,
        quantidadeFotos: fotos.length,
        atributosObrigatorios: atributos,
      });
      const r = await rodarCadeiaEsteira({
        produto: produto.nome,
        contexto,
        briefing,
        variantes,
        precoVenda: produto.precoVenda,
        onPasso: setPassos,
        retomarDe: retomavel,
        onEtapaConcluida: (_, todas) => gravarProgresso(todas),
      });
      // GUARDA ANTES DE GRAVAR. A montagem final custa 30 s e é a única que
      // produz o anúncio; se a gravação falhar depois dela, o trabalho não pode
      // sumir. Mesma razão de `onEtapaConcluida` existir, um passo adiante.
      guardarPendente({
        produtoId: produto.id,
        produtoNome: produto.nome,
        anuncio: r.anuncio,
        tipoExecucao: r.tipo,
        montadoEm: new Date().toISOString(),
      });
      const passouA10 = r.anuncio.vereditoA10 === "aprovado" && r.anuncio.pendencias.length === 0;
      await criarAnuncioGerado({
        clienteId,
        cliente: nome,
        produtoId: produto.id,
        produto: produto.nome,
        auditoriaId: null,
        marketplace: produto.marketplace ?? marketplace,
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
        observacoes: "Gerado pelo lojista no portal.",
      } as Omit<AnuncioGeradoRegistro, "id">);
      if (r.aviso) setAviso(r.aviso);
      // Gravado: nada mais a resgatar.
      descartarPendente();
      // Anúncio gravado: o rascunho da esteira cumpriu o papel e sai de cena.
      limparProgresso();
      setRetomavel([]);
      await recarregarAnuncios();
      setQuota((q) => (q === null ? q : Math.max(0, q - 1)));
    } catch (e) {
      // O progresso guardado FICA. É exatamente aqui que ele vale: a próxima
      // tentativa começa de onde parou, sem repagar o que já foi entregue.
      //
      // E os dois erros são DIFERENTES. Falha de IA é "não foi gerado"; falha
      // de gravação é "foi gerado e não guardei" — dizer a primeira quando é a
      // segunda faz a pessoa refazer três minutos de trabalho que já existe.
      const pendente = lerPendente();
      setErro(
        serveParaOProduto(pendente, produto.id)
          ? "O anúncio foi gerado, mas não consegui gravá-lo. Ele está guardado aqui — use “Gravar o anúncio gerado” abaixo."
          : e instanceof Error
            ? e.message
            : "Não foi possível gerar o anúncio agora."
      );
    } finally {
      setRodando(false);
    }
  }, [
    produto,
    rodando,
    clienteId,
    nome,
    marketplace,
    recarregarAnuncios,
    briefing,
    retomavel,
    gravarProgresso,
    limparProgresso,
  ]);

  async function aprovar() {
    if (!registro || ocupado) return;
    setOcupado(true);
    try {
      await aprovarAnuncioGerado(registro.id, nome || "cliente");
      await recarregarAnuncios();
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Refazer em UM clique.
   *
   * Antes eram dois, com rótulos quase idênticos: este botão só rebobinava a
   * jornada, e a geração acontecia num segundo botão que passava a se chamar
   * "Refazer anúncio". Quem clicava via o rótulo do outro botão mudar e
   * concluía que nada tinha acontecido — foi exatamente o que aconteceu comigo
   * ao testar, e só entendi lendo o código.
   *
   * A confirmação existe porque a ação descarta o anúncio atual e gasta uma
   * geração da quota.
   */
  async function refazer() {
    if (!registro || ocupado) return;
    if (!confirm("Refazer apaga o anúncio atual e gera outro do zero. Continuar?")) return;
    setOcupado(true);
    try {
      await rejeitarAnuncioGerado(registro.id, "Refazer solicitado pelo lojista.");
      await recarregarAnuncios();
      // E gera, em vez de esperar um segundo clique num botão que mudou de nome.
      await gerar();
    } finally {
      setOcupado(false);
    }
  }

  /** Grava o anúncio que já foi gerado — sem repagar os três minutos de esteira. */
  async function gravarPendente() {
    if (!produto || !pendente || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const a = pendente.anuncio as {
        vereditoA10?: string; pendencias?: unknown[]; notaDiagnostico?: number;
      };
      const passou = a.vereditoA10 === "aprovado" && (a.pendencias?.length ?? 0) === 0;
      await criarAnuncioGerado({
        clienteId, cliente: nome, produtoId: produto.id, produto: produto.nome,
        auditoriaId: null, marketplace: produto.marketplace ?? marketplace, origem: "esteira",
        tipoExecucao: pendente.tipoExecucao, notaDiagnostico: a.notaDiagnostico ?? 0,
        vereditoA10: a.vereditoA10 ?? "reprovado", qtdPendencias: a.pendencias?.length ?? 0,
        anuncio: pendente.anuncio, status: passou ? "aguardando_aprovacao" : "rascunho",
        aprovadoPor: "", aprovadoEm: null, criadoEm: new Date().toISOString(),
        observacoes: "Gerado pelo lojista no portal (gravado em segunda tentativa).",
      } as Omit<AnuncioGeradoRegistro, "id">);
      descartarPendente();
      setPendente(null);
      limparProgresso();
      setRetomavel([]);
      await recarregarAnuncios();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Ainda não consegui gravar. O anúncio continua guardado.");
    } finally {
      setOcupado(false);
    }
  }

  function executarAcao() {
    if (!acao?.habilitada) return;
    if (acao.etapa === "gerar") return void gerar();
    if (acao.etapa === "aprovar") return void aprovar();
    if (acao.etapa === "publicar") return setPublicando(true);
    if (acao.etapa === "revisar") {
      // "Revisar" não tem ação REMOTA — mas tinha que ter alguma. Antes o clique
      // chegava ao fim desta função sem fazer nada: um botão roxo, primário, no
      // fim da página, prometendo o passo seguinte e devolvendo silêncio.
      //
      // O raciocínio original ("o painel já está visível") é verdade sobre a
      // tela e falso sobre a promessa do botão. Mesma lição do chip "custo" que
      // virou <span> no PR #76: controle que não faz nada ensina a não clicar
      // em nenhum.
      document.getElementById("anuncio-gerado")?.scrollIntoView({ block: "center" });
      setDestacarAnuncio(true);
      return;
    }
    // "produto" e "fotos" não têm ação: o painel correspondente é a própria
    // tela onde a pessoa já está.
  }

  const total = (produtos ?? []).length;

  return (
    <>
      <PageHeader
        titulo="Criar anúncio"
        subtitulo="Um passo por vez, do produto até o anúncio no ar."
        acao={
          <Link href="/cliente/otimizar">
            <Button variant="ghost">Ferramentas avulsas</Button>
          </Link>
        }
      />

      {publicado && <AvisoPublicado resultado={publicado} />}

      <Trilha trilha={trilha} />


      {/* ── Passo 1: escolher o produto ─────────────────────────────────── */}
      {total === 0 ? (
        <VazioAmigavel
          icon={Package}
          titulo="Comece cadastrando um produto"
          descricao="Você pode cadastrar do zero agora, ou importar sua base na tela de produtos."
          acao={
            <div className="flex gap-2">
              <Button onClick={() => setCadastrando(true)}>Cadastrar produto</Button>
              <Link href="/cliente/produtos">
                <Button variant="ghost">Importar base</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                Qual produto você quer anunciar?
              </label>
              <select
                value={produtoId ?? ""}
                onChange={(e) => {
                  setProdutoId(e.target.value || null);
                  setFotos([]);
                  setPassos([]);
                  setErro(null);
                  setAviso(null);
                  setPublicado(null);
                }}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-violet-500/50"
              >
                <option value="">Escolha um produto…</option>
                {(produtos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                    {p.sku ? ` · ${p.sku}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="ghost" onClick={() => setCadastrando(true)}>
              Cadastrar novo
            </Button>
          </div>

          {produto && (
            <div className="mt-3 flex flex-wrap gap-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
              <span>
                Preço <span className="text-zinc-300">{formatBRL(produto.precoVenda)}</span>
              </span>
              <span>
                Estoque <span className="text-zinc-300">{produto.estoque}</span>
              </span>
              <span>
                Marketplace <span className="text-zinc-300">{produto.marketplace}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Passo 2: as fotos ───────────────────────────────────────────── */}
      {produto && !fim && (
        <FotosDoProduto
          produto={produto}
          clienteId={clienteId}
          fotos={fotos}
          onMudou={() => void recarregarFotos()}
        />
      )}

      {/* ── Geração interrompida: o que já ficou pronto ─────────────────── */}
      {/* A condição é a ETAPA, não a ausência de anúncio: quem clicou "refazer"
          continua com o anúncio rejeitado no banco, e ficaria com um botão
          "Continuar geração" sem nenhuma explicação do que ele continua. */}
      {produto && !fim && !rodando && etapa === "gerar" && retomavel.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] p-3 text-sm text-violet-200">
          <Check size={15} className="mt-0.5 shrink-0" />
          <span>
            Você já tinha começado este anúncio: <strong>{retomavel.length} de{" "}
            {INTERMEDIARIOS.length} etapas</strong> ficaram prontas e foram guardadas. Gerar agora
            continua daí — o que já foi feito não é refeito.
          </span>
        </p>
      )}

      {/* ── Passos da geração ───────────────────────────────────────────── */}
      {rodando && <PassosDaEsteira passos={passos} />}

      {pendente && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-sm text-amber-200">
            <strong>Este anúncio já foi gerado</strong> e não chegou a ser gravado.
          </p>
          <p className="mt-1 text-xs text-amber-200/70">
            A IA terminou o trabalho — são cerca de três minutos de geração que não precisam ser
            refeitos. Grave para continuar de onde parou.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={() => void gravarPendente()} disabled={ocupado}>
              {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Gravar o
              anúncio gerado
            </Button>
            <button
              onClick={() => { descartarPendente(); setPendente(null); }}
              className="text-xs text-amber-200/60 hover:text-amber-200"
            >
              descartar
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}
      {aviso && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {aviso}
        </p>
      )}

      {/* ── O anúncio gerado ────────────────────────────────────────────── */}
      {registro?.anuncio && !rodando && (
        <AnuncioPronto registro={registro} destacado={destacarAnuncio} />
      )}

      {/* ── A única ação de agora ───────────────────────────────────────── */}
      {produto && !fim && acao && acao.etapa !== "fotos" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
          <Button onClick={executarAcao} disabled={!acao.habilitada || rodando || ocupado}>
            {rodando ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Gerando…
              </>
            ) : (
              <>
                {iconeDaEtapa(etapa)}{" "}
                {/* Quando há trabalho guardado o botão não mente: ele continua. */}
                {etapa === "gerar" && retomavel.length > 0 ? "Continuar geração" : acao.rotulo}
              </>
            )}
          </Button>

          {etapa === "revisar" && registro && (
            <Button variant="ghost" onClick={refazer} disabled={ocupado}>
              <RefreshCw size={14} /> Refazer com a IA
            </Button>
          )}

          {acao.motivo && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle size={13} /> {acao.motivo}
              {etapa === "publicar" && !conectado && (
                <Link href="/cliente/conectar-ml" className="underline hover:text-amber-300">
                  Conectar
                </Link>
              )}
            </span>
          )}

          {quota !== null && etapa === "gerar" && quota > 0 && (
            <span className="ml-auto text-[11px] text-zinc-600">
              {quota} {quota === 1 ? "otimização restante" : "otimizações restantes"} no mês
            </span>
          )}
        </div>
      )}

      {fim && registro && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <Check size={16} className="text-emerald-400" />
          <span className="text-sm text-emerald-300">Anúncio no ar. Nada mais a fazer aqui.</span>
          {registro.mlPermalink && (
            <a
              href={registro.mlPermalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-400 underline hover:text-violet-300"
            >
              <ExternalLink size={12} /> Ver no marketplace
            </a>
          )}
          <Button variant="ghost" className="ml-auto" onClick={() => setProdutoId(null)}>
            Anunciar outro produto
          </Button>
        </div>
      )}

      {cadastrando && (
        <CadastrarProduto
          clienteId={clienteId}
          cliente={nome}
          skusExistentes={(produtos ?? []).map((p) => p.sku).filter(Boolean)}
          onFechar={() => setCadastrando(false)}
          onCriado={() => setCadastrando(false)}
        />
      )}

      {publicando && registro && (
        <PublicarAnuncio
          registro={registro}
          onFechar={() => setPublicando(false)}
          onPublicado={(r) => {
            setPublicando(false);
            setPublicado(r);
            void recarregarAnuncios();
          }}
        />
      )}
    </>
  );
}

/** O briefing que a esteira recebe: o que o lojista já cadastrou sobre o produto. */
function montarBriefing(p: Produto): string {
  return [
    `Produto: ${p.nome}`,
    p.marca && `Marca: ${p.marca}`,
    p.categoria && `Categoria: ${p.categoria}`,
    p.cor && `Cor: ${p.cor}`,
    p.tamanho && `Tamanho: ${p.tamanho}`,
    p.precoVenda > 0 && `Preço de venda: ${formatBRL(p.precoVenda)}`,
    p.descricaoBase && `Descrição base: ${p.descricaoBase}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function iconeDaEtapa(etapa: string) {
  if (etapa === "gerar") return <Sparkles size={15} />;
  if (etapa === "aprovar") return <ShieldCheck size={15} />;
  if (etapa === "publicar") return <Rocket size={15} />;
  return <Circle size={15} />;
}

/** A trilha inteira, sempre visível: a pessoa aprende o processo enquanto anda. */
function Trilha({ trilha }: { trilha: ReturnType<typeof montarJornada> }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {trilha.map((p, i) => (
        <li
          key={p.etapa}
          className={`rounded-lg border p-3 ${
            p.estado === "atual"
              ? "border-violet-500/50 bg-violet-500/10"
              : p.estado === "bloqueado"
                ? "border-amber-500/30 bg-amber-500/5"
                : p.estado === "feito"
                  ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                  : "border-white/10 bg-white/[0.02]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {p.estado === "feito" ? (
              <Check size={13} className="text-emerald-400" />
            ) : p.estado === "bloqueado" ? (
              <Lock size={13} className="text-amber-400" />
            ) : (
              <span
                className={`text-[11px] font-semibold ${
                  p.estado === "atual" ? "text-violet-300" : "text-zinc-600"
                }`}
              >
                {i + 1}
              </span>
            )}
            <p
              className={`text-xs font-medium ${
                p.estado === "futuro" ? "text-zinc-500" : "text-zinc-200"
              }`}
            >
              {p.titulo}
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{p.descricao}</p>
          {p.bloqueio && <p className="mt-1 text-[11px] text-amber-400">{p.bloqueio}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Os agentes rodando, ao vivo. Esperar sem ver nada parece travado. */
function PassosDaEsteira({ passos }: { passos: PassoCadeia[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-200">
        <Loader2 size={14} className="animate-spin text-violet-400" /> A IA está montando seu anúncio
      </p>
      <ul className="space-y-1">
        {passos.map((p) => (
          <li key={p.codigo} className="flex items-center gap-2 text-xs">
            {p.status === "ok" ? (
              <Check size={12} className="text-emerald-400" />
            ) : p.status === "rodando" ? (
              <Loader2 size={12} className="animate-spin text-violet-400" />
            ) : (
              <Circle size={12} className="text-zinc-700" />
            )}
            <span className={p.status === "ok" ? "text-zinc-400" : "text-zinc-500"}>{p.nome}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** O anúncio que a IA escreveu — para o lojista ler antes de aprovar. */
function AnuncioPronto({
  registro,
  destacado,
}: {
  registro: AnuncioGeradoRegistro;
  destacado?: boolean;
}) {
  const a = registro.anuncio!;
  return (
    <div
      id="anuncio-gerado"
      className={`space-y-3 rounded-xl border p-4 transition-colors ${
        destacado ? "border-violet-500/60 bg-violet-500/[0.07]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-zinc-100">Seu anúncio</p>
        <Pill tone={registro.notaDiagnostico >= 70 ? "green" : registro.notaDiagnostico >= 40 ? "yellow" : "red"}>
          {registro.notaDiagnostico}/100
        </Pill>
        {registro.qtdPendencias > 0 && (
          <Pill tone="yellow">
            {registro.qtdPendencias} {registro.qtdPendencias === 1 ? "pendência" : "pendências"}
          </Pill>
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Título</p>
        <p className="mt-0.5 text-sm text-zinc-100">{a.tituloOtimizado}</p>
      </div>

      {a.descricaoCurta && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Descrição</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-300">{a.descricaoCurta}</p>
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
          <p className="text-[11px] uppercase tracking-wider text-amber-400">O que ainda falta</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-300/90">
            {a.pendencias.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
