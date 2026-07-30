import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classificarEstado,
  comoErro,
  estaVazio,
  type EstadoAssincrono,
} from "./estadoAssincrono.ts";

// ---------------------------------------------------------------------------
// estaVazio
// ---------------------------------------------------------------------------

test("estaVazio: ausência é vazio", () => {
  assert.equal(estaVazio(null), true);
  assert.equal(estaVazio(undefined), true);
});

test("estaVazio: lista sem itens é vazio; com itens não", () => {
  assert.equal(estaVazio([]), true);
  assert.equal(estaVazio([0]), false);
  assert.equal(estaVazio([null]), false);
});

test("estaVazio: ZERO não é vazio — é uma resposta", () => {
  // "zero produtos sem custo" é boa notícia, não tela em branco.
  assert.equal(estaVazio(0), false);
});

test("estaVazio: false não é vazio", () => {
  assert.equal(estaVazio(false), false);
});

test("estaVazio: string só de espaço é vazio", () => {
  assert.equal(estaVazio(""), true);
  assert.equal(estaVazio("   "), true);
  assert.equal(estaVazio("0"), false);
});

test("estaVazio: objeto presente nunca é vazio pelo default", () => {
  // `{limite, usado}` da quota existe mesmo com usado=0.
  assert.equal(estaVazio({}), false);
  assert.equal(estaVazio({ limite: 5000, usado: 0 }), false);
});

test("estaVazio: Map e Set respondem por tamanho", () => {
  assert.equal(estaVazio(new Map()), true);
  assert.equal(estaVazio(new Set()), true);
  assert.equal(estaVazio(new Set([1])), false);
});

// ---------------------------------------------------------------------------
// classificarEstado — o defeito original e a ordem que o impede
// ---------------------------------------------------------------------------

test("classificarEstado: carregando vence tudo", () => {
  assert.equal(
    classificarEstado({ carregando: true, erro: new Error("x"), dado: [1] }),
    "carregando"
  );
});

test("classificarEstado: ERRO vence VAZIO — o defeito original", () => {
  // No erro o dado é null, e null é vazio pelo default. Se a ordem invertesse,
  // todo erro apareceria como vazio: o bug reconstruído dentro da correção.
  assert.equal(
    classificarEstado({ carregando: false, erro: new Error("RLS"), dado: null }),
    "erro"
  );
});

test("classificarEstado: falha e resultado vazio deixam de ser o mesmo estado", () => {
  const falhou = classificarEstado({ carregando: false, erro: new Error("rede"), dado: null });
  const vazio = classificarEstado({ carregando: false, erro: null, dado: [] });
  assert.equal(falhou, "erro");
  assert.equal(vazio, "vazio");
  assert.notEqual(falhou, vazio);
});

test("classificarEstado: lista com itens é sucesso", () => {
  assert.equal(classificarEstado({ carregando: false, erro: null, dado: [1, 2] }), "sucesso");
});

test("classificarEstado: sucesso que devolveu null é VAZIO, não erro", () => {
  // `buscarProduto(id)` que não achou: não é falha, é ausência.
  assert.equal(classificarEstado({ carregando: false, erro: null, dado: null }), "vazio");
});

test("classificarEstado: contagem zero é SUCESSO, não vazio", () => {
  assert.equal(classificarEstado({ carregando: false, erro: null, dado: 0 }), "sucesso");
});

test("classificarEstado: `vazio` customizado substitui o default", () => {
  const dado = { produtos: [] as number[] };
  assert.equal(classificarEstado({ carregando: false, erro: null, dado }), "sucesso");
  assert.equal(
    classificarEstado({
      carregando: false,
      erro: null,
      dado,
      vazio: (d) => (d as typeof dado).produtos.length === 0,
    }),
    "vazio"
  );
});

test("classificarEstado: `vazio` customizado NÃO consegue transformar erro em vazio", () => {
  // A ordem é do módulo, não de quem chama. Um `vazio` que devolve sempre true
  // não pode apagar a distinção que o módulo existe para manter.
  assert.equal(
    classificarEstado({
      carregando: false,
      erro: new Error("falhou"),
      dado: null,
      vazio: () => true,
    }),
    "erro"
  );
});

test("classificarEstado: erro string vazia não conta como erro", () => {
  // `erro` só é erro se existir. undefined e null não são.
  assert.equal(classificarEstado({ carregando: false, erro: null, dado: [1] }), "sucesso");
  assert.equal(classificarEstado({ carregando: false, erro: undefined, dado: [1] }), "sucesso");
});

test("classificarEstado: os quatro estados são alcançáveis", () => {
  const alcancados = new Set<EstadoAssincrono>([
    classificarEstado({ carregando: true, erro: null, dado: null }),
    classificarEstado({ carregando: false, erro: null, dado: [1] }),
    classificarEstado({ carregando: false, erro: null, dado: [] }),
    classificarEstado({ carregando: false, erro: new Error("x"), dado: null }),
  ]);
  assert.deepEqual([...alcancados].sort(), ["carregando", "erro", "sucesso", "vazio"]);
});

// ---------------------------------------------------------------------------
// comoErro
// ---------------------------------------------------------------------------

test("comoErro: Error atravessa intacto", () => {
  const e = new Error("mensagem original");
  assert.equal(comoErro(e), e);
});

test("comoErro: string virá mensagem", () => {
  assert.equal(comoErro("sem rede").message, "sem rede");
});

test("comoErro: objeto com message aproveita a message", () => {
  assert.equal(comoErro({ message: "PGRST204" }).message, "PGRST204");
});

test("comoErro: objeto sem message NÃO produz [object Object]", () => {
  const m = comoErro({ code: 42 }).message;
  assert.ok(!m.includes("[object"), `mensagem inutil: ${m}`);
  assert.equal(m, "Não consegui carregar estes dados.");
});

test("comoErro: string vazia cai na mensagem padrão", () => {
  assert.equal(comoErro("   ").message, "Não consegui carregar estes dados.");
  assert.equal(comoErro(null).message, "Não consegui carregar estes dados.");
});
