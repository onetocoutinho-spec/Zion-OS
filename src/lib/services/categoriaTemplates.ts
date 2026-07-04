import { criarRepositorio } from "../repositorio";
import { templateParaApp, templateParaBanco } from "../supabase/mappers";
import type { CategoriaTemplateRow } from "../supabase/database.types";
import type { CategoriaTemplate } from "../types";

const repo = criarRepositorio<CategoriaTemplate, CategoriaTemplateRow>({
  tabela: "categoria_templates",
  colecao: "categoriaTemplates",
  prefixoIdLocal: "tpl",
  selecao: "*",
  paraApp: templateParaApp,
  paraBanco: templateParaBanco,
});

export async function listarTemplates(): Promise<CategoriaTemplate[]> {
  return repo.listar();
}

export async function buscarTemplate(id: string): Promise<CategoriaTemplate | null> {
  return repo.buscar(id);
}

/** Template cujo categoria_zion casa (mesmo prefixo) com a categoria do produto. */
export async function templateParaCategoria(
  categoria: string
): Promise<CategoriaTemplate | null> {
  const todos = await repo.listar();
  const alvo = categoria.split(">")[0].trim().toLowerCase();
  return (
    todos.find((t) => t.categoriaZion.toLowerCase() === alvo) ??
    todos.find((t) => alvo.includes(t.categoriaZion.toLowerCase())) ??
    null
  );
}

export async function criarTemplate(
  dados: Omit<CategoriaTemplate, "id">
): Promise<CategoriaTemplate> {
  return repo.criar(dados);
}

export async function atualizarTemplate(
  id: string,
  dados: Partial<CategoriaTemplate>
): Promise<CategoriaTemplate | null> {
  return repo.atualizar(id, dados);
}
