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

Os documentos são vivos: atualize-os a cada fatia entregue.
