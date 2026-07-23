# Evolution Report — E5.6 · Decision Intelligence Center

> EPIC E7 — Decision Intelligence Runtime · item 7/11.
> **A primeira interface operacional** — o Runtime tornou-se observável sem
> inspeção direta do código.

## O que foi construído

- **Camada de composição** (`intelligence-center.ts`): NÃO é projeção nova — é
  a mesma composição do Analytics (E5.5) exposta pronta para a UI; testado que
  o analytics embutido é **idêntico** ao do E5.5 (nunca recalculado).
- **`/ail/inteligencia`** — Platform Health (fatos, nunca nota; principais
  bloqueios nomeados), métricas com **metodologia no hover** (nenhum indicador
  sem explicação), lista de Patterns: confiança atual → projetada (E5.3, com
  "eco descontado" quando cai), prontidão (E5.4), outcomes (E5.1), disputa.
- **`/ail/inteligencia/[id]`** — a **linha do tempo lógica em 7 etapas**:
  `Journal → Pattern → Confidence → Offers → Observations+Outcomes →
  Confidence Evolution → Promotion Readiness` — cada etapa com sua explicação
  e a projeção de origem; dependências da ADR-002 exibidas na íntegra; link
  para as evidências com autor (Memória).
- Menu: **Decision Intelligence**, ao lado da Memória.

## Contratos cumpridos

Zero métrica nova · zero recálculo (composição pura testada) · zero estado
próprio (useLiveQuery re-executa a projeção quando os fatos mudam — atualizar
fatos → atualiza projeção → atualiza interface) · termos "promovido"/"confiável"
**inexistentes** (testado sobre a serialização) · toda informação com origem
declarada e navegável (Analytics → Pattern → Outcome → Evidence → Decision, sem
perda de contexto — ids testados entre lista e detalhe).

## Verificação

412/412 testes (7 novos: vazio, populado, analytics idêntico ao E5.5,
navegação lista↔detalhe, explicação em toda etapa, termos proibidos,
determinismo visual) · typecheck 0 · lint 0 · rotas compilam sem erro de
servidor. Validação visual autenticada: mantenedor.

## Critério de sucesso

O que a plataforma sabe? ✓ (lista + Memória) · Como aprendeu? ✓ (linha do
tempo) · Quais evidências? ✓ (elo 1 → Journal com autor) · Quais evoluindo?
✓ (atual → projetada) · Quais bloqueados? ✓ (bloqueios nomeados) · O que
impede promoções? ✓ (dependências da ADR-002, na íntegra) — tudo de projeções
existentes.

## Evolution Report

**O que aprendemos:** que a interface de uma arquitetura honesta é quase só
layout — as sete etapas da linha do tempo já existiam como objetos explicáveis;
a tela as enfileirou. E que o Center muda o *destinatário* da transparência:
até aqui as explicações falavam com engenheiros via testes; agora falam com o
mantenedor via tela — mesma informação, novo alcance.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Interface honesta = layout sobre projeções | 7 etapas sem um cálculo novo | UI barata para sempre |
| A metodologia no hover fecha o ciclo da E5.5 | nenhum indicador sem origem | auditabilidade visual |
| A ADR-002 agora é visível na operação | dependências na tela do Pattern | pressão saudável de governança |

## Reflection (registro)

O Runtime ensinou a plataforma a pensar. O Center ensina os mantenedores a
compreender esse pensamento. **A transparência não é um recurso da interface —
é uma propriedade da arquitetura**: esta tela não explica resultados; torna
visível o caminho completo entre um fato registrado e o conhecimento
institucional que dele emergiu.
