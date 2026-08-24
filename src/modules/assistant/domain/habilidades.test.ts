// O registro de habilidades — o que o Copilot faz, e o que ele não faz.
//
// As duas regras que este arquivo guarda:
//   1. o registro é DERIVADO do catálogo — ferramenta nova sem frase reprova;
//   2. toda lacuna carrega motivo E o que faltaria. "Não consigo" sozinho não
//      passa.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assuntosDeLacuna,
  ferramentasSemHabilidade,
  habilidades,
  lacunaPorAssunto,
  lacunas,
} from "./habilidades";
import { FERRAMENTAS, PRIMEIRA_ACAO } from "./ferramentasDoAssistente";

test("toda ferramenta do catálogo tem habilidade escrita — o registro não envelhece calado", () => {
  assert.deepEqual(ferramentasSemHabilidade(), []);
  assert.equal(habilidades().length, FERRAMENTAS.length);
});

test("o nível vem do EFEITO do catálogo, não de uma segunda lista", () => {
  const porNome = new Map(habilidades().map((h) => [h.ferramenta, h]));
  for (const f of FERRAMENTAS) {
    const esperado = f.efeito === "le" ? "consulta" : f.efeito === "executa" ? "acao" : "proposta";
    assert.equal(porNome.get(f.nome)?.nivel, esperado, f.nome);
  }
  // E toda leitura da primeira ação é consulta — a fronteira do passo 0 vista
  // pelo outro lado.
  for (const nome of PRIMEIRA_ACAO) assert.equal(porNome.get(nome)?.nivel, "consulta", nome);
});

test("só a AÇÃO promete releitura — proposta se verifica no clique, consulta é o próprio dado", () => {
  const porNivel = new Map(habilidades().map((h) => [h.nivel, h.verificacao]));
  assert.match(porNivel.get("acao") ?? "", /lido de novo no marketplace e comparado/);
  assert.match(porNivel.get("acao") ?? "", /Sem confirmação, a resposta diz que não confirmou/);
  assert.match(porNivel.get("proposta") ?? "", /Nada acontece até o clique/);
  assert.doesNotMatch(porNivel.get("consulta") ?? "", /clique/);
});

test("a única ação do catálogo é a reativação, e ela declara o que exige", () => {
  const acoes = habilidades().filter((h) => h.nivel === "acao");
  assert.deepEqual(acoes.map((h) => h.ferramenta), ["reativar_anuncio"]);
  assert.deepEqual(acoes[0].precisaDe, ["loja conectada ao Mercado Livre", "o anúncio pausado e sem infração"]);
});

test("toda lacuna diz o motivo E o que faltaria — nunca só 'não consigo'", () => {
  const ls = lacunas();
  assert.ok(ls.length >= 8, "o registro de lacunas encolheu");
  for (const l of ls) {
    assert.ok(l.porQue.length > 60, `${l.assunto}: o motivo é curto demais para ser conferível`);
    assert.ok(l.oQueFaltaria.length > 30, `${l.assunto}: falta dizer o que resolveria`);
    assert.ok(l.pedidoTipico.length > 0, `${l.assunto}: sem pedido típico o modelo não reconhece o caso`);
    assert.doesNotMatch(
      l.porQue,
      /ainda não implementad|em breve|futuramente|estamos trabalhando/i,
      `${l.assunto}: promessa de roadmap não é motivo`
    );
  }
  // Assunto é chave: não pode repetir.
  assert.equal(new Set(assuntosDeLacuna()).size, ls.length);
});

test("as lacunas medidas na auditoria estão declaradas, com o código certo", () => {
  assert.equal(lacunaPorAssunto("editar_anuncio_publicado")?.codigo, "CAPACIDADE_AUSENTE");
  assert.match(lacunaPorAssunto("editar_anuncio_publicado")?.porQue ?? "", /não altera preço, estoque, título/);
  assert.equal(lacunaPorAssunto("detalhe_da_moderacao")?.codigo, "DADO_AUSENTE");
  assert.equal(lacunaPorAssunto("outros_marketplaces")?.codigo, "CAPACIDADE_AUSENTE");
  assert.equal(lacunaPorAssunto("estado_ao_vivo")?.codigo, "LIMITE_DO_MARKETPLACE");
  assert.equal(lacunaPorAssunto("excluir")?.codigo, "ACAO_EXTERNA");
  assert.equal(lacunaPorAssunto("assunto_que_nao_existe"), null);
  assert.equal(lacunaPorAssunto("  EDITAR_ANUNCIO_PUBLICADO  ")?.assunto, "editar_anuncio_publicado");
});

test("a lacuna do estado ao vivo aponta o caminho que EXISTE — não deixa a pessoa parada", () => {
  const l = lacunaPorAssunto("estado_ao_vivo");
  assert.match(l?.oQueFaltaria ?? "", /Importar do Mercado Livre/);
});

test("o registro não contradiz o catálogo sobre o que é ação", () => {
  // Se alguém classificar uma habilidade como "acao" aqui sem a ferramenta ter
  // efeito `executa`, o Copilot passa a anunciar poder que ele não tem.
  const efeito = new Map(FERRAMENTAS.map((f) => [f.nome, f.efeito]));
  for (const h of habilidades()) {
    if (h.nivel === "acao") assert.equal(efeito.get(h.ferramenta), "executa", h.ferramenta);
  }
});

test("nenhuma lacuna descreve algo que o catálogo JÁ faz", () => {
  // O erro mais caro deste arquivo seria ensinar o Copilot a recusar o que ele
  // sabe fazer. Estes três assuntos têm ferramenta e NÃO podem virar lacuna.
  const nomes = new Set(FERRAMENTAS.map((f) => f.nome));
  assert.ok(nomes.has("reativar_anuncio"), "reativar existe");
  assert.ok(nomes.has("propor_publicacao"), "publicar existe");
  assert.ok(nomes.has("propor_preco"), "propor preço no catálogo existe");
  for (const l of lacunas()) {
    assert.doesNotMatch(l.assunto, /^reativar|^publicar$/, `${l.assunto} conflita com uma ferramenta existente`);
  }
  // E a lacuna de editar anúncio publicado precisa distinguir os dois casos,
  // senão ela nega o `propor_preco`, que muda o preço NO CATÁLOGO do Zion.
  assert.match(lacunaPorAssunto("editar_anuncio_publicado")?.porQue ?? "", /já está no ar|publicado/);
});

test("a ferramenta de checagem existe, é leitura, e grava o sinal do pedido sem capacidade", () => {
  const raiz = new URL("../../../", import.meta.url);
  const ler = (rel: string) => readFileSync(new URL(rel, raiz), "utf8");
  assert.match(ler("modules/assistant/domain/ferramentasDoAssistente.ts"), /nome: "o_que_eu_consigo",\s*\n\s*efeito: "le",/);
  assert.match(ler("modules/assistant/domain/rotulosDasFerramentas.ts"), /o_que_eu_consigo:/);
  const exec = ler("modules/assistant/domain/executarFerramenta.ts");
  assert.match(exec, /lacunaPorAssunto\(/);
  assert.match(exec, /ctx\.registrarLacuna/, "o sinal precisa ser gravado — é o dado que diz o que construir");
  // O sinal vai para um contexto PRÓPRIO, para não diluir as tendências de conteúdo.
  const svc = ler("lib/services/lacunasDoCopilot.ts");
  assert.match(svc, /contexto: "copilot-lacuna"/);
  assert.match(svc, /empresa: s.clienteId/, "o tenant é da sessão");
});
