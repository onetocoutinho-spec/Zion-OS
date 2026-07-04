"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, FormGrid, Input, Select } from "@/components/ui/form";
import { ORIGEM_ATRIBUTO, TIPO_ATRIBUTO } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import {
  criarAtributo,
  excluirAtributo,
  listarAtributosDoProduto,
} from "@/lib/services/produtoAtributos";
import type { Produto, ProdutoAtributo } from "@/lib/types";

export function AbaAtributos({ produto }: { produto: Produto }) {
  const { data: atributos } = useLiveQuery(
    () => listarAtributosDoProduto(produto.id),
    [produto.id]
  );
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<ProdutoAtributo["tipoAtributo"]>("texto");
  const [origem, setOrigem] = useState<ProdutoAtributo["origem"]>("Manual");
  const [obrigatorio, setObrigatorio] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    await criarAtributo({
      produtoId: produto.id,
      nomeAtributo: nome.trim(),
      valorAtributo: valor.trim(),
      tipoAtributo: tipo,
      obrigatorio,
      origem,
    });
    setNome("");
    setValor("");
  }

  return (
    <div className="space-y-4">
      {atributos && atributos.length > 0 ? (
        <ul className="divide-y divide-white/[0.04] rounded-lg border border-white/5">
          {atributos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">
                  {a.nomeAtributo}: <span className="text-zinc-400">{a.valorAtributo || "—"}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <Badge tone="gray">{a.origem}</Badge>
                  {a.obrigatorio && <Badge tone="orange">obrigatório</Badge>}
                  <span>{a.tipoAtributo}</span>
                </p>
              </div>
              <button onClick={() => excluirAtributo(a.id)} title="Excluir atributo"
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compacto mensagem="Nenhum atributo cadastrado. Adicione a ficha técnica abaixo." />
      )}

      <form onSubmit={adicionar} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Novo atributo
        </p>
        <FormGrid>
          <Field label="Nome" required>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Material" />
          </Field>
          <Field label="Valor">
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: Couro sintético" />
          </Field>
          <Field label="Tipo">
            <Select options={TIPO_ATRIBUTO} value={tipo}
              onChange={(e) => setTipo(e.target.value as ProdutoAtributo["tipoAtributo"])} />
          </Field>
          <Field label="Origem">
            <Select options={ORIGEM_ATRIBUTO} value={origem}
              onChange={(e) => setOrigem(e.target.value as ProdutoAtributo["origem"])} />
          </Field>
        </FormGrid>
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
          Obrigatório no marketplace
        </label>
        <div className="mt-4">
          <Button type="submit"><Plus size={14} /> Adicionar atributo</Button>
        </div>
      </form>
    </div>
  );
}
