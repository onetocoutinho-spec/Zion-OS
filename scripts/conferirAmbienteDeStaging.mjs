// Confere o ambiente de staging SEM IMPRIMIR VALOR NENHUM.
//
// ===========================================================================
// POR QUE ESTE SCRIPT EXISTE
// ===========================================================================
//
// O `.env.staging` guarda credenciais: service_role, client_secret do Mercado
// Livre, chaves de IA. Conferir "está tudo lá?" abrindo o arquivo espalha
// segredo por terminal, histórico e captura de tela.
//
// Aqui nada é impresso. Cada variável recebe um veredito — preenchida, ainda no
// marcador, ou com a forma errada — e o valor nunca sai do processo.
//
// ===========================================================================
// O ERRO QUE ELE EXISTE PARA PEGAR
// ===========================================================================
//
// Apontar o "staging" para o banco de PRODUÇÃO. É o erro mais caro e o mais
// fácil de cometer — copiou o `.env.local`, trocou meia dúzia de linhas, achou
// que trocou todas. O sintoma é nenhum: a tela abre, o login funciona, e o
// percurso de teste escreve na conta que paga.
//
// Por isso a URL do Supabase é comparada com o ref do projeto de staging, e o
// ref de PRODUÇÃO é recusado por nome.
//
// Rodar:  node scripts/conferirAmbienteDeStaging.mjs
//         node scripts/conferirAmbienteDeStaging.mjs .env.development.local

import { readFileSync, existsSync } from "node:fs";

const REF_STAGING = "fivlziuvxvhpuibrjwlq";
const REF_PRODUCAO = "ouynursknlgtmewcdjzr";

const arquivo = process.argv[2] ?? ".env.staging";

if (!existsSync(arquivo)) {
  console.error(`\n${arquivo} não existe. Ver docs/staging-setup/05-VARIAVEIS-DE-AMBIENTE.md\n`);
  process.exit(1);
}

/** Lê o arquivo de ambiente. O objeto NUNCA é impresso — só consultado. */
function lerEnv(caminho) {
  const env = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const i = limpa.indexOf("=");
    if (i < 0) continue;
    env[limpa.slice(0, i).trim()] = limpa.slice(i + 1).trim();
  }
  return env;
}

/** Marcador do modelo: `<ALGUMA_COISA>`. Vazio também conta como não preenchido. */
const aindaMarcador = (v) => !v || /^<.*>$/.test(v);

const env = lerEnv(arquivo);
const linhas = [];
let erros = 0;
let avisos = 0;

function ok(chave, nota = "") {
  linhas.push(`  ok       ${chave}${nota ? `  — ${nota}` : ""}`);
}
function falha(chave, motivo) {
  linhas.push(`  FALHA    ${chave}  — ${motivo}`);
  erros++;
}
function pendente(chave, onde) {
  linhas.push(`  falta    ${chave}  — ainda no marcador; pegar em ${onde}`);
  avisos++;
}

// ---------------------------------------------------------------------------
// Supabase — a checagem que importa
// ---------------------------------------------------------------------------
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (aindaMarcador(url)) {
  falha("NEXT_PUBLIC_SUPABASE_URL", "vazia");
} else if (url.includes(REF_PRODUCAO)) {
  falha(
    "NEXT_PUBLIC_SUPABASE_URL",
    "APONTA PARA PRODUÇÃO. Este arquivo é de staging; escrever aqui escreve na conta que paga"
  );
} else if (!url.includes(REF_STAGING)) {
  falha("NEXT_PUBLIC_SUPABASE_URL", `não é o projeto de staging (esperado ${REF_STAGING})`);
} else if (url.endsWith("/")) {
  falha("NEXT_PUBLIC_SUPABASE_URL", "tem barra no fim — o cliente do Supabase é sensível a isso");
} else {
  ok("NEXT_PUBLIC_SUPABASE_URL", "projeto de staging");
}

const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (aindaMarcador(anon)) falha("NEXT_PUBLIC_SUPABASE_ANON_KEY", "vazia");
else if (!/^(eyJ|sb_publishable_)/.test(anon))
  falha("NEXT_PUBLIC_SUPABASE_ANON_KEY", "não parece chave anônima (nem JWT nem sb_publishable_)");
else ok("NEXT_PUBLIC_SUPABASE_ANON_KEY");

// ---------------------------------------------------------------------------
// Mercado Livre
// ---------------------------------------------------------------------------
if (aindaMarcador(env.ML_CLIENT_ID)) pendente("ML_CLIENT_ID", "DevCenter do ML");
else ok("ML_CLIENT_ID");

if (aindaMarcador(env.ML_CLIENT_SECRET)) pendente("ML_CLIENT_SECRET", "DevCenter do ML");
else ok("ML_CLIENT_SECRET");

const redirect = env.ML_REDIRECT_URI;
if (aindaMarcador(redirect)) {
  pendente("ML_REDIRECT_URI", "o Redirect URI cadastrado no app");
} else if (!redirect.startsWith("https://")) {
  falha(
    "ML_REDIRECT_URI",
    "não é https. `api/ml/autorizar` barra, e o ML recusa na borda com um 403 branco"
  );
} else if (!redirect.endsWith("/cliente/conectar-ml")) {
  falha("ML_REDIRECT_URI", "tem que terminar em /cliente/conectar-ml");
} else {
  ok("ML_REDIRECT_URI");
}

// ---------------------------------------------------------------------------
// Server-only — presença, nunca conteúdo
// ---------------------------------------------------------------------------
if (aindaMarcador(env.SUPABASE_SERVICE_ROLE_KEY))
  pendente("SUPABASE_SERVICE_ROLE_KEY", "painel do Supabase de staging → API Keys");
else ok("SUPABASE_SERVICE_ROLE_KEY");

const appUrl = env.APP_URL;
if (aindaMarcador(appUrl)) {
  pendente("APP_URL", "a origin https do deploy — só o convite por e-mail depende dela");
} else if (!appUrl.startsWith("https://")) {
  falha("APP_URL", "só https (montarRedirectConvite recusa o resto)");
} else if (appUrl.endsWith("/")) {
  falha("APP_URL", "sem barra no fim — é só a origin");
} else {
  ok("APP_URL");
}

for (const [chave, onde] of [
  ["OPENAI_API_KEY", "sua conta OpenAI (opcional até o passo de gerar texto)"],
  ["CRON_SECRET", "qualquer string aleatória (opcional, só o worker)"],
]) {
  if (aindaMarcador(env[chave])) pendente(chave, onde);
  else ok(chave);
}

// ---------------------------------------------------------------------------
// A regra que nenhum arquivo pode quebrar
// ---------------------------------------------------------------------------
const vazados = Object.keys(env).filter(
  (k) =>
    k.startsWith("NEXT_PUBLIC_") &&
    /SECRET|SERVICE_ROLE|CLIENT_SECRET|API_KEY/i.test(k)
);
if (vazados.length > 0) {
  falha(
    vazados.join(", "),
    "SEGREDO COM PREFIXO NEXT_PUBLIC_ — vai para o navegador em todo carregamento"
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${arquivo}\n`);
console.log(linhas.join("\n"));
console.log(
  `\n  ${erros} erro(s), ${avisos} pendência(s). Nenhum valor foi impresso.\n`
);
if (arquivo === ".env.staging") {
  console.log(
    "  Lembre: o Next NÃO carrega .env.staging.\n" +
      "  Para rodar local:  cp .env.staging .env.development.local\n"
  );
}
process.exit(erros > 0 ? 1 : 0);
