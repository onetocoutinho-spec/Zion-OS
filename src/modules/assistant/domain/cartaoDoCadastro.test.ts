import test from "node:test";
import assert from "node:assert/strict";

import {
  desfechoDaCriacao,
  escreverGrade,
  estadoDoCartaoDeCadastro,
  type CadastroNaTela,
} from "./cartaoDoCadastro";

const BASE: CadastroNaTela = {
  draftId: "d1",
  status: "ativo",
  rotulo: "Modare Papete 7178.102",
  jaSei: [
    { campo: "Marca", valor: "Modare", procedencia: "informado" },
    { campo: "Custo", valor: "R$ 47,80", procedencia: "informado" },
  ],
  variantes: {
    total: 6,
    porCor: [
      { cor: "Preto", tamanhos: ["37", "38", "39"] },
      { cor: "Bege", tamanhos: ["36", "37", "38"] },
    ],
    semSku: 5,
  },
  falta: [
    { o_que: "Preço de venda", porque: "Sem ele o anúncio não vai ao ar.", bloqueia: true },
  ],
  conflitos: [],
  prontoParaCriar: false,
};

test("coletando: mostra o que falta e conta os bloqueios", () => {
  const e = estadoDoCartaoDeCadastro(BASE);
  assert.equal(e.estado, "coletando");
  assert.equal(e.estado === "coletando" && e.bloqueios, 1);
});

test("pronto SEM proposta não tem botão — não há o que confirmar ainda", () => {
  const e = estadoDoCartaoDeCadastro({
    ...BASE,
    status: "pronto_para_finalizar",
    prontoParaCriar: true,
    falta: [],
    resumo: "Criar Papete Modare 7178.102, preço R$ 129,90.",
  });
  assert.equal(e.estado, "pronto");
});

test("SÓ com propostaId e aguardando_confirmacao existe botão", () => {
  const e = estadoDoCartaoDeCadastro({
    ...BASE,
    status: "aguardando_confirmacao",
    prontoParaCriar: true,
    falta: [],
    propostaId: "prop-1",
    resumo: "Criar Papete Modare 7178.102, preço R$ 129,90, 6 variantes.",
  });
  assert.equal(e.estado, "proposta");
  // O botão DIZ o que vai acontecer — inclusive quantas variantes.
  assert.equal(e.estado === "proposta" && e.rotuloBotao, "Criar produto com 6 variantes");
});

test("proposta sem id NÃO oferece botão, mesmo com o cadastro completo", () => {
  // Uma proposta que não chegou ao banco não pode ser confirmada; mostrar botão
  // seria oferecer uma ação que o servidor vai recusar.
  const e = estadoDoCartaoDeCadastro({
    ...BASE,
    status: "aguardando_confirmacao",
    prontoParaCriar: true,
    falta: [],
    resumo: "Criar Papete Modare.",
  });
  assert.equal(e.estado, "pronto");
});

test("QUALQUER desfecho tira o botão — inclusive o de sucesso", () => {
  const comBotao: CadastroNaTela = {
    ...BASE,
    status: "aguardando_confirmacao",
    prontoParaCriar: true,
    propostaId: "prop-1",
  };
  const e = estadoDoCartaoDeCadastro(comBotao, { ok: true, mensagem: "Produto criado." });
  assert.equal(e.estado, "concluido");
});

test("criado: vira registro com o produto real", () => {
  const e = estadoDoCartaoDeCadastro({
    ...BASE,
    status: "criado",
    produtoId: "prod-1",
    prontoParaCriar: true,
  });
  assert.equal(e.estado, "concluido");
  assert.equal(e.estado === "concluido" && e.produtoId, "prod-1");
  assert.equal(e.estado === "concluido" && e.ok, true);
});

test("cancelado não volta a oferecer criação", () => {
  const e = estadoDoCartaoDeCadastro({
    ...BASE,
    status: "cancelado",
    prontoParaCriar: true,
    propostaId: "prop-1",
  });
  assert.equal(e.estado, "cancelado");
});

test("dois cadastros abertos param tudo até alguém escolher", () => {
  const e = estadoDoCartaoDeCadastro({
    ...BASE,
    escolhaDeCadastros: [
      { ordem: 1, id: "d1", rotulo: "Modare Papete 7178.102" },
      { ordem: 2, id: "d2", rotulo: "Havaianas Top" },
    ],
  });
  assert.equal(e.estado, "escolha");
  assert.equal(e.estado === "escolha" && e.opcoes.length, 2);
});

test("STALE tem frase própria: o sistema protegeu, não falhou", () => {
  const d = desfechoDaCriacao({
    ok: false,
    motivo: "obsoleta",
    mensagem: "Os dados mudaram depois que eu montei essa proposta — candidatosDoCadastro passou de 0 para 1.",
  });
  assert.equal(d.ok, false);
  assert.equal(d.stale, true);
  assert.match(d.mensagem, /catálogo mudou/);
  assert.match(d.mensagem, /Não criei o produto/);
});

test('"já foi feito" é SUCESSO — o duplo clique achou o produto pronto', () => {
  const d = desfechoDaCriacao({
    ok: false,
    jaFeito: true,
    mensagem: "Isso já foi feito — não repeti a gravação.",
  });
  assert.equal(d.ok, true);
});

test("sucesso carrega o produto que nasceu", () => {
  const d = desfechoDaCriacao({ ok: true, mensagem: "Produto criado: Papete.", produtoId: "prod-1" });
  assert.equal(d.ok, true);
  assert.equal(d.produtoId, "prod-1");
});

test("a grade se lê numa linha por cor", () => {
  assert.deepEqual(escreverGrade(BASE.variantes), ["Preto: 37, 38, 39", "Bege: 36, 37, 38"]);
});

test("grade de um eixo só não escreve dois-pontos vazio", () => {
  assert.deepEqual(
    escreverGrade({ total: 2, porCor: [{ cor: "Preto", tamanhos: [] }], semSku: 2 }),
    ["Preto"]
  );
});
