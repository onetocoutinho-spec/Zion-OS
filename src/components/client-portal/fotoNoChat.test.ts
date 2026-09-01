// A foto é JULGADA antes de subir, e a regra é a do domínio.
//
// ===========================================================================
// POR QUE MEDIR ANTES
// ===========================================================================
//
// 127 anúncios desta lojista estão travados por capa pequena, e o remédio que o
// próprio Mercado Livre deu é foto quadrada com pelo menos 1200 de lado.
//
// Uma foto que não atende NÃO destrava nada. Subir primeiro e descobrir depois
// gastaria a viagem dela ao fabricante, o upload e a espera — para o anúncio
// continuar exatamente onde estava.
//
// O navegador sabe a dimensão antes de qualquer byte subir.
//
// ===========================================================================
// A REGRA NÃO PODE SER REESCRITA AQUI
// ===========================================================================
//
// `lerMaxSize` é a MESMA função que julga as capas que o ML informou. Uma
// segunda regra de tamanho divergiria da primeira no primeiro ajuste — e a
// tela diria "serve" sobre o que a análise chama de fora do padrão.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CHAT = readFileSync(new URL("./ChatDaOperacao.tsx", import.meta.url), "utf8");
const FOTO = readFileSync(new URL("./ConferirFoto.tsx", import.meta.url), "utf8");

test("o clipe aceita imagem", () => {
  assert.match(CHAT, /accept="[^"]*image\/\*/, "o clipe deixou de aceitar foto");
});

test("a foto é DESVIADA antes de tentar ler como planilha ou PDF", () => {
  const receb = CHAT.slice(
    CHAT.indexOf("async function receberPlanilha("),
    CHAT.indexOf("async function confirmarFoto(")
  );
  const iFoto = receb.indexOf('arquivo.type.startsWith("image/")');
  const iPdf = receb.indexOf('arquivo.type === "application/pdf"');
  const iLer = receb.indexOf("await lerPlanilha(arquivo)");
  assert.ok(iFoto > 0, "o desvio da foto sumiu");
  assert.ok(iFoto < iPdf && iFoto < iLer, "a foto passou a ser lida como planilha ou PDF");
});

