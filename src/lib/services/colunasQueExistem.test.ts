// As colunas citadas no código EXISTEM na tabela.
//
// ===========================================================================
// O DEFEITO QUE ISTO PEGA — MEDIDO EM PRODUÇÃO, 10/08/2026
// ===========================================================================
//
// `preparacaoDeAnuncio.ts` lia e ordenava `anuncios_gerados` por `criado_em`.
// A coluna se chama `created_at`. Ela NUNCA existiu com esse nome.
//
// O PostgREST responde a coluna inexistente com erro, o serviço captura, e
// devolve `null`. Para quem usa, `null` é indistinguível de "não há anúncio" —
// então `propor_titulo`, que está no ar, respondia "esse produto ainda não tem
// anúncio gerado" para TODO produto, inclusive os 880 que têm.
//
// Nenhum teste pegou porque nenhum fala com o banco: o dublê responde ao que
// lhe perguntam, e uma coluna inventada é uma pergunta como outra qualquer.
//
// ===========================================================================
// POR QUE VARRER O FONTE
// ===========================================================================
//
// Não dá para consultar o schema daqui. O que dá é garantir que o nome usado
// no código é o mesmo em todos os lugares que tocam a tabela — e que o nome
// ERRADO, agora conhecido, não volta.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";

const DIR = new URL("./", import.meta.url);
const FONTES = readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
  .map((f) => ({ nome: f, texto: readFileSync(new URL(f, DIR), "utf8") }));

/** Sem comentários: um arquivo pode CITAR o nome errado ao contar a história. */
const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("`criado_em` NÃO aparece em nenhum arquivo que toca `anuncios_gerados`", () => {
  // O nome errado, agora conhecido. Se voltar, volta com o mesmo silêncio.
  // A busca é sobre o CÓDIGO: em 24/08/2026 este teste reprovou por causa de um
  // COMENTÁRIO que citava o defeito de 10/08 ao registrar um parente dele. Um
  // guarda que proíbe contar a própria história ensina a apagá-la.
  const culpados = FONTES.filter(
    (f) => f.texto.includes("anuncios_gerados") && /\bcriado_em\b/.test(semComentarios(f.texto))
  ).map((f) => f.nome);
  assert.deepEqual(
    culpados,
    [],
    `voltou a coluna inexistente \`criado_em\` em: ${culpados.join(", ")} — o serviço devolveria null e a ferramenta diria "não tem anúncio"`
  );
});

