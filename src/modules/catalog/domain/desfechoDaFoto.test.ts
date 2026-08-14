import test from "node:test";
import assert from "node:assert/strict";
import {
  fraseDoDesfecho,
  fraseDoDesfazer,
  podeDesfazer,
  type EnvioAoML,
} from "./desfechoDaFoto.ts";

// A frase depois de subir a foto é onde este repositório já mentiu três vezes:
// "Título trocado" quando o anúncio no ar não mudava, o botão que dizia "não
// grava" e gravava, e "Ela é a capa agora" com a capa velha ainda no Mercado
// Livre. O teste guarda a frase porque é ela que a lojista lê.

const BASE = { produtoNome: "Chinelo Havaianas Top Liso Amarelo", largura: 1200, altura: 1200 };
const frase = (envio: EnvioAoML) => fraseDoDesfecho({ ...BASE, envio });

/** Todo desfecho possível, para a varredura da regra geral rodar sobre todos. */
const TODOS: { nome: string; envio: EnvioAoML; trocouLa: boolean }[] = [
  { nome: "não pediu capa", envio: { situacao: "nao-tentado", porque: "nao-pediu-capa" }, trocouLa: false },
  { nome: "não virou capa aqui", envio: { situacao: "nao-tentado", porque: "nao-virou-capa" }, trocouLa: false },
  { nome: "sem cor", envio: { situacao: "nao-tentado", porque: "sem-cor" }, trocouLa: false },
  {
    nome: "409 sem alvos",
    envio: { situacao: "respondeu", resposta: { ok: false, motivo: "sem-alvos", cor: "Amarelo", erro: "Nenhum anúncio desta cor (Amarelo) foi encontrado." } },
    trocouLa: false,
  },
  {
    nome: "502 do Mercado Livre",
    envio: { situacao: "respondeu", resposta: { erro: "Falha ao aplicar a capa." } },
    trocouLa: false,
  },
  {
    nome: "200 sem nada a trocar",
    envio: {
      situacao: "respondeu",
      resposta: { ok: true, cor: "Amarelo", trocados: 0, feitos: [], frase: "Nenhum anúncio de Amarelo precisava de troca — todos já estavam com essa capa." },
    },
    trocouLa: false,
  },
  {
    nome: "200 com dois trocados",
    envio: {
      situacao: "respondeu",
      resposta: {
        ok: true,
        cor: "Amarelo",
        trocados: 2,
        feitos: [
          { mlb: "MLB4598408351", titulo: "Chinelo Amarelo 37/38" },
          { mlb: "MLB7048550938", titulo: "Chinelo Amarelo 39/40" },
        ],
        frase: "Troquei a capa de 2 anúncio(s) de Amarelo.",
      },
    },
    trocouLa: true,
  },
  {
    nome: "207 parou no meio depois de trocar um",
    envio: {
      situacao: "respondeu",
      resposta: {
        ok: false,
        parou: true,
        cor: "Amarelo",
        trocados: 1,
        feitos: [{ mlb: "MLB4598408351", titulo: "Chinelo Amarelo 37/38" }],
        frase: "Troquei 1 anúncio(s) e parei no MLB7048550938: o Mercado Livre recusou a troca. Os demais desta cor continuam como estavam.",
      },
    },
    trocouLa: true,
  },
];

test("A SENTINELA: nenhuma frase afirma troca no ML sem anúncio confirmado", () => {
  // Esta é a regra que os três defeitos anteriores violaram. Ela vale sobre
  // TODOS os desfechos, e não sobre um caso escolhido a dedo — foi assim que
  // "Título trocado" passou por revisão: o caso feliz estava certo.
  for (const c of TODOS) {
    const t = frase(c.envio).replace(/\s+/g, " ");
    if (c.trocouLa) continue;
    assert.doesNotMatch(
      t,
      /Troquei|já é a capa (?:no|do) Mercado Livre|capa (?:no|do) Mercado Livre agora/i,
      `"${c.nome}" afirmou troca no ML sem anúncio confirmado: ${t}`
    );
    assert.doesNotMatch(t, /\bMLB\d/, `"${c.nome}" citou um MLB que não foi trocado: ${t}`);
  }
});

test("quando NÃO trocou nada lá, a frase DIZ que não trocou", () => {
  // O silêncio é o defeito: "Ela é a capa agora." sem falar do Mercado Livre
  // foi exatamente o que fez a lojista conferir e achar a capa antiga.
  for (const c of TODOS) {
    if (c.trocouLa || c.envio.situacao === "nao-tentado" && c.envio.porque === "nao-pediu-capa") continue;
    assert.match(
      frase(c.envio),
      /Mercado Livre/,
      `"${c.nome}" não disse nada sobre o Mercado Livre: ${frase(c.envio)}`
    );
  }
});

test("quem só acrescentou foto não ouve falar de Mercado Livre", () => {
  // Ela não pediu capa. Falar do marketplace aqui é ruído sobre algo que ela
  // não fez — e ruído treina a lojista a não ler.
  const t = frase({ situacao: "nao-tentado", porque: "nao-pediu-capa" });
  assert.equal(t, "Subi a foto para Chinelo Havaianas Top Liso Amarelo (1200 × 1200).");
});

