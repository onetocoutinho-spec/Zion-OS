# Evolution Report — PR-006 · Fechando o Primeiro Learning Loop

> Capítulo II — Learning Platform · branch `eng/pr-006-learning-loop`
> Regra seguida: *"Se surgir evidência que contradiga o plano: pare, atualize o plano."*
> (aplicada 1×: ver §Descoberta que mudou o plano)

## Learning Loops Implementados

| Loop | Ambiente emite | Onde nasce | Onde é traduzido | Onde persiste | Guarda |
|---|---|---|---|---|---|
| **Proposta → Decisão** | `categoriaPrevista` (domain_discovery) | `route.ts` (agora SEMPRE prevê quando há título) | `montarCapturaCategoriaPublicada` (builder puro) | Decision Journal — slot `(emp, catalogo, categoriaMarketplace, ⟨MLB⟩)`, **o mesmo do agregado Produto** | `capturarDecisao`: só com delta real; fire-and-forget — falha da AIL jamais afeta a publicação |
| **Veto → Domínio** | motivo real da rejeição (`cause[]` + `errors[]`) | resposta HTTP do ML | `extrairErro` (exportada, testada) | `observacoes` do anúncio (estrutura existente; apêndice preserva o marcador "Importado do ") | try/catch — persistir o motivo jamais mascara o erro original; **não toca a AIL** (veto não é decisão humana) |

## Descoberta que mudou o plano

O plano assumia que o par `prevista → usada` existia sempre. **Evidência contrariou:**
a rota só chamava `preverCategoria` quando o payload NÃO trazia categoria — ou seja,
exatamente quando o humano escolhe (o caso interessante), a previsão não existia e o
delta jamais ocorreria. Correção: a rota **sempre prevê** quando há
`tituloParaCategoria`; a previsão só PREENCHE o payload quando ele não tem categoria
(comportamento de publicação inalterado — a previsão extra é comparação, não escolha).

## O que aprendemos sobre o ambiente

O Mercado Livre não é um destino passivo. Ele **propõe** (`domain_discovery` devolve
a categoria que ELE acha certa), **veta** (rejeições com motivo estruturado em dois
formatos) e **mede** (vendas/visitas — ainda não integrado). Antes do PR-006, os dois
primeiros feedbacks eram descartados no ponto exato em que nasciam.

## Feedbacks que eram desperdiçados (antes → agora)

| Feedback | Antes | Agora |
|---|---|---|
| Categoria prevista pelo ML | usada só como fallback e descartada | devolvida na resposta e comparada à escolha; delta vira Decision |
| Motivo real da rejeição | `errors[]` ignorado; UI mostrava string genérica; nada persistia | `extrairErro` lê os dois formatos; motivo persiste nas `observacoes` do anúncio |

## Loops ainda incompletos (registrados, não implementados)

- **Medição**: vendas/visitas do item publicado → nenhuma leitura hoje (S-13).
- **Família User Products**: só o 1º MLB persiste → o vínculo SKU↔MLB por tamanho
  segue em aberto (E3.1.1) — limita loops futuros por variação.
- **Estado `rejeitado` explícito**: o veredito persiste em texto; um status
  filtrável é semente (S-14), não necessidade atual.

## Organizational Knowledge Added

| Feedback preservado | Origem | Valor | Domínio |
|---|---|---|---|
| Categoria prevista → utilizada (delta) | ML `domain_discovery` via `api/ml/publicar` | padrão de divergência entre taxonomia do ambiente e a da equipe — converge com correções de cadastro no mesmo slot | Decision Journal (AIL) |
| Motivo real da rejeição | resposta de erro do ML (`cause[]`/`errors[]`) | o anúncio carrega POR QUE falhou — a equipe corrige sem adivinhar | `anuncios_gerados.observacoes` |

## Seeds registradas

S-13 (Knowledge Source — hipótese, ADR futura) · S-14 (Publish Status como ciclo de
vida) · S-15 (External Rules em código). Detalhes em `SEEDS.md`.

## Backlog — limpeza por evidência

- E3.1.2 (reuso de guia): **já estava implementado** (`buscarGuiaZion` paginado +
  `normalizarNomeGuia` + filtro anti-legado) — invalidada.
- E3.1.3 (`extrairErro` + `errors[]`): **concluída neste PR**.
- Permanecem reais: E3.1.1 (família MLBs + retry idempotente) e E3.2.1
  (normalização de tamanhos do acervo).

## Verificação

318/318 testes · typecheck 0 · lint 0. Novos testes: `mercadolivre.test.ts` (4 —
ambos formatos + fallback HTTP) e `publicacaoML.test.ts` (4 — builder, null-usada,
**delta guard** via journal em memória, apêndice preserva marcador de importação).
Rollback: reverter os 4 commits — nenhuma migração, nenhum contrato externo mudou.

---

## Reflexão — o ambiente participa da construção de conhecimento?

**Evidência a favor:** o ML devolve uma *interpretação* (`domain_discovery` mapeia
um título em uma categoria da taxonomia DELE) e um *julgamento* (a rejeição diz qual
regra foi violada, campo a campo). Isso é mais do que dado bruto — é o ambiente
aplicando o próprio modelo de mundo ao nosso conteúdo. O PR-006 mostrou que esses
atos têm forma de conhecimento: a proposta vira `valorAnterior` de uma Decision
legítima (primeira source cujo "anterior" não é um valor humano prévio), e o veto
vira memória do domínio que explica um estado.

**Evidência contra generalizar:** tudo isso vem de UM marketplace, por UMA API, em
DOIS pontos de contato. O ambiente não constrói conhecimento *no nosso sistema* —
ele emite sinais que NÓS estruturamos; sem `extrairErro` e sem o slot canônico, os
mesmos bytes seriam ruído. A assimetria continua: quem decide o que é conhecimento
é a plataforma, não o ambiente.

**Conclusão honesta:** hoje o ambiente é um **participante passivo com opinião** —
fornece dados que já chegam interpretados, mas não participa da construção; participa
do *fornecimento de matéria-prima qualificada*. A hipótese "Knowledge Source como
conceito de primeira classe" fica registrada (S-13) aguardando a evidência que a
promoveria: o mesmo padrão propor/vetar/medir aparecendo em outros ambientes.
