# 10 — Perguntas e Decisões

Decisões que **travam ou direcionam** o próximo passo. Cada uma tem contexto, opções e uma recomendação. Também lista o que ficou **NÃO CONFIRMADO** e precisa de validação.

## Decisões de produto/negócio

### D1 — Como os clientes vão entrar? (self-signup × convite)
- **Contexto**: hoje o cliente é criado manualmente (Auth + linha em `perfis`). O fail-safe "sem perfil = equipe" (R1) só é perigoso **se** houver signup automático.
- **Opções**: (a) só por convite da equipe (mais seguro, atual); (b) self-signup com criação atômica de `perfis`.
- **Recomendação**: manter **convite** até a Fase 1 fechar o RLS; só então liberar self-signup. **Bloqueia** a inversão do default.

### D2 — Multi-usuário por empresa?
- **Contexto**: `perfis` hoje é 1 usuário → 1 cliente. Empresas reais têm dono + operadores.
- **Opções**: (a) manter 1:1 por ora; (b) `organization_membership` com papéis (dono/operador/leitura).
- **Recomendação**: já **estruturar** para N (tabela de membership na Fase 1), mesmo que a UI comece com 1 usuário.

### D3 — Escopo por membro da equipe (carteira de clientes)?
- **Contexto**: hoje **toda** a equipe vê **todos** os clientes (`eh_equipe()` = acesso total). Para uma agência pequena, ok; ao crescer, pode-se querer "cada gestor vê a sua carteira".
- **Recomendação**: aceitar o modelo atual por ora; reavaliar quando a equipe crescer. **Não** é bloqueio agora.

### D4 — Modelo de cobrança (cota × uso real)
- **Contexto**: `limite_esteira_mes` conta **execuções**; o custo real é por **token/modelo** (não medido — R4).
- **Opções**: (a) plano por nº de otimizações; (b) plano + consumo de IA (após `ai_execucoes`).
- **Recomendação**: manter cota por execução para começar; medir custo real (Fase 3) antes de precificar plano.

## Decisões técnicas

### D5 — Primeiro marketplace novo depois do ML?
- **Contexto**: TikTok Shop já aparece nas configs do toolkit e no README como alvo.
- **Recomendação**: **TikTok Shop** como 2º canal, **após** o contrato `MarketplaceAdapter` (Fase 5). Confirmar com a estratégia comercial.

### D6 — Webhooks do ML agora ou depois?
- **Contexto**: hoje o sistema **puxa** (importar/vendas); não **recebe** eventos (status/pergunta/venda).
- **Recomendação**: criar `webhook_events` na Fase 3–4 para reduzir polling e reagir a pausas/perguntas. Não é bloqueio para publicar.

### D7 — Realtime × polling
- **Contexto**: Realtime está declarado nas migrações mas o app usa polling; o worker server-side não atualiza a tela (R12).
- **Recomendação**: ligar Realtime nas tabelas do portal e no status da fila (baixo custo, alto ganho de UX).

### D8 — Prioridade: segurança (Fase 1) × publicar de verdade (R7 User Products)
- **Contexto**: são dois "próximos passos" legítimos. Fase 1 destrava **receber clientes**; R7 destrava **publicar na conta atual**.
- **Recomendação**: se o objetivo imediato é **operar a Chinelaria de ponta a ponta**, adiantar R7; se é **vender o SaaS para novos clientes**, priorizar Fase 1. **Decisão do usuário.**

## NÃO CONFIRMADO (validar no código/ambiente)

1. **Alguma rota de API confia em papel vindo do cliente?** (R6) — precisa revisão rota a rota das `src/app/api/**` para confirmar que a autorização é revalidada no servidor.
2. **Migração 016+ existe além da 015?** A memória do projeto cita `canais_marketplace` como 011, mas o arquivo em `database/migrations/` é o `009`. Há divergência de numeração entre a memória e os arquivos — **os arquivos (001–015) são a fonte da verdade**; conferir se o Supabase de produção rodou exatamente esses.
3. **`maxDuration` do publish (60s) × plano Vercel** — o worker usa 300s (Pro); `api/ml/publicar` declara 60s (grátis). Confirmar o plano real e se publicações grandes cabem em 60s.
4. **Estado do `execucoes_agentes`** (tabela base v1.x) — confirmar se é usada hoje ou se ficou legada (a esteira grava em `anuncios_gerados`, não nela).
5. **Cobertura de `anuncio_variantes`/`precificacao_variantes` no fluxo real** — as tabelas existem (migração 001); confirmar se a esteira/publicação as populam ou se hoje só `anuncios_gerados` carrega as variações (o `mlPayload` lê `anuncio.variacoes`, não `anuncio_variantes`).
6. **Toolkit Python** — decidir se a lógica de capa (`gerar_capas_ml.py`, `trocar_fotos_ml.py`) e precificação (`etapa_precificacao_BC.py`) será **absorvida** pelo SaaS (Estúdio IA já cobre parte) ou **aposentada**. Hoje há duplicação de regra entre os dois mundos.

## Como decidir (sugestão de sequência)
1. Responder **D8** (prioridade macro) — define se o foco é Fase 1 ou R7.
2. Confirmar **D1/D2** — destrava a Fase 1 (RLS) com segurança.
3. Resolver os **NÃO CONFIRMADOS 1 e 2** antes de qualquer mudança de schema/segurança.
