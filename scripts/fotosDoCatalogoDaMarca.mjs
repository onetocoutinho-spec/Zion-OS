// Busca no catálogo PÚBLICO da marca a foto que o acervo não tem em tamanho.
//
// ===========================================================================
// O CASO, MEDIDO EM 31/08/2026
// ===========================================================================
//
// O Mercado Livre parou 142 anúncios desta loja pedindo capa quadrada com 1200
// de lado. Em 13 produtos (78 anúncios) NENHUMA foto do acervo passa de 606px,
// e `quadrarCapa` recusa ampliar — com razão: ampliar borra, e borrada é o que
// o ML está punindo.
//
// As 635 imagens do acervo vieram do próprio ML e já são o arquivo `-O.jpg`, o
// original de lá. Não há versão maior escondida no que temos. Mas há fora.
//
// ===========================================================================
// A DESCOBERTA: A PASTA `alta`
// ===========================================================================
//
// Modare, Moleca, Vizzano e Actvitta são do grupo Beira Rio e publicam catálogo
// aberto, indexado pela MESMA referência que o ERP usa ("REF. 7142.101"). As
// páginas servem a imagem de um bucket comum:
//
//     imagens.catalogobeirario.com.br/grandes/7142-101-30155-15745.jpg   800x545
//     imagens.catalogobeirario.com.br/alta/7142-101-30155-15745.jpg     1890x847
//
// Sondadas onze pastas; só três existem — `pequenas`, `grandes` e `alta`. A
// troca de um segmento da URL é a diferença entre 545 e 847 de altura, e entre
// recusar e publicar.
//
// O catálogo B2B do grupo (catalogobeirario.com.br:8181) pede usuário e senha e
// NÃO é usado aqui: o que este script lê é o bucket público das imagens.
//
// ===========================================================================
// ELE ENTREGA UMA FOLHA DE CONTATO, E NÃO ESCOLHE A COR
// ===========================================================================
//
// A referência dá o MODELO. A COR não sai daqui, e a tentativa de deduzi-la
// falhou de um jeito que vale registrar — porque ela parecia boa.
//
// A ideia era ordenar os candidatos por semelhança com a foto que já temos: ela
// É o produto e a cor certos, então serviria de gabarito. Uma assinatura de
// 12x12 pixels separa duas cores da mesma referência com distância 20,9, o que
// parecia bastante.
//
// Só que a MELHOR distância contra a nossa foto deu 29,2 — mais longe do que
// duas cores diferentes estão entre si. O motivo apareceu ao abrir o arquivo: a
// nossa foto é um RECORTE DA PALMILHA, não o produto inteiro. A assinatura
// estava comparando enquadramento, não cor. E o primeiro colocado para um
// produto que a loja vende em Marrom era rosé.
//
// Um ranking errado é pior que nenhum: ele empurra a pessoa para o topo da
// lista. Então o script não ordena por palpite — ele monta uma FOLHA DE CONTATO
// por referência, todas as cores lado a lado com o nome do arquivo embaixo, e
// quem conhece o produto aponta.
//
// Baixar as 311 imagens em tamanho cheio (316 MB, 54 cores de uma bolsa que a
// loja vende em três) também foi tentado e descartado: uma pasta com 311
// arquivos não é entrega, é despejo.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/fotosDoCatalogoDaMarca.mjs <clienteId>
//   node --env-file=.env.local --import tsx scripts/fotosDoCatalogoDaMarca.mjs <clienteId> --folhas
//   node --env-file=.env.local --import tsx scripts/fotosDoCatalogoDaMarca.mjs <clienteId> --pegar 7142-101-9837-83598
//
// Sem bandeira ele só procura e conta. `--folhas` monta as folhas de contato.
// `--pegar <nome>` baixa UMA imagem em tamanho cheio, a que a pessoa escolheu.

import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { clienteDaBase } from "./aBaseDoComando.mjs";

const [clienteId] = process.argv.slice(2);
const FOLHAS = process.argv.includes("--folhas");
const iPegar = process.argv.indexOf("--pegar");
const PEGAR = iPegar >= 0 ? process.argv[iPegar + 1] : null;
if (!clienteId) {
  console.error("uso: node scripts/fotosDoCatalogoDaMarca.mjs <clienteId> [--folhas | --pegar <nome>]");
  process.exit(1);
}

/** O lado que o Mercado Livre exige na capa — o mesmo de `quadrarCapa`. */
const LADO_ALVO = 1200;
const DESTINO = "backup/fotos-do-catalogo";

/**
 * O bucket comum das marcas do grupo, e por que ele e não os sites.
 *
 * A primeira versão raspava o site público de cada marca
 * (`modareultraconforto`, `moleca`, `vizzano`, `actvitta`), que indexa pela
 * mesma referência do ERP. Funcionou para 10 dos 13 — e os 3 que falharam
 * mostraram por que a fonte estava errada:
 *
 *   Actvitta 4849.302 .. o site não devolve a referência. O bucket tem 5 fotos.
 *   Moleca 50063.1 ..... idem. O bucket tem 5.
 *   Moleca 5579.101 .... o site mostra UMA cor, e é a única sem versão `alta`.
 *                        Outras cinco cores da mesma referência têm.
 *
 * O site mostra a coleção corrente; o bucket guarda o que existe. Listar por
 * prefixo é mais simples (uma origem, nenhuma marca a mapear), mais completo
 * (todas as cores) e não depende de o HTML da marca continuar igual.
 */
