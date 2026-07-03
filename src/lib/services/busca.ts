// Busca global simples: varre clientes, produtos, anúncios, tarefas e agentes.

import { listAll } from "../store";
import type { AgenteIA, Anuncio, Cliente, Produto, Tarefa } from "../types";

export interface ResultadoBusca {
  tipo: "Cliente" | "Produto" | "Anúncio" | "Tarefa" | "Agente";
  titulo: string;
  descricao: string;
  href: string;
}

function contem(texto: string | null | undefined, termo: string): boolean {
  return (texto ?? "").toLowerCase().includes(termo);
}

export async function buscarGlobal(consulta: string): Promise<ResultadoBusca[]> {
  const termo = consulta.trim().toLowerCase();
  if (termo.length < 2) return [];

  const resultados: ResultadoBusca[] = [];

  listAll<Cliente>("clientes").forEach((c) => {
    if (contem(c.empresa, termo) || contem(c.responsavel, termo) || contem(c.segmento, termo)) {
      resultados.push({
        tipo: "Cliente",
        titulo: c.empresa,
        descricao: `${c.segmento} · ${c.status}`,
        href: `/clientes/${c.id}`,
      });
    }
  });

  listAll<Produto>("produtos").forEach((p) => {
    if (contem(p.nome, termo) || contem(p.sku, termo) || contem(p.marca, termo) || contem(p.cliente, termo)) {
      resultados.push({
        tipo: "Produto",
        titulo: p.nome,
        descricao: `${p.cliente} · ${p.sku}`,
        href: `/produtos/${p.id}`,
      });
    }
  });

  listAll<Anuncio>("anuncios").forEach((a) => {
    if (contem(a.produto, termo) || contem(a.tituloAtual, termo) || contem(a.tituloOtimizado, termo) || contem(a.cliente, termo)) {
      resultados.push({
        tipo: "Anúncio",
        titulo: a.produto,
        descricao: `${a.cliente} · ${a.marketplace} · ${a.statusPublicacao}`,
        href: `/anuncios/${a.id}`,
      });
    }
  });

  listAll<Tarefa>("tarefas").forEach((t) => {
    if (contem(t.tarefa, termo) || contem(t.cliente, termo) || contem(t.responsavel, termo)) {
      resultados.push({
        tipo: "Tarefa",
        titulo: t.tarefa,
        descricao: `${t.cliente} · ${t.status} · ${t.responsavel}`,
        href: `/tarefas/${t.id}/editar`,
      });
    }
  });

  listAll<AgenteIA>("agentes").forEach((a) => {
    if (contem(a.nome, termo) || contem(a.area, termo) || contem(a.objetivo, termo)) {
      resultados.push({
        tipo: "Agente",
        titulo: a.nome,
        descricao: `${a.area} · ${a.statusImplantacao}`,
        href: `/agentes/${a.id}`,
      });
    }
  });

  return resultados;
}
