// Planejamento: compor o conteúdo pretendido de uma publicação a partir do
// Anúncio Final. Puro, sem rede.
//
// Extraído de `lib/marketplaces/mlUserProducts.ts` na Release 009 (R13).
// Conteúdo preservado byte a byte; nenhuma lógica alterada.

import type { AnuncioGerado } from "../../../lib/agentes/esteira";
import type { LinhaGuiaTamanho } from "../../../lib/marketplaces/mercadolivre";
import type { VariacaoUP } from "../../integration/domain/mlUserProducts";
import { normalizarTamanho } from "./normalizarTamanho.ts";
import {
  medidaDoTamanho,
  medidasDaMarca,
  type TabelaDaLoja,
} from "../../catalog/domain/tabelasMedidas.ts";

export const GENERO_ID = {
  feminino: "339665",
  masculino: "339666",
  meninas: "339668",
  meninos: "339667",
  sem_genero_infantil: "19159491",
  sem_genero: "110461",
} as const;

export const FOOTWEAR_TYPE_ID = {
  sandalia: "517585",
  chinelo: "517586",
  tamanco: "3630523",
  mule: "3630524",
} as const;

// ---- Montagem do bundle a partir do Anúncio Final (PURO) ----
//
// O navegador tem os dados crus (ficha, variações, marca) mas NÃO o token do
// ML; o servidor tem o token mas NÃO os dados crus. Então o navegador monta
// este bundle (puro, testável) e o servidor cria a guia + publica um item por
// tamanho. Falha FECHADA: dado obrigatório ausente vira erro, nunca palpite.

/** Ingredientes do User Products enviados ao servidor (sem gridId/rowIds). */
export interface BundleUserProducts {
  familyName: string;
  tipoAnuncio: string;
  brand: string;
  model: string;
  descricao: string;
  generoId: string;
  generoNome: string;
  footwearTypeId?: string;
  pictures: string[];
  /** numeração → cm, para POST /catalog/charts. */
  guiaLinhas: LinhaGuiaTamanho[];
  /** uma por (tamanho, cor), tamanho já normalizado. */
  variacoes: VariacaoUP[];
}

export type ResultadoBundle =
  | { ok: true; bundle: BundleUserProducts; avisos?: string[] }
  | { ok: false; motivo: string };

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function paraNumero(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  let s = String(v).trim().replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * O que a lojista preencheu em `produto_atributos`, pronto para consulta.
 *
 * Puro, e por isso separado da leitura: quem tem o cliente do banco é o
 * chamador — no navegador é a sessão dela, no servidor é o admin da conversa —
 * e nenhum dos dois pertence a esta camada.
 *
 * ACEITA AS DUAS FORMAS DE LINHA, e isso não é conveniência. A regra "o cadastro
 * completa o que a ficha não trouxe" nasceu em 28/08 com TRÊS implementações —
 * esta, o mapa cru de `cadastroParaOsObrigatorios` e a conversão inline do
 * ensaio congelado — cada uma com sua normalização de chave. Duas divergências
 * reais saíram disso no mesmo dia: uma porta casava o nome do atributo sem
 * acento e sem caixa, a outra por igualdade exata; o mesmo produto publicava por
 * um caminho e era recusado pelo outro.
 *
 * Aceitando `nomeAtributo` (o serviço) e `nome_atributo` (o banco), os três
 * chamadores passam a chamar ESTA função, e a forma da chave tem um dono só.
 */
export interface LinhaDoCadastro {
  nomeAtributo?: string | null;
  valorAtributo?: string | null;
  /** A mesma linha como o banco a devolve — os dois caminhos de servidor. */
  nome_atributo?: string | null;
  valor_atributo?: string | null;
}

export function fichaDoCadastro(
  atributos: readonly LinhaDoCadastro[]
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const a of atributos) {
    const nome = semAcento(a.nomeAtributo ?? a.nome_atributo ?? "");
    const valor = (a.valorAtributo ?? a.valor_atributo ?? "").trim();
    if (!nome || !valor || mapa.has(nome)) continue;
    mapa.set(nome, valor);
  }
  return mapa;
}

