import test from "node:test";
import assert from "node:assert/strict";

import {
  FERRAMENTAS,
  FERRAMENTAS_DE_LEITURA,
  FERRAMENTAS_DE_PROPOSTA,
  nenhumaFerramentaEscreve,
  type Efeito,
  type Ferramenta,
} from "./ferramentasDoAssistente";

/**
 * A INVARIANTE, em tempo de COMPILAÇÃO.
 *
 * Se alguém adicionar "escreve" (ou qualquer outro efeito) ao tipo `Efeito`,
 * esta linha para de compilar e o `typecheck:test` reprova a build — antes de
 * qualquer teste rodar, antes de qualquer revisão humana esquecer.
 *
 * É a parte com dentes. O teste de runtime abaixo pega o caso mais comum
 * (alguém adiciona uma ferramenta nova); este pega o caso mais perigoso
 * (alguém alarga a fronteira).
 */
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _aFronteiraNaoCresceu: Igual<Efeito, "le" | "propoe"> = true;
void _aFronteiraNaoCresceu;

test("nenhuma ferramenta do assistente escreve", () => {
  // O modelo pode propor qualquer coisa; só o clique de um humano grava.
  // Enquanto isso for verdade, um modelo pior, um prompt vazado ou um turno
  // estranho não conseguem tocar no banco — não porque foram instruídos a não
  // fazer, mas porque não existe caminho.
  assert.ok(nenhumaFerramentaEscreve());
});

test("a fronteira vale para qualquer lista, não só para a de hoje", () => {
  const intrusa = { nome: "gravar_direto", descricao: "", efeito: "escreve", parametros: {} };
  // O cast é o ponto: simula alguém contornando o tipo. A função ainda barra.
  assert.equal(nenhumaFerramentaEscreve([intrusa as unknown as Ferramenta]), false);
});

test("nome de ferramenta não promete escrita", () => {
  // Guarda grosseira e útil: uma ferramenta chamada "gravar" ou "publicar"
  // quase certamente escreve, mesmo que alguém a marque como "propoe" por
  // descuido. Falha aqui é para alguém parar e pensar, não para passar batido.
  const suspeitos = /^(gravar|salvar|atualizar|apagar|deletar|publicar|remover|criar|enviar)/;
  for (const f of FERRAMENTAS) {
    assert.doesNotMatch(f.nome, suspeitos, `"${f.nome}" tem nome de quem escreve`);
  }
});

test("as duas listas não se sobrepõem e formam o catálogo", () => {
  const nomes = FERRAMENTAS.map((f) => f.nome);
  assert.equal(new Set(nomes).size, nomes.length, "ferramenta duplicada");
  assert.equal(
    FERRAMENTAS.length,
    FERRAMENTAS_DE_LEITURA.length + FERRAMENTAS_DE_PROPOSTA.length
  );
  assert.ok(FERRAMENTAS_DE_LEITURA.every((f) => f.efeito === "le"));
  assert.ok(FERRAMENTAS_DE_PROPOSTA.every((f) => f.efeito === "propoe"));
});

test("toda ferramenta se descreve — é o que o modelo lê para decidir", () => {
  for (const f of FERRAMENTAS) {
    assert.ok(f.descricao.length > 20, `"${f.nome}" mal descrita`);
    assert.ok(f.parametros.type === "OBJECT", `"${f.nome}" sem schema de objeto`);
  }
});

test("achar_produto manda perguntar quando acha mais de um", () => {
  // A instrução vive na descrição porque é ela que o modelo lê. Medido no
  // EXP-006: com ela, "a papete pesa 400g" parou e perguntou qual.
  const achar = FERRAMENTAS.find((f) => f.nome === "achar_produto");
  assert.ok(achar);
  assert.match(achar.descricao, /PERGUNTE|pergunte/);
  assert.match(achar.descricao, /nunca escolha/i);
});

test("propor_gravacao avisa que não grava, e proíbe valor deduzido", () => {
  const propor = FERRAMENTAS.find((f) => f.nome === "propor_gravacao");
  assert.ok(propor);
  assert.match(propor.descricao, /NÃO grava/);
  assert.match(propor.descricao, /que o lojista DISSE/);
  // A vírgula decimal precisa sobreviver: "0,3" lido como 3 vira 3 kg — dez
  // vezes o peso, e o frete junto.
  const valor = (propor.parametros.properties as Record<string, { description?: string }>).valor;
  assert.match(valor.description ?? "", /0,3/);
});
