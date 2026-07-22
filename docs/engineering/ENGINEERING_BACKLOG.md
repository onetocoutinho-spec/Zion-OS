# ENGINEERING BACKLOG — Zion OS

> Derivado integralmente do [PROJECT_AUDIT.md](PROJECT_AUDIT.md) (2026-07-22). Organização:
> **EPIC → Feature → Task → Checklist**, em ordem de prioridade real (risco × valor).
> Princípios: simplicidade, baixo acoplamento, alta coesão, evolução incremental, domínio bem
> definido. **Nenhum módulo novo é proposto** — tudo evolui sobre o que existe.

Prioridades: **P0** = antes de qualquer feature nova · **P1** = próximo ciclo · **P2** = programado.

---

## EPIC E1 — Fundação de Engenharia `P0`
*Sem isto, todo o resto corre sem proteção. Custo mínimo, cobertura máxima.*

### Feature E1.1 — Gate de qualidade automático `✅ PR-001`
- **Task E1.1.1 — Script de teste oficial** ✅
  - [x] `"test": "tsx --test \"src/**/*.test.ts\""` e `"typecheck": "tsc --noEmit"` no package.json
  - [x] `tsx` como devDependency
  - [x] README de engenharia (`docs/engineering/README.md`)
- **Task E1.1.2 — CI mínimo (GitHub Actions)** ✅
  - [x] `.github/workflows/ci.yml`: `npm ci` → `typecheck` → `test` em PR e push no master (Node 22 LTS)
  - [ ] Badge/status obrigatório antes de merge (proteção de branch — decisão do mantenedor)
- **Task E1.1.3 — Higiene do repositório** ✅ *(revisada na implementação)*
  - [x] `/.obsidian/` (estado do app na raiz) no `.gitignore` + removido do index (arquivos locais preservados)
  - [x] ~~Remover `modules/operation-center`~~ **REVISADO: mantido como RESERVA ARQUITETURAL** —
        possui intenção documentada (Signal/Decision/Mission/Action/Result) alinhada a
        Capabilities/Workspace Intelligence. Decisão do programa: manter, não implementar ainda,
        não remover. (Aplicação da regra de remoção — as 5 perguntas.)
- **Task E1.1.4 — Lint no gate** `✅ PR-005 (2026-07-22)`
  - [x] Erros zerados — **evidência derrubou a suposição**: os 9 erros nunca estiveram no
        código do app; eram vazamento de escopo do linter para `.obsidian/plugins/*` (plugin
        minificado) e `platform/`. Correção = `globalIgnores` (2 linhas), não 9 edições
  - [x] `lint` promovido ao CI como passo obrigatório (warnings tolerados; 109 continuam
        como aviso — limpeza oportunista)
  - **EPIC E1 COMPLETO** (resta só o clique de *branch protection* no GitHub — ação do mantenedor)

### Feature E1.2 — Rastreabilidade operacional de migrações `✅ PR-003 (2026-07-22)`
- **Task E1.2.1 — Migration Ledger (a memória operacional do banco)** ✅
  - [x] Tabela `migracoes_aplicadas` (migração 024) + baseline **por evidência** — aplicada e validada em produção (zero drift; [relatório](executions/2026-07-22-pr003-ledger-report.md))
  - [x] Convenção permanente: toda migração ≥024 termina com o próprio INSERT; migrações anteriores são documentos históricos (intocadas)
  - [x] Diagnóstico v2 = **detector permanente de drift** (ledger × objetos) + sentinela de regressão da 016
  - [x] Checklist de release coberto: "migrações pendentes" agora é uma consulta (`5-ledger`)
- **Pendências conhecidas registradas no ledger:** 017–021 (017/018/019 → quando as features ativarem; 020/021 → decisão na colheita E5.1)

---

