import { criarRepositorio } from "../repositorio";
import { anuncioGeradoParaApp, anuncioGeradoParaBanco } from "../supabase/mappers";
import type { AnuncioGeradoRow } from "../supabase/database.types";
import type { AnuncioGeradoRegistro, StatusAnuncioGerado } from "../types";

const repo = criarRepositorio<AnuncioGeradoRegistro, AnuncioGeradoRow>({
  tabela: "anuncios_gerados",
  colecao: "anunciosGerados",
  prefixoIdLocal: "ang",
  selecao: "*, clientes(empresa), produtos(nome)",
  paraApp: anuncioGeradoParaApp,
  paraBanco: anuncioGeradoParaBanco,
});

export const ROTULO_STATUS_ANUNCIO_GERADO: Record<StatusAnuncioGerado, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  publicado: "Publicado",
};

export async function listarAnunciosGerados(): Promise<AnuncioGeradoRegistro[]> {
  return repo.listar();
}

export async function listarAnunciosGeradosDoCliente(
  clienteId: string
): Promise<AnuncioGeradoRegistro[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function buscarAnuncioGerado(
  id: string
): Promise<AnuncioGeradoRegistro | null> {
  return repo.buscar(id);
}

export async function criarAnuncioGerado(
  dados: Omit<AnuncioGeradoRegistro, "id">
): Promise<AnuncioGeradoRegistro> {
  return repo.criar(dados);
}

export async function atualizarAnuncioGerado(
  id: string,
  dados: Partial<AnuncioGeradoRegistro>
): Promise<AnuncioGeradoRegistro | null> {
  return repo.atualizar(id, dados);
}

/** Aprova (trava humana): só chame quando o A10 aprovou e não há pendências. */
export async function aprovarAnuncioGerado(
  id: string,
  aprovadoPor = ""
): Promise<AnuncioGeradoRegistro | null> {
  return repo.atualizar(id, {
    status: "aprovado",
    aprovadoPor,
    aprovadoEm: new Date().toISOString(),
  });
}

export async function rejeitarAnuncioGerado(
  id: string,
  motivo = ""
): Promise<AnuncioGeradoRegistro | null> {
  return repo.atualizar(id, {
    status: "rejeitado",
    observacoes: motivo,
  });
}

/** Fase 2 marcará como publicado após o envio via API do marketplace. */
export async function marcarAnuncioPublicado(
  id: string
): Promise<AnuncioGeradoRegistro | null> {
  return repo.atualizar(id, { status: "publicado" });
}

export async function excluirAnuncioGerado(id: string): Promise<void> {
  return repo.excluir(id);
}