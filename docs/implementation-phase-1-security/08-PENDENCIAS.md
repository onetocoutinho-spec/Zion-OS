# 08 — Pendências / Riscos restantes

O que esta fase **não** resolveu (de propósito, por escopo) e o que fica de atenção.

## Fora de escopo (não implementado nesta tarefa)
Conforme a instrução da tarefa, **não** foram feitos:
- Fila de publicação e idempotência de publicação (R2).
- Modo "User Products" no publish (R7).
- Novos marketplaces / contrato `MarketplaceAdapter` (R9).
- Central de aprovações, mudanças de layout.
- Ledger de custo de IA (R4).
- Sistema de cobrança / self-signup público.
- Refatoração ampla.

## Riscos restantes / atenção
1. **Backfill de perfis é pré-condição operacional.** A migração 016 só é segura depois que **todos** os usuários de equipe têm perfil. Isso é responsabilidade da aplicação controlada (check + template). Enquanto não for feito, **não aplicar** a 016 em produção.
2. **Autorização server-side é parcial.** Foi aplicada nas rotas sensíveis (ML + IA). As leituras/escritas de domínio feitas direto do navegador (produtos, anúncios, etc.) continuam protegidas **só pelo RLS** — que é a via principal, mas idealmente ganharia guardas server-side no futuro.
3. **`organization_membership` não foi criado.** `perfis` segue 1 usuário → 1 papel → 1 cliente. Multiusuário por empresa e papéis finos ficam para a fase de fundação (ver `docs/zion-os-audit/05`).
4. **Modo demo é fail-open.** Sem Supabase configurado, as guardas liberam (não há login no demo). Correto para desenvolvimento; produção sempre roda com Supabase.
5. **Sessão do browser × servidor.** A autorização usa o `access_token` que o browser envia. Um token expirado faz a rota responder 401; o supabase-js renova a sessão no cliente automaticamente, mas vale validar em staging chamadas logo após expiração.
6. **`credenciais.md`** (segredos em texto no repo) segue como pendência de higiene (R10) — não faz parte desta fase.
7. **Testes de integração** das rotas (mock de Supabase/fetch) não existem; só há unit das funções puras. Recomendado ao adotar um framework de testes.

## Próxima etapa recomendada (NÃO iniciar agora)
> **Conectar o fluxo User Products para publicar um único calçado real de forma controlada** (R7), reaproveitando o `mlUserProducts.ts` já existente, escolhendo clássico × User Products por categoria e criando a guia de tamanhos antes de publicar 1 item de teste.