## EPIC E2 — Segurança Multi-tenant `P0` `✅ CONCLUÍDA — PR-002 (2026-07-22)`
*Risco nº 1 da auditoria eliminado: deny-by-default ATIVO em produção. Operação com os 3
artefatos: plano (PR-002) · [snapshot](executions/2026-07-22-pr002-security-snapshot.md) ·
[relatório](executions/2026-07-22-pr002-security-report.md).*

### Feature E2.1 — Aplicação completa da migração 016 ✅
- **Task E2.1.1 — Pré-condições** ✅
  - [x] Diagnóstico read-only (`diagnostico-migracoes-producao.sql`, novo no PR-002) — 1 órfão encontrado
  - [x] Backfill do perfil de equipe faltante (template oficial, papel confirmado)
- **Task E2.1.2 — Aplicar e validar** ✅
  - [x] 016 completa aplicada (verificação embutida: ✓ deny-by-default ✓ ativo)
  - [x] Validação em produção: 2 contas equipe + 1 cliente — todas com o painel esperado
  - [ ] Smoke com 2ª empresa (fica pendente até existir um 2º cliente real — sem bloqueio)
- **Achado registrado:** migrações **017–021 nunca aplicadas** em produção — 020/021 são da
  fundação morta (decisão → E5.1); 017/018/019 aplicar quando as features ativarem (→ E1.2).

---

## EPIC E3 — Publicação ML Robusta `P1`
*O caminho do dinheiro. Pré-requisito para publicar em massa sem duplicar anúncios reais.*

### Feature E3.1 — Idempotência do publish User Products
- **Task E3.1.1 — Publicação por família idempotente**
  - [ ] Retry após falha parcial não duplica itens (marcar progresso por tamanho/publishId)
  - [ ] Persistir TODOS os MLBs da família (hoje só o 1º) — vínculo SKU↔MLB por tamanho
- **Task E3.1.2 — Reuso de guia de tamanhos** ✅ *(invalidada por evidência — PR-006)*
  - [x] Já implementado no código: `criarGuiaTamanhos` busca guia ZION equivalente
    via `POST /catalog/charts/search` paginado antes de criar (`buscarGuiaZion`)
  - [x] Nome comparado por `normalizarNomeGuia` (normalização só para comparação) +
    filtro anti-legado — determinismo documentado no próprio arquivo
- **Task E3.1.3 — Diagnóstico de erros do ML** ✅ *(PR-006)*
  - [x] `extrairErro` lê `cause[]` E `errors[]` (aninhados) — exportada e testada;
    motivo real agora persiste no domínio (`observacoes` do anúncio)

### Feature E3.2 — Normalização de tamanhos das variações
- **Task E3.2.1 — Saneamento dos dados importados**
  - [ ] Job/ação que aplica `normalizarTamanho` ao acervo importado ("38 BR", "33 - 34", faixas)
  - [ ] Relatório de irreconciliáveis para revisão humana (nunca chutar — regra do domínio)

---

## EPIC E4 — AIL: da detecção à sugestão `P1`
*A AIL está a uma release de devolver valor visível. Arquitetura congelada — implementar, não redesenhar.*

### Feature E4.1 — Superfície oficial da projeção (pré-R-SE-1)
- **Task E4.1.1 — Invocação controlada de `projetarPadroes()`**
  - [ ] Decidir a forma (rota autenticada da equipe OU integração ao worker/cron existente — reusar o padrão `fila_otimizacao`)
  - [ ] Substituir definitivamente o fluxo de script temporário
- **Task E4.1.2 — Métricas do Journal (RFC-AIL-001 §9)**
  - [ ] Materializar as contagens definidas (decisões por contexto/empresa, campos mais corrigidos) como consultas/projeção — sem dashboard

### Feature E4.2 — R-SE-1 · Suggestion Engine (pull, opt-in)
- **Task E4.2.1 — Planejamento sob o Freeze** (RFC-AIL-005 §6 já especifica)
  - [ ] Plano de release no padrão consolidado (etapas pequenas, validação entre elas)
  - [ ] Primeiro consumidor: 1 contexto, 1 campo (slot consistente → oferta editável + explicação)
