// A comissão vem da API do Mercado Livre — e de mais lugar nenhum.
//
// DECISÃO DO DONO em 03/08/2026, respondendo à AUD-001: "a comissão certa é a
// da API do ML".
//
// Havia DOIS modelos de precificação vivos no mesmo repositório:
//
//   núcleo (modules/pricing/domain)  comissão da categoria exata via
//                                    /sites/MLB/listing_prices + reputação real
//   AbaPrecificacao (área interna)   `taxaMarketplacePercentual: "16"` e
//                                    `taxaFixa: "6"` digitados por nós
//
// Dois números para o mesmo produto, e a pergunta "qual dos dois é o certo"
// ficou aberta de 27/07 a 03/08. O 6,00 era o pior: o núcleo já tinha removido
// os R$ 5,50/6,00 por serem estimativa de terceiros — o app publica com `me2`
// sem Flex, onde a taxa fixa é ZERO.
//
// Este teste guarda a decisão contra o retorno silencioso do número inventado.

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../testing/lerFonte.ts";

const FONTE = lerFonte(new URL("./AbaPrecificacao.tsx", import.meta.url), "utf8");

/**
 * O objeto de estado inicial do formulário — onde os defaults moram, SEM os
 * comentários.
 *
 * Sem tirar comentário, o sentinela acusa a própria documentação: o comentário
 * que explica por que o `16` saiu contém a string `taxaMarketplacePercentual:
 * "16"`. Aconteceu na primeira execução deste teste, e é a versão pequena do
 * defeito que ele guarda — o termo de busca definindo a conclusão.
 */
function estadoInicial(): string {
  const i = FONTE.indexOf("const [f, setF] = useState({");
  assert.ok(i >= 0, "não achei o estado inicial do formulário");
  const fim = FONTE.indexOf("});", i);
  assert.ok(fim > i, "não achei o fim do estado inicial");
  return FONTE.slice(i, fim)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("a taxa do marketplace NÃO nasce com número digitado por nós", () => {
  const bloco = estadoInicial();
  assert.match(bloco, /taxaMarketplacePercentual:\s*""/);
  assert.ok(
    !/taxaMarketplacePercentual:\s*"1?[0-9]+"/.test(bloco),
    "o percentual inventado voltou ao estado inicial"
  );
});

test("a taxa FIXA também não — e ela é zero em me2 sem Flex", () => {
  const bloco = estadoInicial();
  assert.match(bloco, /taxaFixa:\s*""/);
  assert.ok(!/taxaFixa:\s*"[0-9]+"/.test(bloco), "o R$ 6,00 de terceiros voltou");
});

test("as duas vêm da MESMA fonte que o portal da lojista usa", () => {
  // `custosDoCliente` é a função que a tela de Precificação chama: API do ML
  // pela categoria exata + reputação da conta.
  assert.match(FONTE, /custosDoCliente\(\{\s*clienteId/);
  assert.match(FONTE, /comissaoPercentual\(c\.taxas\)/);
  assert.match(FONTE, /taxaFixaVenda\(c\.taxas\)/);
});

test("o cálculo NÃO ganhou um segundo modelo de comissão por dentro", () => {
  // A conta continua sendo `calcularPrecificacao`; o que mudou é DE ONDE vêm os
  // números que entram nela. Um modelo novo aqui recriaria a divergência.
  assert.match(FONTE, /calcularPrecificacao\(\{/);
  assert.ok(
    !/COMISSAO_MODA|tabelaEnvioML/.test(FONTE),
    "a área interna passou a calcular a comissão por conta própria de novo"
  );
});

test("quando a consulta falha, a tela DIZ — não cai no padrão em silêncio", () => {
  assert.match(FONTE, /origemDasTaxas\?\.aviso/);
  assert.match(FONTE, /Não consegui consultar as taxas no Mercado Livre/);
});
