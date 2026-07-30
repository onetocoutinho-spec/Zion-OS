import test from "node:test";
import assert from "node:assert/strict";

import {
  associarNaVariante,
  cancelar,
  centavosParaTexto,
  comStatusRecalculado,
  comoResumo,
  definirGrade,
  draftEstaAberto,
  draftNovo,
  draftVisivelPara,
  escolherParaRetomar,
  informar,
  marcarCriado,
  aguardarConfirmacao,
  numeroDe,
  oQueFalta,
  paraRascunho,
  prontidao,
  resolverConflito,
  resumoDaCriacao,
  resumoDasVariantes,
  rotuloDoDraft,
  skuDoProduto,
  textoDe,
  type DraftDeCadastro,
} from "./draftDeCadastro";
import { validarRascunho } from "../../catalog/domain/cadastroManual";

const T0 = "2026-07-29T12:00:00.000Z";
const T1 = "2026-07-29T12:05:00.000Z";

function novo(conversaId = "conv-1"): DraftDeCadastro {
  return draftNovo({
    id: "d1",
    clienteId: "cli-1",
    conversaId,
    criadoPor: "u1",
    agoraISO: T0,
  });
}

/** Atalho: informa e devolve o Draft, falhando o teste se recusar. */
function dizer(
  d: DraftDeCadastro,
  campo: Parameters<typeof informar>[1],
  valor: string,
  unidade = ""
): DraftDeCadastro {
  const r = informar(d, campo, valor, "informado", T1, unidade);
  assert.equal(r.ok, true, `recusou ${campo}=${valor}: ${r.ok ? "" : r.motivo}`);
  return r.draft;
}

// ---------------------------------------------------------------------------
// fatos e procedência
// ---------------------------------------------------------------------------

test("um fato informado entra com a procedência dele", () => {
  const d = dizer(novo(), "marca", "Modare");
  assert.equal(textoDe(d, "marca"), "Modare");
  assert.equal(d.fatos.marca?.procedencia, "informado");
});

test("dinheiro entra em CENTAVOS INTEIROS, não em float", () => {
  const d = dizer(novo(), "custo", "47,80");
  assert.equal(numeroDe(d, "custo"), 4780);
  assert.equal(typeof numeroDe(d, "custo"), "number");
});

test('dinheiro ambíguo é RECUSADO — "1.2" não vira nem 1,20 nem 12,00', () => {
  const r = informar(novo(), "custo", "1.2", "informado", T1);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sem adivinhar/);
});

test("campo crítico não aceita inferência, nem com o resto do Draft cheio", () => {
  // A autoridade é `aceitarFato`. Este teste existe para provar que o Draft não
  // abriu uma porta lateral para ela.
  const r = informar(novo(), "custo", "47,80", "inferido", T1);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /não posso deduzir/);
});

test("campo NÃO crítico aceita inferência — categoria não quebra ninguém", () => {
  const r = informar(novo(), "categoria", "Calçados", "inferido", T1);
  assert.equal(r.ok, true);
  assert.equal(r.draft.fatos.categoria?.procedencia, "inferido");
});

test("o zero à esquerda do SKU sobrevive", () => {
  const d = dizer(novo(), "sku", "01040533");
  assert.equal(textoDe(d, "sku"), "01040533");
  assert.notEqual(textoDe(d, "sku"), "1040533");
});

test("peso deduz a unidade e AVISA que deduziu", () => {
  const r = informar(novo(), "pesoGramas", "400", "informado", T1, "");
  assert.equal(r.ok, true);
  assert.equal(r.valor, 400);
  assert.equal(r.unidadeDeduzida, true);
  // Com a unidade dita não há dedução a anunciar.
  const dito = informar(novo(), "pesoGramas", "0,4", "informado", T1, "kg");
  assert.equal(dito.ok, true);
  assert.equal(dito.valor, 400);
  assert.equal(dito.unidadeDeduzida, undefined);
});

test("fonte mais fraca NÃO substitui a mais forte", () => {
  const d = dizer(novo(), "marca", "Modare");
  const r = informar(d, "marca", "Moleca", "inferido", T1);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /mais confiável/);
});

test("fonte mais forte substitui a mais fraca", () => {
  const inferido = informar(novo(), "categoria", "Sandálias", "inferido", T1);
  assert.equal(inferido.ok, true);
  const r = informar(inferido.draft, "categoria", "Calçados", "informado", T1);
  assert.equal(r.ok, true);
  assert.equal(textoDe(r.draft, "categoria"), "Calçados");
});

