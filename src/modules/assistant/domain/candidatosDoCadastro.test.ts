import test from "node:test";
import assert from "node:assert/strict";

import {
  CAMPO_TOTAL_DE_CANDIDATOS,
  PREFIXO_CANDIDATO,
  avaliarDuplicidade,
  candidatoEnxuto,
  ehCampoDeCandidato,
  estadoDosCandidatos,
  precondicoesDeCadastro,
  suficienteParaBuscar,
  tentativasDoCadastro,
  unirAchados,
} from "./candidatosDoCadastro";
import {
  associarNaVariante,
  definirGrade,
  draftNovo,
  informar,
  type DraftDeCadastro,
} from "./draftDeCadastro";
import { podeExecutar, type PropostaPersistida } from "./propostaPersistida";
import type { LinhaEncontrada } from "./buscaDeCatalogo";

const T0 = "2026-07-29T12:00:00.000Z";

function novo(): DraftDeCadastro {
  return draftNovo({ id: "d1", clienteId: "cli-1", conversaId: "c1", criadoPor: null, agoraISO: T0 });
}

function dizer(d: DraftDeCadastro, campo: Parameters<typeof informar>[1], valor: string) {
  const r = informar(d, campo, valor, "informado", T0);
  assert.equal(r.ok, true);
  return r.draft;
}

const LINHA = (id: string, nome = "Papete Modare"): LinhaEncontrada => ({
  produtoId: id,
  nome,
  marca: "Modare",
  modelo: "7178.102",
});

// ---------------------------------------------------------------------------
// quando buscar
// ---------------------------------------------------------------------------

test("sem nada que identifique, não se busca — não há candidato de nada", () => {
  assert.equal(suficienteParaBuscar(novo()), false);
  assert.deepEqual(tentativasDoCadastro(novo()), []);
});

test("a referência do lojista vira busca por MODELO, que é onde ela mora", () => {
  const d = dizer(novo(), "modelo", "7178.102");
  const t = tentativasDoCadastro(d);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0], {
    coluna: "modelo",
    modo: "exato",
    termo: "7178.102",
    casamento: "modelo_exato",
  });
});

test("os SKUs das VARIANTES também viram busca — qualquer um casando é sinal", () => {
  const grade = definirGrade(novo(), { cores: ["Preto"], tamanhos: ["37", "38"] }, T0);
  assert.equal(grade.ok, true);
  const a = associarNaVariante(grade.draft, "sku", "01040533", { tamanho: "37" }, T0);
  assert.equal(a.ok, true);
  const b = associarNaVariante(a.draft, "sku", "01040534", { tamanho: "38" }, T0);
  assert.equal(b.ok, true);

  const t = tentativasDoCadastro(b.draft);
  const skus = t.filter((x) => x.coluna === "sku").map((x) => x.termo);
  assert.deepEqual(skus, ["01040533", "01040534"]);
  // O zero à esquerda atravessa como TEXTO até a query.
  assert.equal(typeof skus[0], "string");
});

test("nome curto NÃO vira busca textual — devolveria meio catálogo", () => {
  const d = dizer(novo(), "nome", "Papete");
  assert.deepEqual(tentativasDoCadastro(d), []);
});

test("nome longo vira busca textual só quando não há identificador melhor", () => {
  const soNome = dizer(novo(), "nome", "Papete Modare Salto Bloco");
  assert.equal(tentativasDoCadastro(soNome)[0].casamento, "candidato_textual");

  const comReferencia = dizer(soNome, "modelo", "7178.102");
  const t = tentativasDoCadastro(comReferencia);
  assert.equal(t.length, 1);
  assert.equal(t[0].casamento, "modelo_exato");
});

// ---------------------------------------------------------------------------
// o desfecho — parecido não é o mesmo
// ---------------------------------------------------------------------------

test("nenhum candidato: o cadastro segue como produto novo", () => {
  assert.deepEqual(avaliarDuplicidade([], "modelo_exato", "7178.102"), { desfecho: "nenhum" });
});

