// Planejamento: compor o conteúdo pretendido de uma publicação a partir do
// Anúncio Final. Puro, sem rede.
//
// Extraído de `lib/marketplaces/mlUserProducts.ts` na Release 009 (R13).
// Conteúdo preservado byte a byte; nenhuma lógica alterada.

import type { AnuncioGerado } from "../../../lib/agentes/esteira";
import type { LinhaGuiaTamanho } from "../../../lib/marketplaces/mercadolivre";
import type { VariacaoUP } from "../../integration/domain/mlUserProducts";
import { normalizarTamanho } from "./normalizarTamanho.ts";
import { medidaDoTamanho, medidasDaMarca } from "../../catalog/domain/tabelasMedidas.ts";

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
 */
export function fichaDoCadastro(
  atributos: readonly { nomeAtributo: string; valorAtributo: string }[]
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const a of atributos) {
    const nome = semAcento(a.nomeAtributo ?? "");
    const valor = (a.valorAtributo ?? "").trim();
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
  } = {}
): ResultadoBundle {
  const { doCadastro } = opts;
  const brand = fichaValor(anuncio, ["marca"], doCadastro);
  if (!brand) return { ok: false, motivo: "marca ausente na ficha técnica (obrigatória no ML)" };

  const genero = generoParaId(
    fichaValor(anuncio, ["genero", "gênero", "genero (masculino/feminino)"], doCadastro)
  );
  if (!genero) {
    return { ok: false, motivo: "gênero ausente ou não reconhecido na ficha técnica (obrigatório)" };
  }

  const footwearTypeId = footwearParaId(
    fichaValor(anuncio, ["tipo de calcado", "tipo de calçado"], doCadastro)
  );
  const familyName = (anuncio.tituloOtimizado || brand).slice(0, 60);
  const model = fichaValor(anuncio, ["modelo"], doCadastro) || familyName;
  const descricao = anuncio.descricaoCompleta || anuncio.descricaoCurta || "";

  const cmPorTamanho = medidasDaMarca(brand);

  const variacoes: VariacaoUP[] = [];
  const cmPorTamanhoNaGuia = new Map<string, number>();
  const tokensPorMedida = new Map<number, string[]>();
  const vistos = new Set<string>();

  for (const v of anuncio.variacoes ?? []) {
    const norm = normalizarTamanho(v.tamanho);
    if (!norm.ok) continue; // tamanho ambíguo/faixa → não publica (nada é inventado)
    // DES-004: aceita o número DENTRO do par (`37` acha `37/38`), e só isso.
    // Par contra tabela individual continua recusado, e não há aproximação —
    // ver `medidaDoTamanho`.
    const cm = medidaDoTamanho(cmPorTamanho, norm.valor);
    if (cm === undefined) continue; // sem medida da marca → não entra na guia

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
      motivo: `nenhuma variação com tamanho publicável + medida da marca "${brand}"`,
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