// ---------------------------------------------------------------------------
// conflitos
// ---------------------------------------------------------------------------

test("dois custos diferentes viram CONFLITO, não a última palavra", () => {
  // Custo é o campo que já custou R$ 30 milhões a esta base. Ficar com a última
  // frase seria decidir sozinho entre duas afirmações do lojista.
  const d = dizer(novo(), "custo", "47,80");
  const r = informar(d, "custo", "45,00", "informado", T1);
  assert.equal(r.ok, false);
  assert.ok(r.conflito);
  assert.equal(r.conflito?.valorAtual, 4780);
  assert.equal(r.conflito?.valorNovo, 4500);
  // O custo NÃO mudou.
  assert.equal(numeroDe(r.draft!, "custo"), 4780);
  assert.equal(r.draft?.conflitos.length, 1);
});

test("campo não crítico aceita correção direto — ali a última palavra é a certa", () => {
  const d = dizer(novo(), "nome", "Papete Modare");
  const r = informar(d, "nome", "Papete Modare Papete", "informado", T1);
  assert.equal(r.ok, true);
  assert.equal(textoDe(r.draft, "nome"), "Papete Modare Papete");
  assert.equal(r.draft.conflitos.length, 0);
});

test("repetir o MESMO valor não é conflito", () => {
  const d = dizer(novo(), "custo", "47,80");
  const r = informar(d, "custo", "47,80", "informado", T1);
  assert.equal(r.ok, true);
  assert.equal(r.draft.conflitos.length, 0);
});

test("conflito aberto impede a prontidão, mesmo com o rascunho válido", () => {
  let d = novo();
  d = dizer(d, "nome", "Papete Modare 7178.102");
  d = dizer(d, "sku", "MOD-7178");
  d = dizer(d, "precoVenda", "129,90");
  assert.equal(prontidao(d).pronto, true);

  d = dizer(d, "custo", "47,80");
  const conflito = informar(d, "custo", "45,00", "informado", T1);
  assert.equal(conflito.ok, false);
  const comConflito = conflito.draft!;
  // `validarRascunho` continua aprovando — e mesmo assim não está pronto.
  assert.equal(validarRascunho(paraRascunho(comConflito)).length, 0);
  assert.equal(prontidao(comConflito).pronto, false);
});

test("resolver o conflito escolhe UM valor e libera o cadastro", () => {
  let d = dizer(novo(), "custo", "47,80");
  const conflito = informar(d, "custo", "45,00", "informado", T1);
  d = conflito.draft!;
  const r = resolverConflito(d, "custo", "novo", T1);
  assert.equal(r.ok, true);
  assert.equal(numeroDe(r.draft, "custo"), 4500);
  assert.equal(r.draft.conflitos.length, 0);
});

// ---------------------------------------------------------------------------
// variantes
// ---------------------------------------------------------------------------

test('"preto 37,38,39 e bege 36,37,38" dá SEIS variantes no Draft', () => {
  const r = definirGrade(
    novo(),
    { cores: ["Preto", "Bege"], tamanhos: ["37", "38", "39"] },
    T1
  );
  assert.equal(r.ok, true);
  assert.equal(r.total, 6);
  assert.equal(r.draft.variantes.length, 6);
});

test("SKU vai para a variante CERTA, e só para ela", () => {
  const grade = definirGrade(novo(), { cores: ["Preto", "Bege"], tamanhos: ["37", "38"] }, T1);
  assert.equal(grade.ok, true);
  const r = associarNaVariante(grade.draft, "sku", "01040533", { cor: "Preto", tamanho: "37" }, T1);
  assert.equal(r.ok, true);
  assert.equal(r.draft.variantes[0].sku, "01040533");
  assert.equal(r.draft.variantes[1].sku, undefined);
  assert.equal(resumoDasVariantes(r.draft).semSku, 3);
});

test("alvo ambíguo é RECUSADO com os candidatos", () => {
  const grade = definirGrade(novo(), { cores: ["Preto", "Bege"], tamanhos: ["37", "38"] }, T1);
  assert.equal(grade.ok, true);
  const r = associarNaVariante(grade.draft, "sku", "01040533", {}, T1);
  assert.equal(r.ok, false);
  assert.equal(r.candidatos?.length, 4);
});

