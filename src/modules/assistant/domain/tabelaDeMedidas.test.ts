// A tabela de medidas vem do DOMÍNIO, e a fonte viaja junto.
//
// ===========================================================================
// POR QUE ESTA PORTA, E POR QUE SEM AGENTE
// ===========================================================================
//
// Das três portas fechadas do catálogo de agentes (`ficha_tecnica`,
// `tabela_medidas`, `imagens`), esta é a de consequência mais concreta: medida
// errada não é erro de texto, é DEVOLUÇÃO — e devolução aparece direto no custo
// dela.
//
// Mas o agente A7 NÃO foi ligado. `montarTabelaMedidas` já resolve
// override → marca → padrão BR e diz qual usou. Rodar um modelo sobre isso
// trocaria dado por palpite numa coisa que já é sabida — a mesma classe do
// mapeamento de custos que gravou R$ 30.277.872.
//
// ===========================================================================
// A FONTE É METADE DA RESPOSTA
// ===========================================================================
//
// "35 = 22,5 cm" tem peso diferente conforme venha da tabela que ELA cadastrou,
// da referência da fabricante, ou do padrão BR genérico. Devolver o número sem
// a fonte deixaria o modelo afirmar as três com a mesma confiança.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FERRAMENTAS } from "./ferramentasDoAssistente.ts";

const EXEC = readFileSync(new URL("./executarFerramenta.ts", import.meta.url), "utf8");
const CASO = EXEC.slice(EXEC.indexOf('case "tabela_de_medidas"'), EXEC.indexOf('case "propor_publicacao"'));

test("a ferramenta existe e é de LEITURA", () => {
  const f = FERRAMENTAS.find((x) => x.nome === "tabela_de_medidas");
  assert.ok(f, "`tabela_de_medidas` sumiu do catálogo");
  assert.equal(f!.efeito, "le", "virou ferramenta de efeito — ler medida não muda nada");
});

test("NENHUM agente roda aqui — a tabela é do domínio", () => {
  for (const proibido of ["agentePorFerramenta", "chamarIA", "gerarTabela"]) {
    assert.ok(
      !CASO.includes(proibido),
      `${proibido} entrou no caminho da tabela: medida virou palpite de modelo`
    );
  }
});

test("a FONTE viaja junto, e cada uma tem sua frase", () => {
  assert.match(CASO, /fonte: m\.fonte/, "a procedência da tabela deixou de ser devolvida");
  for (const fonte of ["override", "marca", "padrao"]) {
    assert.ok(CASO.includes(`"${fonte}"`), `a fonte "${fonte}" perdeu o tratamento próprio`);
  }
});

test("o PADRÃO BR é anunciado como genérico — não como a tabela da marca", () => {
  // É a distinção que evita a devolução: 35 da Modare pode não ser 35 do padrão.
  assert.match(CASO, /padrão BR genérico/i);
  assert.match(CASO, /devolução/i, "sumiu a consequência que justifica a distinção");
});

test("sem tabela, NÃO inventa", () => {
  assert.match(CASO, /Não invente medidas/i);
});

test("a rota lê o DOMÍNIO — override, marca e as tabelas dela", () => {
  const rota = readFileSync(
    new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  const porto = rota.slice(rota.indexOf("medidasDoProduto: async"), rota.indexOf("gerarDescricao:"));
  assert.match(porto, /montarTabelaMedidas\(/, "a rota parou de usar o montador do domínio");
  assert.match(porto, /tabela_medidas_override/, "o override da lojista deixou de ter prioridade");
  assert.match(porto, /tabelasCliente/, "as tabelas cadastradas por ela deixaram de entrar");
});