test("a medida entra sempre, para ela julgar a foto sozinha", () => {
  for (const c of TODOS) {
    assert.match(frase(c.envio), /\(1200 × 1200\)/, c.nome);
  }
});

test("trocou: a frase da rota manda e os MLBs vêm junto", () => {
  // Os MLBs não são enfeite: é o que ela cola na busca do Mercado Livre para
  // conferir. Sem eles, "troquei 2 anúncios" é indistinguível de fé.
  const t = frase(TODOS[6].envio);
  assert.match(t, /Troquei a capa de 2 anúncio\(s\) de Amarelo\./);
  assert.match(t, /MLB4598408351, MLB7048550938/);
});

test("207: a frase diz o que foi E onde parou", () => {
  // "deu erro" depois de trocar um de dois é o pior desfecho possível — ela
  // precisa saber qual mudou.
  const t = frase(TODOS[7].envio);
  assert.match(t, /Troquei 1 anúncio\(s\) e parei no MLB7048550938/);
  assert.match(t, /MLB4598408351/);
});

test("sem cor: explica o motivo, não só o fato", () => {
  // "Não deu" ensina a lojista a desistir. "Cada anúncio seu é de uma cor"
  // ensina ela a responder a cor da próxima vez.
  const t = frase({ situacao: "nao-tentado", porque: "sem-cor" });
  assert.match(t, /cada anúncio seu é de uma cor/i);
  assert.match(t, /Ela é a capa aqui/);
});

test("erro do ML chega inteiro, não virado em 'não deu'", () => {
  const t = frase({ situacao: "respondeu", resposta: { erro: "Cliente não conectado ao Mercado Livre." } });
  assert.match(t, /Cliente não conectado ao Mercado Livre\./);
  assert.match(t, /continuam com a capa antiga/);
});

// ===========================================================================
// O DESFAZER — nascido do incidente de 14/08/2026
// ===========================================================================
//
// Uma foto de Havaianas AMARELO virou capa de 10 anúncios AZUL-MARINHO, e o
// repositório tinha ida sem volta. A volta existe agora, e as regras dela são
// as da ida, invertidas.

test("só oferece desfazer quando houve troca CONFIRMADA e sabemos qual foto", () => {
  // Oferecer "desfazer" sobre uma troca que não aconteceu ensina a lojista a
  // desconfiar do botão — e um desfazer em que não se confia é pior que
  // nenhum, porque ela deixa de tentar.
  assert.equal(podeDesfazer({ ok: true, feitos: [], fotoNoML: "1-MLB1_082026" }), false);
  assert.equal(podeDesfazer({ ok: true, feitos: [{ mlb: "MLB1", titulo: "t" }] }), false);
  assert.equal(podeDesfazer({ ok: true, feitos: [{ mlb: "MLB1", titulo: "t" }], fotoNoML: "  " }), false);
  assert.equal(
    podeDesfazer({ ok: true, feitos: [{ mlb: "MLB1", titulo: "t" }], fotoNoML: "1-MLB1_082026" }),
    true
  );
});

test("o desfecho PARCIAL também pode ser desfeito — é onde ele mais serve", () => {
  // Metade trocada é justamente o estado em que ela mais precisa da volta.
  assert.equal(
    podeDesfazer({
      ok: false,
      parou: true,
      feitos: [{ mlb: "MLB1", titulo: "t" }],
      fotoNoML: "1-MLB1_082026",
    }),
    true
  );
});

test("a frase do desfazer NÃO afirma remoção sem anúncio confirmado", () => {
  // Mesma sentinela da ida, invertida. "Desfiz" sobre nada desfeito é a pior
  // mentira deste caminho, porque ela para de procurar.
  const semNada = fraseDoDesfazer({ erro: "Cliente não conectado ao Mercado Livre." });
  assert.doesNotMatch(semNada, /\bTirei\b/);
  assert.doesNotMatch(semNada, /\bMLB\d/);
  assert.match(semNada, /continuam com ela/);
  assert.match(semNada, /Cliente não conectado ao Mercado Livre\./);
});

test("desfez: a frase da rota manda e os MLBs vêm junto", () => {
  const t = fraseDoDesfazer({
    ok: true,
    feitos: [
      { mlb: "MLB4820637003", titulo: "Azul-marinho 45-46" },
      { mlb: "MLB4820624201", titulo: "Azul-marinho 45-46" },
    ],
    frase: "Tirei a foto de 2 anúncio(s).",
  });
  assert.match(t, /No Mercado Livre: Tirei a foto de 2 anúncio\(s\)\./);
  assert.match(t, /MLB4820637003, MLB4820624201/);
});

test("'não estava em nenhum' não vira lista de MLB nenhuma", () => {
  const t = fraseDoDesfazer({ ok: true, feitos: [], frase: "Essa foto não estava em nenhum anúncio deste produto." });
  assert.doesNotMatch(t, /\bMLB\d/);
  assert.match(t, /não estava em nenhum/);
});