test("sem grade não se associa identificador a lugar nenhum", () => {
  const r = associarNaVariante(novo(), "sku", "01040533", { cor: "Preto" }, T1);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /grade de variantes/);
});

test("REDEFINIR a grade não apaga os SKUs de quem continua existindo", () => {
  // "Ah, também tem bege 39" não pode jogar fora os SKUs já informados.
  const grade = definirGrade(novo(), { cores: ["Preto"], tamanhos: ["37", "38"] }, T1);
  assert.equal(grade.ok, true);
  const comSku = associarNaVariante(grade.draft, "sku", "AAA", { tamanho: "37" }, T1);
  assert.equal(comSku.ok, true);

  const maior = definirGrade(comSku.draft, { cores: ["Preto", "Bege"], tamanhos: ["37", "38"] }, T1);
  assert.equal(maior.ok, true);
  assert.equal(maior.total, 4);
  assert.equal(maior.draft.variantes[0].sku, "AAA", "o SKU informado foi perdido");
});

// ---------------------------------------------------------------------------
// conversão e prontidão — `validarRascunho` é a autoridade
// ---------------------------------------------------------------------------

test("PREÇO DE VENDA vem da autoridade: sem ele não fica pronto", () => {
  // "Modare Papete 7178.102, custo R$ 47,80" NÃO está pronta para criação.
  let d = novo();
  d = dizer(d, "marca", "Modare");
  d = dizer(d, "modelo", "7178.102");
  d = dizer(d, "nome", "Papete Modare 7178.102");
  d = dizer(d, "sku", "MOD-7178");
  d = dizer(d, "custo", "47,80");

  const p = prontidao(d);
  assert.equal(p.pronto, false);
  assert.ok(p.problemas.some((x) => x.campo === "precoVenda"));
  // E o bloqueio é o MESMO objeto que `validarRascunho` devolve.
  assert.deepEqual(p.problemas, validarRascunho(paraRascunho(d)));
});

test("com nome, SKU e preço o cadastro fica pronto — nada além é exigido", () => {
  let d = novo();
  d = dizer(d, "nome", "Papete Modare 7178.102");
  d = dizer(d, "sku", "MOD-7178");
  d = dizer(d, "precoVenda", "129,90");
  assert.equal(prontidao(d).pronto, true);
  assert.equal(d.status, "pronto_para_finalizar");
});

test("campos opcionais NÃO bloqueiam — eles aparecem como não bloqueantes", () => {
  let d = novo();
  d = dizer(d, "nome", "Papete Modare 7178.102");
  d = dizer(d, "sku", "MOD-7178");
  d = dizer(d, "precoVenda", "129,90");

  const falta = oQueFalta(d);
  assert.equal(falta.filter((f) => f.bloqueia).length, 0);
  // Peso e custo continuam faltando — e dizem por que importam.
  assert.ok(falta.some((f) => f.campo === "pesoGramas" && !f.bloqueia));
  assert.ok(falta.some((f) => f.campo === "custo" && !f.bloqueia));
});

test("centavos voltam para o texto que o cadastro manual lê", () => {
  assert.equal(centavosParaTexto(4780), "47,80");
  assert.equal(centavosParaTexto(124990), "1249,90");
  let d = dizer(novo(), "custo", "1.249,90");
  d = dizer(d, "precoVenda", "2.499,00");
  const r = paraRascunho(d);
  assert.equal(r.custo, "1249,90");
  assert.equal(r.precoVenda, "2499,00");
});

test("com UMA variante com SKU, o SKU do produto é DERIVADO — não inventado", () => {
  // É literalmente o que `CadastrarProduto` faz: o mesmo SKU vai para o pai e
  // para a variante. Produto e variante são a mesma unidade aqui.
  const grade = definirGrade(novo(), { cores: ["Preto"], tamanhos: ["37"] }, T1);
  assert.equal(grade.ok, true);
  const r = associarNaVariante(grade.draft, "sku", "01040533", { cor: "Preto" }, T1);
  assert.equal(r.ok, true);
  assert.equal(skuDoProduto(r.draft), "01040533");
});

