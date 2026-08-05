// Um catálogo em PDF entra; produtos para CONFERIR saem.
//
// ===========================================================================
// ESTA ROTA NÃO GRAVA NADA
// ===========================================================================
//
// Ela devolve `LinhaProduto[]` — exatamente a forma que a tela de conferência
// da planilha já consome e que `confirmarImportacaoProdutos` já sabe gravar,
// com variações e tudo. Quem grava é a lojista, clicando, depois de olhar.
//
// Não é excesso de zelo. Um catálogo de 90 páginas vira dezenas de produtos de
// uma vez; gravar direto significaria que um erro de leitura do modelo entra no
// catálogo em escala, e sai dele um a um, à mão. E o runbook do chat já
// estabeleceu qual é o caso que decide: não é o sucesso, é o modelo dizer que
// fez quando ainda não fez.
//
// ===========================================================================
// POR QUE A FILES API, E NÃO O PDF NO CORPO
// ===========================================================================
//
// O teto de 32 MB do base64 é da REQUISIÇÃO. O primeiro catálogo que chegou tem
// 272,6 MB — passa 8,5× disso. A Files API tem teto de 500 MB e devolve um id
// que serve para todas as chamadas seguintes sobre o mesmo documento, o que
// importa se a extração precisar de mais de uma passada.

import {
  chamarIAEstruturada,
  contarTokensDaChamada,
  enviarPdfParaIA,
  provedorConfigurado,
} from "@/lib/agentes/provedorIA";
import { chamadaDoCatalogo } from "@/lib/agentes/catalogoEmPdf";
import {
  linhasDoCatalogo,
  resumoDoCatalogo,
  type ProdutoLidoDoCatalogo,
} from "@/modules/catalog/domain/produtosDoCatalogo";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

// Ler 90 páginas e transcrever dezenas de produtos não cabe nos 30s das rotas
// de conversa. Este é o teto da plataforma; se um catálogo não couber nele, a
// resposta certa é fatiar por faixa de páginas — não aumentar o número.
export const maxDuration = 300;

const TAMANHO_MAXIMO = 500 * 1024 * 1024; // o teto da Files API

export async function POST(request: Request) {
  try {
    await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (provedorConfigurado() !== "anthropic") {
    // Específico de propósito: "nenhum provedor" e "o provedor configurado não
    // lê documento" são problemas diferentes, e mandam a pessoa a lugares
    // diferentes. Ver a recusa de anexo em `provedorIA`.
    return Response.json(
      { erro: "Ler catálogo em PDF exige o Claude. Configure ANTHROPIC_API_KEY no servidor." },
      { status: 503 }
    );
  }

  let arquivo: File | null = null;
  let instrucao = "";
  let apenasMedir = false;
  try {
    const form = await request.formData();
    const f = form.get("arquivo");
    arquivo = f instanceof File ? f : null;
    instrucao = String(form.get("instrucao") ?? "");
    apenasMedir = form.get("medir") === "1";
  } catch {
    return Response.json({ erro: "Envio inválido." }, { status: 400 });
  }

  if (!arquivo) return Response.json({ erro: "Anexe o catálogo em PDF." }, { status: 400 });
  if (arquivo.type && arquivo.type !== "application/pdf") {
    return Response.json({ erro: "O catálogo precisa ser um PDF." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return Response.json(
      { erro: "PDF acima de 500 MB. Reduza a resolução das imagens ou divida o catálogo." },
      { status: 413 }
    );
  }

  try {
    const fileId = await enviarPdfParaIA(arquivo);
    const chamada = chamadaDoCatalogo(fileId, instrucao);

    // Modo medir: conta os tokens de entrada e para. Existe porque descobrir o
    // custo de um catálogo TENTANDO é descobrir depois de pagar — e 90 páginas
    // a ~3 MB cada são muita imagem. O `fileId` volta junto: o arquivo já está
    // no ar, então a extração de verdade não precisa subi-lo de novo.
    if (apenasMedir) {
      const tokensEntrada = await contarTokensDaChamada(chamada);
      return Response.json({ medicao: { tokensEntrada }, fileId });
    }

    const { json, uso, modelo } = await chamarIAEstruturada(chamada);

    const lidos = (JSON.parse(json)?.produtos ?? []) as ProdutoLidoDoCatalogo[];
    const linhas = linhasDoCatalogo(lidos);

    return Response.json({
      linhas,
      resumo: resumoDoCatalogo(lidos, linhas),
      // O uso viaja porque uma extração de catálogo é a chamada mais cara que
      // este sistema faz, e "quanto custou" precisou de resposta antes (a
      // mesma pergunta que fez `UsoDeTokens` existir).
      uso,
      modelo,
      fileId,
    });
  } catch (e) {
    // A mensagem do provedor não vai na resposta: ela não ajuda quem subiu o
    // arquivo e às vezes carrega configuração do servidor. O erro real fica no
    // log do servidor, onde alguém pode lê-lo.
    console.error("[catalogo/extrair] falhou", e);
    return Response.json(
      { erro: "Não consegui ler este catálogo agora. Tente de novo em instantes." },
      { status: 502 }
    );
  }
}
