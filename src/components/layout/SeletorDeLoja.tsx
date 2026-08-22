"use client";

// O SELETOR DE LOJA — a Lente (UX-010) materializada no painel.
//
// É o componente mais crítico da experiência da agência: responde "onde estou"
// e "como entro na loja X" sem sair do lugar. Requisitos que ele cumpre
// (docs/product/ux/03 §Contexto global; experience-specs §5):
//
//   * gatilho permanente no topo da sidebar: Agência (menor) ▸ Loja (maior);
//   * Ctrl/Cmd+K abre; busca com foco automático; setas, Enter, Esc;
//   * "Todas as lojas" é uma opção do próprio menu (volta ao portfólio);
//   * recentes no topo — a agência alterna entre poucas lojas por dia;
//   * estado de saúde ao lado do nome: o seletor também informa;
//   * ao trocar, a tela atual permanece (é só o contexto que muda).
//
// O lojista NUNCA vê este componente: a casca do portal não o monta.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Plus, Search, Store, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { Dialog } from "@/components/ui/Dialog";
import { EstadoDaLoja } from "@/components/ui/EstadoDaLoja";
import { useLojaAtual, type Loja } from "@/lib/contexto/LojaAtualProvider";
import { PESO_DA_SAUDE, saudeDaLoja } from "@/lib/contexto/saudeDaLoja";

const CHAVE_RECENTES = "zion.lojas.recentes";
const MAX_RECENTES = 4;
const BUSCA_A_PARTIR_DE = 8;

function lerRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function registrarRecente(id: string) {
  const lista = [id, ...lerRecentes().filter((x) => x !== id)].slice(0, MAX_RECENTES);
  localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista));
}

interface Props {
  /** O nome da agência (ou "Zion" para a equipe). `null` enquanto carrega. */
  nomeDaAgencia: string | null;
  /** Se quem olha pode criar lojas (equipe). */
  podeAdicionar: boolean;
}