test("com SEIS variantes, o SKU do produto NÃO é derivado de nenhuma", () => {
  // Eleger uma variante como representante do pai seria invenção — e o pai
  // ficaria com o SKU de um par preto 37 que não representa o resto.
  const grade = definirGrade(novo(), { cores: ["Preto", "Bege"], tamanhos: ["37", "38", "39"] }, T1);
  assert.equal(grade.ok, true);
  const r = associarNaVariante(grade.draft, "sku", "01040533", { cor: "Preto", tamanho: "37" }, T1);
  assert.equal(r.ok, true);
  assert.equal(skuDoProduto(r.draft), "");
  assert.equal(prontidao(r.draft).pronto, false);
});

test("a conversão leva a primeira variante para o par cor/tamanho do pai", () => {
  const grade = definirGrade(novo(), { cores: ["Preto"], tamanhos: ["37", "38"] }, T1);
  assert.equal(grade.ok, true);
  const r = paraRascunho(grade.draft);
  assert.equal(r.cor, "Preto");
  assert.equal(r.tamanho, "37");
});

// ---------------------------------------------------------------------------
// ciclo de vida
// ---------------------------------------------------------------------------

function pronto(): DraftDeCadastro {
  let d = novo();
  d = dizer(d, "nome", "Papete Modare 7178.102");
  d = dizer(d, "sku", "MOD-7178");
  d = dizer(d, "precoVenda", "129,90");
  return d;
}

test("o status é RECALCULADO pelo domínio, não declarado por ninguém", () => {
  let d = novo();
  assert.equal(d.status, "ativo");
  d = dizer(d, "nome", "Papete");
  assert.equal(d.status, "ativo");
  d = dizer(d, "sku", "MOD-7178");
  d = dizer(d, "precoVenda", "129,90");
  assert.equal(d.status, "pronto_para_finalizar");
});

test("cadastro incompleto NÃO vira aguardando_confirmacao", () => {
  const r = aguardarConfirmacao(novo(), "prop-1", T1);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /ainda não está completo/);
});

test("pronto → aguardando_confirmacao guarda a proposta que autoriza", () => {
  const r = aguardarConfirmacao(pronto(), "prop-1", T1);
  assert.equal(r.ok, true);
  assert.equal(r.draft.status, "aguardando_confirmacao");
  assert.equal(r.draft.propostaId, "prop-1");
});

test("um fato novo NÃO tira o cadastro de aguardando_confirmacao", () => {
  // A Proposal foi montada sobre o estado anterior. Quem decide o destino dela
  // é a revalidação do servidor, não um recálculo local.
  const esperando = aguardarConfirmacao(pronto(), "prop-1", T1);
  assert.equal(esperando.ok, true);
  const depois = comStatusRecalculado(esperando.draft);
  assert.equal(depois.status, "aguardando_confirmacao");
});

test("CANCELADO não aceita mais dados e não finaliza", () => {
  const c = cancelar(pronto(), T1);
  assert.equal(c.ok, true);
  assert.equal(c.draft.status, "cancelado");
  assert.equal(draftEstaAberto(c.draft), false);

  const tentativa = informar(c.draft, "custo", "47,80", "informado", T1);
  assert.equal(tentativa.ok, false);

  const finalizar = aguardarConfirmacao(c.draft, "prop-1", T1);
  assert.equal(finalizar.ok, false);
  assert.match(finalizar.motivo, /cancelado/);

  const criar = marcarCriado(c.draft, "prod-1", T1);
  assert.equal(criar.ok, false);
});

test("cancelar NÃO apaga: o cadastro continua legível e auditável", () => {
  const c = cancelar(pronto(), T1);
  assert.equal(c.ok, true);
  assert.equal(textoDe(c.draft, "nome"), "Papete Modare 7178.102");
  assert.equal(c.draft.id, "d1");
});

test("CRIADO é terminal — não cancela e não cria de novo", () => {
  const esperando = aguardarConfirmacao(pronto(), "prop-1", T1);
  assert.equal(esperando.ok, true);
  const criado = marcarCriado(esperando.draft, "prod-1", T1);
  assert.equal(criado.ok, true);
  assert.equal(criado.draft.produtoId, "prod-1");

  assert.equal(cancelar(criado.draft, T1).ok, false);
  assert.equal(marcarCriado(criado.draft, "prod-2", T1).ok, false);
});

test("a versão sobe a cada mudança — é a trava de escrita concorrente", () => {
  const d = novo();
  assert.equal(d.versao, 1);
  const depois = dizer(d, "nome", "Papete");
  assert.ok(depois.versao > d.versao);
});

