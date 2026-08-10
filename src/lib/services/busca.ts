// Busca global simples: varre clientes, produtos, anúncios e agentes.
// Usa os próprios serviços de listagem, então funciona igualmente com
// Supabase ou com o modo demonstração local.

import { listarClientes } from "./clientes";
import { listarProdutos } from "./produtos";
import { listarResumoDeAnuncios } from "./anunciosGerados";
import { listarAgentes } from "./agentes";

export interface ResultadoBusca {
  tipo: "Cliente" | "Produto" | "Anúncio" | "Agente";
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

  const [clientes, produtos, anuncios, agentes] = await Promise.all([
    listarClientes(),
    listarProdutos(),
    listarResumoDeAnuncios(),
    listarAgentes(),
  ]);

  const resultados: ResultadoBusca[] = [];

  clientes.forEach((c) => {
    if (contem(c.empresa, termo) || contem(c.responsavel, termo) || contem(c.segmento, termo)) {
      resultados.push({
        tipo: "Cliente",
        titulo: c.empresa,
        descricao: `${c.segmento} · ${c.status}`,
        href: `/clientes/${c.id}`,
      });
    }
  });

  produtos.forEach((p) => {
    if (contem(p.nome, termo) || contem(p.sku, termo) || contem(p.marca, termo) || contem(p.cliente, termo)) {
      resultados.push({
        tipo: "Produto",
        titulo: p.nome,
        descricao: `${p.cliente} · ${p.sku}`,
        href: `/produtos/${p.id}`,
      });
    }
  });

  // O anuncio vive na esteira, e o resumo nao traz o JSONB do conteudo — entao
  // a busca casa pelo que a lista TEM: produto, loja e o id do ML. Procurar
  // dentro do titulo gerado exigiria puxar 1 MB de JSONB a cada tecla.
  anuncios.forEach((a) => {
    if (contem(a.produto, termo) || contem(a.cliente, termo) || contem(a.mlItemId, termo)) {
      resultados.push({
        tipo: "Anúncio",
        titulo: a.produto ?? a.mlItemId ?? "Anúncio sem produto vinculado",
        descricao: `${a.cliente} · ${a.marketplace} · nota ${a.notaDiagnostico}`,
        href: a.mlPermalink ?? `/clientes/${a.clienteId}`,
      });
    }
  });

  agentes.forEach((a) => {
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
