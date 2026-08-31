# 05 — Variáveis de Ambiente (Staging)

Modelo pronto: **`.env.staging.example`** (na raiz do repo). O `.env.staging` real
já existe desde 25/08/2026, com as duas variáveis do Supabase **preenchidas** —
elas são públicas por desenho. O resto é credencial, e cada linha diz onde se
pega a dela.

## ⚠️ `.env.staging` NÃO é carregado pelo Next

Isto estava errado nesta página até 25/08 — ela dizia "copie para `.env.staging`
para rodar localmente". Não funciona, e falha em SILÊNCIO: o app sobe com o
ambiente de sempre, e ninguém percebe que está falando com o banco errado.

A documentação do Next instalado
(`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`) lista a
ordem de busca:

```
1. process.env
2. .env.$(NODE_ENV).local
3. .env.local
4. .env.$(NODE_ENV)
5. .env
```

e diz, na mesma página: *"The allowed values for NODE_ENV are production,
development and test"*. **Não existe `NODE_ENV=staging`**, então `.env.staging`
nunca entra na lista.

### Para rodar LOCALMENTE contra o staging

Copie o conteúdo para **`.env.development.local`** — ele é a linha 2 da ordem
acima, vence o `.env.local`, e deixa o `.env.local` intocado, como esta página
manda.

```bash
cp .env.staging .env.development.local
```

Para voltar ao ambiente de sempre, apague:

```bash
rm .env.development.local
```

Reinicie o `next dev` nas duas trocas: variável é lida na subida.

### Para a Vercel

Cole os valores no escopo **Preview**. Aí o nome do arquivo não importa — ele é
só a fonte de onde você copia.

> **Não** edite `.env.local` (é o ambiente atual). O `.env.staging` real nunca vai para o Git (`.gitignore`: `.env*` + exceção só para os `*.example`).

## Variáveis confirmadas no código

| Variável | Escopo | Usada em | Obrigatória? |
|----------|--------|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | público (build) | `src/lib/supabase/client.ts` | **Sim** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público (build) | `src/lib/supabase/client.ts` | **Sim** |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | `src/lib/supabase/admin.ts` (worker) | Só se testar o worker |
| `ML_CLIENT_ID` | server-only | `src/app/api/ml/*` | Sim (fluxo ML) |
| `ML_CLIENT_SECRET` | server-only | `src/app/api/ml/*` | Sim (fluxo ML) |
| `ML_REDIRECT_URI` | server-only | `api/ml/autorizar`, `conectar` | Sim (fluxo ML) |
| `GEMINI_API_KEY` | server-only | `src/lib/agentes/provedorIA.ts`, `provedorImagem.ts` | Só p/ IA/imagens |
| `GEMINI_MODEL` | server-only | `provedorIA.ts` | Opcional (default no código) |
| `GEMINI_IMAGE_MODEL` | server-only | `provedorImagem.ts` | Opcional |
| `OPENAI_API_KEY` | server-only | `provedorIA.ts`, `openai.ts`, `provedorImagem.ts` | A IA padrão (ChatGPT) desde 23/08/2026 |
| `OPENAI_MODEL` / `OPENAI_MODELO_CONVERSA` | server-only | `roteamentoDeModelo.ts` | Opcional (padrão gpt-5) |
| `ANTHROPIC_API_KEY` | server-only | `provedorIA.ts` | Opcional (só com IA_PROVEDOR=anthropic) |
| `ANTHROPIC_MODEL` | server-only | `provedorIA.ts` | Opcional |
| `IA_PROVEDOR` | server-only | `provedorIA.ts` | Opcional (força openai/anthropic/gemini) |
| `CRON_SECRET` | server-only | `src/app/api/otimizar/worker/route.ts` | Só p/ worker |
| `APP_URL` | server-only | `src/lib/auth/definirSenha.ts` (convite) | Só p/ convite — e **só https** |

> Para os **testes de autenticação/isolamento e do token** (o núcleo da Etapa 1), bastam as 2 do Supabase + as 3 do ML. IA/worker são opcionais.

> `APP_URL` **recusa o que não for https** (`montarRedirectConvite`, `definirSenha.ts:51`).
> Rodando local, o convite por e-mail fica desligado — e isso NÃO bloqueia o T1, cujo
> caminho é `signUp` no navegador, que não passa por convite.

## Conferir sem abrir o arquivo

`.env.staging` guarda credenciais. Conferir "está tudo lá?" abrindo o arquivo
espalha segredo por terminal, histórico e captura de tela. Use:

```bash
node scripts/conferirAmbienteDeStaging.mjs
```

Ele dá um veredito por variável — preenchida, ainda no marcador, ou com a forma
errada — e **nenhum valor é impresso**. Sai com código 1 se houver erro, então
serve em automação.

O que ele recusa, e por quê:

| Recusa | Motivo |
|---|---|
| URL do Supabase com o ref de **produção** | o erro mais caro e o mais fácil: copiou o `.env.local`, achou que trocou tudo. O sintoma é nenhum — a tela abre, o login funciona, e o percurso de teste escreve na conta que paga |
| `ML_REDIRECT_URI` sem https | `api/ml/autorizar` barra, e o ML recusa na borda com um 403 branco da CloudFront |
| `ML_REDIRECT_URI` que não termina em `/cliente/conectar-ml` | é a rota do callback |
| `APP_URL` com barra no fim, ou sem https | `montarRedirectConvite` devolve null e o convite é recusado |
| qualquer `NEXT_PUBLIC_*` com `SECRET`, `SERVICE_ROLE` ou `API_KEY` no nome | vai para o navegador em todo carregamento |
| **chave repetida no arquivo** | em `.env` a ÚLTIMA linha vence, calada. Colar a chave acima de um marcador que ficou embaixo faz o marcador ganhar — aqui e no app. Aconteceu em 25/08 |

Para conferir o arquivo que o Next realmente carrega:

```bash
node scripts/conferirAmbienteDeStaging.mjs .env.development.local
```

## Regras
- `service_role`, `client_secret`, chaves de IA e `CRON_SECRET` são **server-only** — **nunca** com prefixo `NEXT_PUBLIC_`.
- Ao colar na Vercel, confira que não sobrou `< >` de placeholder, aspas ou barra no fim (o `NEXT_PUBLIC_SUPABASE_URL` é sensível a isso).
- `NEXT_PUBLIC_*` e `ML_*`/`GEMINI_*` são lidas no **build** → após alterar na Vercel, faça **Redeploy**.

## Git ignora o arquivo real?
Sim. O `.gitignore` foi ajustado:
```
.env*
!.env.example
!.env.staging.example
```
Ou seja: `.env.staging` (real) é **ignorado**; só os `*.example` (placeholders) são versionados. Confirme com:
```bash
git check-ignore .env.staging      # deve imprimir ".env.staging" (está ignorado)
git check-ignore .env.staging.example || echo "rastreável (ok)"
```
