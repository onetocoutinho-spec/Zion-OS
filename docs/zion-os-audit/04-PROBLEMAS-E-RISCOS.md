# 04 — Problemas e Riscos

Cada item: **evidência** (arquivo:linha) · **impacto** · **recomendação**. Classificação: 🔴 Crítico · 🟠 Alto · 🟡 Médio · ⚪ Baixo.

---

## 🔴 R1 — Default "sem perfil = equipe" dá acesso total

- **Evidência (FATO)**: `database/migrations/005-portal-cliente.sql:28-34` — `eh_equipe()` retorna `coalesce((papel='equipe' …), true)`. Ou seja, **usuário autenticado sem linha em `perfis` é tratado como equipe** (acesso total a todos os clientes). Todas as políticas base usam `eh_equipe()` (`005:59-60`).
- **Impacto**: se houver **self-signup** de cliente, ou se um cliente for criado no Auth **antes** do registro em `perfis`, esse usuário enxerga dados de **todas as empresas** (custo, margem, vendas). Vazamento entre tenants — risco legal/comercial.
- **RECOMENDAÇÃO**: inverter o fail-safe para **negar por padrão** (`coalesce(…, false)`) e garantir que **todo** usuário receba um `perfis` na criação (trigger em `auth.users` ou no fluxo de convite). Bloquear cadastro de cliente que não crie o perfil atomicamente. *(Antes de receber o 2º cliente.)*

## 🔴 R2 — Publicação no ML sem fila e sem idempotência

- **Evidência (FATO)**: `src/lib/services/publicacaoML.ts:66-118` — `publicarNoML` roda **síncrono, no cliente**, item a item; `POST /api/ml/publicar` cria em `/items` sem chave de idempotência. Não há tabela de fila para publicação (só para otimização, `fila_otimizacao_produto`).
- **Impacto**: (a) **escala** — 1.000 anúncios = 1.000 chamadas sequenciais presas à aba aberta; (b) **integridade** — reenvio/refresh/duplo clique pode **criar o anúncio duas vezes** no ML (sem `external_id`/dedup). Anúncio duplicado é penalizado pelo ML e confunde a conciliação de estoque.
- **RECOMENDAÇÃO**: enfileirar a publicação (reusar o padrão do worker de otimização), com **idempotência** por `(cliente_id, produto_id, marketplace)` e verificação "já existe `ml_item_id`?" antes de criar. Persistir tentativa/resultado.

## 🟠 R3 — refresh_token do cliente trafega pelo navegador da equipe

- **Evidência (FATO)**: `src/lib/services/publicacaoML.ts:83-99` lê `canal.refreshToken` no cliente e o envia no corpo do POST; `src/app/api/ml/publicar/route.ts:8-9,44-49` documenta e espera `refreshToken` no corpo.
- **Impacto**: o segredo de longa duração da conta ML do cliente passa pelo browser da equipe (memória, logs de rede, extensões). Aumenta a superfície de vazamento de credencial de terceiro.
- **RECOMENDAÇÃO**: manter o `refresh_token` **100% server-side** — a rota recebe apenas `clienteId`/`canalId` e busca o token com `service_role` no servidor. O browser nunca vê o token.

## 🟠 R4 — Sem ledger de custo/uso de IA

- **Evidência (FATO)**: `src/lib/agentes/provedorIA.ts` retorna `{json, provedor, modelo}` mas **nada é persistido**; `execucoes_lote`/`execucoes_agentes` (migração 002) guardam só `entrada_resumo`/`saida_resumo`/`erros`, **sem** tokens/custo/modelo por chamada.
- **Impacto**: custo de IA **cego** — impossível atribuir gasto por cliente, prever margem do plano, ou detectar um cliente/produto que "queima" quota. A cota (`limite_esteira_mes`) conta *execuções*, não *tokens/custo real*.
- **RECOMENDAÇÃO**: tabela `ai_execucoes` (cliente_id, produto_id, agente, provedor, modelo, tokens_in/out, custo_estimado, status, ms). Gravar no `chamarIAEstruturada`. Base para billing por uso.