const BUCKET = "https://s3-sa-east-1.amazonaws.com/imagens.catalogobeirario.com.br";

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

// ---- 1. quem precisa ------------------------------------------------------
// Só os que o ML está segurando E cuja melhor foto não alcança o alvo. Produto
// que já tem foto grande não entra: para ele o conserto é promover e quadrar, e
// isso a rota `melhor-capa` faz sem baixar nada.
const anuncios = await tudo("anuncios_gerados", "produto_id, status_marketplace", doCliente);
const imagens = await tudo("imagens_produto", "produto_id, largura, altura", doCliente);
const produtos = await tudo("produtos", "id, nome, marca, modelo", doCliente);
const fichaDo = new Map(produtos.map((p) => [p.id, p]));
const fotosDe = new Map();
for (const i of imagens) {
  if (!fotosDe.has(i.produto_id)) fotosDe.set(i.produto_id, []);
  fotosDe.get(i.produto_id).push(i);
}
const emRevisao = anuncios.filter((a) => a.status_marketplace === "under_review");

const alvos = [];
for (const pid of new Set(emRevisao.map((a) => a.produto_id))) {
  const medidas = (fotosDe.get(pid) ?? []).filter((x) => x.largura && x.altura);
  const maior = Math.max(0, ...medidas.map((x) => Math.max(x.largura, x.altura)));
  if (maior >= LADO_ALVO) continue;
  const f = fichaDo.get(pid) ?? {};
  alvos.push({
    pid,
    nome: f.nome ?? "(sem nome)",
    marca: f.marca ?? "",
    // A REFERÊNCIA É O QUE INDEXA O CATÁLOGO, e ela está em `modelo`
    // ("7142.101 CANELADO/ELASTICO"). O primeiro pedaço é o código; o resto é
    // o nome comercial do material e não entra na busca.
    ref: (/(\d{3,5}\.\d{1,3})/.exec(String(f.modelo ?? f.nome ?? "")) ?? [])[1] ?? null,
    anuncios: emRevisao.filter((a) => a.produto_id === pid).length,
    maiorNoAcervo: maior,
  });
}
alvos.sort((a, b) => b.anuncios - a.anuncios);
console.log(`produtos parados sem foto grande: ${alvos.length} · ${alvos.reduce((s, x) => s + x.anuncios, 0)} anúncios\n`);

// ---- 2. procura no bucket do grupo ---------------------------------------
/** Todas as fotos em `alta` daquela referência, listadas do bucket. */
async function procurar(ref) {
  // O hífen no lugar do ponto é como o bucket nomeia: "7142.101" -> "7142-101".
  // E o hífen FINAL não é enfeite: sem ele, o prefixo "5006" traria 50063 e
  // 50060 juntos, e a foto de um produto viraria capa de outro.
  const chave = `${ref.replace(".", "-")}-`;
  const url = `${BUCKET}?list-type=2&prefix=alta/${encodeURIComponent(chave)}&max-keys=60`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) return { erro: `HTTP ${r.status} ao listar`, urls: [] };
  const xml = await r.text();
  const chaves = [...xml.matchAll(/<Key>(alta\/[^<]+\.jpg)<\/Key>/g)].map((m) => m[1]);
  return { erro: null, urls: chaves.map((k) => `${BUCKET}/${k}`) };
}

// ---- 2b. --pegar: uma imagem, em tamanho cheio ----------------------------
// O atalho para depois da escolha. O nome vem da folha de contato, e a URL é
// derivável dele — quem escolheu não precisa saber de bucket nem de pasta.
if (PEGAR) {
  const nome = PEGAR.replace(/\.jpg$/i, "");
  mkdirSync(DESTINO, { recursive: true });
  const url = `${BUCKET}/alta/${nome}.jpg`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) {
    console.error(`não achei ${nome}.jpg no catálogo (HTTP ${r.status}).`);
    process.exit(1);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const m = await sharp(buf).metadata();
  const arquivo = `${DESTINO}/${nome}.jpg`;
  writeFileSync(arquivo, buf);
  console.log(`${arquivo}
   ${m.width}x${m.height} · ${(buf.length / 1024).toFixed(0)} KB · ${Math.max(m.width, m.height) >= LADO_ALVO ? "serve para a capa" : "ABAIXO de " + LADO_ALVO}`);
  process.exit(0);
}

if (FOLHAS) mkdirSync(DESTINO, { recursive: true });

/**
 * A folha de contato de uma referência: todas as cores, nomeadas.
 *
 * Cada célula tem a miniatura e, embaixo, o nome do arquivo — que é o que se
 * passa para `--pegar`. Sem o nome a folha seria bonita e inútil: dá para
 * apontar "essa", e não dá para dizer qual é "essa".
 */
