// A regra da capa provada nos CAMINHOS, e não só no domínio.
//
// Os testes de `papelDaImagem` provam a regra onde ela mora. Não provam que
// alguém a usa — e foi essa distância que deixou o quinto caminho de pé mesmo
// depois da correção de 04/08: `AbaImagens` chamava `criarImagem` direto, com o
// Select do formulário aberto em "Principal".
//
// ---------------------------------------------------------------------------
// O QUE ESTE INSTRUMENTO MEDE, E O QUE ELE NÃO MEDE
// ---------------------------------------------------------------------------
// Em Node não existe `window`, então o store (`lib/store.ts`) opera assim:
//
//   `read()`   devolve o array de SEEDS — a mesma referência, não uma cópia
//   `write()`  é NO-OP (guardado por `typeof window !== "undefined"`)
//
// A consequência decide como estes testes são escritos:
//
//   INSERT  não persiste — `createItem` monta o item, `write` descarta
//   UPDATE  persiste — `updateItem` faz `items[index] = ...` no próprio seed
//
// Por isso o efeito de `registrarImagemPorUrl` é medido no VALOR DEVOLVIDO
// (que é onde o papel é decidido), e o de `promoverACapa` no estado, montando
// o cenário com updates. Uma primeira versão destes testes contava linhas
// depois de inserir, e as cinco falhas eram do instrumento, não do código.
//
// Rodar: npx tsx --test src/lib/services/imagensProduto.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  atualizarImagem,
  listarImagensDoProduto,
  promoverACapa,
  registrarImagemPorUrl,
} from "./imagensProduto.ts";
import type { ImagemProduto } from "../types.ts";

const PRODUTO = "prd-11"; // seed: img-01 "Principal" (variante null), img-02 "Lifestyle" (var-01)
const CLIENTE = "cli-06";

function nova(over: Partial<Omit<ImagemProduto, "id">> = {}): Omit<ImagemProduto, "id"> {
  return {
    clienteId: CLIENTE,
    produtoId: PRODUTO,
    varianteId: null,
    anuncioId: null,
    tipoImagem: "Principal",
    url: "https://exemplo.com/nova.jpg",
    status: "Aprovada",
    observacoes: "",
    ...over,
  };
}

async function buscar(id: string): Promise<ImagemProduto> {
  const achada = (await listarImagensDoProduto(PRODUTO)).find((i) => i.id === id);
  assert.ok(achada, `imagem ${id} sumiu do seed`);
  return achada;
}

async function capasNoEscopo(varianteId: string | null): Promise<ImagemProduto[]> {
  const todas = await listarImagensDoProduto(PRODUTO);
  return todas.filter(
    (i) => i.tipoImagem === "Principal" && (i.varianteId ?? null) === varianteId
  );
}

// ---------------------------------------------------------------------------
// registrarImagemPorUrl — o papel sai da regra, nunca do formulário
// ---------------------------------------------------------------------------

test("registrarImagemPorUrl: pedir 'Principal' num produto que já tem capa NÃO devolve capa", async () => {
  // É o defeito do quinto caminho, exercido pela porta que a tela usa. O pedido
  // "Principal" aqui não é opinião de ninguém — é o valor inicial do Select,
  // que abre no primeiro item de TIPO_IMAGEM.
  await atualizarImagem("img-01", { tipoImagem: "Principal", varianteId: null });

  const criada = await registrarImagemPorUrl(nova({ tipoImagem: "Principal" }));

  assert.equal(criada.tipoImagem, "Secundária", "a foto devia ter ido para a galeria");
});

test("registrarImagemPorUrl: rebaixa, e NÃO recusa", async () => {
  // Recusar puniria a lojista por um mecanismo nosso que não sabia da regra.
  // O contrato é "vira Secundária", nunca "lança".
  await atualizarImagem("img-01", { tipoImagem: "Principal", varianteId: null });

  const criada = await registrarImagemPorUrl(nova({ tipoImagem: "Principal" }));

  assert.ok(criada.id, "a imagem precisa ter sido criada");
  assert.equal(criada.url, "https://exemplo.com/nova.jpg", "a foto não pode ser perdida");
});

test("registrarImagemPorUrl: o pedido é respeitado quando não é uma segunda capa", async () => {
  for (const papel of ["Secundária", "Lifestyle", "Infográfico", "Vídeo"] as const) {
    const criada = await registrarImagemPorUrl(nova({ tipoImagem: papel }));
    assert.equal(criada.tipoImagem, papel, `"${papel}" foi alterado`);
  }
});

test("registrarImagemPorUrl: cada VARIANTE tem a sua capa — o escopo do índice 053", async () => {
  // O índice chaveia por `(produto_id, coalesce(variante_id, <zero>))`. A capa
  // de uma variante que ainda não tem capa é legítima mesmo com o produto já
  // tendo a sua — rebaixá-la seria o código sendo mais restritivo que o banco.
  await atualizarImagem("img-01", { tipoImagem: "Principal", varianteId: null });
  assert.equal((await capasNoEscopo("var-nova")).length, 0, "pré-condição: variante sem capa");

  const criada = await registrarImagemPorUrl(nova({ tipoImagem: "Principal", varianteId: "var-nova" }));

  assert.equal(criada.tipoImagem, "Principal", "a variante sem capa podia ter a sua");
  assert.equal((await capasNoEscopo(null)).length, 1, "a capa do produto não foi tocada");
});

