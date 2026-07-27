"use client";

// As fotos do produto, dentro da jornada.
//
// Sem imagem o Mercado Livre recusa o anúncio. Antes disto, o lojista percorria
// a jornada inteira e batia na parede no último clique — "Sem fotos" — sem saber
// que existia uma tela separada para resolver isso. O passo passa a acontecer
// onde ele já está.
//
// Não reimplementa nada: o upload e a geração por IA já existiam em
// /cliente/imagens. Aqui eles só aparecem no momento certo.

import { useRef, useState } from "react";
import { Upload, Sparkles, Loader2, AlertTriangle, ImageIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadImagemProduto } from "@/lib/services/storageImagens";
import { gerarImagemProduto, salvarImagemGerada } from "@/lib/services/imagemIA";
import type { Produto } from "@/lib/types";

export function FotosDoProduto({
  produto,
  clienteId,
  fotos,
  onMudou,
}: {
  produto: Produto;
  clienteId: string;
  /** URLs já existentes. A primeira é a capa do anúncio. */
  fotos: string[];
  onMudou: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolherArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    if (arquivos.length === 0) return;
    setEnviando(true);
    setErro(null);
    try {
      // Sequencial de propósito: o Storage do Supabase responde melhor assim, e
      // subir 8 fotos em paralelo costuma render erro de cota.
      for (const file of arquivos) {
        await uploadImagemProduto({ clienteId, produtoId: produto.id, file });
      }
      onMudou();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar as fotos.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = ""; // permite reenviar o mesmo arquivo
    }
  }

  /**
   * A IA MELHORA uma foto real — não inventa o produto. Por isso exige uma
   * imagem de origem, e o botão não existe antes da primeira foto.
   */
  async function melhorarComIA() {
    if (gerando || fotos.length === 0) return;
    setGerando(true);
    setErro(null);
    try {
      const r = await gerarImagemProduto({
        imagemUrl: fotos[0],
        tipo: "melhorar",
        produtoNome: produto.nome,
        beneficios: produto.beneficios,
      });
      await salvarImagemGerada({
        clienteId,
        produtoId: produto.id,
        base64: r.base64,
        mimeType: r.mimeType,
        tipo: "melhorar",
      });
      onMudou();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  const semFotos = fotos.length === 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        semFotos ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
            <ImageIcon size={15} className={semFotos ? "text-amber-400" : "text-zinc-500"} />
            Fotos do produto
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            {semFotos
              ? "O Mercado Livre exige pelo menos uma imagem — sem foto o anúncio não vai ao ar. Envie a sua e a IA pode tratá-la depois."
              : `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}. A primeira é a capa do anúncio.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => inputRef.current?.click()} disabled={enviando}>
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {enviando ? "Enviando…" : "Enviar fotos"}
          </Button>
          {/* A IA parte de uma foto real: antes da primeira, não há o que melhorar. */}
          {fotos.length > 0 && (
            <Button
              variant="ghost"
              onClick={melhorarComIA}
              disabled={gerando}
              title="Gera uma versão tratada a partir da sua primeira foto"
            >
              {gerando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {gerando ? "Melhorando…" : "Melhorar com IA"}
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={aoEscolherArquivos}
          />
        </div>
      </div>

      {fotos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {fotos.slice(0, 10).map((u, i) => (
            <div key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt={`Foto ${i + 1}`}
                className="h-16 w-16 rounded-lg border border-white/10 object-cover"
              />
              {i === 0 && (
                <span
                  className="absolute -right-1 -top-1 rounded-full bg-violet-500 p-0.5 text-white"
                  title="Capa do anúncio"
                >
                  <Star size={10} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
