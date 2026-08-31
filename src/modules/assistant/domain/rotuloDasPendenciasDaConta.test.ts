import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Número sem significado ao lado é convite à leitura errada — e o modelo lê o
// NOME DO CAMPO como se fosse a definição dele.
//
// ===========================================================================
// Medido em produção em 11/08/2026, na primeira pergunta feita à ferramenta
// ===========================================================================
//
// O campo nasceu `quantos`. O modelo montou a tabela com a coluna "Infrações"
// e escreveu, para o Chinelo Havaianas Top Liso, 40.
//
//   40 anúncios COM infração          ← o que o campo contava (certo)
//   97 infrações naquele produto      ← o que a coluna dizia (errado)
//
// Somando a coluna, ele anunciou "419 infrações" numa conta que tem 1.066.
// Nenhum número foi inventado: o rótulo é que estava ausente.
//
// É a mesma lição que `contar` já tinha aprendido nesta base — lá, sem o
// `significado` ao lado, o modelo recebeu `{quantos: 0, total: 80}` e escreveu
// "0 dos seus 80 produtos têm anúncio gerado", o oposto da verdade, com a
// frase certa disponível ao lado.

const FONTE = readFileSync(
  new URL("./executarFerramenta.ts", import.meta.url),
  "utf8"
);
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^\s*\/\/.*$/gm,
  ""
);

/** Só o corpo do case, para não casar com campos homônimos de outras saídas. */
function corpoDoCase(): string {
  const i = CODIGO.indexOf('case "pendencias_da_conta"');
  assert.ok(i > 0, "o case de `pendencias_da_conta` sumiu");
  const j = CODIGO.indexOf('case "proximo_passo"', i);
  return CODIGO.slice(i, j > i ? j : i + 3000);
}

test("o campo diz que conta ANÚNCIOS, não infrações", () => {
  const corpo = corpoDoCase();
  assert.match(
    corpo,
    /anunciosAfetados:\s*g\.quantos/,
    "o campo voltou a se chamar `quantos` — o modelo vai ler como infrações e " +
      "somar a coluna, dando um total que não existe"
  );
  assert.ok(
    !/\bquantos:\s*g\.quantos/.test(corpo),
    "`quantos` voltou à saída ao lado do nome novo; dois rótulos para o mesmo " +
      "número é pior que um errado"
  );
});

test("o significado viaja junto do número", () => {
  const corpo = corpoDoCase();
  assert.match(
    corpo,
    /significado:/,
    "a saída perdeu o `significado` — o número volta a viajar sozinho"
  );
  assert.match(
    corpo,
    /NUNCA infrações/,
    "o significado deixou de dizer o que o número NÃO é, que é a metade que " +
      "impede a soma errada"
  );
});

test("a lista de MLBs se declara curta — `reativar_anuncio` age sem clique", () => {
  const corpo = corpoDoCase();
  // Medido em produção em 11/08/2026: com 3 MLBs de um grupo de 26, o modelo
  // ofereceu "quer que eu reative algum grupo específico, ou todos?". Aceitar
  // "todos" reativaria 3 e a frase seguinte diria que o grupo voltou ao ar —
  // e como esta ferramenta não pede clique, o engano não fica na tela: fica
  // em anúncio que ela pensa que está vendendo.
  assert.match(
    corpo,
    /mlbsOmitidos:/,
    "o recorte de MLBs voltou a ser calado — o modelo passa a achar que tem " +
      "os códigos do grupo inteiro"
  );
  assert.match(
    corpo,
    /g\.quantos - Math\.min\(/,
    "os omitidos voltaram a ser contados contra `exemplos`, que o domínio já " +
      "recortou — a conta esconde justamente o que sobrou"
  );
  assert.match(
    corpo,
    /nunca ofereça reativar/,
    "sumiu a instrução que impede oferecer o grupo inteiro sem ter os códigos"
  );
});

test("o total verdadeiro continua viajando ao lado do recorte", () => {
  const corpo = corpoDoCase();
  // Recortar em silêncio é o que transforma "mostrei 20" em "só existem 20".
  assert.match(corpo, /totaisPorTipo:/, "os totais por tipo saíram da resposta");
  assert.match(
    corpo,
    /gruposOmitidos:/,
    "o recorte deixou de se declarar — a lista vira o total aos olhos do modelo"
  );
});