test("UM candidato NÃO cria automaticamente nem bloqueia — informa e pergunta", () => {
  const d = avaliarDuplicidade([LINHA("p1")], "modelo_exato", "7178.102");
  assert.equal(d.desfecho, "possivel_existente");
  if (d.desfecho !== "possivel_existente") return;
  assert.match(d.mensagem, /pode corresponder/);
  assert.equal(d.candidatos.length, 1);
});

test("VÁRIOS candidatos: mostra todos, nunca o primeiro", () => {
  const d = avaliarDuplicidade([LINHA("p1"), LINHA("p2"), LINHA("p3")], "sku_exato", "01040533");
  assert.equal(d.desfecho, "varios");
  if (d.desfecho !== "varios") return;
  assert.equal(d.total, 3);
  assert.match(d.mensagem, /eu não escolho por você/);
});

test("SKU EXATO com vários resultados continua ambíguo — não é identidade", () => {
  // Medido nesta base: 117 SKUs e 112 EANs duplicados, nenhuma constraint
  // UNIQUE. Casamento exato é evidência de busca, não prova de identidade.
  const d = avaliarDuplicidade([LINHA("p1"), LINHA("p2")], "sku_exato", "01040533");
  assert.equal(d.desfecho, "varios");
  if (d.desfecho !== "varios") return;
  assert.equal(d.candidatos[0].casamento, "sku_exato");
});

test("candidato textual carrega o casamento fraco até a tela", () => {
  const d = avaliarDuplicidade([LINHA("p1")], "candidato_textual", "papete modare");
  assert.equal(d.desfecho, "possivel_existente");
  if (d.desfecho !== "possivel_existente") return;
  assert.equal(candidatoEnxuto(d.candidatos[0]).casamento, "candidato_textual");
});

test("a união não conta o mesmo produto duas vezes", () => {
  // Duas variantes do mesmo pai não são dois candidatos — são um produto.
  const r = unirAchados([
    { casamento: "sku_exato", linhas: [LINHA("p1"), LINHA("p1")] },
    { casamento: "ean_exato", linhas: [LINHA("p1"), LINHA("p2")] },
  ]);
  assert.equal(r.linhas.length, 2);
  // O casamento é o da PRIMEIRA tentativa que trouxe linha: a ordem é a de força.
  assert.equal(r.casamento, "sku_exato");
});

test("a união ignora tentativas vazias na hora de dizer como achou", () => {
  const r = unirAchados([
    { casamento: "modelo_exato", linhas: [] },
    { casamento: "candidato_textual", linhas: [LINHA("p1")] },
  ]);
  assert.equal(r.casamento, "candidato_textual");
});

// ---------------------------------------------------------------------------
// revalidação — a promessa que a Proposal carrega
// ---------------------------------------------------------------------------

test("as precondições guardam o CONJUNTO e o total, não só a contagem", () => {
  const p = precondicoesDeCadastro(["p2", "p1"]);
  assert.deepEqual(p[0], { campo: CAMPO_TOTAL_DE_CANDIDATOS, valorNaCriacao: 2 });
  // Ordenados, para o jsonb ser comparável em qualquer inspeção posterior.
  assert.deepEqual(
    p.slice(1).map((x) => x.campo),
    [`${PREFIXO_CANDIDATO}p1`, `${PREFIXO_CANDIDATO}p2`]
  );
});

test("catálogo vazio no começo: uma precondição, e ela vale zero", () => {
  const p = precondicoesDeCadastro([]);
  assert.equal(p.length, 1);
  assert.equal(p[0].valorNaCriacao, 0);
});

test("id repetido não infla o conjunto", () => {
  const p = precondicoesDeCadastro(["p1", "p1", "p1"]);
  assert.equal(p[0].valorNaCriacao, 1);
  assert.equal(p.length, 2);
});

test("ehCampoDeCandidato reconhece as duas formas e recusa as outras", () => {
  assert.ok(ehCampoDeCandidato(CAMPO_TOTAL_DE_CANDIDATOS));
  assert.ok(ehCampoDeCandidato(`${PREFIXO_CANDIDATO}p1`));
  assert.equal(ehCampoDeCandidato("custo"), false);
  assert.equal(ehCampoDeCandidato("variacoesSemPeso:p1"), false);
});

