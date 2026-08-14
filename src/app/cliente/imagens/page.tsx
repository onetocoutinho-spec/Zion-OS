"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Images,
  Upload,
  FolderUp,
  Package,
  Check,
  X,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Sparkles,
  Save,
  Star,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { EsqueletoDeBloco } from "@/components/ui/Skeleton";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import {
  listarImagensDoProduto,
  atualizarImagem,
  excluirImagem,
} from "@/lib/services/imagensProduto";
import {
  excluirImagemDoProduto,
  promoverImagemACapa,
  uploadImagemProduto,
} from "@/lib/services/storageImagens";
import { gerarImagemProduto, salvarImagemGerada, type TipoGeracao } from "@/lib/services/imagemIA";
import { supabaseConfigurado } from "@/lib/supabase/client";
import type { ImagemProduto, Produto } from "@/lib/types";
import {
  casarPastaComProduto,
  lerCaminhoDaFoto,
} from "@/modules/catalog/domain/casarPastaComProduto";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Abre já no produto quando vem de `?produto=<id>` — o chip "foto" da lista
 * leva a pessoa ao item que ela acabou de ver, em vez de a uma busca vazia.
 */
function ClienteImagensInterno() {
  const { clienteId } = useClientPortal();
  const { data: produtos, estado: estadoDosProdutos } = useLiveQuery(listarProdutos);
  const [modo, setModo] = useState<"produto" | "massa">("produto");

  if (!supabaseConfigurado) {
    return (
      <>
        <PageHeader titulo="Fotos dos produtos" />
        <VazioAmigavel
          icon={Images}
          titulo="Indisponível no modo demonstração"
          descricao="O upload de imagens usa o Supabase Storage. Conecte o Supabase para anexar fotos."
        />
      </>
    );
  }

  // "IMPORTE SEUS PRODUTOS" A QUEM TEM OITENTA.
  //
  // O ramo abaixo faz `(produtos ?? []).length === 0` e RETORNA. O `?? []`
  // transforma "ainda não sei" em "não há", e enquanto a busca está no ar a
  // tela inteira vira um convite para importar uma base que já existe.
  if (estadoDosProdutos === "carregando") {
    return (
      <>
        <PageHeader titulo="Fotos dos produtos" subtitulo="Anexe as fotos reais dos seus produtos." />
        <EsqueletoDeBloco altura="h-40" />
      </>
    );
  }

  if ((produtos ?? []).length === 0) {
    return (
      <>
        <PageHeader titulo="Fotos dos produtos" subtitulo="Anexe as fotos reais dos seus produtos." />
        <VazioAmigavel
          icon={Package}
          titulo="Importe seus produtos primeiro"
          descricao="As fotos são anexadas a cada produto da sua base. Importe a base para começar."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Fotos dos produtos"
        subtitulo="Anexe fotos reais — são elas que vão para o anúncio no marketplace."
      />

      <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-sm">
        {(["produto", "massa"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors [@media(pointer:coarse)]:min-h-11 ${
              modo === m ? "bg-violet-500/15 text-violet-300" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "produto" ? "Um produto" : "Em massa (pasta)"}
          </button>
        ))}
      </div>

      {modo === "produto" ? (
        <ModoUmProduto clienteId={clienteId} produtos={produtos ?? []} />
      ) : (
        <ModoMassa clienteId={clienteId} produtos={produtos ?? []} />
      )}
    </>
  );
}

// ---------- Modo: um produto ----------

function ModoUmProduto({ clienteId, produtos }: { clienteId: string; produtos: Produto[] }) {
  const params = useSearchParams();
  // Só aceita id que EXISTE na lista: um endereço com produto apagado abriria a
  // tela num item fantasma, o que é pior que abrir vazia.
  const doEndereco = params.get("produto");
  const [produtoId, setProdutoId] = useState<string | null>(
    doEndereco && produtos.some((p) => p.id === doEndereco) ? doEndereco : null
  );
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState<string | null>(null);

  const { data: imagens, reload } = useLiveQuery(
    () => (produtoId ? listarImagensDoProduto(produtoId) : Promise.resolve([])),
    [produtoId]
  );

  // Tudo entra por padrão; "Pendente" = o cliente tirou do envio (sem apagar).
  const enviada = (img: ImagemProduto) => img.status !== "Pendente";

  async function alternarEnvio(img: ImagemProduto) {
    setImgBusy(img.id);
    try {
      await atualizarImagem(img.id, { status: enviada(img) ? "Pendente" : "Aprovada" });
      reload();
    } finally {
      setImgBusy(null);
    }
  }

  async function tornarCapa(img: ImagemProduto) {
    setImgBusy(img.id);
    try {
      // A regra da capa mora em `promoverImagemACapa`, e repeti-la aqui é como
      // as quatro cópias que a 053 tornou audíveis. Esta era a que sobrou: a
      // ordem estava certa, faltava o desfazer.
      await promoverImagemACapa(img.produtoId, img.id);
      reload();
    } finally {
      setImgBusy(null);
    }
  }

  async function remover(img: ImagemProduto) {
    setImgBusy(img.id);
    try {
      // NÃO é `excluirImagem` direto: apagar a capa deixava o produto sem capa
      // nenhuma, em silêncio. Ver `excluirImagemDoProduto`.
      await excluirImagemDoProduto(img.produtoId, img.id);
      reload();
    } finally {
      setImgBusy(null);
    }
  }

  const filtrados = useMemo(() => {
    const q = norm(busca);
    return produtos.filter((p) => !q || norm(`${p.nome} ${p.sku}`).includes(q)).slice(0, 40);
  }, [produtos, busca]);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !produtoId) return;
    setEnviando(true);
    setErro(null);
    try {
      for (let i = 0; i < files.length; i++) {
        // Sem `tipo`: a regra da capa mora em `papelDaFotoNova`, e repeti-la
        // aqui era uma das quatro cópias que discordavam entre si.
        await uploadImagemProduto({ clienteId, produtoId, file: files[i] });
      }
      reload();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setEnviando(false);
      e.target.value = "";
    }
  }

  if (!produtoId) {
    return (
      <Card title="Escolha o produto">
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-zinc-500 focus-within:border-violet-500/50">
          <Search size={14} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto…"
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
          />
        </div>
        <ul className="max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
          {filtrados.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setProdutoId(p.id)}
                className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-white/[0.02]"
              >
                <span className="truncate text-sm text-zinc-200">{p.nome}</span>
                <span className="text-xs text-zinc-500">{p.sku || "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const produto = produtos.find((p) => p.id === produtoId);
  const lista = imagens ?? [];

  const fonte = lista.find((i) => i.tipoImagem === "Principal") ?? lista[0];

  return (
    <>
      <Card
        title={`Fotos · ${produto?.nome ?? ""}`}
        action={
          <button onClick={() => setProdutoId(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
            Trocar produto
          </button>
        }
      >
        {erro && (
          <p className="mb-3 flex items-center gap-2 text-sm text-red-400">
            <AlertTriangle size={15} /> {erro}
          </p>
        )}

        {lista.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
              <span className="text-zinc-400">
                <span className="font-semibold text-emerald-400">{lista.filter(enviada).length}</span> de{" "}
                {lista.length} foto(s) vão para o anúncio.
              </span>
              {/* A legenda usava ★ 👁 🗑 — EMOJI descrevendo os ícones que os
                  botões desenham em SVG (lucide). Além de inconsistente, a régua
                  de UI do projeto lista "emoji como ícone" entre os
                  anti-padrões. Agora a legenda mostra o MESMO ícone do botão. */}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-500">
                <span>Todas entram por padrão</span>
                <span className="flex items-center gap-1">
                  <Star size={11} aria-hidden="true" /> = capa
                </span>
                <span className="flex items-center gap-1">
                  <EyeOff size={11} aria-hidden="true" /> tira do envio
                </span>
              </span>
            </div>

            {/* DUAS COLUNAS NO CELULAR, e não três.
                Não é gosto: é o que faz os controles caberem. Em toque cada
                botão passa a ter 44px (a régua exige 44×44) e são três, em
                coluna, com 8px de gap — 148px de altura. Numa tela de 375px com
                três colunas a miniatura tem ~110px, e os botões não cabem; com
                duas ela tem ~167px e cabem. No desktop continuam cinco. */}
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {lista.map((img) => {
                const vai = enviada(img);
                const ocupada = imgBusy === img.id;
                return (
                  <div
                    key={img.id}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/30"
                  >
                    {/* `alt=""` declara "imagem decorativa, ignore" — e numa tela
                        cuja função é GERENCIAR fotos de produto ela não é
                        decorativa. A régua: "BAD: alt='' for content images".
                        O texto diz o papel da foto, que é o que distingue uma da
                        outra aqui: a capa é a que o Mercado Livre exibe. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={
                        img.tipoImagem === "Principal"
                          ? "Foto de capa do produto"
                          : img.tipoImagem === "Infográfico"
                            ? "Infográfico do produto"
                            : "Foto do produto"
                      }
                      className={`h-full w-full object-cover transition-opacity ${vai ? "" : "opacity-35"}`}
                    />
                    {img.tipoImagem === "Principal" && (
                      <span className="absolute left-1 top-1 rounded bg-violet-600/90 px-1 py-0.5 text-[9px] font-medium text-white">
                        Capa
                      </span>
                    )}
                    {img.tipoImagem === "Infográfico" && (
                      <span className="absolute left-1 top-1 rounded bg-cyan-600/90 px-1 py-0.5 text-[9px] font-medium text-white">
                        Infográfico
                      </span>
                    )}
                    {!vai && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] text-zinc-300">
                        fora do envio
                      </span>
                    )}

                    {/* CONTROLES — e este bloco tinha três defeitos de uma vez.
                        ==================================================
                        Medido em 05/08/2026 contra a régua `ui-ux-pro-max`, que
                        traz o exemplo LITERAL do que estava aqui:

                          Touch Target Size · High
                            Code Example Bad: w-6 h-6 buttons     ← era isto
                          Hover vs Tap · High
                            Don't: Rely only on hover              ← era isto
                          Touch Spacing · Medium
                            Do: Minimum 8px gap                    ← era gap-1 (4px)

                        A consequência não era estética. NUM TELEFONE NÃO EXISTE
                        HOVER: a tela cuja função é gerenciar fotos não tinha, no
                        celular, caminho nenhum para definir a capa — que é
                        exatamente o trabalho que o PLANO-001 §A2 aponta como o
                        maior ganho de receita disponível desta conta (535 capas
                        fora do padrão do Mercado Livre).

                        `[@media(pointer:coarse)]` é a mesma consulta que
                        `components/ui/form.tsx` já usa para os campos. Em toque
                        os controles ficam SEMPRE visíveis e com 44px; com mouse
                        continuam aparecendo no hover, com 24px, como antes — o
                        desktop não muda. */}
                    <div className="absolute right-1 top-1 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
                      <button
                        onClick={() => tornarCapa(img)}
                        disabled={ocupada}
                        title="Definir como capa"
                        aria-label={`Definir como capa${img.tipoImagem === "Principal" ? " (já é a capa)" : ""}`}
                        className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-zinc-200 hover:text-violet-300 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                      >
                        <Star size={12} aria-hidden="true" className={img.tipoImagem === "Principal" ? "fill-violet-400 text-violet-400" : ""} />
                      </button>
                      <button
                        onClick={() => alternarEnvio(img)}
                        disabled={ocupada}
                        title={vai ? "Tirar do envio (mantém a foto)" : "Voltar a enviar"}
                        aria-label={vai ? "Tirar esta foto do envio (mantém a foto)" : "Voltar a enviar esta foto"}
                        className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-zinc-200 hover:text-emerald-300 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                      >
                        {vai ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
                      </button>
                      <button
                        onClick={() => remover(img)}
                        disabled={ocupada}
                        title="Remover (apaga a foto)"
                        aria-label="Remover esta foto (apaga do catálogo)"
                        className="flex h-6 w-6 items-center justify-center rounded bg-black/70 text-zinc-200 hover:text-red-400 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                      >
                        {ocupada ? <Loader2 size={12} aria-hidden="true" className="animate-spin" /> : <Trash2 size={12} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mb-4 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
            Ainda sem fotos. Tudo que você enviar (ou gerar com a IA) já vai para o anúncio — você não precisa selecionar nada; só tira do envio o que não quiser.
          </div>
        )}

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500">
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {enviando ? "Enviando…" : lista.length > 0 ? "Adicionar mais fotos" : "Enviar fotos"}
          <input type="file" accept="image/*" multiple className="hidden" onChange={aoEscolher} disabled={enviando} />
        </label>
        {/* "Passe o mouse" era a instrução, e no celular ela era FALSA duas
            vezes: não existe mouse, e antes do conserto acima não existia
            caminho nenhum. Consertar o comportamento e deixar o texto velho
            trocaria um defeito por outro — a tela passaria a funcionar dizendo
            que não. O texto agora vale nos dois casos, e os emoji saíram junto
            (os botões desenham os ícones em SVG). */}
        <p className="mt-2 text-xs text-zinc-500">
          Todas as fotos já vão para o anúncio — você não seleciona uma a uma. No celular
          os botões de cada foto ficam sempre visíveis; no computador eles aparecem ao
          passar o mouse. Com eles você define a capa, tira do envio sem apagar, ou remove.
        </p>
      </Card>

      {fonte && produto && (
        <EstudioIA
          clienteId={clienteId}
          produto={produto}
          fonte={fonte}
          onSalvo={reload}
        />
      )}
    </>
  );
}

// ---------- Estúdio de imagem por IA (a partir da foto real) ----------

function EstudioIA({
  clienteId,
  produto,
  fonte,
  onSalvo,
}: {
  clienteId: string;
  produto: Produto;
  fonte: ImagemProduto;
  onSalvo: () => void;
}) {
  const [beneficios, setBeneficios] = useState(produto.beneficios ?? "");
  const [gerando, setGerando] = useState<TipoGeracao | null>(null);
  const [resultado, setResultado] = useState<{ dataUrl: string; base64: string; mimeType: string; tipo: TipoGeracao } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar(tipo: TipoGeracao) {
    if (gerando) return;
    setGerando(tipo);
    setErro(null);
    setResultado(null);
    try {
      const r = await gerarImagemProduto({
        imagemUrl: fonte.url,
        tipo,
        beneficios: tipo === "infografico" ? beneficios : undefined,
        produtoNome: produto.nome,
      });
      setResultado({ ...r, tipo });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar a imagem.");
    } finally {
      setGerando(null);
    }
  }

  async function salvar() {
    if (!resultado || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      await salvarImagemGerada({
        clienteId,
        produtoId: produto.id,
        base64: resultado.base64,
        mimeType: resultado.mimeType,
        tipo: resultado.tipo,
      });
      // O rebaixamento da capa antiga saiu daqui: `salvarImagemGerada` faz a
      // troca inteira, rebaixando ANTES de inserir e desfazendo se falhar. Aqui
      // ele acontecia DEPOIS, e uma falha entre as duas chamadas deixava o
      // produto com duas capas — silenciosamente, até a restrição existir.
      setResultado(null);
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card title="Estúdio de imagem (IA)">
      <p className="mb-3 text-sm text-zinc-400">
        A IA parte da sua <span className="text-zinc-300">foto real</span> — melhora a capa ou cria um
        infográfico, sem descaracterizar o produto.
      </p>

      <div className="flex flex-wrap items-start gap-4">
        {/* Foto de origem */}
        <div className="w-28 shrink-0">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">Foto real</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fonte.url} alt="Foto real do produto, antes da edição" className="aspect-square w-full rounded-lg border border-white/5 object-cover" />
        </div>

        {/* Ações */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => gerar("melhorar")} disabled={gerando !== null}>
              {gerando === "melhorar" ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              Melhorar capa (1:1)
            </Button>
            <Button variant="ghost" onClick={() => gerar("infografico")} disabled={gerando !== null}>
              {gerando === "infografico" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Gerar infográfico
            </Button>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
              Benefícios (para o infográfico)
            </label>
            <textarea
              value={beneficios}
              onChange={(e) => setBeneficios(e.target.value)}
              rows={2}
              placeholder="Ex.: palmilha ortopédica, ultraconforto, antiderrapante…"
              className="w-full rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500"
            />
          </div>
        </div>
      </div>

      {erro && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle size={15} /> {erro}
        </p>
      )}

      {resultado && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">Resultado</p>
          <div className="flex flex-wrap items-end gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultado.dataUrl} alt="Resultado da edição, ainda não salvo" className="w-48 rounded-lg border border-white/10" />
            <div className="flex gap-2">
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {resultado.tipo === "melhorar" ? "Salvar como capa" : "Salvar imagem"}
              </Button>
              <Button variant="ghost" onClick={() => setResultado(null)} disabled={salvando}>
                <X size={15} /> Descartar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- Modo: em massa (pasta produto/cor) ----------

interface GrupoMassa {
  chave: string;
  pastaProduto: string;
  cor: string;
  arquivos: File[];
  produtoId: string | null;
  /** 0 a 1. A tela mostra: um casamento de 35% não é igual a um de 100%. */
  confianca: number;
  via: "codigo" | "nome" | null;
}

function ModoMassa({ clienteId, produtos }: { clienteId: string; produtos: Produto[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [grupos, setGrupos] = useState<GrupoMassa[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function aoEscolherPasta(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    const mapa = new Map<string, GrupoMassa>();
    for (const f of files) {
      const { pastaProduto, cor } = lerCaminhoDaFoto(f.webkitRelativePath || f.name);
      const chave = `${pastaProduto}||${cor}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          pastaProduto,
          cor,
          arquivos: [],
          ...casarPastaComProduto(pastaProduto, produtos),
        });
      }
      mapa.get(chave)!.arquivos.push(f);
    }
    setGrupos([...mapa.values()].sort((a, b) => a.pastaProduto.localeCompare(b.pastaProduto)));
    setMsg(null);
  }

  const totalArquivos = grupos.reduce((s, g) => s + g.arquivos.length, 0);
  const semCasar = grupos.filter((g) => !g.produtoId).length;

  async function confirmar() {
    const validos = grupos.filter((g) => g.produtoId);
    if (!validos.length || enviando) return;
    setEnviando(true);
    setMsg(null);
    const total = validos.reduce((s, g) => s + g.arquivos.length, 0);
    let feito = 0;
    setProgresso({ feito, total });
    try {
      for (const g of validos) {
        for (let i = 0; i < g.arquivos.length; i++) {
          // `i === 0 ? "Principal"` pedia uma capa por GRUPO DE COR, e um
          // produto de três cores pedia três. A capa é do produto; a capa por
          // cor é o DES-003, e ela mora em `variante_id`, não em repetir
          // "Principal" na tabela toda.
          await uploadImagemProduto({
            clienteId,
            produtoId: g.produtoId!,
            file: g.arquivos[i],
            cor: g.cor || undefined,
          });
          feito++;
          setProgresso({ feito, total });
        }
      }
      setMsg(`${feito} foto(s) enviadas para ${validos.length} produto(s).`);
      setGrupos([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setMsg(err instanceof Error ? `Falha: ${err.message}` : "Falha no envio.");
    } finally {
      setEnviando(false);
      setProgresso(null);
    }
  }

  return (
    <Card title="Enviar por pasta (produto / cor)">
      <p className="mb-3 text-sm text-zinc-400">
        Escolha uma pasta organizada como <span className="text-zinc-300">Produto → Cor → fotos</span>.
        Casamos cada pasta com o produto da sua base; revise antes de confirmar.
      </p>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 hover:border-white/20">
        <FolderUp size={15} /> Escolher pasta
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={aoEscolherPasta}
          {...({ webkitdirectory: "", directory: "" } as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      </label>

      {grupos.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <Pill tone="violet">{grupos.length} pastas</Pill>
            <Pill tone="gray">{totalArquivos} fotos</Pill>
            {semCasar > 0 && <Pill tone="yellow">{semCasar} sem produto</Pill>}
          </div>

          <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto">
            {grupos.map((g, idx) => (
              <div
                key={g.chave}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-zinc-200">
                    {g.pastaProduto}
                    {g.cor ? <span className="text-zinc-500"> · {g.cor}</span> : null}
                  </p>
                  <p className="text-xs text-zinc-500">{g.arquivos.length} foto(s)</p>
                </div>
                <select
                  value={g.produtoId ?? ""}
                  onChange={(e) =>
                    setGrupos((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? // Escolha humana não tem confiança de algoritmo: a
                            // marca de palpite sai quando a pessoa decide.
                            { ...x, produtoId: e.target.value || null, confianca: 1, via: null }
                          : x
                      )
                    )
                  }
                  className="max-w-56 rounded-lg border border-white/10 bg-[#12121c] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                >
                  <option value="">— escolher produto —</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                {g.produtoId ? (
                  <span className="flex items-center gap-1.5">
                    {g.via === "codigo" && <Pill tone="violet">código</Pill>}
                    {g.via === "nome" && (
                      // Casamento por nome é parecença, e parecença erra. O
                      // número existe para a pessoa olhar duas vezes os fracos
                      // em vez de confiar igual em todos.
                      <Pill tone={g.confianca >= 0.6 ? "gray" : "yellow"}>
                        {Math.round(g.confianca * 100)}%
                      </Pill>
                    )}
                    <Check size={15} className="text-emerald-400" />
                  </span>
                ) : (
                  <X size={15} className="text-amber-400" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={confirmar} disabled={enviando || grupos.every((g) => !g.produtoId)}>
              {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {enviando
                ? progresso
                  ? `Enviando ${progresso.feito}/${progresso.total}…`
                  : "Enviando…"
                : "Confirmar envio"}
            </Button>
            {semCasar > 0 && (
              <span className="text-xs text-amber-400">Pastas sem produto serão ignoradas.</span>
            )}
          </div>
        </>
      )}

      {msg && (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 size={15} /> {msg}
        </p>
      )}
    </Card>
  );
}

/** `useSearchParams` exige limite de Suspense no App Router. */
export default function ClienteImagens() {
  return (
    <Suspense fallback={null}>
      <ClienteImagensInterno />
    </Suspense>
  );
}
