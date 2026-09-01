// Baixa as capas escolhidas no catálogo e as deixa quadradas, prontas para o ML.
//
// ===========================================================================
// O QUE ELE FAZ, E O QUE NÃO
// ===========================================================================
//
// Recebe a lista de (referência, cor, arquivo do catálogo) que uma pessoa
// escolheu, baixa cada imagem em tamanho cheio e a passa por `quadrarCapa` — a
// MESMA função da rota `/api/ml/quadrar-capa`, não uma parecida.
//
// Ele NÃO publica, não toca no banco e não decide cor. A escolha entrou pronta;
// o que ele acrescenta é o tamanho e o quadrado que o Mercado Livre exige.
//
// ===========================================================================
// POR QUE `contain` E NÃO `cover`
// ===========================================================================
//
// Está em `quadrarCapa` e vale repetir: `cover` corta as bordas, e numa foto de
// sapato corta o sapato; `fill` estica, e um chinelo esticado é um chinelo que
// não existe. `contain` põe a imagem inteira dentro do quadrado e completa com
// branco — que é o fundo que a foto de catálogo já tem.
//
// A função RECUSA o que não tem 1200 em nenhum lado. Aqui isso nunca deveria
// acontecer, porque a escolha saiu de uma lista já filtrada por tamanho — mas a
// recusa é reportada em vez de engolida, porque "nunca deveria" não é garantia.
//
// Uso:
//   node --import tsx scripts/quadrarAsEscolhidas.mjs <arquivo-da-lista.json>
//
// A lista é um JSON com [{ ref, cor, arquivo, produto }]. Sai em
// `backup/capas-prontas/`, com o original ao lado do quadrado para conferência.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { quadrarCapa, LADO_ALVO } from "../src/modules/integration/domain/quadrarCapa.ts";

const [listaPath] = process.argv.slice(2);
if (!listaPath) {
  console.error("uso: node scripts/quadrarAsEscolhidas.mjs <arquivo-da-lista.json>");
  process.exit(1);
}

const BUCKET = "https://s3-sa-east-1.amazonaws.com/imagens.catalogobeirario.com.br/alta";
const DESTINO = "backup/capas-prontas";

const escolhas = JSON.parse(readFileSync(listaPath, "utf8"));
mkdirSync(DESTINO, { recursive: true });
console.log(`escolhas: ${escolhas.length}\n`);

const feitas = [];
for (const e of escolhas) {
  const rotulo = `${String(e.ref).padEnd(9)} ${String(e.cor).padEnd(7)} ${String(e.produto ?? "").slice(0, 34).padEnd(35)}`;
  try {
    const r = await fetch(`${BUCKET}/${e.arquivo}.jpg`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) {
      console.log(`  ✗ ${rotulo} HTTP ${r.status}`);
      continue;
    }
    const original = Buffer.from(await r.arrayBuffer());
    const antes = await sharp(original).metadata();

    const q = await quadrarCapa(original);
    if (!q.ok) {
      // A recusa é INFORMAÇÃO, não erro: ela diz que esta foto não serve de
      // capa e por quê. Engolir transformaria "não dá" em "não fiz".
      console.log(`  ✗ ${rotulo} ${antes.width}x${antes.height} — recusada: ${q.motivo}`);
      continue;
    }
    const base = `${e.ref.replace(".", "-")}__${e.cor.toLowerCase()}__${e.arquivo}`;
    writeFileSync(`${DESTINO}/${base}--original.jpg`, original);
    writeFileSync(`${DESTINO}/${base}--quadrada.jpg`, q.imagem);
    console.log(`  ✓ ${rotulo} ${q.de} → ${q.para}`);
    feitas.push({ ...e, de: q.de, para: q.para, arquivoQuadrado: `${DESTINO}/${base}--quadrada.jpg` });
  } catch (err) {
    console.log(`  ✗ ${rotulo} ${String(err?.message ?? err).slice(0, 60)}`);
  }
}

writeFileSync(`${DESTINO}/lista.json`, JSON.stringify(feitas, null, 2), "utf8");
console.log(`\nprontas: ${feitas.length} de ${escolhas.length} · em ${DESTINO}/`);
console.log(`o lado alvo é ${LADO_ALVO}, o mesmo que a rota de quadrar usa.`);
console.log("NADA foi publicado nem gravado no banco.");
