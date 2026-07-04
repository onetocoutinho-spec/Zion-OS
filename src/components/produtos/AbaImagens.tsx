"use client";

import { useState } from "react";
import { ExternalLink, ImageIcon, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, FormGrid, Input, Select } from "@/components/ui/form";
import { IMAGEM_STATUS, TIPO_IMAGEM } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { resumoVariante } from "@/lib/variantes";
import { listarVariantesDoProduto } from "@/lib/services/produtoVariantes";
import {
  criarImagem,
  excluirImagem,
  listarImagensDoProduto,
} from "@/lib/services/imagensProduto";
import type { ImagemProduto, Produto } from "@/lib/types";

export function AbaImagens({ produto }: { produto: Produto }) {
  const { data: imagens } = useLiveQuery(
    () => listarImagensDoProduto(produto.id),
    [produto.id]
  );
  const { data: variantes } = useLiveQuery(
    () => listarVariantesDoProduto(produto.id),
    [produto.id]
  );

  const [tipo, setTipo] = useState<ImagemProduto["tipoImagem"]>("Principal");
  const [url, setUrl] = useState("");
  const [varianteId, setVarianteId] = useState("");
  const [status, setStatus] = useState<ImagemProduto["status"]>("Pendente");

  function resumoDaVariante(id: string | null): string {
    if (!id) return "Produto (todas)";
    const v = (variantes ?? []).find((x) => x.id === id);
    return v ? resumoVariante(v) : "—";
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    await criarImagem({
      clienteId: produto.clienteId,
      produtoId: produto.id,
      varianteId: varianteId || null,
      anuncioId: null,
      tipoImagem: tipo,
      url: url.trim(),
      status,
      observacoes: "",
    });
    setUrl("");
  }

  return (
    <div className="space-y-4">
      {imagens && imagens.length > 0 ? (
        <ul className="divide-y divide-white/[0.04] rounded-lg border border-white/5">
          {imagens.map((img) => (
            <li key={img.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-500">
                  <ImageIcon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm text-zinc-200">
                    <Badge tone="gray">{img.tipoImagem}</Badge>
                    {resumoDaVariante(img.varianteId)}
                  </p>
                  <a href={img.url} target="_blank" rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 truncate text-[11px] text-violet-400 hover:text-violet-300">
                    {img.url} <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{img.status}</Badge>
                <button onClick={() => excluirImagem(img.id)} title="Excluir imagem"
                  className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compacto mensagem="Nenhuma imagem cadastrada. Adicione as imagens do produto abaixo." />
      )}

      <form onSubmit={adicionar} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Nova imagem</p>
        <FormGrid>
          <Field label="Tipo">
            <Select options={TIPO_IMAGEM} value={tipo}
              onChange={(e) => setTipo(e.target.value as ImagemProduto["tipoImagem"])} />
          </Field>
          <Field label="Variação (opcional)">
            <Select
              options={(variantes ?? []).map((v) => resumoVariante(v))}
              placeholder="Produto (todas)"
              value={varianteId ? resumoDaVariante(varianteId) : ""}
              onChange={(e) => {
                const v = (variantes ?? []).find((x) => resumoVariante(x) === e.target.value);
                setVarianteId(v?.id ?? "");
              }}
            />
          </Field>
          <Field label="URL da imagem" required>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Status">
            <Select options={IMAGEM_STATUS} value={status}
              onChange={(e) => setStatus(e.target.value as ImagemProduto["status"])} />
          </Field>
        </FormGrid>
        <div className="mt-4">
          <Button type="submit"><Plus size={14} /> Adicionar imagem</Button>
        </div>
      </form>
    </div>
  );
}