// ---------------------------------------------------------------------------
// promoverACapa — rebaixa ANTES, e sobra exatamente uma
// ---------------------------------------------------------------------------

test("promoverACapa: a capa antiga é rebaixada, e o produto fica com uma só", async () => {
  // Cenário montado por UPDATE (o único que persiste em Node): img-02 entra no
  // mesmo escopo de img-01, como foto de galeria fora do envio.
  await atualizarImagem("img-01", { tipoImagem: "Principal", varianteId: null });
  await atualizarImagem("img-02", { tipoImagem: "Secundária", varianteId: null, status: "Pendente" });

  await promoverACapa(await buscar("img-02"));

  const capas = await capasNoEscopo(null);
  assert.equal(capas.length, 1, "trocar a capa não pode deixar duas");
  assert.equal(capas[0].id, "img-02", "a promovida devia ser a capa");
  assert.equal((await buscar("img-01")).tipoImagem, "Secundária", "a antiga devia ter sido rebaixada");
});

test("promoverACapa: a promovida volta para o envio", async () => {
  // Tornar capa uma foto que estava "Pendente" e mantê-la assim publicaria um
  // produto cuja capa o ML nunca recebe — `urlsDoProduto` filtra as pendentes.
  await atualizarImagem("img-01", { tipoImagem: "Principal", varianteId: null });
  await atualizarImagem("img-02", { tipoImagem: "Secundária", varianteId: null, status: "Pendente" });

  await promoverACapa(await buscar("img-02"));

  assert.equal((await buscar("img-02")).status, "Aprovada");
});

test("promoverACapa: promover quem JÁ é a capa não deixa o produto sem capa", async () => {
  // O caminho antigo rebaixava e repromovia a mesma linha. Entre as duas
  // escritas há um instante sem capa — e se a segunda falhar, ele é o estado
  // final. Produto sem capa não publica.
  // O seed é mutado in-place e os testes compartilham o estado, então o cenário
  // é montado INTEIRO — o teste anterior deixa img-02 como capa.
  await atualizarImagem("img-01", { tipoImagem: "Principal", varianteId: null, status: "Pendente" });
  await atualizarImagem("img-02", { tipoImagem: "Secundária", varianteId: null });

  await promoverACapa(await buscar("img-01"));

  const capas = await capasNoEscopo(null);
  assert.equal(capas.length, 1, "a capa não pode ter sumido");
  assert.equal(capas[0].id, "img-01");
  assert.equal(capas[0].status, "Aprovada", "promover a própria capa ainda a devolve ao envio");
});

// ---------------------------------------------------------------------------
// A fiação — o teste que teria pego o quinto caminho
// ---------------------------------------------------------------------------

/** Arquivos de tela, sem comentários: prosa não é chamada de função. */
function telasSemComentarios(): { arquivo: string; codigo: string }[] {
  const raizes = [join(process.cwd(), "src/app"), join(process.cwd(), "src/components")];
  const achados: { arquivo: string; codigo: string }[] = [];
  const visitar = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) visitar(caminho);
      else if (/\.tsx?$/.test(entrada.name) && !entrada.name.includes(".test.")) {
        achados.push({
          arquivo: caminho.replace(`${process.cwd()}/`, ""),
          // Tirar os comentários é o que impede este teste de acusar inocentes:
          // metade dos arquivos CITA `criarImagem` explicando por que não a usa.
          codigo: readFileSync(caminho, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/.*$/gm, "$1"),
        });
      }
    }
  };
  raizes.forEach(visitar);
  return achados;
}

test("nenhuma TELA importa `criarImagem` — o insert cru não tem porta na UI", () => {
  // Este é o teste que faltava em 04/08. A regra estava certa, num lugar só, e
  // testada — e mesmo assim uma tela criava a segunda capa, porque nada ligava
  // a regra aos chamadores. Quem precisa registrar imagem numa tela usa
  // `registrarImagemPorUrl`; `criarImagem` é a primitiva sem regra.
  const infratores = telasSemComentarios()
    .filter(({ codigo }) => /\bcriarImagem\b/.test(codigo))
    .map(({ arquivo }) => arquivo);

  assert.deepEqual(
    infratores,
    [],
    `estas telas usam o insert cru e podem criar uma segunda capa calada:\n  ${infratores.join("\n  ")}`
  );
});

test("o instrumento acima funciona — ele acusa quando deve", () => {
  // Um teste que nunca reprova não mede nada. Dois testes meus acusaram
  // inocentes em 04/08 (um casou com prosa em comentário), então este confere
  // as DUAS direções: que o padrão casa em código, e que NÃO casa em comentário.
  const semComentario = "import { criarImagem } from '@/lib/services/imagensProduto';";
  const soComentario = "// era criarImagem, virou registrarImagemPorUrl";
  const limpar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.ok(/\bcriarImagem\b/.test(limpar(semComentario)), "não pegaria o defeito real");
  assert.ok(!/\bcriarImagem\b/.test(limpar(soComentario)), "acusaria um inocente");
  assert.ok(!/\bcriarImagem\b/.test(limpar("criarImagensBulk(dados)")), "confundiu com o bulk");
});