## 🟠 R5 — Sem auditoria de alteração (anterior → novo, autor, desfazer)

- **Evidência (FATO)**: as escritas passam pelo repositório genérico (`src/lib/repositorio.ts`) que faz `insert/update/delete` **sem** trilha de versão. `anuncios_gerados` guarda o resultado atual, não o histórico campo-a-campo nem quem aprovou o quê (só `aprovado_por`/`aprovado_em`).
- **Impacto**: não dá para responder "o que a IA mudou, quando, por qual agente, e com qual confiança" nem **desfazer** uma alteração. Trava a "central de aprovação" rica ([07](./07-WIREFRAMES-TEXTUAIS.md)) e a confiança do cliente.
- **RECOMENDAÇÃO**: `auditoria_log` (entidade, id, campo, valor_anterior, valor_novo, autor, agente, modelo, confiança, timestamp) + versões do anúncio (`listing_versions`) para diff e revert.

## 🟠 R6 — Proteção de rota é client-side

- **Evidência (FATO)**: `README.md` ("Limitações conhecidas") + `AuthGate` em `src/components/auth`. A separação equipe×cliente na navegação é no browser.
- **Impacto**: a defesa real é só o RLS. Se uma rota de API server-side confiar em papel vindo do cliente (sem revalidar no servidor), há risco. **NÃO CONFIRMADO** que alguma rota confie no cliente para autorização — precisa revisão rota a rota.
- **RECOMENDAÇÃO**: revalidar papel/escopo **no servidor** em toda rota sensível (a partir da sessão Supabase), não confiar em flag do cliente. Manter RLS como segunda camada.

## 🟠 R7 — Publicação "User Products" não ligada ao fluxo

- **Evidência (FATO)**: `src/lib/marketplaces/mlPayload.ts:67-138` monta o modelo **clássico** (`title` + `variations[]`). `mlUserProducts.ts` (builder do modo novo, `family_name` + `SIZE_GRID`) existe mas **não é chamado** pelo `publicacaoML.ts`. A conta atual (calçado MLB273770) exige o modo novo.
- **Impacto**: publicar de verdade na conta principal **falha** (`body.invalid_fields`) — o ML rejeita o payload clássico nessa categoria. É o bloqueio prático para "publicar de verdade".
- **RECOMENDAÇÃO**: no publish, escolher **clássico × User Products por categoria**; criar a guia de tamanhos (`POST /catalog/charts`) antes; testar 1 item real.

## 🟡 R8 — Sem fallback entre provedores de IA + teto de tokens do Gemini

- **Evidência (FATO)**: `provedorIA.ts:159-163` — se o provedor escolhido falha, **erra** (não tenta o outro). `provedorIA.ts:89` limita `maxOutputTokens` do Gemini a 8192, enquanto o `ESQUEMA_ANUNCIO` é grande (o worker faz retry de parse por JSON truncado, `worker/route.ts:82-95`).
- **Impacto**: indisponibilidade do Gemini derruba a esteira mesmo com chave Claude presente; JSON grande pode truncar e gastar tentativas.
- **RECOMENDAÇÃO**: fallback automático Gemini→Claude (ou vice-versa) em erro não-determinístico; considerar modelo/limite maior para o anúncio completo.

## 🟡 R9 — Sem contrato de adaptador de marketplace

- **Evidência (FATO)**: `src/lib/marketplaces/` é 100% ML; não há interface `MarketplaceAdapter`. Regras do ML (atributos, shipping, GTIN) vivem no builder e nos serviços.
- **Impacto**: adicionar Shopee/TikTok/Amazon/Magalu exige espalhar `if marketplace === …`. Dívida que cresce a cada canal.
- **RECOMENDAÇÃO**: contrato único (`publicar/atualizar/pausar/excluir/importar/webhook/limites`) com `MercadoLivreAdapter` primeiro. Detalhe em [06](./06-ARQUITETURA-RECOMENDADA.md).

