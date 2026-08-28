// O ENSAIO DO PASSO 7, sem conta de teste e sem pôr nada no ar.
//
// ===========================================================================
// A PERGUNTA
// ===========================================================================
//
// AUD-006 fechou o CHECKPOINT 1 com "chega até o anúncio aprovado, e para antes
// do ar", e o número que ficou foi 361 PUBLICÁVEIS — aprovados, sem pendência,
// com foto, preço, grade e categoria.
//
// "Publicável" ali quer dizer: passou nas regras da ESTEIRA. Não quer dizer que
// o Mercado Livre aceitaria. Quem decide isso é a categoria, e a conferência que
// a lê (`obrigatoriosAusentes` + `atributosObrigatorios`) só roda no momento da
// publicação — que é justamente o passo que não pode ser percorrido, porque a
// guarda 2 proíbe publicar pela conexão da loja que vende.
//
// Então este script faz a conferência SEM a publicação. Nada de rede autenticada,
// nada de token, nada que escreva: só o endpoint PÚBLICO de categorias do ML.
//
// ===========================================================================
// A REGRA É A DO CÓDIGO, NÃO UMA PARECIDA
// ===========================================================================
//
// `montarItemML` e `obrigatoriosAusentes` são as MESMAS funções que
// `publicarNoMercadoLivre` chama nos passos 4.5 e 6. Reimplementar a checagem
// aqui responderia por um sistema que não existe — é a escolha que
// `recomporVeredictos.mjs` já registrou.
//
// O que este ensaio NÃO cobre, e por isso não pode ser lido como "publicaria":
//
//   - token, canal e trava de infração (precisam da conexão real);
//   - o modelo USER PRODUCTS, cujo caminho real também não confere obrigatórios;
//   - o que só o ML sabe na hora (duplicidade, moderação, saldo).
//
// ===========================================================================
// CATEGORIA MUDA, E O SILÊNCIO DELA NÃO PODE VIRAR APROVAÇÃO
// ===========================================================================
//
// `atributosObrigatorios` devolve `[]` quando o ML não responde — de propósito:
// sem confirmação, não se bloqueia ninguém. Para MEDIR, esse mesmo `[]` é
// veneno: uma queda de rede faria os 361 passarem.
//
// Por isso cada categoria é confirmada uma vez, direto no endpoint, ANTES de
// valer como resposta. Categoria que não respondeu entra como NÃO MEDIDA e
// aparece separada no relatório. É a mesma distinção de sempre: null é null.
//
// Uso:
//
//   node --env-file=.env.local --import tsx scripts/ensaioDaPublicacao.mjs <clienteId>
//   node --env-file=.env.local --import tsx scripts/ensaioDaPublicacao.mjs <clienteId> --todos
//
// `--todos` ensaia também os NÃO publicáveis, para medir a distância que falta.

import { createClient } from "@supabase/supabase-js";
import { montarItemML } from "../src/modules/integration/domain/mlPayload.ts";
import {
  obrigatoriosAusentes,
  doCadastroParaOPayload,
} from "../src/modules/integration/domain/exigenciasDoPayload.ts";
import { atributosObrigatorios } from "../src/lib/marketplaces/mercadolivre.ts";
import { resolverObrigatorios } from "../src/modules/publication/domain/atributosDoMarketplace.ts";