test("a REGRA vem do domínio — não é reescrita na tela", () => {
  assert.match(FOTO, /from "@\/modules\/integration\/domain\/capaForaDoPadrao"/);
  assert.match(FOTO, /lerMaxSize\(/, "a tela parou de usar o juiz do domínio");
  // O número não pode estar escrito à mão: ele já existe como constante, e uma
  // segunda cópia divergiria no primeiro ajuste.
  const semImports = FOTO.replace(/^import[\s\S]*?;$/gm, "");
  assert.ok(
    !/\b1200\b/.test(semImports.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")),
    "o 1200 foi copiado para dentro da tela em vez de vir de LADO_MINIMO_DA_CAPA"
  );
});

test("o VEREDICTO aparece antes do botão, e diz o que falta", () => {
  assert.match(FOTO, /não é quadrada/, "sumiu o aviso de foto não quadrada");
  assert.match(FOTO, /não destrava o anúncio/, "sumiu a consequência — o ponto da tela");
});

test("ENVIAR MESMO ASSIM continua existindo — a decisão é dela", () => {
  // Uma foto abaixo do padrão pode servir como secundária. O software garante
  // que ela leu o número, não decide por ela.
  assert.match(FOTO, /Enviar mesmo assim/);
});

test("sem produto aberto, NÃO sobe — mandar para o errado troca a foto de quem estava certo", () => {
  assert.match(FOTO, /Não sei de qual produto é esta foto/);
  const grav = CHAT.slice(
    CHAT.indexOf("async function confirmarFoto("),
    CHAT.indexOf("async function confirmarCatalogo(")
  );
  assert.match(grav, /!produto\) return/, "a gravação parou de exigir produto");
});

test("largar a foto NÃO sobe — só o clique sobe", () => {
  const receb = CHAT.slice(
    CHAT.indexOf("async function receberPlanilha("),
    CHAT.indexOf("async function confirmarFoto(")
  );
  assert.ok(!receb.includes("uploadImagemProduto("), "largar a foto no chat passou a subir sozinho");
});

const CONFIRMAR_FOTO = CHAT.slice(
  CHAT.indexOf("async function confirmarFoto("),
  CHAT.indexOf("async function confirmarCatalogo(")
);

test("a capa é um SEGUNDO passo, e falhar nele não vira 'não subiu'", () => {
  // A foto está lá. Dizer que não subiu seria mentira.
  //
  // MODIFICADA EM 14/08/2026, e o motivo escrito porque sentinela alterada sem
  // justificativa é sentinela desligada: esta linha exigia a frase
  // "não consegui marcá-la como capa" DENTRO do componente. A frase mudou de
  // casa — foi para `modules/catalog/domain/desfechoDaFoto`, que tem teste
  // próprio e uma sentinela mais forte (nenhuma frase afirma mudança no
  // Mercado Livre sem anúncio confirmado). O que se guarda AQUI passa a ser o
  // caminho: a falha da promoção sai como desfecho parcial, e não pelo catch
  // que responde "Não consegui subir a foto".
  assert.match(CONFIRMAR_FOTO, /promoverImagemACapa/);
  assert.match(
    CONFIRMAR_FOTO,
    /porque: "nao-virou-capa"/,
    "o desfecho parcial virou erro total"
  );
  assert.match(
    CONFIRMAR_FOTO,
    /subiu mas não virou capa/,
    "o catch da promoção deixou de ser separado do catch do upload"
  );
});

test("marcar 'usar como capa' ESCREVE no Mercado Livre, não só no nosso banco", () => {
  // O DEFEITO QUE ESTA SENTINELA IMPEDE DE VOLTAR, cometido até 14/08/2026:
  // `promoverImagemACapa` mexe no NOSSO banco. Sozinha, ela fazia o chat
  // responder "Ela é a capa agora" enquanto o anúncio no ar continuava com a
  // capa velha — a mesma família de "Título trocado" e do botão que dizia
  // "não grava" e gravava.
  //
  // Apagar a chamada abaixo não quebraria nenhuma outra prova: `envio` ficaria
  // em "nao-pediu-capa" e a frase simplesmente PARARIA de falar do Mercado
  // Livre. Silêncio é exatamente como o defeito passou treze dias.
  assert.match(CONFIRMAR_FOTO, /enviarCapaAoMercadoLivre\(/);
  assert.ok(
    CONFIRMAR_FOTO.indexOf("promoverImagemACapa") <
      CONFIRMAR_FOTO.indexOf("enviarCapaAoMercadoLivre("),
    "o envio ao ML passou na frente da promoção daqui — escreve lá fora antes de acertar aqui dentro"
  );
  // Sem cor a rota recusa com 409, e cada chamada ao ML renova o token dela.
  assert.match(CONFIRMAR_FOTO, /porque: "sem-cor"/);
});

test("o aviso de que o anúncio no ar vai mudar vem ANTES do clique", () => {
  // Contar depois de feito é o mesmo que não contar. A caixa "Usar como capa"
  // escreve nos anúncios que estão no ar; quem abrir o anúncio passa a ver
  // outra foto.
  const semEspaco = FOTO.replace(/\s+/g, " ");
  assert.match(
    semEspaco,
    /\{comoCapa && \(/,
    "o aviso deixou de depender da caixa marcada"
  );
  assert.match(semEspaco, /anúncios desta cor no Mercado Livre/);
});

test("a URL do preview é revogada — senão cada foto deixa um blob preso", () => {
  assert.match(FOTO, /revokeObjectURL/);
});

test("a ida NÃO existe sem a volta — o desfazer mora no turno que trocou", () => {
  // O INCIDENTE DE 14/08/2026: uma foto de Havaianas AMARELO virou capa de 10
  // anúncios AZUL-MARINHO. A foto era quadrada, tinha 1200 de lado e passou em
  // todas as guardas — a cor é a única entrada deste caminho que NENHUM código
  // confere.
  //
  // O que faltava não era mais uma guarda: era a volta. `aplicar-capa` punha,
  // `melhor-capa` promovia, e nada tirava. Desfazer exigiu escrever código
  // novo com a lojista no prejuízo.
  //
  // O desfazer mora no TURNO, e não numa 24ª ferramenta, porque o lugar dele é
  // onde ela está quando percebe o erro — não numa frase que ela precisaria
  // saber formular.
  assert.match(CONFIRMAR_FOTO, /podeDesfazer\(/, "o turno parou de guardar a volta");
  assert.match(CONFIRMAR_FOTO, /desfazerCapa:/, "sumiu o que o desfazer precisa mirar");
  assert.match(CHAT, /tirarFotoDoMercadoLivre\(/, "a volta deixou de chamar a rota que tira");

  // E o botão tem que APARECER: a volta que não está na tela não é volta.
  const semEspaco = CHAT.replace(/\s+/g, " ");
  assert.match(semEspaco, /\{t\.desfazerCapa && \(/, "o botão de desfazer saiu da tela");

  // O botão só some quando a foto SAIU de algum anúncio. Se a remoção falhou,
  // ela continua lá e a volta continua fazendo falta.
  const desfazer = CHAT.slice(
    CHAT.indexOf("async function desfazerTrocaDeCapa("),
    CHAT.indexOf("async function confirmarCatalogo(")
  );
  assert.ok(desfazer.length > 100, "a função de desfazer sumiu");
  assert.match(
    desfazer,
    /\(resposta\.feitos \?\? \[\]\)\.length > 0 \? \{ desfazerCapa: undefined \}/,
    "o botão passou a sumir mesmo quando a foto continuou nos anúncios"
  );
  assert.match(desfazer, /fraseDoDesfazer\(/, "a frase do desfazer deixou de vir do domínio");
});