// ---------------------------------------------------------------------------
// tenant
// ---------------------------------------------------------------------------

test("Draft de outro tenant é indistinguível de inexistente", () => {
  const d = novo();
  assert.equal(draftVisivelPara(d, "cli-1"), true);
  assert.equal(draftVisivelPara(d, "cli-2"), false);
  assert.equal(draftVisivelPara(null, "cli-1"), false);
});

// ---------------------------------------------------------------------------
// retomada
// ---------------------------------------------------------------------------

function comNome(id: string, marca: string, nome: string): DraftDeCadastro {
  let d = draftNovo({ id, clienteId: "cli-1", conversaId: "c", criadoPor: null, agoraISO: T0 });
  if (marca) d = dizer(d, "marca", marca);
  if (nome) d = dizer(d, "nome", nome);
  return d;
}

test("nenhum cadastro aberto: a retomada diz isso, não inventa um", () => {
  assert.deepEqual(escolherParaRetomar([]), { desfecho: "nenhum" });
});

test("UM cadastro aberto é retomado", () => {
  const d = comNome("d1", "Modare", "Papete 7178.102");
  const r = escolherParaRetomar([d]);
  assert.equal(r.desfecho, "unico");
  assert.equal(r.desfecho === "unico" && r.draft.id, "d1");
});

test("VÁRIOS abertos NÃO escolhem — mostram os candidatos numerados", () => {
  const r = escolherParaRetomar([
    comNome("d1", "Modare", "Papete 7178.102"),
    comNome("d2", "Havaianas", "Top"),
    comNome("d3", "", ""),
  ]);
  assert.equal(r.desfecho, "varios");
  if (r.desfecho !== "varios") return;
  assert.equal(r.candidatos.length, 3);
  assert.deepEqual(
    r.candidatos.map((c) => c.ordem),
    [1, 2, 3]
  );
  assert.match(r.candidatos[2].rotulo, /ainda sem nome/);
});

test('a dica filtra: "o da Modare" resolve para um só', () => {
  const r = escolherParaRetomar(
    [comNome("d1", "Modare", "Papete 7178.102"), comNome("d2", "Havaianas", "Top")],
    "modare"
  );
  assert.equal(r.desfecho, "unico");
  assert.equal(r.desfecho === "unico" && r.draft.id, "d1");
});

test("dica que não casa com nada mostra TODOS em vez de dizer que não achou", () => {
  const r = escolherParaRetomar(
    [comNome("d1", "Modare", "Papete"), comNome("d2", "Havaianas", "Top")],
    "zaxy"
  );
  assert.equal(r.desfecho, "varios");
});

test("cadastro cancelado não aparece como aberto na retomada", () => {
  const vivo = comNome("d1", "Modare", "Papete");
  const morto = cancelar(comNome("d2", "Havaianas", "Top"), T1);
  assert.equal(morto.ok, true);
  const r = escolherParaRetomar([vivo, morto.draft]);
  assert.equal(r.desfecho, "unico");
  assert.equal(r.desfecho === "unico" && r.draft.id, "d1");
});

// ---------------------------------------------------------------------------
// o que a conversa vê
// ---------------------------------------------------------------------------

test("o resumo escreve dinheiro em reais — o modelo não vê centavos", () => {
  const d = dizer(novo(), "custo", "47,80");
  const r = comoResumo(d);
  const custo = r.jaSei.find((f) => f.campo === "Custo");
  assert.equal(custo?.valor, "R$ 47,80");
});

test("o resumo da criação é o que a pessoa lê antes de autorizar", () => {
  let d = pronto();
  d = dizer(d, "custo", "47,80");
  const grade = definirGrade(d, { cores: ["Preto", "Bege"], tamanhos: ["37", "38", "39"] }, T1);
  assert.equal(grade.ok, true);
  const frase = resumoDaCriacao(grade.draft);
  assert.match(frase, /Papete Modare 7178\.102/);
  assert.match(frase, /R\$ 129,90/);
  assert.match(frase, /6 variantes/);
});

test("o rótulo serve para escolher, mesmo sem nome", () => {
  assert.match(rotuloDoDraft(novo()), /ainda sem nome/);
  const comReferencia = dizer(dizer(novo(), "marca", "Modare"), "modelo", "7178.102");
  assert.equal(rotuloDoDraft(comReferencia), "Modare 7178.102");
});
