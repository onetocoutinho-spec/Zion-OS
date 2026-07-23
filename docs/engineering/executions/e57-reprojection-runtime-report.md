# Evolution Report — E5.7 · Reprojection Runtime

> EPIC E7 — Decision Intelligence Runtime · item 8/11. Absorve a E4.1.1.
> **O script morreu; o botão audita.**

## O que foi construído

- **`application/reprojection.ts`** — `reprojetar({empresa?})`: executa
  `projetarPadroes()` (a função sancionada da R-PD-1, **intocada**) e devolve
  o `RelatorioReprojecao` completo. A única projeção persistida da AIL é
  `padroes` — todas as demais (Outcomes, Evolution, Readiness, Analytics) são
  recomputadas a cada leitura por construção e não precisam de runtime.
- **Comparação antes × depois**: novos / alterados / inalterados, diff por
  Pattern (ocorrências, confidence, slot).
- **Órfãos**: linhas existentes que a computação atual não produz (ex.:
  canonicalização antiga) são **listadas e jamais apagadas** — remoção de
  projeção é decisão de governança, nunca efeito colateral de reprojeção.
- **Idempotência verificada NA EXECUÇÃO**: o núcleo puro é computado **duas
  vezes** sobre os mesmos fatos e comparado — a confluência (004 §7.3) é
  provada a cada uso, não só em teste. Divergência apareceria como
  `DIVERGENTE` no relatório (vermelho na tela).
- **Reprojeção parcial por empresa — segura por construção**: a Pattern Key
  contém a empresa (003 §3.2); slots jamais cruzam tenants, logo o subconjunto
  de decisões de uma empresa determina exatamente os seus Patterns.
- **Botão no DI Center** (`ReprojecaoPadroes`), presente inclusive no estado
  vazio — a primeira projeção de um ambiente novo nasce da tela, sem script.
  Gatilho **sempre humano** (R-PD-1: sob demanda; sem cron, sem automatismo).

## O que foi aposentado

`scripts/validar-r-pd-1.ts` (untracked, com credenciais no shell) perde a
razão de existir: a superfície oficial roda no navegador sob a sessão
autenticada do mantenedor — mesma via RLS de toda a AIL, zero credencial em
shell.

## Verificação

419/419 testes (7 novos: primeira reprojeção, idempotência real na 2ª rodada,
alterado com suporte crescendo até `consistente`, parcial por empresa, órfão
listado-não-apagado, comparador puro, relatório serializável) · typecheck 0 ·
lint 0 · rota limpa.

## Critério de sucesso (roadmap)

Reprojeção completa ✓ · parcial ✓ · auditoria ✓ (relatório com diffs e
órfãos) · comparação ✓ · idempotência ✓ (garantida por construção E verificada
por execução).

## Evolution Report

**O que aprendemos:** que a idempotência pode ser mais que uma propriedade —
pode ser um *teste embutido em produção*: computar duas vezes e comparar custa
milissegundos e transforma cada reprojeção numa prova viva da confluência. E
que órfãos são o jeito honesto de lidar com evolução de canonicalização: o
relatório os nomeia, a governança decide.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Idempotência como prova viva, não só teste | núcleo 2× em cada execução | regressão de confluência seria visível na tela |
| Só uma projeção precisa de runtime | todas as demais recomputam na leitura | o E5.7 é pequeno porque a arquitetura é grande |
| Órfãos = evolução visível de canonicalização | listados, jamais apagados | governança decide, nunca o efeito colateral |