## 🟡 R10 — Segredos em texto no working tree

- **Evidência (FATO)**: `credenciais.md` (~38 KB) na raiz do repo contém tokens reais (gitignored conforme memória do projeto).
- **Impacto**: risco de higiene — um `git add -f`, backup ou compartilhamento de pasta vaza credenciais. Segredo em texto claro no disco de trabalho.
- **RECOMENDAÇÃO**: mover para um cofre (1Password/Vault/`.env` fora do repo); nunca versionar; rotacionar o que já esteve exposto. *(Este relatório não reproduz nenhum valor do arquivo.)*

## 🟡 R11 — Tamanhos das variações não normalizados

- **Evidência (FATO/memória do projeto)**: tamanhos importados do ML vêm "sujos" ("38 BR", "33 - 34", faixas "33-38"). O `mlPayload.ts:95` envia `SIZE value_name` cru.
- **Impacto**: bloqueia o `SIZE_GRID` do modo User Products e a conciliação por tamanho.
- **RECOMENDAÇÃO**: normalizador de grade (BR) na importação/edição da variação, antes do publish.

## 🟡 R12 — Realtime declarado mas não usado; atualização por polling

- **Evidência (FATO)**: migrações fazem `alter publication supabase_realtime add table …`, mas o app usa `notificarMudanca()`/`useLiveQuery` (`repositorio.ts:8-9`). Escritas server-side (worker) **não** disparam `notificarMudanca` → a tela só atualiza no refresh (confirmado na memória do projeto).
- **Impacto**: UX — anúncios criados pelo worker "não aparecem" até o usuário recarregar. Confunde o cliente.
- **RECOMENDAÇÃO**: usar Realtime de fato para as tabelas do portal (ou polling leve no status da fila) para refletir o worker sem refresh manual.

## ⚪ R13 — Duas filas com nomes parecidos

- **Evidência (FATO)**: `fila_otimizacao` (equipe, migração 002) e `fila_otimizacao_produto` (cliente/worker, migração 012) coexistem. Só a segunda é consumida pelo worker.
- **Impacto**: confusão de manutenção; risco de otimizar pelo caminho errado.
- **RECOMENDAÇÃO**: unificar num modelo de "tarefa" único ([06](./06-ARQUITETURA-RECOMENDADA.md)) ou documentar claramente a diferença.

## ⚪ R14 — Cobertura de testes

- **Evidência (FATO)**: não há framework/arquivos de teste no `package.json` (só `lint`); `git`/CI não incluem testes automatizados.
- **Impacto**: regressões silenciosas em builders puros (`mlPayload`), mappers e parsing de IA.
- **RECOMENDAÇÃO**: testes de unidade nos módulos **puros** primeiro (`mlPayload`, `provedorIA.paraSchemaGemini`, mappers) — alto valor, baixo custo.

---

## Matriz de risco

| ID | Risco | Gravidade | Esforço de correção |
|----|-------|-----------|---------------------|
| R1 | Default "sem perfil = equipe" | 🔴 Crítico | Baixo |
| R2 | Publicação sem fila/idempotência | 🔴 Crítico | Médio |
| R3 | refresh_token no browser | 🟠 Alto | Baixo |
| R4 | Sem ledger de IA | 🟠 Alto | Médio |
| R5 | Sem auditoria de alteração | 🟠 Alto | Médio |
| R6 | Autorização client-side | 🟠 Alto | Médio |
| R7 | User Products não ligado | 🟠 Alto | Médio |
| R8 | Sem fallback de IA / teto tokens | 🟡 Médio | Baixo |
| R9 | Sem MarketplaceAdapter | 🟡 Médio | Médio |
| R10 | Segredos em texto no repo | 🟡 Médio | Baixo |
| R11 | Tamanhos não normalizados | 🟡 Médio | Médio |
| R12 | Polling em vez de Realtime | 🟡 Médio | Baixo |
| R13 | Duas filas parecidas | ⚪ Baixo | Baixo |
| R14 | Sem testes | ⚪ Baixo | Médio |