test("NENHUMA coluna `*_override` inventada em `produtos`", () => {
  // O override da tabela de medidas mora em `produtos.tabela_medidas`. Supus
  // `tabela_medidas_override` e a ferramenta respondeu "não achei esse produto"
  // sobre um produto que existe — PostgREST erra na coluna, `maybeSingle`
  // devolve null, e null é indistinguível de ausência.
  const rota = readFileSync(
    new URL("../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  // SÓ O CÓDIGO. Comentários podem — e devem — nomear o erro para quem lê; o
  // que não pode é o código voltar a usá-lo. Mesma correção que a sentinela do
  // roteador de planilhas precisou hoje.
  const soCodigo = rota
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/tabela_medidas_override/.test(soCodigo),
    "voltou a coluna inexistente `tabela_medidas_override` — a ferramenta diria que o produto não existe"
  );
});

test("quem ordena `anuncios_gerados` usa `created_at`", () => {
  const prep = FONTES.find((f) => f.nome === "preparacaoDeAnuncio.ts");
  assert.ok(prep, "preparacaoDeAnuncio.ts sumiu");
  assert.match(prep!.texto, /\.order\("created_at"/, "a ordenação perdeu o nome real da coluna");
});

test("o `catch` que engoliu o erro continua DIZENDO que engoliu", () => {
  // A captura não é o defeito — sem ela um erro de rede derrubaria a conversa.
  // O defeito foi ninguém ver o log. Ele tem que continuar existindo.
  const prep = FONTES.find((f) => f.nome === "preparacaoDeAnuncio.ts")!.texto;
  const quantos = (prep.match(/console\.error\(/g) ?? []).length;
  assert.ok(quantos >= 2, `esperava logs nos catch de leitura, achei ${quantos}`);
});

// ===========================================================================
// A TRAVA GERAL — porque a de cima só pegava o nome errado JÁ CONHECIDO
// ===========================================================================
//
// Em 24/08/2026 o mesmo defeito voltou, no mesmo arquivo-alvo e com outro
// nome: `anunciosNoArNoServidor.ts` pedia a coluna `produto` de
// `anuncios_gerados`. Ela não existe — o nome do produto chega por EMBED
// (`produtos(nome)`), e é o TIPO de aplicação que tem o campo `produto`.
//
// O PostgREST recusa a consulta inteira, `lerTudoPaginado` lança, e as três
// ferramentas de anúncio (`anuncios_ativos`, `anuncios_a_corrigir`,
// `diagnostico_de_agrupamento`) nasceram quebradas. Passaram por tsc, por
// eslint e por 3.268 testes: nenhum deles fala com o banco, e o defeito só
// apareceu quando a lojista perguntou.
//
// A trava de cima é uma LISTA NEGRA de um nome. Esta compara o que o código
// PEDE com o que o tipo gerado DECLARA — pega o próximo nome errado, que
// ninguém conhece ainda.
//
// Limite honesto: `database.types.ts` é escrito à mão neste projeto, então ele
// pode divergir do banco. Ele é a melhor fonte disponível sem rede, e uma
// divergência entre código e tipo já é defeito por si só.

const TIPOS = readFileSync(new URL("../supabase/database.types.ts", DIR), "utf8");

/** tabela → interface de linha. Só as que têm tipo declarado. */
const ROW_DA_TABELA: Readonly<Record<string, string>> = {
  anuncios_gerados: "AnuncioGeradoRow",
  produtos: "ProdutoRow",
  produto_variantes: "ProdutoVarianteRow",
  produto_atributos: "ProdutoAtributoRow",
  imagens_produto: "ImagemProdutoRow",
  anuncio_variantes: "AnuncioVarianteRow",
  tabelas_medidas: "TabelaMedidaRow",
};

/** Os campos declarados numa interface de linha. */
function camposDe(nomeDaInterface: string): Set<string> {
  const i = TIPOS.indexOf(`export interface ${nomeDaInterface} {`);
  assert.ok(i >= 0, `não achei a interface ${nomeDaInterface}`);
  const corpo = TIPOS.slice(i, TIPOS.indexOf("\n}", i));
  return new Set([...corpo.matchAll(/^\s{2}([a-z_]+)\??:/gm)].map((m) => m[1]));
}

/** Os `.from("x").select("...")` de um arquivo, com a tabela junto. */
function selecoesDe(texto: string): { tabela: string; colunas: string[] }[] {
  const saida: { tabela: string; colunas: string[] }[] = [];
  for (const m of texto.matchAll(/\.from\("([a-z_]+)"\)([\s\S]{0,400}?)\.select\("([^"]*)"\)/g)) {
    // Só a MESMA cadeia: se houver outro `.from(` no meio, o par não é de verdade.
    if (m[2].includes(".from(")) continue;
    const colunas = m[3]
      // Embeds primeiro: `produtos(nome, marca)` tem vírgulas DENTRO, e separar
      // por vírgula antes de removê-los parte o embed ao meio — foi o que fez a
      // primeira versão desta trava acusar `modelo)` de ser coluna.
      // `produtos!inner(id, nome)` também é embed: o `!hint` faz parte do nome
      // da relação, e sem ele na classe o resto do embed vaza como "coluna".
      .replace(/[a-z_]+(?:![a-z_]+)?\([^)]*\)/g, "")
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c && c !== "*")
      .map((c) => c.split(":").pop()!.trim());
    saida.push({ tabela: m[1], colunas });
  }
  return saida;
}

test("toda coluna pedida num `.select` existe no tipo da tabela", () => {
  const erros: string[] = [];
  for (const f of FONTES) {
    for (const { tabela, colunas } of selecoesDe(f.texto)) {
      const row = ROW_DA_TABELA[tabela];
      if (!row) continue; // tabela sem tipo declarado — fora do alcance desta trava
      const campos = camposDe(row);
      for (const c of colunas) {
        if (!campos.has(c)) erros.push(`${f.nome}: ${tabela}.${c} não existe em ${row}`);
      }
    }
  }
  assert.deepEqual(
    erros,
    [],
    "\n\nColuna pedida ao PostgREST que o tipo não declara. O PostgREST recusa a\n" +
      "CONSULTA INTEIRA, e quem chama costuma ler isso como 'não há dados'.\n"
  );
});

test("a varredura enxerga as consultas que deveria — senão ela passa vazia", () => {
  // Uma trava que não encontra nada passa sempre. Este teste é o teste dela.
  const encontradas = FONTES.flatMap((f) => selecoesDe(f.texto)).filter(
    (s) => s.tabela in ROW_DA_TABELA
  );
  assert.ok(encontradas.length >= 10, `só ${encontradas.length} consultas cobertas — a regex parou de casar`);
  assert.ok(
    encontradas.some((s) => s.tabela === "anuncios_gerados" && s.colunas.includes("ml_item_id")),
    "a consulta que quebrou em 24/08 não está sendo enxergada"
  );
});
