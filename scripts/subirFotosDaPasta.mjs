// Sobe uma pasta de fotos direto para o Storage, sem passar pelo navegador.
//
// ===========================================================================
// POR QUE ISTO EXISTE, E O QUE ELE NÃO PROVA
// ===========================================================================
//
// Em 27/08/2026 o envio pela tela falhou cinco vezes seguidas. O motivo não era
// o casamento — esse foi medido e funciona nos três níveis de seleção — e sim a
// NAVEGAÇÃO do seletor de pastas do Chrome, que abre dentro da última pasta
// usada e escolhe a pasta em que se está, não a que está destacada. Quatro das
// cinco tentativas mandaram a mesma pasta de COR.
//
// Este script desbloqueia o percurso. Ele NÃO prova que a lojista consegue
// sozinha — essa continua sendo a pergunta do T1, e a resposta continua sendo
// "trava no seletor". O achado fica registrado; o script só tira a pedra do
// caminho para os passos seguintes.
//
// ===========================================================================
// MESMAS REGRAS DA TELA, E NÃO REGRAS PARECIDAS
// ===========================================================================
//
// O nível do produto sai de `nivelDoProdutoPorProfundidade`, o casamento de
// `casarPastaComProduto`, o caminho no bucket e a regra da capa são os de
// `storageImagens`. Um script com regra própria gravaria diferente da tela — e
// aí ninguém saberia qual das duas está certa.
//
// Uso:  node --env-file=.env.staging scripts/subirFotosDaPasta.mjs <pasta> <clienteId>

import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  casarPastaComProduto,
  nivelDoProdutoPorProfundidade,
} from "../src/modules/catalog/domain/casarPastaComProduto.ts";

const BUCKET = "produtos-imagens";
const IMAGEM = /\.(jpe?g|png|webp)$/i;

const [pastaRaiz, clienteId] = process.argv.slice(2);
/**
 * `--simular` mede sem escrever nada.
 *
 * A primeira execução deste script subiu 800 fotos de uma pasta conhecida. A
 * segunda leva 10.976 de 21 pastas, e quantas CASAM com produto era palpite.
 * Escrever dez mil arquivos no Storage para descobrir a taxa de acerto é a
 * ordem errada — mede-se antes, e com as mesmas regras, não com parecidas.
 */