export function SeletorDeLoja({ nomeDaAgencia, podeAdicionar }: Props) {
  const { lojaId, loja, lojas, definirLoja } = useLojaAtual();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recentes, setRecentes] = useState<string[]>([]);
  const campoBusca = useRef<HTMLInputElement>(null);

  const abrir = useCallback(() => {
    setRecentes(lerRecentes());
    setBusca("");
    setCursor(0);
    setAberto(true);
  }, []);
  const fechar = useCallback(() => setAberto(false), []);

  // Ctrl/Cmd+K em qualquer lugar do painel.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (aberto) fechar();
        else abrir();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, abrir, fechar]);

  useEffect(() => {
    if (aberto) campoBusca.current?.focus();
  }, [aberto]);

  const todas = useMemo(() => {
    const lista = (lojas ?? []).map((l) => ({ loja: l, saude: saudeDaLoja(l) }));
    lista.sort(
      (a, b) =>
        PESO_DA_SAUDE[a.saude.nivel] - PESO_DA_SAUDE[b.saude.nivel] ||
        a.loja.empresa.localeCompare(b.loja.empresa)
    );
    return lista;
  }, [lojas]);

  const termo = busca.trim().toLowerCase();
  const filtradas = termo ? todas.filter((x) => x.loja.empresa.toLowerCase().includes(termo)) : todas;
  const recentesVisiveis = termo
    ? []
    : recentes.map((id) => todas.find((x) => x.loja.id === id)).filter((x): x is NonNullable<typeof x> => !!x);

  // As opções na ordem em que aparecem — a mesma ordem do teclado.
  type Item =
    | { tipo: "secao"; rotulo: string }
    | { tipo: "portfolio"; indice: number }
    | { tipo: "loja"; indice: number; loja: Loja; saude: ReturnType<typeof saudeDaLoja> };
  const itens: Item[] = [];
  let n = 0;
  if (!termo) itens.push({ tipo: "portfolio", indice: n++ });
  if (recentesVisiveis.length > 0) {
    itens.push({ tipo: "secao", rotulo: "Recentes" });
    for (const x of recentesVisiveis) itens.push({ tipo: "loja", indice: n++, loja: x.loja, saude: x.saude });
  }
  if (!termo) itens.push({ tipo: "secao", rotulo: `Todas (${lojas?.length ?? 0})` });
  for (const x of filtradas) itens.push({ tipo: "loja", indice: n++, loja: x.loja, saude: x.saude });
  const selecionaveis = itens.filter((i) => i.tipo !== "secao");

  function escolher(item: Item) {
    if (item.tipo === "portfolio") definirLoja(null);
    else if (item.tipo === "loja") {
      registrarRecente(item.loja.id);
      definirLoja(item.loja.id);
    }
    fechar();
  }

  function aoTeclarNaBusca(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, selecionaveis.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && selecionaveis[cursor]) {
      e.preventDefault();
      escolher(selecionaveis[cursor]);
    }
  }

  const total = lojas?.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title="Trocar de loja (Ctrl+K)"
        className="flex w-full items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:border-white/15 hover:bg-white/[0.05] [@media(pointer:coarse)]:min-h-11"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] uppercase tracking-widest text-zinc-500">
            {nomeDaAgencia ?? <span className="inline-block h-2.5 w-20 animate-pulse rounded bg-white/10" />}
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {lojaId === null ? "Todas as lojas" : (loja?.empresa ?? "…")}
          </p>
        </div>
        <ChevronsUpDown size={15} className="shrink-0 text-zinc-500" />
      </button>

      <Dialog
        aberto={aberto}
        aoFechar={fechar}
        titulo="Trocar de loja"
        descricao={lojaId && loja ? `Operando ${loja.empresa}` : "Em visão de portfólio"}
        tamanho="sm"
      >
        <div className="p-2">
          {total >= BUSCA_A_PARTIR_DE || termo ? (
            <label className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-surface-input px-3 py-2 text-zinc-500 focus-within:border-violet-500/60">
              <Search size={14} />
              <input
                ref={campoBusca}
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={aoTeclarNaBusca}
                placeholder="Buscar loja…"
                aria-label="Buscar loja"
                className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
              />
            </label>
          ) : (
            // Com poucas lojas a busca não ajuda; o teclado continua valendo.
            <input
              ref={campoBusca}
              onKeyDown={aoTeclarNaBusca}
              aria-label="Navegar pelas lojas com as setas"
              className="sr-only"
              readOnly
            />
          )}

          <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto" role="listbox" aria-label="Lojas">
            {itens.map((item) => {
              if (item.tipo === "secao") {
                return (
                  <li key={`s-${item.rotulo}`} className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                    {item.rotulo}
                  </li>
                );
              }
              const ativo = item.indice === cursor;
              const selecionado = item.tipo === "portfolio" ? lojaId === null : item.loja.id === lojaId;
              return (
                <li key={item.tipo === "portfolio" ? "portfolio" : `${item.indice}-${item.loja.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(item.indice)}
                    onClick={() => escolher(item)}
                    aria-current={selecionado ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors [@media(pointer:coarse)]:min-h-11 ${
                      ativo ? "bg-violet-500/10 text-violet-200" : "text-zinc-300 hover:bg-white/5"
                    } ${selecionado ? "font-semibold" : ""}`}
                  >
                    {item.tipo === "portfolio" ? (
                      <>
                        <LayoutGrid size={15} className="shrink-0 text-zinc-500" />
                        <span className="flex-1">Todas as lojas</span>
                        <span className="text-[11px] text-zinc-500">portfólio</span>
                      </>
                    ) : (
                      <>
                        <EstadoDaLoja saude={item.saude} className="w-4 justify-center" />
                        <span className="flex-1 truncate">{item.loja.empresa}</span>
                        <span className="truncate text-[11px] text-zinc-500">{item.loja.status}</span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
            {filtradas.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-zinc-500">
                {lojas === null ? "Carregando lojas…" : termo ? `Nenhuma loja com “${busca}”.` : "Nenhuma loja ainda."}
              </li>
            )}
          </ul>

          {podeAdicionar && (
            <div className="mt-2 border-t border-white/5 pt-2">
              <Link
                href="/clientes/novo"
                onClick={fechar}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 [@media(pointer:coarse)]:min-h-11"
              >
                <Plus size={15} className="text-zinc-500" /> Adicionar loja
              </Link>
            </div>
          )}
          {!podeAdicionar && total === 0 && lojas !== null && (
            <p className="flex items-center gap-2 px-3 py-3 text-xs text-zinc-500">
              <Store size={13} /> Peça à Zion para vincular lojas à sua agência.
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