const CELULA = 260;
const RODAPE = 22;
const COLUNAS = 5;
async function montarFolha(ref, itens, caminho) {
  const linhas = Math.ceil(itens.length / COLUNAS);
  const larg = COLUNAS * CELULA;
  const alt = linhas * (CELULA + RODAPE);
  const pecas = [];
  for (const [i, it] of itens.entries()) {
    const x = (i % COLUNAS) * CELULA;
    const y = Math.floor(i / COLUNAS) * (CELULA + RODAPE);
    const mini = await sharp(it.buf)
      .resize(CELULA - 12, CELULA - 12, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 78 })
      .toBuffer();
    pecas.push({ input: mini, top: y + 6, left: x + 6 });
    const nome = it.url.split("/").pop().replace(".jpg", "");
    const legenda = Buffer.from(
      `<svg width="${CELULA}" height="${RODAPE}"><rect width="100%" height="100%" fill="#fff"/>` +
        `<text x="${CELULA / 2}" y="15" font-family="monospace" font-size="11" fill="#333" text-anchor="middle">${nome}</text></svg>`
    );
    pecas.push({ input: legenda, top: y + CELULA - 4, left: x });
  }
  await sharp({ create: { width: larg, height: alt, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite(pecas)
    .jpeg({ quality: 82 })
    .toFile(caminho);
  return { larg, alt, celulas: itens.length };
}

const relatorio = [];
for (const a of alvos) {
  const rotulo = `${String(a.anuncios).padStart(3)} anún · ${String(a.marca || "?").padEnd(9)} ${String(a.ref ?? "sem ref").padEnd(9)} ${a.nome.slice(0, 40)}`;
  if (!a.ref) {
    console.log(`  ${rotulo}
        sem referência no cadastro — o catálogo é indexado por ela`);
    relatorio.push({ ...a, situacao: "sem referência", fotos: [] });
    continue;
  }
  const { erro, urls } = await procurar(a.ref);
  if (erro || urls.length === 0) {
    console.log(`  ${rotulo}
        ${erro ?? "a referência não existe no catálogo do grupo"}`);
    relatorio.push({ ...a, situacao: erro ?? "não achada", fotos: [] });
    continue;
  }

  const fotos = [];
  const paraFolha = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) {
        fotos.push({ url, erro: `HTTP ${r.status}` });
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      const m = await sharp(buf).metadata();
      const serve = Math.max(m.width ?? 0, m.height ?? 0) >= LADO_ALVO;
      fotos.push({ url, largura: m.width, altura: m.height, bytes: buf.length, serve });
      // Só as que SERVEM entram na folha: mostrar uma cor que não pode virar
      // capa é oferecer o que não se pode entregar.
      if (serve && FOLHAS) paraFolha.push({ url, buf });
    } catch (e) {
      fotos.push({ url, erro: String(e?.message ?? e).slice(0, 60) });
    }
  }
  const servem = fotos.filter((f) => f.serve).length;
  let folha = null;
  if (FOLHAS && paraFolha.length > 0) {
    folha = `${DESTINO}/folha-${a.ref.replace(".", "-")}.jpg`;
    const d = await montarFolha(a.ref, paraFolha, folha);
    console.log(`  ${rotulo}
        ${servem} cores servem · folha ${d.larg}x${d.alt} → ${folha}`);
  } else {
    const menor = fotos.filter((f) => !f.erro && !f.serve).length;
    console.log(`  ${rotulo}
        ${servem} cores servem${menor ? ` · ${menor} abaixo de ${LADO_ALVO}` : ""} · ${fotos.filter((f) => f.erro).length} com erro`);
  }
  relatorio.push({ ...a, situacao: servem > 0 ? "achada" : "achada mas pequena", fotos, folha });
}

// ---- 3. o placar ----------------------------------------------------------
const comFoto = relatorio.filter((r) => r.fotos.some((f) => f.serve));
const sem = relatorio.filter((r) => !r.fotos.some((f) => f.serve));
console.log(`
${"=".repeat(74)}`);
console.log(`resolvidos pelo catálogo: ${comFoto.length} produtos · ${comFoto.reduce((s, x) => s + x.anuncios, 0)} anúncios`);
console.log(`ainda sem foto grande:    ${sem.length} produtos · ${sem.reduce((s, x) => s + x.anuncios, 0)} anúncios`);
for (const r of sem) console.log(`     ${String(r.anuncios).padStart(3)} anún · ${r.situacao.padEnd(22)} ${r.nome.slice(0, 42)}`);

if (!FOLHAS) {
  console.log(`
(procura apenas — nada foi gravado. Rode com --folhas para montar as folhas de contato.)`);
} else {
  const n = relatorio.filter((r) => r.folha).length;
  console.log(`
${n} folhas de contato em ${DESTINO}/`);
  console.log("Escolha a cor e rode --pegar <nome-do-arquivo> para baixar aquela em tamanho cheio.");
  console.log("NADA foi publicado nem gravado no banco.");
}