const [clienteId] = process.argv.slice(2);
const TODOS = process.argv.includes("--todos");
if (!clienteId) {
  console.error("uso: node --import tsx scripts/ensaioDaPublicacao.mjs <clienteId> [--todos]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, chave, { auth: { persistSession: false } });

/** Leitura paginada: o PostgREST corta em 1000 e o catálogo passa disso. */
async function tudo(tabela, colunas, filtro = (q) => q) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await filtro(sb.from(tabela).select(colunas)).range(i, i + 999);
    if (error) {
      console.error(`erro lendo ${tabela}: ${error.message}`);
      process.exit(1);
    }
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const doCliente = (q) => q.eq("cliente_id", clienteId);

const anuncios = await tudo(
  "anuncios_gerados",
  "id, produto_id, veredito_a10, qtd_pendencias, categoria_ml, tipo_anuncio_ml, anuncio",
  doCliente
);
const produtos = await tudo("produtos", "id, nome, preco_venda, sku, cod_erp, estoque", doCliente);
const imagens = await tudo("imagens_produto", "produto_id, url", doCliente);
const atributosDoCadastro = await tudo(
  "produto_atributos",
  "produto_id, nome_atributo, valor_atributo",
  doCliente
);

/** produto -> { "Gênero" -> "Feminino" }, a forma que `resolverObrigatorios` lê. */
const cadastroPorProduto = new Map();
for (const a of atributosDoCadastro) {
  if (!a.produto_id || !a.valor_atributo?.trim()) continue;
  if (!cadastroPorProduto.has(a.produto_id)) cadastroPorProduto.set(a.produto_id, new Map());
  cadastroPorProduto.get(a.produto_id).set(a.nome_atributo, a.valor_atributo.trim());
}

const porId = new Map(produtos.map((p) => [p.id, p]));
const fotosDoProduto = new Map();
for (const i of imagens) {
  if (!i.produto_id || !i.url) continue;
  if (!fotosDoProduto.has(i.produto_id)) fotosDoProduto.set(i.produto_id, []);
  fotosDoProduto.get(i.produto_id).push(i.url);
}

const publicavel = (a) => a.veredito_a10 === "aprovado" && (a.qtd_pendencias ?? 0) === 0;
const fila = TODOS ? anuncios : anuncios.filter(publicavel);

console.log(
  `anúncios: ${anuncios.length} · publicáveis: ${anuncios.filter(publicavel).length} · ` +
    `no ensaio: ${fila.length}\n`
);

// ---------------------------------------------------------------------------
// AS CATEGORIAS, CONFIRMADAS UMA VEZ CADA.
// ---------------------------------------------------------------------------
const categorias = [...new Set(fila.map((a) => (a.categoria_ml ?? "").trim()).filter(Boolean))];
console.log(`categorias distintas: ${categorias.length} — confirmando no ML...`);

/** categoria -> { exigencias, respondeu } */
const exigenciasPorCategoria = new Map();
for (const c of categorias) {
  let respondeu = false;
  try {
    const r = await fetch(`https://api.mercadolibre.com/categories/${encodeURIComponent(c)}/attributes`);
    respondeu = r.ok;
  } catch {
    respondeu = false;
  }
  const exigencias = respondeu ? await atributosObrigatorios(c) : [];
  exigenciasPorCategoria.set(c, { exigencias, respondeu });
  console.log(
    `  ${c}  ${respondeu ? `${exigencias.length} obrigatório(s)` : "NÃO RESPONDEU — não medido"}`
  );
}
console.log("");

// ---------------------------------------------------------------------------
// O ENSAIO.
// ---------------------------------------------------------------------------
const resultado = { passou: 0, semCategoria: 0, semProduto: 0, naoMedido: 0, faltando: 0, resolviveis: 0, preenchidos: 0 };
const porAtributo = new Map();
const porOrigem = new Map();
const exemplos = [];

for (const a of fila) {
  const categoria = (a.categoria_ml ?? "").trim();
  if (!categoria) {
    resultado.semCategoria++;
    continue;
  }
  const p = a.produto_id ? porId.get(a.produto_id) : null;
  if (!p) {
    resultado.semProduto++;
    continue;
  }
  const { exigencias, respondeu } = exigenciasPorCategoria.get(categoria) ?? { respondeu: false };
  if (!respondeu) {
    resultado.naoMedido++;
    continue;
  }

  const payload = montarItemML({
    produto: {
      precoVenda: p.preco_venda ?? 0,
      estoque: p.estoque ?? 1,
      sku: p.sku ?? "",
      codErp: p.cod_erp ?? "",
    },
    anuncio: a.anuncio,
    categoryId: categoria,
    tipoAnuncio: a.tipo_anuncio_ml ?? "",
    pictures: fotosDoProduto.get(a.produto_id) ?? [],
  });

  let ausentes = obrigatoriosAusentes(payload, exigencias);

  // ---- O MESMO PREENCHIMENTO QUE A PUBLICAÇÃO FAZ, na mesma ordem.
  //
  // `publicarNoMercadoLivre` pergunta ao cadastro antes de recusar, com estas
  // duas funções. O ensaio precisa fazer o mesmo, senão mede um sistema que não
  // existe mais — e o número que ele imprime deixa de prever coisa alguma.
  const dados = {
    nome: p.nome ?? "",
    marca: "",
    modelo: "",
    cores: [],
    tamanhos: [],
    atributos: cadastroPorProduto.get(a.produto_id) ?? new Map(),
  };
  if (ausentes.length > 0) {
    const doCadastro = doCadastroParaOPayload(ausentes, resolverObrigatorios(dados, exigencias));
    if (doCadastro.length > 0) {
      payload.attributes = [...(payload.attributes ?? []), ...doCadastro];
      resultado.preenchidos++;
      ausentes = obrigatoriosAusentes(payload, exigencias);
    }
  }

  if (ausentes.length === 0) {
    resultado.passou++;
    continue;
  }
  resultado.faltando++;
  for (const at of ausentes) porAtributo.set(at.id, (porAtributo.get(at.id) ?? 0) + 1);

  // ---- E O SISTEMA JÁ SABERIA RESPONDER?
  //
  // `resolverObrigatorios` lê o cadastro, depois o marketplace, depois o nome —
  // e devolve `null` quando não sabe. Ele já roda: alimenta o BRIEFING que o
  // modelo recebe. O que ele não faz é entrar no payload; o payload leva só o
  // que o modelo escolheu escrever na ficha técnica.
  //
  // Então a pergunta que decide o tamanho do conserto é esta: dos que faltam,
  // quantos o resolvedor responde sozinho, sem perguntar nada a ninguém?
  const resolvidos = resolverObrigatorios(dados, ausentes);
  for (const r of resolvidos) {
    const chave = `${r.id}|${r.valor ? r.origem : "ausente"}`;
    porOrigem.set(chave, (porOrigem.get(chave) ?? 0) + 1);
  }
  if (resolvidos.every((r) => r.valor)) resultado.resolviveis++;
  if (exemplos.length < 8) {
    exemplos.push(`  ${p.nome?.slice(0, 46).padEnd(46)} ${categoria}  falta: ${ausentes.map((x) => x.id).join(", ")}`);
  }
}

console.log("=".repeat(72));
console.log("ENSAIO — go:false, nada foi enviado ao Mercado Livre");
console.log("=".repeat(72));
console.log(`  passariam na conferência da categoria .. ${resultado.passou}`);
console.log(`    destes, completados pelo cadastro ..... ${resultado.preenchidos}`);
console.log(`  faltando atributo obrigatório .......... ${resultado.faltando}`);
console.log(`  sem categoria definida ................. ${resultado.semCategoria}`);
console.log(`  sem produto no cadastro ................ ${resultado.semProduto}`);
console.log(`  categoria que o ML não respondeu ....... ${resultado.naoMedido}`);

if (porAtributo.size > 0) {
  console.log("\natributos que mais faltam:");
  for (const [id, n] of [...porAtributo].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${String(n).padStart(4)}  ${id}`);
  }
  console.log(
    `\ndos ${resultado.faltando} recusados, o resolvedor responde TODOS os ausentes em ${resultado.resolviveis}`
  );
  console.log("de onde viria cada resposta:");
  for (const [chave, n] of [...porOrigem].sort((x, y) => y[1] - x[1])) {
    const [id, origem] = chave.split("|");
    console.log(`  ${String(n).padStart(4)}  ${id.padEnd(16)} ${origem}`);
  }

  console.log("\nexemplos:");
  for (const e of exemplos) console.log(e);
}