const SIMULAR = process.argv.includes("--simular");
if (!pastaRaiz || !clienteId) {
  console.error("uso: node scripts/subirFotosDaPasta.mjs <pasta> <clienteId> [--simular]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, chave, { auth: { persistSession: false } });

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

const TIPO = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

// ---- 1. varre a pasta, do jeito que o navegador entregaria ------------------
const nomeDaRaiz = pastaRaiz.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
const arquivos = [];
(function andar(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = `${dir}/${e.name}`;
    if (e.isDirectory()) andar(caminho, [...acc, e.name]);
    else if (IMAGEM.test(e.name)) arquivos.push({ caminho, pastas: acc, nome: e.name });
  }
})(pastaRaiz, [nomeDaRaiz]);
console.log(`imagens encontradas: ${arquivos.length}`);

// ---- 2. o catálogo diz qual nível é o produto -------------------------------
const { data: linhas, error: erroProdutos } = await sb
  .from("produtos")
  .select("id, nome, sku, cod_erp")
  .eq("cliente_id", clienteId);
if (erroProdutos) {
  console.error("não consegui ler os produtos:", erroProdutos.message);
  process.exit(1);
}
const produtos = linhas.map((p) => ({ id: p.id, nome: p.nome, sku: p.sku, codErp: p.cod_erp }));
const nivel = nivelDoProdutoPorProfundidade(
  arquivos.map((a) => a.pastas),
  produtos
);
for (const [prof, i] of [...nivel.entries()].sort()) {
  console.log(`  profundidade ${prof} -> produto no nível ${i}`);
}

// ---- 3. agrupa por produto + cor, como a tela faz ---------------------------
const grupos = new Map();
for (const a of arquivos) {
  const i = nivel.get(a.pastas.length) ?? 0;
  const rotulo = a.pastas[i] ?? "";
  const cor = a.pastas[i + 1] ?? "";
  const chave = `${rotulo}||${cor}`;
  if (!grupos.has(chave)) {
    grupos.set(chave, { rotulo, cor, arquivos: [], ...casarPastaComProduto(rotulo, produtos) });
  }
  grupos.get(chave).arquivos.push(a);
}
const validos = [...grupos.values()].filter((g) => g.produtoId);
const semCasar = grupos.size - validos.length;
console.log(`grupos: ${grupos.size} · casaram ${validos.length} · sem produto ${semCasar}`);
if (validos.length === 0) process.exit(1);

// ---- 4. quem já tem capa, para não criar uma segunda ------------------------
// O SKIP NÃO É ZELO — ELE VEIO DE DUAS INTERRUPÇÕES REAIS.
//
// A primeira execução morreu em 629 de 800 porque a saída foi para um `head`,
// que fechou o cano. A segunda rodou inteira e subiu as 800 POR CIMA das 629 —
// o mesmo defeito que `envioDeFotoRepetido` acabou de fechar do lado da tela,
// repetido aqui por um script escrito com pressa.
//
// A chave é produto+cor, igual à do aviso: cor nova no mesmo produto entra; a
// mesma cor de novo, não. Retomar é o caso comum, não a exceção.
// E A LEITURA É PAGINADA — ELA NÃO ERA, E QUEBROU EXATAMENTE ONDE TINHA QUE.
//
// O PostgREST devolve no MÁXIMO 1000 linhas. Enquanto `imagens_produto` tinha
// 800, a leitura simples parecia completa. Passou de 1000 na terceira pasta, e
// a partir dali `comCapa` e `jaEnviados` viravam retratos de um pedaço do
// banco: produtos com foto passavam por "sem foto", e o script marcava uma
// SEGUNDA capa.
//
// O que salvou foi o banco. `idx_imagens_produto_uma_capa` recusou o INSERT —
// 6 lotes perdidos, e ZERO capas duplicadas. Restrição no banco pega o que o
// código esqueceu; foi ela que transformou uma corrupção silenciosa em seis
// linhas de erro.
//
// Este é o defeito que a sentinela `leituraNaoTruncada` guarda em `src/`, e que
// esta sessão já tinha pego uma vez na leitura de `produtos` (1003 linhas).
// Repeti aqui, num script, onde a sentinela não alcança.
async function todasAsImagens() {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await sb
      .from("imagens_produto")
      .select("produto_id, tipo_imagem, cor")
      .eq("cliente_id", clienteId)
      .range(i, i + 999);
    if (error) {
      console.error(`não consegui ler as imagens já enviadas: ${error.message}`);
      process.exit(1); // sem esta lista, subir é arriscar duplicar tudo
    }
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
const jaTem = await todasAsImagens();
console.log(`imagens já no banco: ${jaTem.length}`);
const comCapa = new Set((jaTem ?? []).filter((i) => i.tipo_imagem === "Principal").map((i) => i.produto_id));
const jaEnviados = new Set(
  (jaTem ?? []).map((i) => `${i.produto_id}||${(i.cor ?? "").trim().toLowerCase()}`)
);

if (SIMULAR) {
  const novos = validos.filter((g) => !jaEnviados.has(`${g.produtoId}||${g.cor.trim().toLowerCase()}`));
  const fotosNovas = novos.reduce((s, g) => s + g.arquivos.length, 0);
  const naoCasaram = [...grupos.values()].filter((g) => !g.produtoId);
  console.log(`
SIMULAÇÃO — nada foi escrito.
  grupos que casaram com produto ....... ${validos.length} de ${grupos.size}
  destes, ainda não enviados ........... ${novos.length}
  FOTOS que subiriam ................... ${fotosNovas}
  produtos que ganhariam foto .......... ${new Set(novos.map((g) => g.produtoId)).size}
  fotos puladas (produto+cor já tem) ... ${validos.reduce((s, g) => s + g.arquivos.length, 0) - fotosNovas}
  fotos sem produto (ficam de fora) .... ${naoCasaram.reduce((s, g) => s + g.arquivos.length, 0)}`);
  if (naoCasaram.length) {
    console.log(`  exemplos que NÃO casaram: ${naoCasaram.slice(0, 5).map((g) => g.rotulo).join(" | ")}`);
  }
  process.exit(0);
}

// ---- 5. sobe ---------------------------------------------------------------
let feito = 0;
let falhas = 0;
const total = validos.reduce((s, g) => s + g.arquivos.length, 0);
const t0 = Date.now();

let pulados = 0;
for (const g of validos) {
  if (jaEnviados.has(`${g.produtoId}||${g.cor.trim().toLowerCase()}`)) {
    pulados += g.arquivos.length;
    continue;
  }
  const registros = [];
  for (const a of g.arquivos) {
    const ext = a.nome.split(".").pop().toLowerCase();
    const caminho = `${clienteId}/${g.produtoId}/${Date.now()}-${slugArquivo(a.nome)}`;
    const { error } = await sb.storage.from(BUCKET).upload(caminho, readFileSync(a.caminho), {
      upsert: true,
      contentType: TIPO[ext] ?? "image/jpeg",
    });
    if (error) {
      falhas++;
      if (falhas <= 3) console.error(`  falha em ${a.nome}: ${error.message}`);
      continue;
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(caminho);
    // A CAPA É DO PRODUTO, não do grupo de cor — a mesma regra de
    // `papelDaFotoNova`. Um produto de três cores teria três "Principal" se a
    // decisão fosse por grupo.
    const ehCapa = !comCapa.has(g.produtoId);
    if (ehCapa) comCapa.add(g.produtoId);
    registros.push({
      cliente_id: clienteId,
      produto_id: g.produtoId,
      variante_id: null,
      anuncio_id: null,
      tipo_imagem: ehCapa ? "Principal" : "Secundária",
      url: data.publicUrl,
      status: "Aprovada",
      observacoes: g.cor ? `Cor: ${g.cor}` : "",
      cor: g.cor.trim() || null,
    });
    feito++;
    if (feito % 50 === 0) {
      const seg = (Date.now() - t0) / 1000;
      console.log(`  ${feito}/${total} · ${(feito / seg).toFixed(1)} fotos/s`);
    }
  }
  if (registros.length > 0) {
    const { error } = await sb.from("imagens_produto").insert(registros);
    if (error) console.error(`  linha recusada em ${g.rotulo}: ${error.message}`);
  }
}

console.log(
  `
subiram ${feito} · pulados ${pulados} (produto+cor que já tinha foto) · falhas ${falhas} · ${((Date.now() - t0) / 1000).toFixed(0)}s`
);
