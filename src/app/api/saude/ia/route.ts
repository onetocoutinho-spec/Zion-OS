// Qual IA está atendendo — e, se pedirem, o formato REAL da API que eu não alcanço.
//
// ===========================================================================
// DUAS FUNÇÕES, E A SEGUNDA É A QUE DESBLOQUEIA TRABALHO
// ===========================================================================
//
// GET sem parâmetro: o retrato do que está configurado. Puro, instantâneo,
// nenhuma rede. Responde a pergunta que nenhuma tela responde hoje — "a
// otimização que a lojista pediu foi feita por IA de verdade ou saiu
// `[SIMULAÇÃO]`?".
//
// GET com `?sondar=openai`: FAZ UMA CHAMADA REAL à OpenAI e devolve o que ela
// respondeu.
//
// Isso existe por um motivo específico e medido. O ambiente onde este código é
// escrito NÃO ALCANÇA `api.openai.com` nem `platform.openai.com` — os dois dão
// `http=000`, verificado em 05 e de novo em 06/08/2026. A Vercel alcança.
//
// A alternativa era escrever o caminho da OpenAI de memória, e isso já foi
// tentado neste projeto: os schemas das 17 ferramentas foram escritos em
// `type: "OBJECT"` (dialeto do Gemini), passaram por typecheck, passaram por
// teste, e só a API reclamaria. Foram corrigidos no mesmo dia, antes de chegar
// à lojista, por sorte.
//
// Então em vez de adivinhar o formato, esta rota vai LER o formato de onde a
// rede funciona. O que ela descobrir é o que vai ser escrito em
// `gerarImagemOpenAI` — verificado, não lembrado.
//
// ===========================================================================
// A SONDAGEM CUSTA DINHEIRO, ENTÃO ELA NÃO ACONTECE POR ACIDENTE
// ===========================================================================
//
// Três travas, e cada uma existe por uma razão diferente:
//
//   1. `?sondar=openai` EXPLÍCITO. Sem o parâmetro, zero rede. Um diagnóstico
//      que gasta ao ser aberto seria uma armadilha para quem o abre para
//      entender por que nada funciona.
//   2. Autenticação. Uma rota que consome crédito não pode ser anônima.
//   3. A sondagem começa pelo que é GRÁTIS: listar modelos (`GET /v1/models`).
//      Só isso já responde metade das perguntas — se a chave vale, e o nome do
//      modelo de imagem atual. A pergunta caríssima (máscara é obrigatória?) é
//      respondida pelo ERRO de uma chamada malformada, que também não custa
//      geração.
//
// NENHUMA IMAGEM É GERADA. A sondagem manda um pedido deliberadamente incompleto
// para o endpoint de edição e devolve a mensagem de erro — porque é o erro que
// diz quais campos são obrigatórios, e erro de validação não é cobrado.

import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { retratoDaIA, type AmbienteDaIA } from "@/modules/diagnostics/domain/saudeDaIA";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** O que a sondagem descobriu. Tudo opcional: falha parcial ainda informa. */
interface Sondagem {
  alcancou: boolean;
  /** HTTP da listagem de modelos. 401 = chave inválida; 200 = chave boa. */
  statusDosModelos?: number;
  /** Os modelos que parecem ser de imagem, pelo nome. */
  modelosDeImagem?: string[];
  /** O que a API respondeu a um pedido de edição SEM os campos obrigatórios. */
  erroDaEdicao?: string;
  /** O que fazer com isso, em uma frase. */
  leitura?: string;
  falha?: string;
}

export async function GET(request: Request) {
  try {
    await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  // O retrato NUNCA toca a rede. É o caminho normal desta rota.
  const retrato = retratoDaIA(process.env as AmbienteDaIA);

  const sondar = new URL(request.url).searchParams.get("sondar");
  if (sondar !== "openai") {
    return Response.json(retrato, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    { ...retrato, sondagem: await sondarOpenAI() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Pergunta à OpenAI o que ela é, sem gerar nada.
 *
 * Devolve `alcancou: false` em vez de lançar: uma sondagem que derruba a rota
 * de diagnóstico impede justamente o diagnóstico. Quem lê precisa saber a
 * diferença entre "a chave está errada" e "não deu para perguntar".
 */
async function sondarOpenAI(): Promise<Sondagem> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) {
    return { alcancou: false, falha: "OPENAI_API_KEY não está configurada neste servidor." };
  }

  const s: Sondagem = { alcancou: false };

  // ── 1. A chave vale? E qual é o modelo de imagem atual? (grátis) ──────────
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(12_000),
    });
    s.alcancou = true;
    s.statusDosModelos = r.status;
    if (r.ok) {
      const corpo = (await r.json().catch(() => ({}))) as { data?: { id?: string }[] };
      // Filtra pelo NOME porque a API não marca "isto gera imagem". É heurística
      // e está dito: o nome exato entra no código depois de alguém ler esta lista.
      s.modelosDeImagem = (corpo.data ?? [])
        .map((m) => m.id ?? "")
        .filter((id) => /image|dall/i.test(id))
        .sort();
    }
  } catch (e) {
    return {
      ...s,
      falha: `Não deu para falar com api.openai.com: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // ── 2. Máscara é obrigatória? Pergunta ao validador, não ao gerador ───────
  //
  // A PERGUNTA QUE DECIDE SE ESTE CAMINHO SERVE. `provedorImagem.ts` a registra
  // como o item que pode matar a ideia inteira: se a edição só funciona dentro
  // da região de uma máscara, este projeto não tem máscara, e inventar uma
  // mudaria o produto — que é o que aquele módulo existe para nunca fazer.
  //
  // Um corpo vazio recebe erro de validação, e o erro lista o que falta. Não
  // gera imagem, não é cobrado, e responde a pergunta.
  try {
    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}` },
      body: new FormData(),
      signal: AbortSignal.timeout(12_000),
    });
    const texto = await r.text().catch(() => "");
    s.erroDaEdicao = `HTTP ${r.status}: ${texto.slice(0, 600)}`;
    s.leitura =
      "Leia `erroDaEdicao`: os campos que ele exige são o formato real do endpoint de edição. " +
      "Se `mask` aparecer como obrigatório, o caminho da OpenAI NÃO serve para este projeto — " +
      "ver o cabeçalho de `lib/agentes/provedorImagem.ts`. Se `mask` for opcional, o caminho serve " +
      "e o que falta é escrever a chamada com estes campos.";
  } catch (e) {
    s.erroDaEdicao = `não deu para sondar a edição: ${e instanceof Error ? e.message : String(e)}`;
  }

  return s;
}
