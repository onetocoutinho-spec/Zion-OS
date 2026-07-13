# 01 — Resumo Executivo

## 1. Diagnóstico geral

**Nível: MVP funcional, entrando em produção para 1 cliente.**

Não é protótipo nem "só visual": o sistema tem banco real (Supabase, 15 migrações aditivas), autenticação por papel (equipe × cliente) com RLS, integração OAuth com o Mercado Livre **funcionando** (o cliente conecta a própria conta), geração de conteúdo por IA real (Gemini ou Claude atrás da mesma interface), uma **fila de otimização** consumida por um worker no servidor (Vercel Cron) e deploy em produção (Vercel + Cloudflare).

Por que ainda **não** é "pronto para escala":
- A **publicação** no ML é síncrona, um-a-um e disparada do navegador — não passa por fila e não é idempotente (`src/lib/services/publicacaoML.ts`).
- O isolamento multiempresa tem um **default perigoso**: "usuário sem perfil = equipe (acesso total)" (`database/migrations/005-portal-cliente.sql`).
- Não há **ledger de custo/uso de IA** nem **auditoria de alteração** (valor anterior → novo, com quem/quando/desfazer).
- As integrações são **ML-específicas**; não há um contrato de adaptador para plugar Shopee/TikTok/Amazon/Magalu.
- O worker processa **1 item por vez** (`CONCORRENCIA = 1`) — suficiente para dezenas/centenas de itens de 1 cliente, apertado para milhares em vários clientes.

Em resumo: **fundação boa e real, faltam as travas de escala, segurança multi-tenant e observabilidade** antes de receber vários clientes maiores.

## 2. O que deve ser mantido (aproveitável)

1. **Separação catálogo × anúncio** — `produtos` → `produto_variantes` (SKU) → `anuncios_gerados`/`anuncios` por canal. Modelo correto; é a espinha dorsal. (`database/migrations/001`)
2. **Gateway de IA** — `src/lib/agentes/provedorIA.ts` já abstrai Gemini/Claude com saída estruturada (JSON Schema). Só falta ledger + fallback.
3. **Catálogo de agentes A0–A12** — `src/lib/agentes/catalogo.ts` é fonte única dos prompts reais; alimenta esteira, portal e tela de agentes. Excelente ativo.
4. **Fila + worker de otimização** — `fila_otimizacao_produto` + `src/app/api/otimizar/worker/route.ts`: retry, recuperação de item preso, tratamento de rate-limit, idempotência por `unique(produto_id)`. Reaproveitar o padrão para publicação.
5. **Repositório genérico com lote** — `src/lib/repositorio.ts` (`criarVarios`/`atualizarVarios` com chunk + retry) aguenta importação de 500–1000+ itens.
6. **RLS + RPCs do portal** — `eh_equipe()`/`cliente_do_usuario()` + funções `portal_*` que devolvem só campos seguros ao cliente. Boa base — precisa fechar o default.
7. **Esteira com trava de qualidade (A10)** — só aprova anúncio sem pendências; `vereditoA10` já gate o status.

## 3. O que precisa ser corrigido imediatamente (top 10 — detalhe em [04](./04-PROBLEMAS-E-RISCOS.md))

| # | Item | Gravidade |
|---|------|-----------|
| 1 | Default "sem perfil = equipe" dá acesso total a qualquer autenticado sem `perfis` | **Crítico** |
| 2 | Publicação no ML sem fila e sem idempotência (risco de duplicar anúncio) | **Crítico** |
| 3 | `refresh_token` do cliente trafega pelo navegador da equipe no publish | **Alto** |
| 4 | Sem registro de custo/tokens/modelo por execução de IA (custo cego) | **Alto** |
| 5 | Sem auditoria de alteração (anterior→novo, autor, agente, desfazer) | **Alto** |
| 6 | Proteção de rota é client-side (defesa real só no RLS) | **Alto** |
| 7 | Publicação "User Products" (calçado MLB273770) não ligada ao fluxo — o `mlPayload` monta o modelo clássico | **Alto** |
| 8 | Sem fallback entre provedores de IA; `maxOutputTokens` Gemini limitado a 8192 pode truncar JSON | **Médio** |
| 9 | Sem contrato `MarketplaceAdapter` (regras ML espalhadas, difícil plugar canais) | **Médio** |
| 10 | `credenciais.md` (segredos em texto) versionado no working tree do repo | **Médio** |

## 4. Arquitetura recomendada (resumo — detalhe em [06](./06-ARQUITETURA-RECOMENDADA.md))

Manter a arquitetura de camadas atual (telas → serviços → repositório → Supabase) e **adicionar três coisas** sem reescrever:

1. **Fila unificada de tarefas** (otimizar **e** publicar **e** sincronizar), reusando o padrão do worker atual, com `dead-letter` e chave de idempotência.
2. **Contrato `MarketplaceAdapter`** (`publicar/atualizar/pausar/importar/webhooks`), com `MercadoLivreAdapter` como primeira implementação — isolando as regras do ML.
3. **Observabilidade/ledger**: tabelas `ai_execucoes` (modelo, tokens, custo) e `auditoria_log` (anterior→novo, autor, agente) + fechamento do RLS multiempresa.

## 5. Próximas cinco tarefas (na ordem)

1. **Fechar o isolamento multiempresa** — trocar o default `eh_equipe()` de "true" para "false" (sem perfil = sem acesso) e criar `perfis` no cadastro de todo usuário; revisar RLS das tabelas base. *(Segurança — bloqueia receber o 2º cliente.)*
2. **Enfileirar a publicação no ML** — mover `publicarNoML` para uma fila+worker (reusar `fila_otimizacao_produto` como molde) com idempotência por `(cliente_id, produto_id, marketplace)`. *(Escala + evita duplicar anúncio.)*
3. **Ledger de IA + auditoria de alteração** — `ai_execucoes` (grava modelo/tokens/custo no `chamarIAEstruturada`) e `auditoria_log` (anterior→novo em toda escrita de anúncio). *(Custo e confiança.)*
4. **Ligar o modo "User Products"** no publish por categoria (o builder `mlUserProducts.ts` já existe) e testar 1 item real de calçado. *(Desbloqueia publicar de verdade na conta atual.)*
5. **Extrair o contrato `MarketplaceAdapter`** com o ML como primeira implementação, sem mexer no comportamento atual. *(Prepara Shopee/TikTok.)*

## 6. Estimativa de impacto

| Tarefa | Impacto |
|--------|---------|
| 1. Fechar isolamento multiempresa | **Crítico** (segurança/legal — vazamento entre empresas) |
| 2. Enfileirar publicação ML | **Alto** (escala + integridade — evita anúncio duplicado) |
| 3. Ledger de IA + auditoria | **Alto** (custo previsível + confiança do cliente) |
| 4. Ligar User Products | **Alto** (destrava a publicação real na conta atual) |
| 5. Contrato MarketplaceAdapter | **Médio** (habilita novos canais; sem urgência imediata) |

## 7. Arquivos criados nesta auditoria

`docs/zion-os-audit/`: `README.md`, `01-RESUMO-EXECUTIVO.md`, `02-ARQUITETURA-ATUAL.md`, `03-FLUXO-ATUAL.md`, `04-PROBLEMAS-E-RISCOS.md`, `05-MODELO-DE-DADOS-SUGERIDO.md`, `06-ARQUITETURA-RECOMENDADA.md`, `07-WIREFRAMES-TEXTUAIS.md`, `08-PLANO-DE-EVOLUCAO.md`, `09-BACKLOG-PRIORIZADO.md`, `10-PERGUNTAS-E-DECISOES.md`.
