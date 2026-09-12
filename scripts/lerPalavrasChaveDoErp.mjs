// Lê as palavras-chave do ERP para um catálogo JÁ IMPORTADO.
//
// ===========================================================================
// POR QUE UM BACKFILL, E NÃO REIMPORTAR
// ===========================================================================
//
// A importação passou a ler gênero e tipo das palavras-chave (28/08). Mas o
// catálogo do percurso T1 entrou ANTES disso, com a coluna não mapeada — e
// rodar a importação de novo não corrige: ela é `insert` puro, e a mesma
// planilha deixaria 2006 produtos onde há 1003. Está registrado no AUD-006.
//
// O que falta lá não é o catálogo, são os atributos. Este script escreve só
// eles, casando pelo `cod_erp` que a importação já gravou.
//
// ===========================================================================
// A MESMA REGRA, NÃO UMA PARECIDA
// ===========================================================================
//
// `atributosParaOCadastro` é a função que a importação chama. Reimplementar a
// leitura aqui responderia por um sistema que não existe — e a origem gravada é
// a MESMA, `Importação`, para que a lojista confirme em `/cliente/atributos`
// antes de qualquer anúncio subir. Este script não publica nada: ele enche a
// fila de perguntas.
//
// ===========================================================================
// NÃO SOBRESCREVE
// ===========================================================================
//
// Produto que já tem aquele atributo — de qualquer origem — é pulado. O que a
// lojista respondeu não é tocado por um backfill, e rodar duas vezes não
// duplica a pergunta.
//
// Uso:
//
//   node --env-file=.env.staging --import tsx scripts/lerPalavrasChaveDoErp.mjs <clienteId> "<csv>"
//   node --env-file=.env.staging --import tsx scripts/lerPalavrasChaveDoErp.mjs <clienteId> "<csv>" --gravar
//
// SEM `--gravar` não escreve nada. Com `--simular` junto, também não.

import { readFileSync } from "node:fs";
import { clienteDaBase } from "./aBaseDoComando.mjs";
import { atributosParaOCadastro } from "../src/modules/publication/domain/composicaoConteudo.ts";
import { detectarDelimitador } from "../src/lib/csv.ts";
import { decodificarTexto } from "../src/lib/textoDeArquivo.ts";

const [clienteId, caminhoCsv] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SIMULAR = process.argv.includes("--simular");
const GRAVAR = process.argv.includes("--gravar") && !SIMULAR;
if (!clienteId || !caminhoCsv) {
  console.error(
    "uso: node --import tsx scripts/lerPalavrasChaveDoErp.mjs <clienteId> <arquivo.csv> [--gravar]"
  );
  process.exit(1);
}

const sb = clienteDaBase();

// ---------------------------------------------------------------------------
// O ARQUIVO. Windows-1252 e `;` na exportação do Magazord — `decodificarTexto`
// e `detectarDelimitador` são os mesmos que a importação usa, e foram medidos
// contra esta planilha em 26/08.
// ---------------------------------------------------------------------------
const lido = decodificarTexto(new Uint8Array(readFileSync(caminhoCsv)));
if (lido.temCorrupcao) {
  // O decodificador nunca lança: devolve o texto com marcas e a flag ligada.
  // Seguir daqui gravaria acento quebrado dentro do cadastro dela.
  console.error("o arquivo veio corrompido na leitura — não dá para confiar no que sai dele");
  process.exit(1);
}
const linhas = lido.texto.split(/\r?\n/).filter((l) => l.trim());
const sep = detectarDelimitador(linhas[0] ?? "");
const cabecalho = linhas[0].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
const iPai = cabecalho.findIndex((c) => /^c[oó]digo pai$/i.test(c));
const iKw = cabecalho.findIndex((c) => /^palavras\s*chave$/i.test(c));
if (iPai < 0 || iKw < 0) {
  console.error(`o arquivo não tem "Código Pai" e "Palavras Chave" — achei: ${cabecalho.join(", ")}`);
  process.exit(1);
}

/** cod_erp -> palavras-chave (a primeira preenchida do grupo). */
const kwPorCodigo = new Map();
for (const linha of linhas.slice(1)) {
  const campos = linha.split(sep);
  const cod = (campos[iPai] ?? "").trim().replace(/^"|"$/g, "");
  const kw = (campos[iKw] ?? "").trim().replace(/^"|"$/g, "");
  if (cod && kw && !kwPorCodigo.has(cod)) kwPorCodigo.set(cod, kw);
}
console.log(`planilha: ${linhas.length - 1} linhas · ${kwPorCodigo.size} códigos com palavras-chave`);

// ---------------------------------------------------------------------------
// O CATÁLOGO E O QUE JÁ EXISTE.
// ---------------------------------------------------------------------------
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
const produtos = await tudo("produtos", "id, nome, cod_erp", doCliente);
const jaTem = await tudo("produto_atributos", "produto_id, nome_atributo", doCliente);

const existentes = new Set(jaTem.map((a) => `${a.produto_id}|${a.nome_atributo}`));

const aGravar = [];
let semCodigo = 0;
let semPalavras = 0;
for (const p of produtos) {
  const cod = (p.cod_erp ?? "").trim();
  if (!cod) {
    semCodigo++;
    continue;
  }
  const kw = kwPorCodigo.get(cod);
  if (!kw) {
    semPalavras++;
    continue;
  }
  // Nome E palavras-chave, e cada um responde uma coisa: o tipo sai do nome
  // (foi o babuche que ensinou), o gênero sai dos dois.
  for (const a of atributosParaOCadastro({ nome: p.nome ?? "", palavrasChave: kw })) {
    if (existentes.has(`${p.id}|${a.nomeAtributo}`)) continue;
    aGravar.push({
      produto_id: p.id,
      cliente_id: clienteId,
      nome_atributo: a.nomeAtributo,
      valor_atributo: a.valorAtributo,
      tipo_atributo: "texto",
      obrigatorio: false,
      origem: "Importação",
    });
  }
}

const porValor = new Map();
for (const a of aGravar) {
  const k = `${a.nome_atributo} ${a.valor_atributo}`;
  porValor.set(k, (porValor.get(k) ?? 0) + 1);
}

console.log(
  `\nprodutos ${produtos.length} · sem cod_erp ${semCodigo} · sem palavras-chave na planilha ${semPalavras}`
);
console.log(`propostas a criar: ${aGravar.length}\n`);
for (const [k, n] of [...porValor].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}

if (!GRAVAR) {
  console.log("\nSIMULAÇÃO — nada foi escrito. Rode com --gravar para valer.");
  process.exit(0);
}

for (let i = 0; i < aGravar.length; i += 500) {
  const { error } = await sb.from("produto_atributos").insert(aGravar.slice(i, i + 500));
  if (error) {
    console.error(`\nERRO gravando (lote ${i / 500 + 1}): ${error.message}`);
    process.exit(1);
  }
}
console.log(`\nGRAVADO: ${aGravar.length} propostas, esperando confirmação em /cliente/atributos.`);
