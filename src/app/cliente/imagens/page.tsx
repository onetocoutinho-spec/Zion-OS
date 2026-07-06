"use client";

import { useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { listarImagensDoProduto } from "@/lib/services/imagensProduto";
import { uploadImagemProduto } from "@/lib/services/storageImagens";
import { supabaseConfigurado } from "@/lib/supabase/client";
import type { Produto } from "@/lib/types";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Casa o nome da pasta com um produto da base (melhor sobreposição de palavras). */
function casarProduto(pasta: string, produtos: Produto[]): string | null {
  const alvo = new Set(norm(pasta).split(" ").filter((w) => w.length > 2));
  if (alvo.size === 0) return null;
  let melhor: string | null = null;
  let melhorScore = 0;
  for (const p of produtos) {
    const palavras = new Set(norm(p.nome).split(" ").filter((w) => w.length > 2));
    let comuns = 0;
    for (const w of alvo) if (palavras.has(w)) comuns++;
    const score = comuns / Math.max(alvo.size, palavras.size, 1);
    if (score > melhorScore) {
      melhorScore = score;
      melhor = p.id;
    }
  }
  return melhorScore >= 0.34 ? melhor : null;
}

export default function ClienteImagens() {
  const { clienteId } = useClientPortal();
  const { data: produtos } = useLiveQuery(listarProdutos);
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
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
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
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: imagens, reload } = useLiveQuery(
    () => (produtoId ? listarImagensDoProduto(produtoId) : Promise.resolve([])),
    [produtoId]
  );

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
        await uploadImagemProduto({
          clienteId,
          produtoId,
          file: files[i],
          tipo: i === 0 && (imagens ?? []).length === 0 ? "Principal" : "Secundária",
        });
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

  return (
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

      {lista.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {lista.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg border border-white/5 bg-black/30">
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {img.tipoImagem === "Principal" && (
                <span className="absolute left-1 top-1 rounded bg-violet-600/90 px-1 py-0.5 text-[9px] font-medium text-white">
                  Capa
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500">
        {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {enviando ? "Enviando…" : lista.length > 0 ? "Adicionar mais fotos" : "Enviar fotos"}
        <input type="file" accept="image/*" multiple className="hidden" onChange={aoEscolher} disabled={enviando} />
      </label>
      <p className="mt-2 text-xs text-zinc-500">A primeira foto vira a capa (1:1) do anúncio. JPG ou PNG.</p>
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
      const partes = (f.webkitRelativePath || f.name).split("/");
      const pastaProduto = partes.length >= 3 ? partes[partes.length - 3] : partes[0] || "(raiz)";
      const cor = partes.length >= 3 ? partes[partes.length - 2] : "";
      const chave = `${pastaProduto}||${cor}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          pastaProduto,
          cor,
          arquivos: [],
          produtoId: casarProduto(pastaProduto, produtos),
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
          await uploadImagemProduto({
            clienteId,
            produtoId: g.produtoId!,
            file: g.arquivos[i],
            cor: g.cor || undefined,
            tipo: i === 0 ? "Principal" : "Secundária",
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
                      prev.map((x, i) => (i === idx ? { ...x, produtoId: e.target.value || null } : x))
                    )
                  }
                  className="max-w-56 rounded-lg border border-white/10 bg-[#12121c] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
                >
                  <option value="">— escolher produto —</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                {g.produtoId ? (
                  <Check size={15} className="text-emerald-400" />
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
