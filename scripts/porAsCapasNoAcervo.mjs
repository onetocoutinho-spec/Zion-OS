// Põe as capas quadradas no ACERVO da lojista — o degrau antes de aplicar.
//
// ===========================================================================
// POR QUE ESTE PASSO EXISTE
// ===========================================================================
//
// `/api/ml/aplicar-capa` recebe um `imagemId`, não um arquivo: a foto precisa
// estar em `imagens_produto` antes. As 20 capas escolhidas no catálogo Beira
// Rio e quadradas por `quadrarAsEscolhidas.mjs` estão em disco, e disco não é
// acervo.
//
// Este script fecha essa distância, e só ela. Ele NÃO fala com o Mercado Livre,
// não aplica capa nenhuma e não muda anúncio.
//
// ===========================================================================
// MESMAS REGRAS DA TELA, NÃO REGRAS PARECIDAS
// ===========================================================================
//
// Bucket, caminho e slug são os de `subirFotosDaPasta` — que por sua vez são os
// de `storageImagens`. Um script com convenção própria gravaria num lugar que a
// tela não lê, e aí a foto existiria sem aparecer.
//
// ===========================================================================
// POR QUE ELAS ENTRAM COMO `Secundária`
// ===========================================================================
//
// A migração 053 criou `idx_imagens_produto_uma_capa`: UMA "Principal" por
// produto, garantido pelo banco. Todos estes produtos já têm a delas.
//
// Marcar a nova como Principal exigiria rebaixar a antiga — e isso é decisão
// sobre o catálogo da lojista, não sobre o anúncio. O que precisa mudar é a
// capa NO MERCADO LIVRE, e quem faz isso é `aplicar-capa`, por `imagemId`,
// sem olhar `tipo_imagem`.
//
// Então a foto entra como Secundária e carrega a `cor` — que é o campo pelo
// qual a aplicação vai encontrá-la.
//
// ===========================================================================
// UMA REFERÊNCIA PODE SER DOIS PRODUTOS
// ===========================================================================
//
// `7142.106` é "Tresse Alba" e "Tres Berlim" — mesma referência do fabricante,
// dois produtos no Zion, com anúncios separados. A mesma capa precisa de uma
// LINHA EM CADA, porque `imagens_produto` é por produto.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/porAsCapasNoAcervo.mjs <clienteId>
//   node --env-file=.env.local --import tsx scripts/porAsCapasNoAcervo.mjs <clienteId> --gravar
//
// Sem `--gravar` ele só diz o que faria, linha por linha.

import { readFileSync } from "node:fs";
import { clienteDaBase } from "./aBaseDoComando.mjs";

const [clienteId] = process.argv.slice(2);
const GRAVAR = process.argv.includes("--gravar");
if (!clienteId) {
  console.error("uso: node scripts/porAsCapasNoAcervo.mjs <clienteId> [--gravar]");
  process.exit(1);
}

const BUCKET = "produtos-imagens";
const LISTA = "backup/capas-prontas/lista.json";
const capas = JSON.parse(readFileSync(LISTA, "utf8"));

const sb = clienteDaBase();
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

