# Evolution Report — E5.0 · Offer Observation

> EPIC E7 — Decision Intelligence Runtime (roadmap 2026-07-22; namespace E5.x
> do roadmap ≠ EPIC E5-Saneamento do backlog). Primeiro item do Runtime.
> Pergunta: **o que aconteceu depois que uma Offer foi criada?**

## O que foi construído

`application/offer-observation.ts` — leitura pura sobre `ofertas × decisoes`:

- **`observarOferta(oferta, decisoes)`** (pura): correspondência por slot +
  entidade (quando a oferta tem; em criação, por slot — limite declarado);
  resposta = a **primeira** Decision posterior (ordem por timestamp, desempate
  lexicográfico — o mesmo do Detector); comparação pelo **valor canônico**;
  `tempoAteRespostaMs` já derivado (insumo direto da E5.2).
- **`observarOfertas(empresa?)`**: cruzamento em memória dos dois logs,
  recentes primeiro. Zero escrita, zero recomputação, zero estado novo.

## As classes de evidência (o que os fatos permitem distinguir)

| Classe | Leitura operacional | Rótulo da missão |
|---|---|---|
| `respondida_igual` | Decision posterior com o valor oferecido | **aceita** |
| `respondida_diferente` | Decision posterior com outro valor | **editada/contradita** — indistinguíveis sem fato de aplicação (declarado) |
| `sem_resposta` | nenhuma Decision posterior | **ignorada ATÉ AGORA** — sem janela temporal (janela = heurística; recência segue deferida, RFC-AIL-004 §6.4). A observação nunca "fecha" uma oferta |

## Limites declarados — evidências do sistema sobre si mesmo

1. **`criarProduto` não captura** → aceitação em criação é invisível ao Journal.
2. **"Remover sugestão" não registra fato** → `rejeitada` é **indetectável** hoje.
3. Correspondência é por slot(+entidade), não causalidade provada.

Não são defeitos silenciosos: são os **insumos do design da E5.1** — e a prova
viva do princípio do roadmap ("toda evolução deve ser consequência das
evidências produzidas pelo próprio sistema"). Se a E5.1 precisar distinguir
editada de contradita ou detectar rejeição, o caminho é **registrar novos fatos
na fonte** (aplicação/remoção da oferta), nunca inventar heurísticas aqui.

## Verificação

359/359 testes (10 novos: 3 classes, canonicidade, entidade, criação,
primeira-resposta determinística, slots alheios, cruzamento por empresa,
autoria anônima) · typecheck 0 · lint 0. Nenhum módulo existente alterado.

## Evolution Report

**O que aprendemos:** que observar é mais honesto do que classificar — os fatos
atuais sustentam três distinções, não quatro, e a diferença entre "o que a
missão pediu" e "o que a evidência permite" virou o backlog natural do próximo
item. E que o desenho da Oferta (E4.2) pagou imediatamente: slot + entidade +
instante bastaram para o cruzamento, exatamente como a ADR-001 previu.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Os fatos sustentam 3 classes, não 4 | remoção sem fato; criação sem captura | requisitos da E5.1 nascem de evidência |
| "Ignorada" é sempre "ainda não" | sem janela — recência deferida | a E5.1 herda a mesma honestidade |
| A identidade da Oferta é suficiente | cruzamento só com slot+entidade+instante | valida o Outcome Readiness do E4.2 |
