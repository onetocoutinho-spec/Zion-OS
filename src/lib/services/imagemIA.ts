// Geração de imagem por IA — orquestração no cliente (Fase 3.2).
//
// Chama /api/imagens/gerar (que detém a chave do Gemini), mostra o resultado e,
// se o cliente aprovar, salva a imagem gerada no Storage como uma nova foto do
// produto (reusa o upload existente).

import { trocarCapaDoProduto, uploadImagemProduto } from "./storageImagens";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import type { ImagemProduto } from "../types";

export type TipoGeracao = "melhorar" | "infografico";

export interface ResultadoGeracao {
  base64: string;
  mimeType: string;
  /** data URL pronto para <img src>. */
  dataUrl: string;
}

export async function gerarImagemProduto(opcoes: {
  imagemUrl: string;
  tipo: TipoGeracao;
  beneficios?: string;
  produtoNome?: string;
}): Promise<ResultadoGeracao> {
  const resposta = await fetch("/api/imagens/gerar", {
    method: "POST",
    // A rota exige sessao (`exigirAutenticado`) e esta chamada nunca a mandava:
    // o Estudio de imagem respondia "Nao autenticado" desde que a seguranca
    // entrou, em 22/07/2026. E a explicacao do "infograficos: 0" do DES-003 —
    // nao e que ninguem quis gerar, e que nao dava.
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify(opcoes),
  });
  const dados = (await resposta.json()) as {
    imagemBase64?: string;
    mimeType?: string;
    erro?: string;
    configurado?: boolean;
  };
  if (resposta.status === 503) {
    throw new Error(
      dados.erro ?? "A geração de imagem por IA não está configurada no servidor."
    );
  }
  if (!resposta.ok || !dados.imagemBase64) {
    throw new Error(dados.erro ?? "Não foi possível gerar a imagem.");
  }
  const mimeType = dados.mimeType ?? "image/png";
  return {
    base64: dados.imagemBase64,
    mimeType,
    dataUrl: `data:${mimeType};base64,${dados.imagemBase64}`,
  };
}

function base64ParaFile(base64: string, mimeType: string, nome: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], nome, { type: mimeType });
}

/** Salva a imagem gerada como uma nova foto do produto (Storage + registro). */
export async function salvarImagemGerada(opcoes: {
  clienteId: string;
  produtoId: string;
  base64: string;
  mimeType: string;
  tipo: TipoGeracao;
}): Promise<ImagemProduto> {
  const ext = opcoes.mimeType.includes("png") ? "png" : "jpg";
  const nome = `ia-${opcoes.tipo}-${Date.now()}.${ext}`;
  const file = base64ParaFile(opcoes.base64, opcoes.mimeType, nome);
  const comum = {
    clienteId: opcoes.clienteId,
    produtoId: opcoes.produtoId,
    file,
    observacoes: "Gerada por IA (a partir da foto real).",
  };
  // "Melhorar" é uma TROCA de capa, e agora diz isso. Antes inseria a capa nova
  // e deixava a tela rebaixar a antiga depois — uma ordem que exige um instante
  // com duas capas, e que a restrição de uma capa por produto reprova.
  return opcoes.tipo === "melhorar"
    ? trocarCapaDoProduto(comum)
    : uploadImagemProduto({ ...comum, tipo: "Infográfico" });
}
