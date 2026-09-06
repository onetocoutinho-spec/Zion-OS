# Isolamento entre tenants — o que impede um furo novo

Auditoria somente-leitura. Nenhum arquivo de aplicação foi alterado; nenhuma migration foi criada; nada foi executado contra banco de produção. `git status` no repositório permaneceu limpo durante toda a auditoria.

- **Commit auditado:** `c04ca519230a86ad4c5c5ee9535fbcb2c8abafb9` (branch `claude/tenant-isolation-audit-p8yzgr`, `master` na origem).
- **Método:** leitura estática de código-fonte e migrations. **Sem acesso ao Supabase vivo** (sem MCP conectado) — tudo que depende do estado real do banco (policies criadas fora das migrations, RLS realmente habilitada, GRANTs atuais) está marcado como "não verificado" e precisa de confirmação com `pg_policies`/`pg_tables`/`get_advisors` antes de qualquer decisão de produção.
- **Gatilho:** achado do documento de produto `docs/product/ux/02-PROBLEMS.md` (`nav.ts:88-89,91-102`, `roteamentoPapel.ts:112-127`) e o histórico documentado em `database/migrations/041-fecha-o-rls-que-a-005-nao-fechou.sql` — em 29/07/2026 a migração 005 nunca completou seu laço, 29 tabelas ficaram com uma policy `equipe_autenticada using(true)` coexistindo (via `OR`) com a policy correta, e um lojista real leu produto de outro tenant e escreveu em `decisoes` (a AIL), `agentes` e `clientes` de outro tenant. A 041 corrigiu.
- **A pergunta desta auditoria não é "onde está o furo" — é "o que impede um furo novo do mesmo formato".**

## Resumo em uma tela

| # | Área | O que existe hoje | Veredito |
|---|---|---|---|
| 1 | `service_role` (45 pontos de entrada) | 100% passam por `exigirAcessoAoCliente` antes de tocar dado de tenant, direto ou via caller já validado | Disciplinado, mas **por convenção** — nada barra um 46º ponto sem checagem |
| 2 | RLS tabela por tabela | As 29 tabelas da 005/041 estão corrigidas; nenhuma tabela criada depois da 041 ficou sem policy | OK, com uma ressalva sobre `storage.objects` (não verificado no banco vivo) |
| 3 | IDOR em rotas de API | 36/36 rotas lidas; nenhuma usa `cliente_id`/`loja_id` do body/query sem checagem prévia | OK |
| 4 | Token OAuth do Mercado Livre | Cifrado em repouso (pgcrypto + Vault), sem coluna em texto puro, sem acesso do navegador, ticket opaco no fluxo OAuth | Maduro — o melhor domínio da auditoria |
| 5 | Travas automáticas hoje | Existem 2 testes estruturais reais, mas **nenhum cobre o padrão geral `service_role` → dado de tenant** | Parcial — a peça que falta é exatamente a que o padrão pediu |
| 6 (achado novo) | `fila_otimizacao_produto` → worker de cron | Um cliente autenticado pode enfileirar o `produto_id` de **outro tenant**; o worker (service_role) processa sem checar posse | **Gap real, do mesmo formato do incidente de 29/07** |

O sistema de hoje está mais maduro do que a pergunta do usuário presumia — a disciplina em `service_role` e em IDOR é real e foi lida linha a linha. O problema é exatamente o que a pergunta identificou: essa disciplina é **lembrada**, não **imposta**. E a prova de que isso não é hipotético é o achado #6: um ponto novo, criado depois da 041, que tem o mesmo defeito de forma — uma camada confia que a anterior já validou, e ninguém provou que sim.

---

## 1. Inventário de `service_role`

Único ponto de criação: `getSupabaseAdmin()` em `src/lib/supabase/admin.ts:16-27` (usa `SUPABASE_SERVICE_ROLE_KEY`, ignora RLS). Não há um segundo `createClient` com a chave de serviço em nenhum outro arquivo de produção (`src/lib/supabase/client.ts:27` e `src/lib/auth/serverAuthorization.ts:144` usam a `anon key`, sujeitos a RLS).

45 arquivos importam `getSupabaseAdmin` (mais 1 indireto, `src/app/api/ml/desconectar/route.ts`, via `clienteDaCredencial()`). Foram lidos os 46. Resultado:

