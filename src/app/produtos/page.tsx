"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Upload, ChevronDown, Users, ClipboardList, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FiltroDeLoja } from "@/components/ui/FiltroDeLoja";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { Table, Td, TdMain } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EsqueletoDeTabela } from "@/components/ui/Skeleton";
import { CADASTRO_STATUS, PRIORIDADES } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { gerarAuditoriasDaBase } from "@/lib/services/auditoriaDaBase";
import { formatBRL } from "@/lib/format";
import type { Produto } from "@/lib/types";

const HEADERS = [
  "Produto",
  "SKU",
  "Custo",
  "Preço",
  "Estoque",
  "Cadastro",
  "SEO",
  "Descrição",
  "Imagens",
  "Preço OK",
  "Prioridade",
];

export default function ProdutosPage() {
  const [status, setStatus] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todos");
  // A loja vem do contexto global (cookie + ?loja=), não de um estado local.
  const { lojaId } = useLojaAtual();
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [auditando, setAuditando] = useState<string | null>(null);
  // Sucesso e falha em estados SEPARADOS. Antes era uma string só, e "Falha ao
  // auditar" aparecia em verde com o ícone de check — a pessoa lia "deu certo".
  const [msgAuditoria, setMsgAuditoria] = useState<string | null>(null);
  const [erroAuditoria, setErroAuditoria] = useState<string | null>(null);
  const { data: produtos, carregando } = useLiveQuery(listarProdutos);

  async function auditarBase(nome: string, itens: Produto[]) {
    if (auditando || itens.length === 0) return;
    setAuditando(nome);
    setMsgAuditoria(null);
    setErroAuditoria(null);
    try {
      const r = await gerarAuditoriasDaBase(itens[0].clienteId, nome);
      setMsgAuditoria(
        r.auditados === 0
          ? `${nome}: nada novo a auditar (${r.pulados} produtos já auditados).`
          : `${nome}: ${r.auditados} produtos auditados · ${r.criticas} críticos · ${r.altas} alta prioridade · ${r.problemas} problemas mapeados.`
      );
    } catch (e) {
      setErroAuditoria(
        e instanceof Error ? `Falha ao auditar ${nome}: ${e.message}` : `Falha ao auditar ${nome}.`
      );
    } finally {
      setAuditando(null);
    }
  }

  const lojasComProduto = [...new Set((produtos ?? []).map((p) => p.clienteId))];

  const filtrados = (produtos ?? []).filter(
    (p) =>
      (status === "Todos" || p.statusCadastro === status) &&
      (prioridade === "Todos" || p.prioridade === prioridade) &&
      (!lojaId || p.clienteId === lojaId)
  );

  // Agrupa por cliente (ordem alfabética)
  const grupos = useMemo(() => {
    const map = new Map<string, Produto[]>();
    filtrados.forEach((p) => {
      const arr = map.get(p.cliente) ?? [];
      arr.push(p);
      map.set(p.cliente, arr);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtrados]);

  function toggle(nome: string) {
    setColapsados((prev) => {
      const n = new Set(prev);
      if (n.has(nome)) n.delete(nome);
      else n.add(nome);
      return n;
    });
  }

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Base de produtos por cliente. Cada cliente tem sua própria base para iniciar o cadastramento nos marketplaces."
        count={filtrados.length}
        countLabel="produtos"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FiltroDeLoja apenasIds={lojasComProduto} />
          <FilterSelect label="Cadastro" value={status} options={CADASTRO_STATUS} onChange={setStatus} />
          <FilterSelect label="Prioridade" value={prioridade} options={PRIORIDADES} onChange={setPrioridade} />
        </div>
        <div className="flex gap-2">
          <LinkButton href="/produtos/importar" variant="ghost">
            <Upload size={14} /> Importar base
          </LinkButton>
          <LinkButton href="/produtos/novo">
            <Plus size={14} /> Novo produto
          </LinkButton>
        </div>
      </div>

      {/* role="alert"/"status": o resultado nasce longe do botão que o disparou
          (o botão fica no cabeçalho de cada grupo, às vezes fora da tela), então
          o leitor de tela precisa ANUNCIAR, não esperar que a pessoa ache. */}
      {erroAuditoria && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={15} /> {erroAuditoria}
          </span>
          <span className="text-xs text-amber-200/60">
            Tente de novo pelo botão &ldquo;Auditar base&rdquo; do grupo.
          </span>
        </div>
      )}

      {msgAuditoria && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 size={15} /> {msgAuditoria}
          </span>
          <LinkButton href="/auditoria-massa" variant="ghost" className="px-2 py-1 text-xs">
            Abrir Auditoria em Massa
          </LinkButton>
        </div>
      )}

      {carregando && !produtos && (
        // Esqueleto em vez de tela vazia: sem isto, cabeçalho e filtros apareciam
        // e o resto ficava em branco até a lista chegar.
        <div aria-busy="true" className="rounded-lg border border-white/5 p-4">
          <EsqueletoDeTabela colunas={6} linhas={6} />
        </div>
      )}

      {produtos && grupos.length === 0 && (
        <EmptyState
          mensagem="Nenhum produto encontrado com os filtros atuais."
          acaoLabel="Importar base de um cliente"
          acaoHref="/produtos/importar"
        />
      )}

      <div className="space-y-5">
        {grupos.map(([nome, itens]) => {
          const aberto = !colapsados.has(nome);
          const estoqueTotal = itens.reduce((s, p) => s + p.estoque, 0);
          return (
            <section key={nome}>
              <div className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2 transition-colors hover:bg-white/[0.05]">
                <button
                  type="button"
                  aria-expanded={aberto}
                  onClick={() => toggle(nome)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5 text-left [@media(pointer:coarse)]:min-h-11"
                >
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-zinc-500 transition-transform ${aberto ? "" : "-rotate-90"}`}
                  />
                  <Users size={15} className="shrink-0 text-violet-400" />
                  <span className="truncate text-sm font-semibold text-zinc-100">{nome}</span>
                  <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-xs text-zinc-400">
                    {itens.length} {itens.length === 1 ? "produto" : "produtos"}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-zinc-500 sm:inline">{estoqueTotal} em estoque</span>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => auditarBase(nome, itens)}
                    disabled={auditando !== null}
                    title="Gera a Auditoria em Massa direto desta base (cold-start)"
                  >
                    <ClipboardList size={13} />
                    {auditando === nome ? "Auditando…" : "Auditar base"}
                  </Button>
                </div>
              </div>

              {aberto && (
                <Table headers={HEADERS}>
                  {itens.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      {/* TdMain, não <td> cru: esta célula tinha `whitespace-nowrap` no
                          nome — justamente o que TdMain removeu para a tabela parar
                          de rolar na horizontal com nomes longos. */}
                      <TdMain sub={`${p.marca} · ${p.modelo}`}>
                        <Link
                          href={`/produtos/${p.id}`}
                          className="inline-flex items-center hover:text-violet-300 [@media(pointer:coarse)]:min-h-11"
                        >
                          {p.nome}
                        </Link>
                      </TdMain>
                      <Td className="whitespace-nowrap font-mono text-xs">{p.sku}</Td>
                      <Td className="whitespace-nowrap">{formatBRL(p.custo)}</Td>
                      <Td className="whitespace-nowrap text-zinc-200">{formatBRL(p.precoVenda)}</Td>
                      <Td>{p.estoque}</Td>
                      <Td><Badge>{p.statusCadastro}</Badge></Td>
                      <Td><Badge>{p.statusSeo}</Badge></Td>
                      <Td><Badge>{p.statusDescricao}</Badge></Td>
                      <Td><Badge>{p.statusImagens}</Badge></Td>
                      <Td><Badge>{p.statusPrecificacao}</Badge></Td>
                      <Td><Badge>{p.prioridade}</Badge></Td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
