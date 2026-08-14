import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// O CAMINHO FALSIFICADO NÃO PODE VOLTAR A SER CLICÁVEL.
//
// ===========================================================================
// O QUE FOI MEDIDO, E POR QUE O CÓDIGO FICOU
// ===========================================================================
//
// "Ajustar capa" completava as laterais da foto com branco para deixá-la
// quadrada. Falsificado em 03/08/2026 por dois motivos independentes:
//
//   1. o Mercado Livre REPROCESSA a imagem e apara a faixa branca — enviamos
//      1200x1200 e ele guardou 1062x1200;
//   2. a regra dele é "tamanho mínimo, POSIÇÃO E PROPORÇÃO do produto na
//      foto", e a faixa deixa o produto MENOR — piorando exatamente o
//      critério cobrado.
//
// Cada clique, então, acrescentava uma foto ao anúncio e piorava a capa.
//
// O código e os 19 testes ficaram no repositório de propósito: o registro do
// que foi tentado e falsificado vale mais que o espaço que ocupa. O que não
// pode ficar é o caminho ABERTO.
//
// ===========================================================================
// POR QUE UMA SENTINELA, SE JÁ ESTÁ ATRÁS DE `{false && ...}`
// ===========================================================================
//
// Porque `{false &&` é uma tranca de uma tecla. Quem encontrar aquele bloco
// daqui a três meses lê um botão pronto, um `title` convincente e uma guarda
// que parece sobra de depuração — e reativa em segundos, sem ler o comentário
// acima dele. A medição que custou uma tarde não pode depender disso.
//
// Em 14/08/2026 eu mesmo li a chamada e o JSX, não vi a guarda, e relatei ao
// dono que a lojista tinha um botão vivo piorando a loja. Estava errado. Se um
// leitor atento erra a leitura, um leitor apressado erra a edição.

const RAIZ = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function telas(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) telas(caminho, achados);
    else if (/\.tsx$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

test("nenhuma tela oferece 'quadrar a capa' — o caminho segue desligado", () => {
  const vivos: string[] = [];
  for (const caminho of telas(RAIZ)) {
    const fonte = readFileSync(caminho, "utf8");
    if (!/quadrar\(|quadrarCapaNoML\(/.test(fonte)) continue;
    // A chamada pode existir (a função ficou, com o registro). O que não pode
    // é um `onClick` alcançável. A guarda `{false &&` tem que estar ANTES do
    // botão, no mesmo bloco.
    const iBotao = fonte.indexOf("onClick={() => quadrar(");
    if (iBotao < 0) continue;
    const antes = fonte.slice(Math.max(0, iBotao - 400), iBotao);
    if (!/\{false && /.test(antes)) vivos.push(caminho.slice(caminho.indexOf("src")));
  }
  assert.deepEqual(
    vivos,
    [],
    "o botão de quadrar capa voltou a ser clicável — o ML apara a faixa branca e " +
      "o produto fica MENOR, piorando o critério que ele cobra"
  );
});

test("o motivo fica JUNTO da tranca — quem for reativar lê antes", () => {
  // Uma guarda sem o porquê ao lado é uma guarda que alguém remove achando que
  // é sobra de depuração.
  const pagina = readFileSync(join(RAIZ, "cliente", "anuncios", "page.tsx"), "utf8");
  const i = pagina.indexOf("{false && a.mlItemId");
  assert.ok(i > 0, "a tranca do botão de quadrar capa mudou de forma");
  const acima = pagina.slice(Math.max(0, i - 500), i);
  assert.match(acima, /DESLIGADO/, "sumiu o aviso de que está desligado de propósito");
  assert.match(acima, /faixa branca/, "sumiu o MOTIVO — sem ele a tranca não se defende");
});
