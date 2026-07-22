# Evolution Report — PR-010 · Delegation Discovery

> Capítulo III — Decision Intelligence · descoberta pura (zero código alterado)
> Pergunta do ciclo: **como uma organização delega decisões mantendo governança?**

## Decision Inventory (oficial)

| Decisão | Quem decide hoje | Risco | Feedback |
|---|---|---|---|
| Categoria do anúncio | humano; **sistema no vazio** (fallback da rota) | médio | ✅ veto ML + par prevista→usada |
| Preço de venda | humano | **alto** | ⚠️ vendas medem — e evaporam (S-24) |
| Tipo de anúncio | humano sobre default do sistema ("Premium") | médio | ❌ |
| Medidas / guia | humano (curadoria) | médio | ❌ |
| Conteúdo do anúncio | sistema rascunha (esteira), humano edita | médio | ⚠️ edições pré-aprovação **não capturadas** (RFC-AIL-001 §4.3: "onde está o valor") |
| Aprovar (trava) | humano, após veredito A10 | alto | ✅ |
| Publicar (`go`) | humano | alto | ✅ |
| Reusar vs criar guia | **sistema, sozinho** | baixo | ✅ verificável |
| Rotação de token | **sistema, sozinho** | baixo | ✅ |
| Substituir importados | humano dispara; sistema exclui em massa | **crítico** | ❌ |
| Resolver pendência | humano (cliente) | baixo | ❌ |

## Os 6 níveis de delegação existem no código, dispersos e sem nome

| Nível | Evidência viva |
|---|---|
| 0 — Humano decide | preço, medidas, curadoria |
| 1 — Sistema explica | veto traduzido + motivo no domínio (PR-006) |
| 2 — Sistema sugere | embrião: default "Premium"; forma plena aguarda E4 |
| 3 — Sistema prepara | esteira rascunha o anúncio inteiro; `montarPreviewML` (dry-run) |
| 4 — Humano delega | `go=true` delega a cadeia inteira; trava = **duplo gatilho** (A10 + clique — mesma filosofia do invariante 002 §7) |
| 5 — Sistema executa | guia reuse-or-create, token, categoria no vazio |

## A Lei da Abstenção (política descoberta, não inventada)

> **Toda autonomia atual é autonomia por abstenção**: o sistema decide apenas
> onde o humano deixou vazio (categoria ausente, default não tocado) ou onde a
> regra é externa e verificável (guia, token). **Nenhum ponto do código
> sobrescreve uma escolha humana explícita.**

O que o sistema executa sozinho compartilha 4 propriedades: regra determinística
conhecida · erro barato · resultado imediatamente verificável · nenhuma escolha
humana a sobrescrever. E a trava é **seletiva por evidência**, não ritual: a
importação a pula (`importarAnunciosML` auto-aprova) porque o conteúdo é fato
consumado — já vive no ML.

## Resposta do ciclo — os 5 saberes da delegação

Antes de deixar de decidir manualmente, a organização precisa saber: **o que**
decide (inventário) · **quanto custa errar** (risco) · **como saberá que errou**
(feedback fechado — só a Publicação o tem) · **como desfaz** (duas decisões não
têm volta: publicar, substituir — fronteira dura da delegação) · **quem
autorizou** (duplo gatilho com assinatura — a lacuna S-30).

## Reflection (registro)

Autonomia nasce da confiança **ou** confiança da autonomia? **Os dois sentidos,
por tipo de decisão:** para decisões de **regra**, a autonomia veio primeiro e a
confiança nasceu dela operando sob feedback fechado (`criarGuiaTamanhos` — o erro
`chart_name_unavailable` sumiu). Para decisões de **julgamento**, a confiança
precede por invariante congelado (Automatizável = Validado + permissão, 002 §7)
— e o domínio concorda por prática própria: a trava existe exatamente onde
julgamento e risco se encontram.
