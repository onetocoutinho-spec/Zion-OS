# Auditoria de Produto e UX — Agência × Loja

Data: 2026-08-21 · Commit analisado: `36e1828` · Método: skill `zion-product-ui-ux` (DISCOVER → UNDERSTAND → MAP → AUDIT → DESIGN → PROPOSE).

Princípio que governa a série: **o Zion OS deve ter experiências diferentes, não apenas permissões diferentes.** A experiência é escolhida pelo **contexto** (portfólio × dentro de uma loja), nunca pelo `papel` sozinho.

| # | Documento | Responde |
|---|---|---|
| 01 | [CURRENT EXPERIENCE](01-CURRENT-EXPERIENCE.md) | Como o sistema funciona hoje — stack, modelo, as dez perguntas com arquivo:linha, inventário, fluxos reais |
| 02 | [PROBLEMS](02-PROBLEMS.md) | 37 achados priorizados por impacto ÷ esforço; scorecard 2.3/5; riscos abertos |
| 03 | [RECOMMENDED EXPERIENCE](03-RECOMMENDED-EXPERIENCE.md) | Modelo atual × recomendado (sem mudança de schema), as duas experiências, contexto global, roles, IA |
| 04 | [INFORMATION ARCHITECTURE](04-INFORMATION-ARCHITECTURE.md) | Navegação Agency e Store, mapa de rotas com redirects, padrão de URL, glossário |
| 05 | [USER FLOWS](05-USER-FLOWS.md) | Fluxos principais antes × depois, onboarding, bordas |
| 06 | [SCREEN HIERARCHY](06-SCREEN-HIERARCHY.md) | Prioridade e anatomia de cada tela |
| 07 | [COMPONENT IMPACT](07-COMPONENT-IMPACT.md) | Componentes novos/estendidos/consolidados/removidos, tokens, plano em 8 fatias, riscos |

## Veredito em três linhas

- O **modelo de dados está certo** (loja = `clientes`, agência = `agencias`, vínculo = `agencia_id`); o problema é de **contexto e apresentação**. Nenhuma migração de tabela é proposta.
- O **lojista** já tem uma experiência própria e madura (5 áreas por pergunta, home orientada a ação, IA contextual). A **agência** usa o painel da Zion com menu filtrado, sem contexto de loja, sem home e sem entrar na loja.
- Primeira fatia: **contexto global de loja** — elimina ~7 seleções por fluxo e o F5 que troca de loja em silêncio; é a fundação das outras sete.

## Relação com a constituição de produto

- UX-010 define a **Lente** como o mecanismo de troca de contexto; o Store switcher proposto é a Lente materializada no app de produção (`AppShell`), sem adotar o Shell de `/z`.
- VOC-001 C3: esta série propõe a emenda **Loja ≠ Cliente** na interface (Cliente = quem contrata a Zion, só em telas da equipe).
- `docs/agency-panel-separation/` fez a separação *cirúrgica* de layouts; esta série faz a separação de *experiências*. Três dos oito documentos daquela pasta estão desatualizados (ver 01, pergunta 9 e relatório de auth).

## Estado em 2026-08-22 — as 8 fatias entregues (branch `ux/agency-store-experience`)

| Fatia | Commit | Entregue | Pendente |
|---|---|---|---|
| 1 Contexto global de loja | `da3155c` | provider + resolver (URL > ?loja= > cookie > perfil), 11 telas migradas, 15 testes | — |
| 2 Switcher + indicadores | `b2232ab` | Dialog, SeletorDeLoja (Ctrl+K), trilha no header, esqueleto da sidebar, saúde derivada | foco de volta ao gatilho só quando aberto por teclado/clique real |
| 3 Navegação + guard | `e9b96ce` | grupos por pergunta, `rotaPermitida` = menu, 403 explicativo, rótulos do glossário | renomes físicos de rota (ver fatia 8) |
| 4 Agency overview | `0c2ccc3` | `/` com KPIs clicáveis, "Precisa de atenção" com ação exata, tabela de lojas, 3 estados | KPI de vendas com delta (depende de resumo agregado no banco) |
| 5 Operar a loja | `8397197` | agência/equipe entram em `/cliente/*` com a loja do contexto; barra "Operando"; seletor na sidebar | migração 064 **aplicada em 2026-08-22** no projeto Supabase principal (ledger 064; varredura `alcance-da-agencia.sql` = 0 linhas) |
| 6 Onboarding de agência | `aa3f382` | Zion › Agências (criar, vincular lojas), Zion › Usuários, papel `agencia` criável pela UI | e-mail na lista de usuários (exige rota admin) |
| 7 Design system | `4b84562` | tokens `surface-*` (46 arquivos), Badge⊃Pill, EmptyState⊃VazioAmigavel; ModalPublicar e MissaoRepublicacao sobre `Dialog` | `PainelDoAssistente` (é painel lateral, não modal — avaliar); `text-[11px]` → `text-xs`; tabelas cruas |
| 8 Vocabulário + rotas | `b2afaf6` | área "Loja" no portal, colunas Loja/Situação/Nota, redirects canônicos (`/lojas`, `/anuncios`, `/auditoria`, `/loja/*`) | mover as rotas físicas (bloqueado pelo `redirect_uri` do ML em `/cliente/conectar-ml`) |

Verificado no navegador a cada fatia (seeds locais, sem Supabase): seletor, trilha, 403, home, modo operando, redirects, 375px sem scroll horizontal e sem alvo < 44px na home.

Os documentos são vivos: atualize-os a cada fatia entregue.