- **Task E4.2.2 — Novos Producers (cobertura R-DJ-4)** `✅ PR-004 (2026-07-22)`
  - [x] **5 Signal Sources ativas** (era 1): + categoria, preço, medida (agregado Produto) e tipoAnuncio (Marketplace) — via `capturarDecisao()` com delta real e captura significativa
  - [x] Mapa vivo: [AIL_SIGNAL_MAP.md](AIL_SIGNAL_MAP.md) · Natural Aggregates oficiais (Produto, Marketplace, Pendências; Curadoria identificado)
  - [ ] Onda P2: `tabelasMedidasCliente` (curadoria) e `produtoAtributos`; rejeição quando a UI coletar motivo real

---

## EPIC E5 — Saneamento Estrutural `P2`
*Reduzir massa morta e god-files sem reescrever nada.*

### Feature E5.1 — Colheita e arquivamento da fundação DDD morta
- **Task E5.1.1 — Colheita deliberada** (decisão por evidência, item a item)
  - [ ] Avaliar resgate: validadores de intake, conector Magazord (se roadmap), value objects
  - [ ] Registrar decisão (1 ADR curto: o que foi resgatado, o que foi arquivado, por quê)
- **Task E5.1.2 — Arquivamento**
  - [ ] Mover `src/domain|application|infrastructure` para `archive/` (ou branch dedicada) — `git mv`, reversível
  - [ ] Suíte e typecheck verdes após (esperado: queda de ~½ dos testes, todos os vivos mantidos)

### Feature E5.2 — Fronteiras nos god-files (incremental, sem big-bang)
- **Task E5.2.1 —** Novos mappers/Rows nascem por módulo (padrão AIL já provou); os centrais existentes **não migram** até haver motivo
- **Task E5.2.2 —** `mercadolivre.ts`: extrair guia-de-tamanhos para `modules/integration` quando a E3.1.2 tocar o arquivo (oportunista, nunca gratuito)

### Feature E5.3 — Consolidação documental
- **Task E5.3.1 — PR-DOC-002**: versionar o corpus de descoberta (Cap. 01/02, Épicos, diagnósticos) referenciado pelas RFCs
- **Task E5.3.2 —** Índice raiz de `docs/` apontando o que é vigente vs histórico

---

## EPIC E6 — Self-service: cadastro generalizado por nicho `P2`
*O pivot do produto (cliente opera sozinho). Bloco já pedido; fundação pronta no portal.*

### Feature E6.1 — Atributos/checklist por categoria
- **Task E6.1.1 —** Modelar "perfil de nicho" sobre as estruturas existentes (categoria templates + atributos) — sem módulo novo
- **Task E6.1.2 —** Formulário de cadastro dirigido por nicho no portal (`/cliente/produtos`)
- **Task E6.1.3 —** Esteira consome o perfil (checklist por categoria) sem alterar regras-mãe

---

## Fora do backlog (deliberado)
- **Reescritas** de qualquer camada — vetadas pela regra de evolução incremental.
- **Remover o dual-mode demo** — sustenta os 294 testes; reavaliar apenas quando testes tiverem alternativa.
- **Docker/K8s** — Vercel+Supabase atendem; complexidade sem demanda.
- **Novos módulos/domínios** — só quando uma feature os exigir (método do programa de refatoração).

## Sequência recomendada
```
E1 (fundação) ─┬─► E2 (segurança) ─► E3 (publicação robusta) ─► E4 (AIL sugere)
               └─────────────► E5/E6 em paralelo conforme capacidade
```
Racional: E1 protege tudo que vier depois; E2 remove o risco nº 1; E3 destrava operação em
massa com segurança; E4 entrega o diferencial (aprendizado visível); E5/E6 são melhoria
contínua e produto.
