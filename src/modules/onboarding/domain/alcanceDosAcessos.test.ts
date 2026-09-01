// O recorte da leitura de acessos — provado no que ele NEGA.
//
// A 054 barrou a agência de ler `perfis` porque "identidade não é dado
// operacional". Abrir uma rota que devolve perfis é furar isso de propósito, e
// um furo de propósito precisa de borda: se o recorte falhar aberto, a rota
// entrega a lista de todo mundo — para a agência e para o lojista.

import test from "node:test";
import assert from "node:assert/strict";
import { alcanceDosAcessos } from "./alcanceDosAcessos";

const LOJA = "11111111-1111-4111-8111-111111111111";
const AGENCIA = "33333333-3333-4333-8333-333333333333";

test("a equipe lê tudo — é a Zion", () => {
  assert.deepEqual(alcanceDosAcessos({ papel: "equipe", clienteId: null, agenciaId: null }), {
    tipo: "tudo",
  });
});

test("a agência lê o recorte da agência dela", () => {
  assert.deepEqual(alcanceDosAcessos({ papel: "agencia", clienteId: null, agenciaId: AGENCIA }), {
    tipo: "agencia",
    agenciaId: AGENCIA,
  });
});

test("o lojista lê a própria loja", () => {
  assert.deepEqual(alcanceDosAcessos({ papel: "cliente", clienteId: LOJA, agenciaId: null }), {
    tipo: "loja",
    clienteId: LOJA,
  });
});

test("vínculo faltando não vira 'tudo'", () => {
  // O modo de falha que importa: um perfil incompleto caindo no ramo sem
  // filtro devolveria a lista inteira de acessos do banco. `nenhum` é a
  // resposta, e a rota a traduz em lista vazia.
  assert.deepEqual(alcanceDosAcessos({ papel: "agencia", clienteId: null, agenciaId: null }), {
    tipo: "nenhum",
  });
  assert.deepEqual(alcanceDosAcessos({ papel: "cliente", clienteId: null, agenciaId: null }), {
    tipo: "nenhum",
  });
});

test("papel desconhecido não vira 'tudo'", () => {
  // Mesmo defeito que `lerPapel` foi criado para matar: o padrão antigo lia
  // qualquer coisa que não fosse "cliente" como equipe — falha ABERTA, no
  // lugar onde falhar aberto custa mais caro.
  assert.deepEqual(
    alcanceDosAcessos({ papel: "admin" as never, clienteId: LOJA, agenciaId: AGENCIA }),
    { tipo: "nenhum" }
  );
});
