import test from "node:test";
import assert from "node:assert/strict";
import {
  podeTrocarTitulo,
  planejarEdicaoDeTitulo,
  temPropriedadeIntelectual,
} from "./edicaoDoAnuncio.ts";

// Editar texto de anúncio no ar é a capacidade que dá destino a todo o
// conteúdo que o Zion produz — e é a que pode custar a conta dela.
//
// ===========================================================================
// O que está em jogo, medido em 14/08/2026
// ===========================================================================
//
// O ML trata editar-e-republicar anúncio acusado de PROPRIEDADE INTELECTUAL
// como REINCIDÊNCIA, e reincidência custa a CONTA, não o anúncio. São 7
// anúncios desta lojista em `PI_FAKES`, em 2 produtos.
//
// Todas as outras recusas custam tempo. Essa custa a loja.

const BASE = {
  mlb: "MLB1",
  status: "active",
  tituloAtual: "Chinelo Havaianas Top Liso Preto 39 - 40",
  categoriasDeInfracao: [] as string[],
};
const NOVO = "Chinelo Havaianas Top Liso Original Preto 39/40";

test("PI é recusado — e por PREFIXO, não por string exata", () => {
  // `PI_FAKES` é a única categoria observada. Uma nova (`PI_BRAND`, o que for)
  // tem que entrar pelo caminho grave por OMISSÃO: tratar PI desconhecido como
  // edição de rotina é o defeito que este módulo existe para impedir.
  for (const cat of ["PI_FAKES", "PI_BRAND", "pi_qualquer_coisa"]) {
    const v = podeTrocarTitulo({ ...BASE, categoriasDeInfracao: [cat] }, NOVO);
    assert.equal(v.pode, false, `${cat} passou como editável`);
    assert.equal(v.pode === false && v.motivo, "propriedade-intelectual");
  }
  assert.equal(temPropriedadeIntelectual(["FOTOS", "PQT"]), false);
});

test("PI vence QUALQUER outra recusa — a ordem da gravidade", () => {
  // Um anúncio PI com título idêntico sairia como "sem-mudanca" se a ordem
  // fosse outra — e a lojista leria "nada a fazer aqui" sobre o anúncio que
  // pode derrubar a conta dela.
  const v = podeTrocarTitulo(
    { ...BASE, status: "closed", categoriasDeInfracao: ["PI_FAKES"] },
    BASE.tituloAtual
  );
  assert.equal(v.pode === false && v.motivo, "propriedade-intelectual");
});

test("anúncio em revisão não é editado", () => {
  // O ML está avaliando ESTE anúncio agora; mexer no texto troca o objeto
  // avaliado no meio da avaliação.
  const v = podeTrocarTitulo({ ...BASE, status: "under_review" }, NOVO);
  assert.equal(v.pode === false && v.motivo, "em-revisao");
});

test("encerrado e inativo não têm o que editar", () => {
  for (const s of ["closed", "inactive", "CLOSED"]) {
    const v = podeTrocarTitulo({ ...BASE, status: s }, NOVO);
    assert.equal(v.pode === false && v.motivo, "encerrado", `status ${s}`);
  }
});

test("título igual ao que está no ar não gera escrita", () => {
  // Enviar o mesmo texto gasta uma escrita, pode reabrir revisão, e não muda
  // nada para quem compra.
  const v = podeTrocarTitulo(BASE, `  ${BASE.tituloAtual}  `);
  assert.equal(v.pode === false && v.motivo, "sem-mudanca");
});

test("título acima do limite do ML é recusado ANTES de sair daqui", () => {
  const v = podeTrocarTitulo(BASE, "x".repeat(61));
  assert.equal(v.pode === false && v.motivo, "titulo-longo");
  assert.match(v.pode === false ? v.explicacao : "", /61 caracteres/);
});

test("o anúncio ativo e com título novo passa, dizendo de/para", () => {
  const v = podeTrocarTitulo(BASE, NOVO);
  assert.equal(v.pode, true);
  assert.equal(v.pode === true && v.de, BASE.tituloAtual);
  assert.equal(v.pode === true && v.para, NOVO);
});

test("o plano SEPARA com motivo, em vez de filtrar em silêncio", () => {
  // "7 de 12" sem os motivos é a mesma opacidade que este repositório passou o
  // mês arrancando: a lojista precisa saber POR QUE cada um ficou de fora.
  const plano = planejarEdicaoDeTitulo(
    [
      BASE,
      { ...BASE, mlb: "MLB2", categoriasDeInfracao: ["PI_FAKES"] },
      { ...BASE, mlb: "MLB3", status: "under_review" },
      { ...BASE, mlb: "MLB4", tituloAtual: NOVO },
    ],
    NOVO
  );
  assert.equal(plano.editaveis.length, 1);
  assert.equal(plano.editaveis[0].mlb, "MLB1");
  assert.deepEqual(
    plano.recusados.map((r) => `${r.mlb}:${r.motivo}`),
    ["MLB2:propriedade-intelectual", "MLB3:em-revisao", "MLB4:sem-mudanca"]
  );
});
