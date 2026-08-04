// Toda chamada a uma rota que EXIGE sessão manda o cabeçalho de sessão.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// 04/08/2026, na tela de Fotos da lojista: **"Não autenticado."** em vermelho,
// no Estúdio de imagem. A rota `/api/imagens/gerar` chama `exigirAutenticado`
// e a chamada do cliente mandava só `Content-Type`.
//
// O defeito estava lá desde 22/07/2026, quando a autorização server-side
// entrou (PR-002). Três meses de um botão que nunca funcionou — e ninguém viu,
// porque o erro só aparece para quem clica, e quem clicava era a lojista.
//
// Fui varrer e não era um: eram TRÊS.
//
//   /api/imagens/gerar     → Estúdio de imagem, "melhorar capa" e "infográfico"
//   /api/agentes/executar  → toda ferramenta de /cliente/otimizar
//   /api/agentes/executar  → o executor do painel da equipe
//
// A terceira é a que dói: `cadeiaEsteira.ts` chama a MESMA rota, COM o
// cabeçalho. Três caminhos para o mesmo endpoint, e só um acertava.
//
// Isso também explica um número que estava no DES-003 como observação neutra:
// **"infográficos: 0"**. Não é que ninguém quis gerar — é que não dava.
//
// ===========================================================================
// POR QUE UM TESTE ESTRUTURAL, E NÃO "LEMBRAR"
// ===========================================================================
//
// A falta não aparece em tipo, não aparece em lint e não aparece em teste de
// unidade: o `fetch` está sintaticamente perfeito. Só aparece em runtime, para
// quem clica, com uma mensagem que parece problema de login do usuário.
//
// A varredura abaixo é a mesma que fiz à mão, virada teste — ela lê as rotas,
// descobre quais exigem sessão, e confere quem as chama.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const APP_API = `${RAIZ}app/api/`;

/** Todo arquivo `.ts`/`.tsx` de `src`, menos os próprios testes. */
function fontes(): string[] {
  return readdirSync(RAIZ, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => `${RAIZ}${f}`);
}

/** As rotas que chamam `exigir*` — isto é, que recusam quem não tem sessão. */
function rotasQueExigemSessao(): Set<string> {
  const exigem = new Set<string>();
  for (const arq of readdirSync(APP_API, { recursive: true, encoding: "utf8" })) {
    if (!arq.endsWith("route.ts")) continue;
    const conteudo = readFileSync(`${APP_API}${arq}`, "utf8");
    // `exigirAutenticado`, `exigirAcessoAoCliente`, `exigirEquipe`, `exigirCliente`.
    // A chamada, não o import: importar sem usar não protege nada.
    if (/await exigir[A-Z]\w*\(/.test(conteudo)) {
      exigem.add(`/api/${arq.replace(/[/\\]route\.ts$/, "").replace(/\\/g, "/")}`);
    }
  }
  return exigem;
}

test("as rotas protegidas foram encontradas — senão este teste não prova nada", () => {
  assert.ok(existsSync(APP_API), "o diretório de rotas mudou de lugar");
  const rotas = rotasQueExigemSessao();
  assert.ok(rotas.size >= 10, `esperava ao menos 10 rotas protegidas, achei ${rotas.size}`);
  // Âncoras: se estas três deixarem de exigir sessão, é outra conversa — e ela
  // precisa acontecer aqui, não passar batido.
  for (const r of ["/api/imagens/gerar", "/api/agentes/executar", "/api/ml/publicar"]) {
    assert.ok(rotas.has(r), `"${r}" parou de exigir sessão`);
  }
});

test("quem chama rota protegida manda o cabeçalho de sessão", () => {
  const protegidas = rotasQueExigemSessao();
  const faltando: string[] = [];

  for (const arq of fontes()) {
    // Sem comentários. A primeira versão deste teste acusou
    // `diagnostico-guias/route.ts` de chamar a si mesma sem sessão — e o
    // `fetch` estava dentro de um exemplo de uso, em comentário. Casar com
    // prosa é o mesmo defeito que o teste da guarda de nome já tinha cometido
    // hoje: o instrumento erra antes da tela.
    const conteudo = readFileSync(arq, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const chamadas = [...conteudo.matchAll(/fetch\(\s*["'`](\/api\/[^"'`?]+)/g)].map((m) => m[1]);
    const paraProtegida = chamadas.filter((r) => protegidas.has(r.replace(/\/+$/, "")));
    if (paraProtegida.length === 0) continue;
    // A conferência é por ARQUIVO, não por chamada: o helper é assíncrono e
    // pode estar numa variável, num spread ou num objeto montado antes. Provar
    // a ligação exata exigiria interpretar o código; o que se quer aqui é que
    // ninguém escreva um `fetch` para rota protegida num arquivo que não sabe
    // o que é sessão.
    if (!conteudo.includes("cabecalhoAutenticacao")) {
      faltando.push(`${arq.slice(RAIZ.length)} → ${[...new Set(paraProtegida)].join(", ")}`);
    }
  }

  assert.deepEqual(
    faltando,
    [],
    `chamada a rota protegida sem cabeçalho de sessão — vai responder "Não autenticado" para quem clicar:\n  ${faltando.join("\n  ")}`
  );
});
