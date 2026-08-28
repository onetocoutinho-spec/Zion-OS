// O ensaio tem que atravessar tudo que decide a recusa.
//
// ===========================================================================
// O DEFEITO, ACHADO EM 28/08/2026
// ===========================================================================
//
// `go: false` é o ensaio: monta e valida sem publicar. Era a guarda 3 do plano
// da loja nova — "sem conta ML de teste, o passo 7 para no dry-run, o payload
// montado sem enviar" — e portanto a ÚNICA medição do passo 7 possível hoje.
//
// Só que ele retornava cedo demais. A ordem era:
//
//     4)   if (!corpo.go) return { dry: true }      <- saía aqui
//     4.5) obrigatoriosAusentes(...)  -> 422        <- nunca chegava
//     5)   criarItem(...)                           <- publica
//
// Credencial e categoria conferidas, `dry: true` devolvido — e o anúncio seria
// recusado pelo ML por atributo obrigatório faltando. Um ensaio que aprova o
// que o real reprova responde a uma pergunta que ninguém fez.
//
// Agora a saída do ensaio fica DEPOIS da conferência e ANTES de `criarItem`: a
// única linha do fluxo que escreve no Mercado Livre.
//
// ===========================================================================
// POR QUE ESTE TESTE LÊ O ARQUIVO
// ===========================================================================
//
// A ordem entre três trechos é o que está sendo guardado, e ela não aparece no
// retorno da função: um ensaio que saísse cedo devolveria `dry: true` do mesmo
// jeito — a resposta certa pela razão errada. Exercitar o fluxo pediria simular
// token, canal, categoria e rede; o que se quer provar é mais simples e mais
// durável que isso. Mesmo idioma de `publicarNoChat.test.ts`.
//
// Rodar: npx tsx --test src/modules/integration/application/oEnsaioMedeOQueORealRecusa.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./publicarNoMercadoLivre.ts", import.meta.url), "utf8");

// SÃO DOIS FLUXOS, cada um com a sua saída de ensaio e a sua escrita. O User
// Products vem primeiro no arquivo e o clássico depois, então "primeiro" e
// "último" bastam para separá-los — e a primeira versão deste teste comparou a
// saída do clássico com a escrita do OUTRO fluxo, e reprovou com razão.
const saidaDoEnsaioUserProducts = FONTE.indexOf("if (!corpo.go)");
const saidaDoEnsaioClassico = FONTE.lastIndexOf("if (!corpo.go)");
const conferenciaDosObrigatorios = FONTE.indexOf("obrigatoriosAusentes(");
const escritaUserProducts = FONTE.indexOf("await criarItem(");
const escritaClassica = FONTE.lastIndexOf("await criarItem(");

test("o ensaio sai DEPOIS da conferência de obrigatórios", () => {
  assert.ok(conferenciaDosObrigatorios > 0, "sumiu a conferência de obrigatórios");
  assert.ok(saidaDoEnsaioClassico > 0, "sumiu a saída do ensaio");
  assert.ok(
    saidaDoEnsaioClassico > conferenciaDosObrigatorios,
    "o ensaio voltou a sair antes de `obrigatoriosAusentes` — ele aprovaria o que o " +
      "Mercado Livre recusa, e é a única medição do passo 7 que existe sem conta de teste"
  );
});

test("e ANTES de criar o item — ensaio não escreve, nos DOIS fluxos", () => {
  assert.ok(escritaUserProducts > 0 && escritaClassica > escritaUserProducts, "sumiu `criarItem`");
  assert.ok(
    saidaDoEnsaioClassico < escritaClassica,
    "a saída do ensaio clássico passou de `criarItem`: um ensaio publicaria de verdade"
  );
  assert.ok(
    saidaDoEnsaioUserProducts < escritaUserProducts,
    "a saída do ensaio User Products passou de `criarItem`: um ensaio publicaria de verdade"
  );
});

test("o cadastro é consultado ANTES da recusa", () => {
  // Medido em 28/08: 500 dos 793 publicáveis seriam recusados por atributo, e
  // em 497 a resposta estava em `produto_atributos`. Recusar antes de perguntar
  // ao banco é recusar por um dado que o sistema tem.
  const perguntaAoCadastro = FONTE.indexOf("doCadastroParaOPayload(");
  const recusa = FONTE.indexOf("explicarAusentes(");
  assert.ok(perguntaAoCadastro > 0, "sumiu o preenchimento pelo cadastro");
  assert.ok(recusa > 0, "sumiu a recusa");
  assert.ok(
    perguntaAoCadastro < recusa,
    "a recusa voltou a vir antes de perguntar ao cadastro"
  );
});

test("a resposta diz QUAL pergunta ela respondeu", () => {
  // O caminho User Products sai antes da conferência, porque o caminho REAL
  // dele também não confere. Os dois ensaios não valem o mesmo, e quem conta
  // precisa distinguir sem ler este arquivo.
  assert.match(FONTE, /obrigatoriosConferidos: true/);
  assert.match(FONTE, /obrigatoriosConferidos: false/);

  const conferidoNoClassico = FONTE.indexOf("obrigatoriosConferidos: true");
  assert.ok(
    conferidoNoClassico > conferenciaDosObrigatorios,
    "o `true` está antes da conferência que o justifica"
  );
});