/**
 * Valor da ficha técnica por atributo (ignora pendências "informação necessária"),
 * e SE A FICHA NÃO TIVER, o que a lojista respondeu no cadastro.
 *
 * ===========================================================================
 * POR QUE O CADASTRO ENTRA AQUI — MEDIDO EM 28/08/2026
 * ===========================================================================
 *
 * `montarBundleUserProducts` recusa sem gênero, e recusava 408 dos 674 anúncios
 * publicáveis de calçado da base real. A ficha técnica é escrita pelo modelo, e
 * numa amostra de 400 aprovados ela traz "Gênero" em 159.
 *
 * A resposta existia: está em `produto_atributos`, preenchida pela lojista. O
 * caminho clássico passou a lê-la no mesmo dia (`doCadastroParaOPayload`), e
 * esta é a MESMA falta pela outra porta — 85% deste catálogo publica por aqui,
 * não por lá.
 *
 * A FICHA CONTINUA MANDANDO. O cadastro é consultado só quando ela não
 * responde: o modelo trabalha em cima do anúncio, e sobrescrever o que ele
 * escreveu com um valor mais velho seria trocar a resposta de um pelo outro sem
 * ninguém pedir. E nada de dedução pelo nome — o que a lojista não respondeu
 * continua virando recusa, que é o que faz a pergunta chegar até ela.
 */
function fichaValor(
  anuncio: AnuncioGerado,
  aliases: string[],
  doCadastro?: ReadonlyMap<string, string>
): string {
  const alvo = aliases.map(semAcento);
  for (const f of anuncio.fichaTecnica ?? []) {
    if (!alvo.includes(semAcento(f.atributo))) continue;
    const v = (f.valor ?? "").trim();
    if (!v || /informacao necessaria/.test(semAcento(v))) continue;
    return v;
  }
  for (const nome of alvo) {
    const v = doCadastro?.get(nome)?.trim();
    if (v) return v;
  }
  return "";
}

/** Gênero (texto pt) → value_id do ML + nome canônico. Null se não reconhecido. */
function generoParaId(valor: string): { id: string; nome: string } | null {
  const s = semAcento(valor);
  if (!s) return null;
  if (/menina/.test(s)) return { id: GENERO_ID.meninas, nome: "Meninas" };
  if (/menino/.test(s)) return { id: GENERO_ID.meninos, nome: "Meninos" };
  if (/(feminino|mulher|\bfem\b)/.test(s)) return { id: GENERO_ID.feminino, nome: "Feminino" };
  if (/(masculino|homem|\bmasc\b)/.test(s)) return { id: GENERO_ID.masculino, nome: "Masculino" };
  if (/infantil/.test(s)) return { id: GENERO_ID.sem_genero_infantil, nome: "Sem gênero" };
  if (/(unissex|sem genero)/.test(s)) return { id: GENERO_ID.sem_genero, nome: "Sem gênero" };
  return null;
}

/** Tipo de calçado (texto pt) → value_id do ML. Undefined se não reconhecido. */
function footwearParaId(valor: string): string | undefined {
  const s = semAcento(valor);
  if (/chinelo/.test(s)) return FOOTWEAR_TYPE_ID.chinelo;
  if (/sandal/.test(s)) return FOOTWEAR_TYPE_ID.sandalia;
  if (/tamanco/.test(s)) return FOOTWEAR_TYPE_ID.tamanco;
  if (/mule/.test(s)) return FOOTWEAR_TYPE_ID.mule;
  return undefined;
}

/** Nome canônico do tipo de calçado, para o payload clássico (que usa `value_name`). */
function footwearParaNome(valor: string): string | undefined {
  const s = semAcento(valor);
  if (/chinelo/.test(s)) return "Chinelo";
  if (/sandal/.test(s)) return "Sandália";
  if (/tamanco/.test(s)) return "Tamanco";
  if (/mule/.test(s)) return "Mule";
  return undefined;
}

/** O corte que `montarItemML` aplica ao título. Ver `tituloPublicado`. */
export const LIMITE_DO_TITULO = 60;

/**
 * O título COMO ELE VAI AO AR — cortado nos 60 do Mercado Livre.
 *
 * O corte não é detalhe: é ele que separa "o anúncio afirma isso" de "alguém
 * escreveu isso em algum lugar". Uma palavra depois do caractere 60 não é
 * publicada, e a coerência de `oQueOTituloAfirma` vale só sobre o que sobe.
 */
export function tituloPublicado(anuncio: AnuncioGerado): string {
  return (anuncio?.tituloOtimizado ?? "").slice(0, LIMITE_DO_TITULO);
}

/** Um atributo que o próprio título já declara, nas duas formas que o ML aceita. */
export interface AfirmacaoDoTitulo {
  id: string;
  valorId?: string;
  valorNome: string;
}