- **33 arquivos passam por `exigirAcessoAoCliente`** antes de qualquer leitura/escrita de dado de tenant — direto na própria rota, ou porque recebem um `clienteId` que o *caller* já validou (ex.: `src/lib/services/tituloNoAnuncio.ts:25` recebe `p.clienteId` de uma Proposal cujo dono já foi checado em `src/app/api/assistente/proposta/route.ts:996`).
- **11 arquivos são "não se aplica"**, cada um com motivo verificável: `canalServidor.ts` e `cadastroParaOsObrigatorios.ts` são infraestrutura pura que documenta explicitamente (comentário, `canalServidor.ts:9-14`) que a autorização não mora ali; `otimizar/worker/route.ts` é o cron (autenticado por `CRON_SECRET`, sem sessão de usuário — ver achado #6 abaixo); `loja/provisionar/route.ts`, `agencia/loja/route.ts` criam recurso novo para o próprio usuário, não tocam tenant existente; `catalogo/extrair/route.ts`, `agentes/esteira/route.ts`, `agentes/executar/route.ts`, `execucoesDeIA.ts` usam `cliente_id` só para telemetria/cota da própria sessão, nunca como filtro de leitura de outro tenant.
- **0 arquivos falharam** o padrão clássico (id de tenant vindo de body/query usado direto num `.eq("cliente_id", ...)` do cliente admin sem checagem prévia).

Ponto de desenho central: `exigirAcessoAoCliente(req, clienteId)` (`src/lib/auth/serverAuthorization.ts:272-277`). O comentário no próprio arquivo (linhas 256-271, referência interna `ZION-AUTHZ-001`) documenta uma correção que já aconteceu uma vez: a função aceitava `clienteId` vazio como "sem restrição", e o comportamento seguro dependia de cada uma das 15 rotas de então validar `!clienteId → 400` por conta própria. Hoje a recusa (403 se `clienteId` for vazio ou não-string) mora na própria função — a lição de que "depender de disciplina em N lugares" é o padrão de falha já foi aprendida uma vez neste código, para este sintoma específico.

**O que isso não prova**: que o 46º ponto de import, escrito amanhã, vai repetir o padrão. Nada no repositório impede um `getSupabaseAdmin()` novo de ser chamado sem `exigirAcessoAoCliente` antes — só a atenção de quem revisa o PR.

## 2. Cobertura de RLS, tabela por tabela

Gerado por análise estática das migrations (`rls_matrix.py`, saída completa em anexo ao workspace de auditoria) e conferido manualmente linha a linha porque a ferramenta lê **todas** as migrations, incluindo as substituídas — sem cruzar com a 041 ela reporta 29 tabelas como "ALTO risco" por ainda "ter" a policy `equipe_autenticada using(true)`, o que é **falso-positivo**: são exatamente as 29 tabelas que a 041 corrigiu (comparação campo a campo entre a lista de `database/migrations/041-fecha-o-rls-que-a-005-nao-fechou.sql:118-128` e as tabelas flagradas — coincidem 100%). Nenhuma migration entre 042 e 086 reintroduz `equipe_autenticada` (`grep -rl "equipe_autenticada" database/migrations/` só retorna arquivos ≤ 041, e as ocorrências ali são o próprio `drop policy if exists`).

- **Tabelas do Copilot (035, 037, 038)** — `copilot_conversas`, `copilot_mensagens`, `copilot_propostas`, `copilot_acoes`, `copilot_cadastros`, `procedencia_de_campo`: a ferramenta as reporta como "sem nenhuma policy" porque as policies são criadas dentro de um bloco `do $$ ... $$` condicional (só quando `cliente_do_usuario()` existe) e o parser estático não entra em PL/pgSQL dinâmico. Lidas diretamente (`database/migrations/035-copilot-propostas-e-conversas.sql:184-218`, `037:195-214`, `038:118-134`): RLS habilitada, policy de **SELECT** por `cliente_id = cliente_do_usuario()`, **zero policy de escrita** — escrita só pelas funções `SECURITY DEFINER`/`service_role`. É o desenho documentado no próprio comentário da 041 (linhas 65-66: "NÃO mexe nas tabelas do Copilot... nasceram com o desenho certo"). **NOT VULNERABLE**, investigado e descartado.
- **`public.agencias` (054)** — a ferramenta reporta a policy `equipe_total` (`for all using (eh_equipe())`) como "sem `WITH CHECK`, permite gravar linha de outro tenant". Lida a migration (`054-a-agencia-como-cliente.sql:87-88`): não há `WITH CHECK` explícito, mas a regra do Postgres para `FOR ALL` é usar a expressão de `USING` como `WITH CHECK` quando o segundo é omitido — ou seja, o efeito real é `WITH CHECK (eh_equipe())`, idêntico ao pretendido. **NOT VULNERABLE**, investigado e descartado (não verificado no banco vivo — o comportamento é o documentado pelo Postgres, mas uma policy criada manualmente pelo dashboard poderia divergir disso).
- **Tabelas com só SELECT criadas depois da 041** (`consumo_ia` 060, `ia_execucoes` 067, `imagens_versoes` 070, `copilot_investigacoes` 071, `ml_conexoes_pendentes` 055) — todas seguem o mesmo padrão deliberado: SELECT por `cliente_id = cliente_do_usuario()` ou `lojas_da_agencia()`, escrita só via função `SECURITY DEFINER`/`service_role`. Não é uma lacuna; é a mesma arquitetura do Copilot, repetida corretamente.
- **`storage.objects`** — a ferramenta não encontra `enable row level security` para esta tabela em nenhuma migration do repositório, mas encontra duas policies (`produtos_imagens_leitura`, `produtos_imagens_escrita`) em `database/staging/sql-editor/04-migrations-006-010.sql:274-275`. RLS em `storage.objects` é ligada por padrão pelo próprio Supabase (não por migration do usuário), então a ausência de um `alter table ... enable row level security` no repositório **não** significa RLS desligada — mas isso é exatamente o tipo de afirmação que só o banco vivo confirma. **Não verificado.**
- **`public.migracoes_aplicadas`** — só SELECT para equipe, sem INSERT/UPDATE/DELETE via RLS; é o ledger de migrations, escrito pela própria migration (papel dono da tabela, que ignora RLS). Não é dado de tenant. Sem risco relevante aqui.

Nenhuma tabela nova, das criadas depois da 041 (55 em diante), ficou com RLS habilitada e **zero** policy nenhuma — o padrão "nasce com policy" se manteve.

## 3. Server Actions e rotas de API — IDOR

Este projeto **não usa Server Actions** (`'use server'`): o inventário determinístico encontrou 0 arquivos com esse padrão. Toda mutação passa por `src/app/api/**/route.ts` (36 arquivos).

As 36 rotas foram lidas por completo. Nenhuma usa um `cliente_id`/`loja_id` vindo do body ou da query string para tocar dado via `service_role` sem checagem prévia de tenant:

- Rotas com o padrão clássico de risco (`clienteId` no body) — `ml/aplicar-capa`, `ml/autorizar`, `ml/categoria`, `ml/categoria/lote`, `ml/conectar`, `ml/custos`, `ml/desconectar`, `ml/diagnostico-*`, `ml/encerrar`, `ml/ensaio-da-capa`, `ml/estado-do-anuncio`, `ml/importar-anuncios`, `ml/melhor-capa`, `ml/otimizar-anuncio`, `ml/publicar`, `ml/quadrar-capa`, `ml/remover-foto`, `ml/vendas`, `imagens/aprovar`, `imagens/gerar`, `usuarios`, `assistente/proposta`, `assistente/conversa` — **todas** chamam `exigirAcessoAoCliente` (direto ou via helper `comToken`/`contexto`) antes de qualquer leitura/escrita.
- Caso de desenho correto notável: `src/app/api/imagens/aprovar/route.ts:38-49` deriva o `clienteId` do **dono real do recurso** (lido de `imagens_versoes.cliente_id` com o admin) e só então confirma via `exigirAcessoAoCliente` — não confia em nenhum id vindo do corpo.
- Caso de defesa em profundidade notável: `src/app/api/assistente/proposta/route.ts` filtra `.eq("cliente_id", p.clienteId)` em toda leitura pós-autorização, mesmo já tendo autorizado — proteção redundante contra um id de outro tenant entrar disfarçado num array de alvos em lote.
- Rotas onde o tenant só vem da sessão (nunca do request): `agencia/loja`, `agentes/esteira`, `agentes/executar`, `catalogo/extrair`, `loja/provisionar`, `loja/renomear` — OK por construção.
- Fora de escopo (não tocam dado de tenant): `csp-report`, `consulta-peso`, `saude/ia`, `versao`.
- `otimizar/worker` — worker de cron, ver achado #6.

## 4. Tokens OAuth de marketplace (Mercado Livre)

Este é o domínio mais maduro do repositório — há um histórico de hardening documentado nas próprias migrations, com referências a auditorias internas anteriores (`ZION-AGENCY-001`, `ZION-SECRET-001` em `059` e `061`).

**Fluxo:**
1. `POST /api/ml/autorizar` (`src/app/api/ml/autorizar/route.ts:67`) — `exigirAcessoAoCliente` antes de gerar um **ticket opaco** aleatório e gravá-lo em `ml_conexoes_pendentes` (migração 055) amarrado a `(cliente_id, usuario_id)`. O `state` enviado ao ML é o ticket, **nunca o `clienteId`** — decisão deliberada documentada no cabeçalho da 055 (linhas 14-26): se o `state` fosse o `clienteId`, bastaria editar a URL para conectar a própria conta do ML a uma loja alheia.
2. `POST /api/ml/conectar` (callback) — `exigirAutenticado`, resolve a loja **a partir do ticket** via `consumir_ticket_ml` (RPC `SECURITY DEFINER`, queima o ticket atomicamente), e **reconfirma** com `exigirAcessoAoCliente` (linha 106) — dupla checagem deliberada, porque o operador pode ter perdido acesso à loja entre o clique e a volta do Mercado Livre.
3. O `accessToken` nunca é persistido — só usado em memória durante a requisição. Só o `refreshToken` é gravado.

**Armazenamento:** tabela `canais_marketplace` (migração 009). Evolução:
- Texto puro (`refresh_token text`) até a migração 059/061.
- 061 (`a-credencial-do-ml-cifrada-em-repouso.sql`): cifragem com `pgcrypto` (`pgp_sym_encrypt`/`pgp_sym_decrypt`), chave simétrica de 32 bytes gerada e guardada no **Supabase Vault** (nunca sai do banco), acessível só por 4 funções `SECURITY DEFINER` (`ml_credencial_ler/gravar/rotacionar/limpar`) com `EXECUTE` concedido **só a `service_role`**.
- 062: a coluna em texto puro (`refresh_token`) foi **removida** do schema, só depois de confirmar (a própria migração aborta se não confirmar) que toda linha já tinha cópia cifrada.
- 059: `revoke all on table canais_marketplace from authenticated` + GRANT por coluna, explicitamente sem a coluna de credencial — nenhuma sessão de navegador alcança o valor, nem via RLS nem via PostgREST.
- 085 (`uma-conta-do-ml-pertence-a-uma-loja.sql`): índice único parcial `(marketplace, seller_id) where ativo` — impede que a MESMA conta ML fique ativa em duas lojas ao mesmo tempo (o comentário da migração cita um risco real: publicar duas vezes o mesmo anúncio, faturamento duplicado, e reincidência de infração atribuída à conta errada).

**Quem lê:** só `src/modules/integration/infrastructure/canalServidor.ts` chama as funções de credencial, sempre com um `clienteId` que o caller (`route.ts`) já validou via `exigirAcessoAoCliente` — confirmado arquivo a arquivo nas 9 rotas que tocam a credencial (`vendas`, `custos`, `encerrar`, `estado-do-anuncio`, `diagnostico-item`, `importar-anuncios`, `otimizar-anuncio`, `desconectar`, `conectar`).

Existe até um **teste estrutural dedicado** para este caminho específico — ver seção 5.

**Logs:** nenhuma ocorrência de `console.*` com o valor do token como argumento. O logger de erro genérico (`src/lib/http/respostaDeErro.ts:75`) loga o objeto `Error` inteiro, mas as funções que constroem esses erros (`src/lib/marketplaces/mercadolivre.ts`) nunca colocam o token no corpo da mensagem — só no header `Authorization`. Não é possível excluir 100% um vazamento via stack trace de uma dependência de rede subjacente; **não verificado**, mas de baixa probabilidade dado o padrão consistente.

**Veredito:** nenhuma falha encontrada neste domínio.

## 5. O que existe hoje como trava automática

A resposta não é uniforme — é preciso separar por escopo, porque o repositório já tem parte da resposta que a pergunta busca, só que aplicada de forma pontual:

### Já existe

- **`src/lib/auth/autorizarAntesDaCredencial.test.ts`** — teste estrutural (não de unidade) que lê o código-fonte das 36 rotas, encontra toda função que chama `lerCanalServidor`/`renovarToken`/`renovarTokenDaRota` (a credencial do ML) e falha se, **dentro da mesma função** (ou de um helper chamado antes do handler), não houver uma chamada a `exigir*` **antes** da linha que toca a credencial. Roda em `npm test`, que roda no CI (`.github/workflows/ci.yml`, step "Testes") e é obrigatório para todo push/PR. Nasceu de um incidente real (26/08/2026, comentário nas linhas 7-14 do arquivo): a ordem das linhas numa rota quase expôs a credencial de produção para um clique em ambiente errado.
- **`src/lib/auth/chamadasAutenticadas.test.ts`** — teste estrutural complementar: varre toda rota que exige sessão (`exigir*`) e confirma que todo `fetch()` no resto do código para essa rota manda o cabeçalho de sessão. Também nasceu de um incidente real (3 meses com um botão de produção quebrado, comentário linhas 7-22).
- **`src/application/arquitetura.test.ts`** — teste de fronteira de camadas (Domain/Application), não é sobre tenant, mas mostra que o padrão "teste estrutural que lê o próprio código-fonte e falha o build" já é cultura no repositório, não uma novidade a introduzir.
- **CI** (`ci.yml`) roda `typecheck`, `typecheck:test` (separado, porque um `tsc` verde já deixou passar contrato quebrado em fixture de teste — comentário no workflow), `lint` e `test` em todo push/PR para `master`.
- **Pre-commit hook** (`.githooks/pre-commit` → `scripts/hooks/preCommit.mjs`) valida disciplina de ledger de migration quando o commit toca `database/migrations/`.

### Não existe hoje

- **Nenhum teste equivalente para o padrão geral `getSupabaseAdmin()` → dado de tenant.** O teste que existe (`autorizarAntesDaCredencial.test.ts`) está *hard-coded* para três nomes de função (`lerCanalServidor`, `renovarToken`, `renovarTokenDaRota`) — a credencial do ML. Ele não sabe nada sobre `produtos`, `anuncios_gerados`, `pendencias` ou qualquer outra tabela de tenant tocada via `service_role`. Um novo arquivo em `src/lib/services/` que chame `getSupabaseAdmin()` e leia/escreva por `cliente_id` sem checagem não é pego por nada automatizado.
- **Nenhuma regra de ESLint** restringe o import de `src/lib/supabase/admin.ts` (`eslint.config.mjs` não tem `no-restricted-imports` nem regra customizada — confirmado, é 45 linhas, só a config padrão do Next + 5 regras de `react-hooks` rebaixadas a warning).
- **Nenhum tipo TypeScript** obriga a passagem de um contexto de tenant para criar o cliente admin — `getSupabaseAdmin(): SupabaseClient` não recebe nenhum parâmetro; o tipo de retorno é o `SupabaseClient` genérico do SDK, sem diferenciação em nível de tipo entre "cliente com tenant resolvido" e "cliente cru".
- **Nenhum teste de integração que tente ler/escrever dado de outro tenant e falhe o build se conseguir** — os testes de RLS que existem (`src/lib/services/*.test.ts`) testam comportamento de escrita silenciosa (INC-004) e execução atômica, não isolamento entre tenants.

**Resposta direta ao item 5:** para o caso específico da credencial do Mercado Livre, existe uma trava automática real e ela já provou valor (nasceu de um quase-incidente). Para o caso geral — qualquer tabela de tenant tocada via `service_role` — **não existe hoje**.

## 6. Achado adicional: a fila do cron confia no tenant que ela mesma não valida

Não estava na lista de pontos pedidos, mas apareceu ao verificar o worker do cron (item 1) e é o achado que melhor ilustra a pergunta central da auditoria — porque é um buraco **do mesmo formato** do incidente de 29/07/2026, em código escrito **depois** da correção da 041.

**A cadeia:**

1. `src/lib/services/filaOtimizacaoProduto.ts:19-37` (`enfileirarProdutos(clienteId, produtoIds)`) roda no **navegador**, com o cliente Supabase de sessão (`getSupabase()`, `anon key`, sujeito a RLS) — chamado de `src/app/otimizar-lote/page.tsx:98`, `src/app/cliente/otimizar/page.tsx:531`, `src/app/cliente/produtos/page.tsx:781`, `src/components/client-portal/ChatDaOperacao.tsx:3265`.
2. A tabela `fila_otimizacao_produto` (`database/migrations/012-fila-otimizacao-produto.sql:11-23`) tem `produto_id uuid not null references public.produtos(id)` — a *foreign key* só exige que o produto **exista em algum tenant**, não que pertença ao `cliente_id` da mesma linha.
3. A policy de RLS (`012-fila-otimizacao-produto.sql:34-37`, mantida pela 041/016) é `with check (cliente_id = public.cliente_do_usuario() or public.eh_equipe())` — **valida só o `cliente_id`**, nunca a relação entre `cliente_id` e `produto_id`.
4. O worker (`src/app/api/otimizar/worker/route.ts`), autenticado por `CRON_SECRET` e rodando com `service_role`, lê o produto da fila **sem filtrar por tenant**: `admin.from("produtos").select("*, clientes(empresa)").eq("id", fila.produto_id).maybeSingle()` (linhas 295-299) — nenhum `.eq("cliente_id", fila.cliente_id)`.
5. O resultado (`gerarAnuncio(produto, variantes, tabelas, atributosDoProduto, perfil, exigencias, procedencia, fotos)`, linha 372) é montado a partir dos dados **reais** do produto lido — nome, variantes, atributos, categoria, contagem de fotos — e inserido em `anuncios_gerados` com `clienteId: fila.cliente_id` (linhas 384-411), ou seja, **atribuído ao tenant que enfileirou**, não ao dono do produto.

**O que isso significa, concretamente:** um usuário autenticado com papel `cliente` pode inserir uma linha em `fila_otimizacao_produto` com `cliente_id = <o próprio>` e `produto_id = <de qualquer outro tenant>` — essa escrita passa pela RLS porque a policy nunca olha o `produto_id`. O worker processa a linha sem revalidar posse e gera, dentro do tenant do atacante, um rascunho de anúncio derivado do produto real de outro cliente (nome, atributos, categoria, dados que alimentam preço/margem).

**Classificação: gap estrutural confirmado, exploração não verificada.** A ausência da checagem — no INSERT (RLS) e no worker (`service_role`) — está confirmada lendo o código e as migrations. O que **não** foi verificado é como um atacante obteria o UUID de `produto_id` de outro tenant na prática (não são sequenciais; nenhuma tela lista IDs de outros tenants nos caminhos revisados nesta auditoria) — então o risco real depende de uma segunda informação vazar primeiro, por outro caminho não mapeado aqui. Mesmo assim, é exatamente o padrão que motivou esta auditoria: **uma camada confiou que a anterior já tinha validado, e nenhuma das duas validou o par completo.**

Nenhuma outra fila ou caminho equivalente foi encontrado com o mesmo padrão dentro do escopo lido (as filas `fila_otimizacao` e `execucoes_lote` são escritas só pela equipe/`service_role`, não pelo navegador do cliente).

---

## Como tornar o isolamento estrutural em vez de convencional

Cinco opções, do mais barato ao mais caro. Nenhuma é excludente — a recomendação no final combina duas.

### A. Teste estrutural que generaliza o `autorizarAntesDaCredencial.test.ts` para todo `getSupabaseAdmin()`

**O que é:** o mesmo mecanismo que já existe e já provou valor — ler o código-fonte de `src/app/api/**/route.ts` e `src/lib/services/**/*.ts`, achar toda função que chama `getSupabaseAdmin()` e, **dentro da mesma função** (ou via helper chamado antes), exigir uma chamada a `exigir*` antes de qualquer `.from(...)` do cliente admin em tabela com coluna `cliente_id`. Generaliza o padrão do arquivo que já existe (`credencialSemPorteira`) trocando a lista de 3 funções-alvo por "qualquer uso do cliente admin".

**O que previne:** um novo `route.ts` ou serviço que chame `getSupabaseAdmin()` sem checagem de tenant antes — falha o `npm test`, que já é obrigatório no CI e no gate local. Pega exatamente o padrão do incidente de 29/07 (checagem existe em algum lugar, mas não neste caminho) antes de chegar a produção.

**O que não previne:** um serviço que recebe um `clienteId` de um *caller* — a análise estática não sabe provar que o caller de fato validou aquele valor específico (o `autorizarAntesDaCredencial.test.ts` atual tem a mesma limitação: olha só dentro da função, ou de um helper). Também não pega o achado #6 (a checagem que falta ali é no `INSERT` feito pelo *browser*, e a leitura no worker não tem um "id de tenant do request" para checar — o buraco é de outra natureza, ver opção D).

**Esforço:** S — o código-molde já existe no repositório (`autorizarAntesDaCredencial.test.ts`), é generalizar a lista de funções-alvo e apontar também para `src/lib/services/`.

**O que quebra hoje:** potencialmente nada nas rotas (a auditoria de IDOR não encontrou nenhum caso real), mas é provável que o teste precise de uma lista de exceções explícita para os 11 pontos "não se aplica" documentados na seção 1 (cron, criação de recurso novo, telemetria) — do jeito que `autorizarAntesDaCredencial.test.ts` já lida com casos como `comToken`/`contexto` (autorização no helper).

### B. Wrapper que substitui `getSupabaseAdmin()` por uma função que exige o contexto de tenant

**O que é:** trocar `export function getSupabaseAdmin(): SupabaseClient` por algo como `getSupabaseAdminParaCliente(ctx: ContextoAutorizado, clienteId: string): SupabaseClient` — ou, mais simples, manter `getSupabaseAdmin()` só para os casos "não se aplica" documentados (cron, criação de recurso) e criar `getSupabaseAdminComoCliente(ctx, clienteId)` para todo o resto, que internamente chama `exigirAcessoAoCliente`-equivalente antes de devolver o cliente.

**O que previne:** por *design*, não é possível obter um cliente admin "genérico" sem passar o contexto — o erro deixa de ser "esqueci de checar" e passa a ser "não compila sem os dois argumentos". É mais forte que o teste (A), porque não depende de rodar a suíte para pegar — o TypeScript recusa o build.

**O que não previne:** alguém pode passar um `clienteId` errado (não o da sessão) e a função aceitaria — o wrapper garante que *algum* contexto foi fornecido, não que ele é o certo. Ainda depende de disciplina para "qual `clienteId` eu passo aqui", só que agora o compilador força a pergunta a ser feita.

**Esforço:** M — é uma mudança de assinatura numa função usada em 46 lugares. Não é reescrever a lógica de cada um (a checagem já existe na maioria), é mover a chamada de `exigirAcessoAoCliente` para dentro do wrapper e ajustar as chamadas.

**O que quebra hoje:** os 11 pontos "não se aplica" (cron, criação de loja nova, telemetria) precisam de uma segunda função (`getSupabaseAdminSemTenant()`, nomeada de propósito para chamar atenção em code review) — forçar todo mundo pelo mesmo molde quebraria o worker do cron, que não tem sessão de usuário. O `catalogo/extrair` e `execucoesDeIA` (telemetria com o `clienteId` da própria sessão, não de terceiro) também precisam entrar nessa segunda categoria ou aceitar o wrapper com o próprio id — verificar caso a caso ao migrar.

### C. Regra de lint (`no-restricted-imports`) barrando o import direto de `admin.ts`

**O que é:** uma regra de ESLint (`no-restricted-imports` com `paths`, ou uma regra customizada) que barra `import { getSupabaseAdmin } from ".../supabase/admin"` fora de uma allowlist de arquivos (o próprio wrapper da opção B, se implementado, e os arquivos "não se aplica" documentados).

**O que previne:** um import novo e "solto" de `admin.ts` num componente ou arquivo fora do padrão esperado — pega no `npm run lint`, que já é obrigatório no CI.

**O que não previne:** nada sobre o *uso* — só sobre *onde* o import aparece. Se o wrapper (B) não existir, um arquivo já allowlistado pode continuar esquecendo a checagem; a regra sozinha (sem B) só limita a superfície de arquivos a revisar, não substitui revisão.

**Esforço:** S — poucas linhas em `eslint.config.mjs`.

**O que quebra hoje:** nada além de precisar listar os ~46 arquivos atuais na allowlist inicial (ou, melhor, restringir por diretório: permitir `src/app/api/**` e `src/lib/services/**`, bloquear em qualquer outro lugar — mais barato de manter e já cobre o caso real, já que nenhum import hoje está fora desses dois diretórios, conferido no inventário da seção 1).

### D. Constraint de banco para o achado #6 (`fila_otimizacao_produto`)

**O que é:** específico ao achado 6, não ao padrão geral. Duas opções técnicas, crescente em custo:
   - **D1 (barata):** um trigger `BEFORE INSERT OR UPDATE` em `fila_otimizacao_produto` que confere `exists (select 1 from produtos where id = new.produto_id and cliente_id = new.cliente_id)` e rejeita se não bater.
   - **D2 (mais robusta, mais cara):** desnormalizar não é necessário aqui porque já existe FK simples; o trigger da D1 resolve sem mudança de schema.

**O que previne:** o INSERT malicioso descrito no achado 6, tanto pelo navegador (RLS) quanto por qualquer outro caminho futuro que grave nessa fila — a garantia migra de "quem escreve validou" para "o banco não aceita a combinação errada", que é o mesmo tipo de mudança que a 041 fez (de "confiar na aplicação" para "o RLS decide").

**O que não previne:** qualquer outra tabela com o mesmo padrão (duas FKs para tenants diferentes sem constraint cruzando as duas) que ainda não foi encontrada — esta auditoria não teve escopo para varrer as 57 tabelas procurando esse padrão especificamente; é um exercício futuro (ver seção de cobertura).

**Esforço:** S — um trigger, uma migration, o teste de regressão que a própria cultura de migration deste repositório já pratica (ver o padrão de "prova" em toda migration lida, ex. 041 e 062).

**O que quebra hoje:** nada, se não houver hoje nenhuma linha em `fila_otimizacao_produto` com `produto_id` de tenant diferente do `cliente_id` (não verificado — precisa rodar a mesma query de checagem que a 085 rodou para `canais_marketplace` antes de aplicar a constraint, para não travar em dado sujo já existente).

### E. Teste de integração "tenta vazar e falha o build"

**O que é:** um teste que sobe dois tenants sintéticos contra um Supabase de teste (ou usa o padrão de mock de `escritasQueFalhamEmSilencio.test.ts`, que já simula respostas do PostgREST), autentica como o tenant A e tenta ler/escrever um recurso do tenant B por 3-4 caminhos representativos (uma rota de API, uma leitura direta via RLS, o `enfileirarProdutos` do achado 6) — falha o build se qualquer tentativa tiver sucesso.

**O que previne:** regressão em qualquer um dos caminhos cobertos pelo teste, incluindo regressão de RLS causada por uma migration futura mal escrita (o cenário exato do incidente de 29/07 — a 005 alegou proteger e não protegia, e nada testou).

**O que não previne:** qualquer caminho não coberto pelos casos escolhidos — este teste tem cobertura do tamanho da lista de cenários que alguém escreveu, ao contrário das opções A/C que cobrem *todo* uso de um padrão sintático.

**Esforço:** L — precisa de infraestrutura de teste contra um banco real (ou um mock de PostgREST fiel o bastante para expressar RLS, o que é difícil — RLS é lógica do Postgres, não da aplicação). É o item mais caro da lista, e o único que exigiria decidir se roda contra Supabase local (Docker) no CI.

**O que quebra hoje:** nada no código; exige decisão de infraestrutura de CI (banco de teste efêmero) que este repositório hoje não tem.

---

## Recomendação única

**Adotar a opção A primeiro:** generalizar `src/lib/auth/autorizarAntesDaCredencial.test.ts` para cobrir todo uso de `getSupabaseAdmin()`, não só a credencial do ML.

Por quê esta e não outra:

1. **É a única que custa quase nada e fecha a lacuna descrita no item 5 diretamente** — hoje existe o molde exato (`credencialSemPorteira`), testado, já rodando no CI, já tendo provado que pega o defeito real (nasceu de um incidente, não de teoria). Generalizar a lista de funções-alvo de 3 nomes para "qualquer chamada a `getSupabaseAdmin`" é reaproveitar infraestrutura que já existe e já é gate obrigatório de todo PR — não é preciso convencer ninguém a adicionar uma etapa nova ao CI, ela já está lá.
2. **É estática, não depende de infraestrutura de teste nova** (ao contrário da opção E, que exige banco de teste no CI — mudança de infraestrutura, não só de código).
3. **Cobre os 46 pontos de entrada atuais e qualquer um novo**, porque varre o código-fonte, não uma lista de casos escritos à mão.
4. A opção B (wrapper com tipo) é estruturalmente mais forte — vale fazer depois —, mas é uma refatoração de 46 call sites, com risco real de quebrar o worker de cron e os casos de telemetria se a categorização "precisa de tenant" vs "não precisa" não for feita com cuidado. A (A) dá o mesmo tipo de proteção (falha o build antes de produção) por uma fração do esforço, e não é descartada pela (B) — as duas se somam.

**Segunda ação, de custo baixo e impacto concentrado:** aplicar a opção D (trigger em `fila_otimizacao_produto`) para fechar o achado #6 especificamente — é uma migration pequena, no padrão que este repositório já domina (a própria 085 fez exatamente este tipo de correção para `canais_marketplace`), e fecha um gap já confirmado, não hipotético.

As opções C (lint) e B (wrapper) ficam como próximo passo, nessa ordem — lint primeiro por ser mais barato, wrapper depois por exigir mais coordenação. A opção E (teste de integração contra RLS real) é a que mais valor estrutural agregaria a longo prazo — é o único mecanismo que pegaria uma regressão de *RLS* (não de código de aplicação) como a que motivou a 041 — mas depende de uma decisão de infraestrutura de CI que está fora do escopo de "qual trava adotar primeiro" e vale uma conversa própria.

---

## Cobertura e limitações desta auditoria

- **Lido por completo:** as 36 rotas de API, os 46 pontos de `service_role`, o fluxo OAuth do ML e sua tabela de credencial, as migrations relevantes a RLS (todas as que tocam tabelas de tenant), os testes estruturais existentes, a config de CI/lint/pre-commit.
- **Não coberto por falta de acesso:** estado vivo do banco (RLS realmente habilitada, policies fora das migrations, GRANTs atuais) — não havia MCP do Supabase conectado nesta sessão. Toda afirmação sobre "o banco hoje" vem de ler migrations, não de consultar o banco.
- **Não coberto por escopo:** varredura completa das 57 tabelas procurando o mesmo padrão do achado #6 (duas FKs de tenants diferentes sem constraint cruzando as duas) — só foi encontrado ao investigar o worker de cron especificamente pedido no item 1; pode haver outras.
- **Fora do pedido do usuário, não auditado nesta rodada:** dependências/supply chain, infraestrutura/CORS/headers, lógica de negócio fora de isolamento de tenant, segurança de agentes de IA além do que apareceu ao verificar `service_role` (a trava de posse em `reativar_anuncio`, `assistente/conversa/route.ts:1863-1901`, foi observada de passagem e parece correta, mas não foi auditada a fundo).
