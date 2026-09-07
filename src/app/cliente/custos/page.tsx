"use client";

// Custos da loja — varre o catálogo procurando o que está sem custo, o que
// tem fontes conflitantes e o que mudou. É comparação, então é tabela.
//
// Esta tela escreve APENAS em produtos.custo (+ margem/confiança derivadas) e
// produto_variantes.custo — nunca em anúncio, preço publicado ou marketplace.
// A escrita passa por /api/catalogo/custos, que exige acesso ao cliente antes
// de qualquer admin (ver o comentário da rota).

import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { EsqueletoDeTabela } from "@/components/ui/Skeleton";
import { useClientPortal } from "@/components/client-portal/context";
import { CustoEditavel } from "@/components/client-portal/CustoEditavel";
import { EscolhaDeCustoConflitante } from "@/components/client-portal/EscolhaDeCustoConflitante";
import { useLiveQuery } from "@/lib/hooks";
import { listarCustosDoCatalogo, definirOuResolverCusto } from "@/lib/services/custoPendencias";
import { escreverProcedencia } from "@/modules/catalog/domain/procedenciaDeCampo";
import type { EstadoDoCusto } from "@/modules/catalog/domain/custosDoCatalogo";
import { formatDateTime } from "@/lib/format";

const COLUNAS = ["Produto", "Custo", "Fonte", "Atualizado em", "Estado", "SKUs"];

const ROTULO_ESTADO: Record<EstadoDoCusto, string> = {
  ausente: "Ausente",
  confirmado: "Confirmado",
  conflito: "Em conflito",
};
const ESTADOS = Object.values(ROTULO_ESTADO);

export default function ClienteCustos() {
  const { clienteId } = useClientPortal();
  const consulta = useLiveQuery(() => listarCustosDoCatalogo(clienteId), [clienteId], {
    tabelas: ["produtos", "produto_variantes"],
  });
  const { data: linhas, estado, erro, reload, revalidando } = consulta;

  const [fEstado, setFEstado] = useState("Todos");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => linhas ?? [], [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((l) => {
      if (fEstado !== "Todos" && ROTULO_ESTADO[l.estado] !== fEstado) return false;
      if (q && !`${l.nome} ${l.sku}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lista, fEstado, busca]);

  const contagem = useMemo(() => {
    const c: Record<EstadoDoCusto, number> = { ausente: 0, confirmado: 0, conflito: 0 };
    for (const l of lista) c[l.estado]++;
    return c;
  }, [lista]);

  async function gravar(produtoId: string, valor: number) {
    const r = await definirOuResolverCusto({ clienteId, produtoId, valor });
    if (!r.ok) throw new Error(r.erro);
    reload();
  }

  if (estado === "carregando") {
    return (
      <>
        <PageHeader
          titulo="Custos da loja"
          subtitulo="O que está sem custo, o que tem fontes conflitantes e o que mudou."
        />
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <EsqueletoDeTabela colunas={COLUNAS.length} />
        </div>
      </>
    );
  }

  if (estado === "erro") {
    return (
      <>
        <PageHeader
          titulo="Custos da loja"
          subtitulo="O que está sem custo, o que tem fontes conflitantes e o que mudou."
        />
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-200">
          <p className="font-medium">Não consegui carregar os custos do catálogo.</p>
          <p className="mt-1 text-amber-200/70">
            Isto é uma falha nossa ao buscar os dados — não significa que os custos sumiram.
          </p>
          <p className="mt-2 text-xs text-amber-200/50">{erro?.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-md border border-amber-400/30 px-2.5 py-1 text-xs transition hover:bg-amber-400/10"
          >
            Tentar de novo
          </button>
        </div>
      </>
    );
  }

  if (estado === "vazio") {
    return (
      <>
        <PageHeader
          titulo="Custos da loja"
          subtitulo="O que está sem custo, o que tem fontes conflitantes e o que mudou."
        />
        <VazioAmigavel
          icon={Package}
          titulo="Sem produtos no catálogo"
          descricao="Importe seu catálogo para começar a acompanhar os custos — o que falta, o que está confirmado e o que tem fontes discordando."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Custos da loja"
        subtitulo="O que está sem custo, o que tem fontes conflitantes e o que mudou. Custo em conflito não entra em nenhuma conta até alguém decidir."
      />

      <div className={revalidando ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-input px-2.5 py-1.5 text-zinc-500 focus-within:border-violet-500/50">
            <Search size={14} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto…"
              className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-500"
            />
          </div>
          <FilterSelect label="Estado" value={fEstado} options={ESTADOS} onChange={setFEstado} />
          <span className="ml-auto text-xs text-zinc-500">
            {contagem.conflito > 0 && <span className="text-red-400">{contagem.conflito} em conflito · </span>}
            {contagem.ausente > 0 && <span className="text-amber-400">{contagem.ausente} sem custo · </span>}
            {filtradas.length} de {lista.length}
          </span>
        </div>

        <Table headers={COLUNAS}>
          {filtradas.length === 0 ? (
            <EmptyRow colSpan={COLUNAS.length} />
          ) : (
            filtradas.map((l) => (
              <tr key={l.produtoId} className="hover:bg-white/[0.02]">
                <TdMain sub={l.sku || undefined}>{l.nome}</TdMain>
                <Td>
                  {l.estado === "conflito" ? (
                    <EscolhaDeCustoConflitante
                      nome={l.nome}
                      precoVenda={l.precoVenda}
                      candidatos={l.candidatos ?? []}
                      onEscolher={(valor) => gravar(l.produtoId, valor)}
                    />
                  ) : (
                    <CustoEditavel
                      nome={l.nome}
                      custo={l.custo}
                      precoVenda={l.precoVenda}
                      onGravar={(valor) => gravar(l.produtoId, valor)}
                    />
                  )}
                </Td>
                <Td className="text-zinc-500">
                  {l.estado === "conflito" ? (
                    <span className="text-amber-400/80">aguardando decisão</span>
                  ) : (
                    <span title={l.fonte.ator ? `Por ${l.fonte.ator}` : undefined}>
                      {escreverProcedencia(l.fonte)}
                    </span>
                  )}
                </Td>
                <Td className="text-zinc-500">{formatDateTime(l.atualizadoEm, { comHora: false })}</Td>
                <Td>
                  <Pill tone={l.estado === "ausente" ? "yellow" : l.estado === "conflito" ? "red" : "green"}>
                    {ROTULO_ESTADO[l.estado]}
                  </Pill>
                </Td>
                <Td className="text-zinc-500">
                  {l.skusHerdando > 0 ? `${l.skusHerdando} variação(ões)` : "—"}
                </Td>
              </tr>
            ))
          )}
        </Table>

        <p className="text-xs leading-relaxed text-zinc-500">
          O custo é do <span className="text-zinc-400">produto</span>, e vale para todas as suas
          variações — hoje não existe exceção por SKU. Quando duas ou mais fontes discordam do custo
          de um produto, ele fica <span className="text-red-400">em conflito</span> e esse valor não é
          usado em nenhuma conta de margem ou preço até alguém escolher.
        </p>
      </div>
    </>
  );
}