/**
 * O QUE O TÍTULO JÁ AFIRMA — e por que ler dali NÃO é palpite.
 *
 * ===========================================================================
 * A CONTRADIÇÃO QUE ISTO DESFAZ, MEDIDA EM 28/08/2026
 * ===========================================================================
 *
 * Dos 12 anúncios que o bundle recusava por gênero ausente, CINCO tinham a
 * palavra no título que ia subir:
 *
 *     Chinelo Slide Infantil Molekinha Nuvem 2338.110 EVA
 *     Chinelo Rider Infantil Masculino 12673 Core Up
 *     Sandália Papete Infantil Zaxynina 19060 Moderninha
 *     Chinelo Ipanema infantil Disney Joy 27323
 *     Chinelo Olympikus 921 unissex conforto
 *
 * O anúncio subiria com "Infantil" na linha mais visível que existe, e o
 * sistema o recusava dizendo que não sabe o gênero. Isso não é cuidado — é
 * incoerência.
 *
 * ===========================================================================
 * POR QUE ESTA LEITURA É DIFERENTE DA DEDUÇÃO PELO NOME
 * ===========================================================================
 *
 * `doCadastroParaOPayload` recusa `origem: "nome"`, e continua certo: deduzir
 * do NOME DO CADASTRO — uma string que não é publicada — para afirmar um
 * atributo sob a conta da lojista é pôr na boca dela o que ela não disse.
 *
 * Aqui a string é outra. É o título que VAI AO AR. Preencher o atributo com o
 * que ele já declara não acrescenta afirmação nenhuma: acrescenta o mesmo dito,
 * no campo estruturado, onde o marketplace consegue ler. Recusar seria publicar
 * a afirmação na vitrine e negá-la na ficha.
 *
 * MEDIDO, e a diferença é grande: o nome do cadastro responde 2 dos 12; o
 * título do anúncio responde 5. O modelo escreve gênero em título que o
 * cadastro não tem.
 *
 * O vocabulário é o MESMO dos leitores da ficha — `generoParaId` e
 * `footwearParaId`, listas fechadas. Título que não traz a palavra devolve
 * lista vazia, e o obrigatório continua virando pergunta.
 */
export function oQueOTituloAfirma(titulo: string): AfirmacaoDoTitulo[] {
  const afirma: AfirmacaoDoTitulo[] = [];
  const genero = generoParaId(titulo);
  if (genero) afirma.push({ id: "GENDER", valorId: genero.id, valorNome: genero.nome });
  const tipoId = footwearParaId(titulo);
  const tipoNome = footwearParaNome(titulo);
  if (tipoId && tipoNome) afirma.push({ id: "FOOTWEAR_TYPE", valorId: tipoId, valorNome: tipoNome });
  return afirma;
}

function primeiroNumero(s: string): number {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : 9999;
}

/**
 * Monta o bundle User Products a partir do Anúncio Final. Puro e determinístico.
 * Falha fechada quando falta dado OBRIGATÓRIO do ML (marca, gênero) ou quando
 * nenhuma variação tem tamanho publicável com medida.
 */