/** O mesmo slug de `storageImagens`, para o caminho sair idêntico ao da tela. */
function slugArquivo(nome) {
  const ponto = nome.lastIndexOf(".");
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  const ext = ponto > 0 ? nome.slice(ponto + 1).toLowerCase() : "jpg";
  const limpo = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${limpo || "foto"}.${ext}`;
}

const produtos = await tudo("produtos", "id, nome, modelo", doCliente);
const imagens = await tudo("imagens_produto", "id, produto_id, url, cor, tipo_imagem, observacoes, largura, altura", doCliente);
const anuncios = await tudo("anuncios_gerados", "produto_id, status_marketplace", doCliente);
const refDe = (p) => (/(\d{3,5}\.\d{1,3})/.exec(String(p?.modelo ?? "")) ?? [])[1] ?? null;

// A REFERÊNCIA NÃO BASTA, e isso quase pôs foto errada em produto certo.
//
// `7208.101` é "Micr Perf Suprem" E "Nobuck" — mesma referência do fabricante,
// MATERIAIS diferentes. A capa foi escolhida olhando o nome do produto ("micro
// perfurado"), e aplicá-la no Nobuck seria a foto de outro sapato.
//
// `7142.101` tem três produtos e só um estava na lista dos treze; `7142.106`
// tem três e dois estavam.
//
// O alvo é o mesmo do ensaio: produto que o ML segura E cuja melhor foto no
// acervo não chega a 1200. Quem já tem foto grande não precisa desta, e quem
// não está parado não é para ser tocado.
const emRevisao = new Set(anuncios.filter((a) => a.status_marketplace === "under_review").map((a) => a.produto_id));
const maiorFoto = new Map();
for (const i of imagens) {
  if (!i.largura || !i.altura) continue;
  maiorFoto.set(i.produto_id, Math.max(maiorFoto.get(i.produto_id) ?? 0, Math.max(i.largura, i.altura)));
}
const precisa = (id) => emRevisao.has(id) && (maiorFoto.get(id) ?? 0) < 1200;

const planejadas = [];
for (const c of capas) {
  const alvos = produtos.filter((p) => refDe(p) === c.ref && precisa(p.id));
  if (alvos.length === 0) {
    console.log(`  ! ${c.ref} ${c.cor} — nenhum produto parado E sem foto grande com esta referência`);
    continue;
  }
  for (const p of alvos) {
    // JÁ ESTÁ LÁ? A marca é a observação, que carrega o arquivo de origem.
    // Sem isto, rodar duas vezes deixa a mesma capa duplicada no acervo — e
    // duplicata de foto é o defeito que este repositório já pagou duas vezes.
    const marca = `Catálogo da marca: ${c.arquivo}`;
    const jaTem = imagens.some((i) => i.produto_id === p.id && String(i.observacoes ?? "").includes(c.arquivo));
    planejadas.push({ capa: c, produto: p, marca, jaTem });
  }
}

const novas = planejadas.filter((x) => !x.jaTem);
const repetidas = planejadas.filter((x) => x.jaTem);
console.log(`capas prontas: ${capas.length} · linhas planejadas: ${planejadas.length}\n`);
for (const x of planejadas) {
  console.log(
    `  ${x.jaTem ? "já está" : "ENTRA  "} ${String(x.capa.ref).padEnd(9)} ${String(x.capa.cor).padEnd(7)} → ${String(x.produto.nome).slice(0, 44)}`
  );
}
console.log(`\nentram ${novas.length} · já estavam ${repetidas.length}`);

if (!GRAVAR) {
  console.log(`\n(planejamento apenas — nada foi enviado ao Storage nem gravado. Rode com --gravar.)`);
  process.exit(0);
}

// ---- envia ----------------------------------------------------------------
let ok = 0;
let falhas = 0;
const registros = [];
for (const x of novas) {
  const nomeArquivo = `${x.capa.ref.replace(".", "-")}-${x.capa.cor.toLowerCase()}.jpg`;
  const caminho = `${clienteId}/${x.produto.id}/${Date.now()}-${slugArquivo(nomeArquivo)}`;
  const { error } = await sb.storage.from(BUCKET).upload(caminho, readFileSync(x.capa.arquivoQuadrado), {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) {
    falhas++;
    console.error(`  falha ao subir ${x.capa.ref} ${x.capa.cor}: ${error.message}`);
    continue;
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(caminho);
  registros.push({
    cliente_id: clienteId,
    produto_id: x.produto.id,
    variante_id: null,
    anuncio_id: null,
    // Secundária por causa do índice de capa única — ver o topo.
    tipo_imagem: "Secundária",
    url: data.publicUrl,
    status: "Aprovada",
    observacoes: x.marca,
    cor: x.capa.cor,
    // As duas dimensões vão preenchidas: `quadrarCapa` garante o quadrado, e
    // gravar o que se sabe evita que a tela precise baixar a imagem para medir.
    largura: 1200,
    altura: 1200,
  });
  ok++;
}

if (registros.length > 0) {
  // Uma por vez, com o erro capturado: `supabase-js` NÃO LANÇA em erro de banco
  // (INC-004), e um insert em lote recusado viraria "subi 20" com zero linhas.
  let gravadas = 0;
  for (const r of registros) {
    const { error } = await sb.from("imagens_produto").insert(r);
    if (error) {
      falhas++;
      console.error(`  linha recusada (${r.cor}): ${error.message}`);
      continue;
    }
    gravadas++;
  }
  console.log(`\narquivos no Storage: ${ok} · linhas em imagens_produto: ${gravadas} · falhas: ${falhas}`);
} else {
  console.log(`\nnada a gravar.`);
}

// CONFERE LENDO DE VOLTA. Escrita aceita não é escrita aplicada.
const depois = await tudo("imagens_produto", "id, produto_id, cor, observacoes", doCliente);
const doCatalogo = depois.filter((i) => String(i.observacoes ?? "").startsWith("Catálogo da marca:"));
console.log(`conferido no banco: ${doCatalogo.length} imagens marcadas como vindas do catálogo da marca`);
console.log("NADA foi aplicado no Mercado Livre — as capas agora estão no acervo, e é `aplicar-capa` que as põe no anúncio.");
