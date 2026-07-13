# 09 — Backlog Priorizado

Classificação: **Manter · Melhorar · Refatorar · Substituir · Criar · Remover futuramente · Investigar**. Prioridade: Crítica · Alta · Média · Baixa. Referências Rx → [04](./04-PROBLEMAS-E-RISCOS.md).

## Tabela por área

| Área | Situação atual | Classificação | Problema | Recomendação | Prioridade |
|------|----------------|---------------|----------|--------------|------------|
| Isolamento multiempresa (RLS) | Implementado, com fail-safe perigoso | **Melhorar** | "Sem perfil = equipe" dá acesso total (R1) | Negar por padrão; `perfis` p/ todo usuário | **Crítica** |
| Publicação ML | Síncrona, 1‑a‑1, no browser | **Refatorar** | Sem fila nem idempotência; risco duplicar (R2) | Enfileirar + idempotência | **Crítica** |
| Token do cliente no publish | refresh_token no corpo do POST | **Refatorar** | Segredo trafega pelo browser (R3) | Manter server-side por clienteId | **Alta** |
| Custo/uso de IA | Não registrado | **Criar** | Custo cego, sem billing por uso (R4) | Tabela `ai_execucoes` | **Alta** |
| Auditoria de alteração | Inexistente | **Criar** | Sem anterior→novo/desfazer (R5) | `auditoria_log` + `listing_versions` | **Alta** |
| Autorização de rota | Client-side (AuthGate) | **Melhorar** | Defesa real só no RLS (R6) | Revalidar papel no servidor | **Alta** |
| Publicação User Products | Builder existe, não ligado | **Melhorar** | ML rejeita clássico em calçado (R7) | Ligar por categoria + testar item real | **Alta** |
| Gateway de IA | Gemini/Claude por env | **Manter** + Melhorar | Sem fallback; teto 8192 tokens Gemini (R8) | Fallback + rever limite | Média |
| Adaptadores de marketplace | Só ML, sem contrato | **Refatorar** | Regras espalhadas (R9) | Contrato `MarketplaceAdapter` | Média |
| Segredos no repo | `credenciais.md` versionado | **Remover futuramente** | Segredo em texto (R10) | Mover p/ cofre + rotacionar | Média |
| Normalização de tamanhos | Cru do ML | **Criar** | Bloqueia SIZE_GRID/conciliação (R11) | Normalizador de grade BR | Média |
| Atualização de tela | Polling (notificarMudanca) | **Melhorar** | Worker não reflete sem refresh (R12) | Realtime nas tabelas do portal | Média |
| Duas filas parecidas | `fila_otimizacao` × `_produto` | **Refatorar** | Confusão de manutenção (R13) | Unificar em `tarefas_processamento` | Baixa |
| Testes automatizados | Inexistentes | **Criar** | Regressão silenciosa (R14) | Unit nos módulos puros | Baixa |
| Catálogo de agentes A0–A12 | Fonte única, prompts reais | **Manter** | — | Só versionar prompts | Baixa |
| Repositório genérico + lote | Chunk/retry robusto | **Manter** | — | — | Baixa |
| Separação catálogo × anúncio | Modelo correto | **Manter** | — | — | Baixa |
| Auditoria em massa (score/ABC) | Implementada | **Manter** + Melhorar | Base ótima p/ central de otimização | Ligar à tela de Aprovações | Média |
| Esteira (worker + Cron) | Retry, stale, rate-limit | **Manter** + Melhorar | Concorrência=1 (throughput) | Tornar dispatcher por tipo | Média |
| Aprovação (status) | Existe, sem diff/lote | **Melhorar** | Sem diff campo-a-campo (3.8) | Entidade `aprovacoes` + tela | **Alta** |
| Cota de IA | `limite_esteira_mes` (execuções) | **Melhorar** | Conta execuções, não custo real | Evoluir p/ uso por token/plano | Média |
| Webhooks do ML | Inexistentes | **Criar** | Sem reagir a status/pergunta/venda | `webhook_events` + rota | Média |
| Toolkit Python (paralelo) | Scripts foto/preço via Excel | **Investigar** | Duplica lógica do SaaS (capa, preço) | Decidir: absorver no SaaS ou aposentar | Baixa |

## Top 10 do backlog (ordem de execução)

1. **Fechar RLS multiempresa** (R1) — Crítica.
2. **Enfileirar publicação + idempotência** (R2) — Crítica.
3. **refresh_token server-side** (R3) — Alta.
4. **Ligar User Products por categoria** (R7) — Alta (destrava publicar real).
5. **`ai_execucoes` (ledger de IA)** (R4) — Alta.
6. **`auditoria_log` + versões** (R5) — Alta.
7. **Revalidar autorização no servidor** (R6) — Alta.
8. **Central de Aprovações (diff + lote)** (3.8) — Alta.
9. **Contrato `MarketplaceAdapter`** (R9) — Média.
10. **Normalizar tamanhos** (R11) — Média.

## Itens de higiene rápida (baixo custo, faça em paralelo)
- Mover `credenciais.md` para fora do repo (R10).
- Testes unit em `mlPayload`, `paraSchemaGemini`, mappers (R14).
- Documentar a diferença das duas filas até unificar (R13).
- Fallback de IA + revisar teto de tokens (R8).
