# 08 — Plano de Evolução (por fases)

> Evolução incremental sobre o que já funciona. Cada fase tem objetivo, mudanças, arquivos afetados, dependências, riscos, critério de conclusão e "o que **não** fazer ainda". Referências de risco (Rx) vêm de [04](./04-PROBLEMAS-E-RISCOS.md).

## Fase 0 — Diagnóstico e estabilização
- **Objetivo**: garantir que o que funciona não quebre e documentar o real. *(Esta auditoria é a Fase 0.)*
- **Mudanças**: documentar fluxo atual; organizar `.env` (conferir sem `<>`/aspas — gotcha conhecido); tirar `credenciais.md` do working tree (R10); identificar partes simuladas (modo demo/localStorage, `anuncioSimulado`).
- **Arquivos**: `docs/zion-os-audit/*`, `.env.example`, `credenciais.md` (remover/mover).
- **Dependências**: nenhuma.
- **Riscos**: baixos (só documentação/higiene).
- **Critério de conclusão**: auditoria aprovada + `credenciais.md` fora do repo + testes mínimos nos módulos puros (`mlPayload`, `paraSchemaGemini`, mappers) começados (R14).
- **Não fazer ainda**: nenhuma mudança de schema.

## Fase 1 — Fundação multiempresa
- **Objetivo**: isolar empresas de verdade antes de receber o 2º cliente.
- **Mudanças**: inverter o default `eh_equipe()` para negar (R1); criar `perfis`/`organization_membership` para **todo** usuário na criação; revalidar autorização **no servidor** nas rotas sensíveis (R6); tirar o `refresh_token` do browser (R3).
- **Arquivos**: `database/migrations/016-*` (novo, aditivo), `src/lib/supabase/*`, `src/app/api/ml/publicar/route.ts`, `src/lib/services/publicacaoML.ts`, `src/components/auth/*`.
- **Dependências**: Fase 0.
- **Riscos**: **médio-alto** — mexer em RLS pode bloquear a equipe atual. Mitigar: rodar em staging, criar `perfis` de toda a equipe **antes** de inverter o default; script de verificação.
- **Critério de conclusão**: um usuário sem `perfis` **não** acessa nada; cliente A não vê dados do cliente B (teste com 2 clientes); `refresh_token` nunca aparece no payload do browser.
- **Não fazer ainda**: multi-usuário por empresa completo (papéis finos) pode vir depois; agora basta 1:1 seguro + a estrutura para N.

## Fase 2 — Escala operacional (filas)
- **Objetivo**: processar 100 → 1.000 → 10.000 itens sem travar a UI nem duplicar anúncio.
- **Mudanças**: generalizar `fila_otimizacao_produto` → `tarefas_processamento` (tipo otimizar/publicar/sincronizar); **enfileirar a publicação** com idempotência por `(cliente, produto, marketplace)` (R2); dead-letter; concorrência por tipo; unificar/documentar as duas filas (R13); refletir status sem refresh (R12).
- **Arquivos**: `database/migrations/017-*`, `src/app/api/otimizar/worker/route.ts` (→ dispatcher), `src/lib/services/publicacaoML.ts`, `filaOtimizacaoProduto.ts`, `vercel.json`.
- **Dependências**: Fase 1 (escopo por empresa) — a fila roda com `service_role`, precisa scoping correto.
- **Riscos**: médio — idempotência mal feita pode pular publicações. Mitigar: chave de idempotência + checagem de `ml_item_id` existente.
- **Critério de conclusão**: publicar 500 itens sem a aba aberta, sem duplicar; item preso volta pra fila; erro vai pra dead-letter e é reprocessável.
- **Não fazer ainda**: infra externa (Redis/SQS) — enquanto couber no worker+Cron, não adicionar.

## Fase 3 — Inteligência artificial (gateway maduro)
- **Objetivo**: custo previsível, confiança e robustez da IA.
- **Mudanças**: `ai_execucoes` (tokens/modelo/custo) gravado em `chamarIAEstruturada` (R4); **fallback** Gemini↔Claude (R8); revisar teto de tokens do Gemini para o anúncio completo; prompts versionados (o catálogo já é fonte única — adicionar versão); `auditoria_log` de alteração por agente (R5).
- **Arquivos**: `src/lib/agentes/provedorIA.ts`, `esteira.ts`, `src/app/api/agentes/*`, `database/migrations/018-*`.
- **Dependências**: Fase 1 (escopo) para atribuir custo por cliente.
- **Riscos**: baixo-médio.
- **Critério de conclusão**: relatório de custo de IA por cliente/mês; queda de um provedor não derruba a esteira; toda alteração registra anterior→novo + agente + confiança.
- **Não fazer ainda**: agentes como microsserviços independentes — manter o pipeline atual (uma passada / multi-agente) que já funciona.

## Fase 4 — Experiência do cliente
- **Objetivo**: o cliente opera sozinho, com confiança.
- **Mudanças**: **central de Aprovações** com diff atual×sugerido, risco, confiança, agente; aprovar/editar/rejeitar, **em lote e por tipo**, automação de alterações seguras, trava para preço/publicação ([07](./07-WIREFRAMES-TEXTUAIS.md), 3.8 do brief); tela de **Publicações**; indicadores e alertas; tratamento visual de erros.
- **Arquivos**: `src/app/cliente/*` (nova rota aprovações/publicações), `src/components/client-portal/*`, `database/migrations/019-*` (`aprovacoes`, `listing_versions`).
- **Dependências**: Fase 3 (auditoria/versões) e Fase 2 (fila de publicação).
- **Riscos**: baixo (UI sobre dados já existentes).
- **Critério de conclusão**: cliente aprova em lote e publica sem ajuda da equipe; preço/publicação sempre pedem confirmação.
- **Não fazer ainda**: onboarding self-service completo/planos pagos — depois da confiança operacional.

## Fase 5 — Novos marketplaces
- **Objetivo**: plugar Shopee/TikTok/Amazon/Magalu sem retrabalho.
- **Mudanças**: extrair o contrato `MarketplaceAdapter` com `MercadoLivreAdapter` primeiro (R9); ligar o modo **User Products** por categoria (R7) dentro do adapter ML; **depois** implementar o próximo canal (sugestão: TikTok, já citado nas configs).
- **Arquivos**: `src/lib/marketplaces/*` (novo `adapter.ts` + `mercadoLivreAdapter.ts`), `src/lib/services/publicacaoML.ts`.
- **Dependências**: Fases 2–4.
- **Riscos**: médio — não regredir o ML ao refatorar. Mitigar: adapter envolve o código atual sem mudar comportamento; testes do `mlPayload`.
- **Critério de conclusão**: publicar calçado real via User Products no ML; um segundo canal publica um item de teste pelo mesmo contrato.
- **Não fazer ainda**: **não** adicionar todos os canais de uma vez; um por vez, com o ML 100% sólido.

## Sequência recomendada (resumo)

```
Fase 0 (agora) ──► Fase 1 (segurança) ──► Fase 2 (fila/escala)
                                              │
                                              ▼
                    Fase 3 (IA/ledger) ──► Fase 4 (experiência) ──► Fase 5 (canais)
```

O **caminho crítico** para "receber clientes maiores com segurança" é **Fase 1 → Fase 2**. O caminho crítico para "publicar de verdade na conta atual" é **R7 (User Products)** — pode ser adiantado dentro da Fase 2/5 se for a prioridade comercial.
