// Acrescenta às tabelas da loja as numerações que faltam — só as que TÊM FONTE.
//
// ===========================================================================
// DE ONDE VÊM OS NÚMEROS
// ===========================================================================
//
// De `PADRAO_BR`, em `tabelasMedidas.ts`, cuja fonte declarada é "guias da
// Chinelaria Leilane Neves (05_Guias_de_Medidas)" e cuja faixa adulta está,
// pelo comentário do próprio arquivo, "alinhada ao guia Azaleia/Yvate".
//
// NADA É INTERPOLADO AQUI. Numeração sem valor em `PADRAO_BR` não é escrita:
// centímetro de calçado é o que a compradora usa para decidir o pé, e a mesma
// recusa que `medidaDoTamanho` faz ao não escolher entre 35 e 36 vale para não
// inventar um 19 que ninguém mediu.
//
// ===========================================================================
// O QUE ISTO NÃO É
// ===========================================================================
//
// `PADRAO_BR` é REFERÊNCIA, não medida do fabricante. Onde a marca tem grade
// própria, ela pode divergir — medido em 28/08/2026:
//
//   Yvate      a tabela dela É o PADRAO_BR de 34 a 40, valor a valor.
//              Continuar em 41 a 43 pela mesma grade é exato.
//   Modare     grade própria (passo 0,7 terminando em 26,5). A continuação dela
//   Beira Rio  daria 27,2 em 41 e 21,6 em 33; o PADRAO_BR diz 27,3 e 21,5.
//              Diferença de 1 mm, e o número escrito é o da fonte, não o meu.
//   Molekinho  tabela em pares; o 25/26 dela bate com o 25 do PADRAO_BR.
//   Ipanema    grade Grendene em pares; a infantil dela não foi conferida.
//
// Quem tiver a tabela do fabricante corrige por cima, em `/cliente/medidas` —
// é para isso que a tabela dela passou a completar a embutida.
//
// Uso:
//
//   node --env-file=.env.local --import tsx scripts/completarTabelasDeMedida.mjs <clienteId> --simular
//   node --env-file=.env.local --import tsx scripts/completarTabelasDeMedida.mjs <clienteId> --gravar
//
// SEM `--gravar` não escreve nada.

import { createClient } from "@supabase/supabase-js";
import { PADRAO_BR } from "../src/modules/catalog/domain/tabelasMedidas.ts";
import { normalizarTamanho } from "../src/modules/publication/domain/normalizarTamanho.ts";

/** O que o ensaio de 28/08 mediu como faltante, marca por marca. */
const FALTANDO = {
  Molekinho: ["19", "20", "21", "22", "23", "24"],
  Ipanema: ["25", "26"],
  Yvate: ["41", "42", "43"],
  "Beira Rio": ["41"],
  Modare: ["33"],
};

const [clienteId] = process.argv.slice(2);
// `--simular` RECUSA a gravacao, e nao apenas deixa de pedi-la.
//
// A flag estava documentada no cabecalho e nunca era lida: so `--gravar`
// decidia, entao `--gravar --simular` escrevia. Quem aprendeu o idioma de
// `subirFotosDaPasta.mjs` — onde `--simular` e real e foi o que impediu envio
// errado — acrescentaria `--simular` esperando protecao e escreveria em
// producao. Uma flag que nao faz o que o nome diz e pior que flag nenhuma.
const SIMULAR = process.argv.includes("--simular");
const GRAVAR = process.argv.includes("--gravar") && !SIMULAR;
if (SIMULAR && process.argv.includes("--gravar")) {
  console.log("--simular e --gravar juntos: SIMULANDO, nada sera escrito.");
}
if (!clienteId) {
  console.error("uso: node --import tsx scripts/completarTabelasDeMedida.mjs <clienteId> [--gravar]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, chave, { auth: { persistSession: false } });

const paraLinha = (cm) => `${cm.toFixed(1).replace(".", ",")} cm`;
const primeiroNumero = (s) => {
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : 9999;
};

const { data: tabelas, error } = await sb
  .from("tabelas_medidas")
  .select("id, marca, nome, linhas")
  .eq("cliente_id", clienteId);
if (error) {
  console.error(`erro lendo tabelas_medidas: ${error.message}`);
  process.exit(1);
}

let escritas = 0;
let semFonte = 0;

for (const [marca, numeracoes] of Object.entries(FALTANDO)) {
  const t = (tabelas ?? []).find((x) => (x.marca ?? "").trim().toLowerCase() === marca.toLowerCase());
  if (!t) {
    console.log(`${marca}: SEM TABELA na loja — nada a fazer aqui.`);
    continue;
  }
  const linhas = Array.isArray(t.linhas) ? [...t.linhas] : [];
  // O que a tabela já responde, na forma canônica — para não duplicar rótulo.
  const jaTem = new Set(
    linhas.map((l) => normalizarTamanho(l.rotulo)).filter((r) => r.ok).map((r) => r.valor)
  );

  const novas = [];
  for (const n of numeracoes) {
    const norm = normalizarTamanho(n);
    if (!norm.ok || jaTem.has(norm.valor)) continue;
    const cm = PADRAO_BR[norm.valor];
    if (cm === undefined) {
      console.log(`   ${marca} ${n}: SEM FONTE em PADRAO_BR — não escrito.`);
      semFonte++;
      continue;
    }
    novas.push({ rotulo: norm.valor, valor: paraLinha(cm) });
  }

  if (novas.length === 0) {
    console.log(`${marca}: nada a acrescentar.`);
    continue;
  }

  const juntas = [...linhas, ...novas].sort(
    (a, b) => primeiroNumero(a.rotulo) - primeiroNumero(b.rotulo)
  );
  console.log(
    `${marca}: +${novas.length} → ${novas.map((l) => `${l.rotulo}=${l.valor}`).join(", ")}`
  );
  escritas += novas.length;

  if (GRAVAR) {
    const { error: erroGravacao } = await sb
      .from("tabelas_medidas")
      .update({ linhas: juntas })
      .eq("id", t.id)
      .eq("cliente_id", clienteId);
    if (erroGravacao) {
      console.error(`   ERRO gravando ${marca}: ${erroGravacao.message}`);
      process.exit(1);
    }
  }
}

console.log(
  `\n${GRAVAR ? "GRAVADO" : "SIMULAÇÃO"}: ${escritas} numerações` +
    (semFonte > 0 ? ` · ${semFonte} sem fonte, deixadas de fora` : "")
);
if (!GRAVAR) console.log("nada foi escrito — rode com --gravar para valer.");