/** A proposta de cadastro, com o conjunto de T0 congelado dentro dela. */
function propostaDeCadastro(idsEmT0: readonly string[]): PropostaPersistida {
  return {
    id: "prop-1",
    clienteId: "cli-1",
    conversaId: "c1",
    criadaPor: "u1",
    tipo: "cadastro",
    risco: "alto",
    status: "pendente",
    alvos: ["d1"],
    valor: 129.9,
    resumo: "Criar Papete Modare 7178.102",
    precondicoes: precondicoesDeCadastro(idsEmT0),
    criadaEm: T0,
    expiraEm: "2026-07-29T12:30:00.000Z",
    draftId: "d1",
  };
}

const AGORA = "2026-07-29T12:10:00.000Z";

function estadoAgora(p: PropostaPersistida, idsAgora: readonly string[]) {
  return estadoDosCandidatos(
    p.precondicoes.map((c) => c.campo),
    idsAgora
  );
}

test("catálogo IGUAL: a criação pode acontecer", () => {
  const p = propostaDeCadastro(["p1"]);
  const v = podeExecutar(p, "cli-1", AGORA, estadoAgora(p, ["p1"]));
  assert.equal(v.pode, true);
});

test("catálogo vazio e continua vazio: pode criar", () => {
  const p = propostaDeCadastro([]);
  const v = podeExecutar(p, "cli-1", AGORA, estadoAgora(p, []));
  assert.equal(v.pode, true);
});

test("O CENÁRIO OBRIGATÓRIO: 7178.102 aparece entre a proposta e o clique", () => {
  // T0: não existe. T2: a importação cria um possível 7178.102. T3: o cliente
  // confirma. Resultado exigido: NENHUMA criação, e a frase diz que mudou.
  const p = propostaDeCadastro([]);
  const v = podeExecutar(p, "cli-1", AGORA, estadoAgora(p, ["p-novo"]));
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "obsoleta");
});

test("candidato que SUMIU também invalida — o mundo mudou nos dois sentidos", () => {
  const p = propostaDeCadastro(["p1"]);
  const v = podeExecutar(p, "cli-1", AGORA, estadoAgora(p, []));
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "obsoleta");
});

test("um TROCADO por outro não passa, mesmo com o total igual", () => {
  // Só a contagem deixaria isto passar. Por isso existe uma precondição por id.
  const p = propostaDeCadastro(["p1"]);
  const v = podeExecutar(p, "cli-1", AGORA, estadoAgora(p, ["p2"]));
  assert.equal(v.pode, false);
  if (v.pode) return;
  assert.equal(v.impedimento.motivo, "obsoleta");
  if (v.impedimento.motivo !== "obsoleta") return;
  // O que mudou aparece: o total continuou 1, mas p1 sumiu.
  assert.ok(v.impedimento.mudou.some((m) => m.campo === `${PREFIXO_CANDIDATO}p1`));
});

test("proposta de cadastro de OUTRO tenant não executa", () => {
  const p = propostaDeCadastro([]);
  const v = podeExecutar(p, "cli-2", AGORA, estadoAgora(p, []));
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "outro_tenant");
});

test("duplo clique: a segunda confirmação encontra o trabalho feito", () => {
  const p = { ...propostaDeCadastro([]), status: "executada" as const };
  const v = podeExecutar(p, "cli-1", AGORA, estadoAgora(p, []));
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "ja_executada");
});

test("o estado de agora só responde pelos campos que a proposta observou", () => {
  // O que não foi observado na criação não pode invalidar a execução: seria
  // recusar por uma mudança que ninguém prometeu vigiar.
  const estado = estadoDosCandidatos([CAMPO_TOTAL_DE_CANDIDATOS], ["p1", "p2"]);
  assert.deepEqual(estado, { [CAMPO_TOTAL_DE_CANDIDATOS]: 2 });
});

test("candidato ausente vira null, não zero — ausência não é valor", () => {
  const estado = estadoDosCandidatos([`${PREFIXO_CANDIDATO}p1`], []);
  assert.equal(estado[`${PREFIXO_CANDIDATO}p1`], null);
});