export function montarBundleUserProducts(
  anuncio: AnuncioGerado,
  opts: {
    pictures?: string[];
    tipoAnuncio?: string;
    /** `produto_atributos` por `fichaDoCadastro` — o que a ficha não trouxer. */
    doCadastro?: ReadonlyMap<string, string>;
    /** As tabelas de `/cliente/medidas` — ver `comAsDaLoja`. */
    tabelasDaLoja?: readonly TabelaDaLoja[];
  } = {}
): ResultadoBundle {
  const { doCadastro } = opts;
  const brand = fichaValor(anuncio, ["marca"], doCadastro);
  if (!brand) return { ok: false, motivo: "marca ausente na ficha técnica (obrigatória no ML)" };

  // FICHA → CADASTRO → TÍTULO QUE VAI AO AR. Ver `oQueOTituloAfirma`.
  //
  // O título entra por ÚLTIMO e só quando os dois primeiros calam: ele não é
  // uma quarta opinião, é a constatação de que o anúncio já declara aquilo na
  // linha mais visível que tem. Recusar depois disso seria publicar a afirmação
  // na vitrine e negá-la na ficha — foi o que aconteceu com 5 dos 12 recusados
  // por gênero em 28/08.
  const doTitulo = new Map(oQueOTituloAfirma(tituloPublicado(anuncio)).map((x) => [x.id, x]));

  const generoDoTitulo = doTitulo.get("GENDER");
  const genero =
    generoParaId(fichaValor(anuncio, ["genero", "gênero", "genero (masculino/feminino)"], doCadastro)) ??
    (generoDoTitulo?.valorId
      ? { id: generoDoTitulo.valorId, nome: generoDoTitulo.valorNome }
      : null);
  if (!genero) {
    return {
      ok: false,
      motivo:
        "gênero ausente ou não reconhecido — nem na ficha técnica, nem no cadastro, nem no título do anúncio",
    };
  }

  const footwearTypeId =
    footwearParaId(fichaValor(anuncio, ["tipo de calcado", "tipo de calçado"], doCadastro)) ??
    doTitulo.get("FOOTWEAR_TYPE")?.valorId;
  const familyName = (anuncio.tituloOtimizado || brand).slice(0, 60);
  const model = fichaValor(anuncio, ["modelo"], doCadastro) || familyName;
  const descricao = anuncio.descricaoCompleta || anuncio.descricaoCurta || "";

  const cmPorTamanho = medidasDaMarca(brand, opts.tabelasDaLoja ?? []);

  const variacoes: VariacaoUP[] = [];
  const cmPorTamanhoNaGuia = new Map<string, number>();
  const tokensPorMedida = new Map<number, string[]>();
  const vistos = new Set<string>();
  /** Tamanhos que a tabela da marca não cobre — a recusa os nomeia. */
  const semMedida: string[] = [];

  for (const v of anuncio.variacoes ?? []) {
    const norm = normalizarTamanho(v.tamanho);
    if (!norm.ok) continue; // tamanho ambíguo/faixa → não publica (nada é inventado)
    // DES-004: aceita o número DENTRO do par (`37` acha `37/38`), e só isso.
    // Par contra tabela individual continua recusado, e não há aproximação —
    // ver `medidaDoTamanho`.
    const cm = medidaDoTamanho(cmPorTamanho, norm.valor);
    if (cm === undefined) {
      // GUARDA QUAL TAMANHO FICOU DE FORA, para a recusa poder nomeá-lo.
      //
      // Antes a recusa dizia só "nenhuma variação com tamanho publicável +
      // medida da marca X" — verdade, e sem dizer o que fazer. Medido em 28/08,
      // os 30 recusados desta base faltavam por tamanho FORA da faixa da
      // tabela: Molekinho 19 a 24, Ipanema 25 e 26, Yvate 41 a 43. Dizer o
      // número transforma a parede numa linha para ela cadastrar.
      if (!semMedida.includes(norm.valor)) semMedida.push(norm.valor);
      continue;
    }

    const cor = (v.cor ?? "").trim();
    const chave = `${norm.valor}|${cor.toLowerCase()}`;
    if (vistos.has(chave)) continue; // dedup por (tamanho, cor)
    vistos.add(chave);

    cmPorTamanhoNaGuia.set(norm.valor, cm);
    // Dois tokens diferentes com a MESMA medida são o mesmo tamanho escrito de
    // duas formas — o cadastro da Zaxy Air 19419 tem `33 - 34` E `33 BR`.
    //
    // Antes do DES-004 isso não aparecia: `33 BR` não achava medida e era
    // pulado em silêncio. Agora os dois acham, e os dois virariam variação —
    // a compradora veria "33/34" e "33" como opções separadas do mesmo pé.
    //
    // Não deduplico: escolher qual das duas grafias sobrevive é decidir pela
    // lojista qual está certa, e a resposta muda por marca. Reporto.
    const mesmaMedida = tokensPorMedida.get(cm) ?? [];
    if (!mesmaMedida.includes(norm.valor)) mesmaMedida.push(norm.valor);
    tokensPorMedida.set(cm, mesmaMedida);
    variacoes.push({
      tamanho: norm.valor,
      cor: cor || undefined,
      sku: (v.sku ?? "").trim() || undefined,
      ean: (v.ean ?? "").trim() || undefined,
      estoque: paraNumero(v.estoque),
      preco: paraNumero(v.preco),
    });
  }

  if (variacoes.length === 0) {
    return {
      ok: false,
      motivo: semMedida.length
        ? `a tabela de medidas da marca "${brand}" não cobre ${
            semMedida.length === 1 ? "o tamanho" : "os tamanhos"
          } ${semMedida.join(", ")}. Abra Medidas, acrescente ${
            semMedida.length === 1 ? "essa numeração" : "essas numerações"
          } na tabela da ${brand} e publique de novo.`
        : `nenhuma variação com tamanho publicável + medida da marca "${brand}"`,
    };
  }

  const guiaLinhas: LinhaGuiaTamanho[] = [...cmPorTamanhoNaGuia.entries()]
    .sort((a, b) => primeiroNumero(a[0]) - primeiroNumero(b[0]))
    .map(([tamanho, footLengthCm]) => ({ tamanho, footLengthCm }));

  const avisos = [...tokensPorMedida.entries()]
    .filter(([, tokens]) => tokens.length > 1)
    .sort((a, b) => a[0] - b[0])
    .map(
      ([cm, tokens]) =>
        `O cadastro tem ${tokens.join(" e ")} para a mesma medida (${cm} cm) — vão virar opções separadas no anúncio.`
    );

  return {
    ok: true,
    ...(avisos.length > 0 ? { avisos } : {}),
    bundle: {
      familyName,
      tipoAnuncio: opts.tipoAnuncio ?? "Premium",
      brand,
      model,
      descricao,
      generoId: genero.id,
      generoNome: genero.nome,
      footwearTypeId,
      pictures: opts.pictures ?? [],
      guiaLinhas,
      variacoes,
    },
  };
}
