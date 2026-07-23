# Evolution Report — E5.8 · Typed Author

> EPIC E7 — Decision Intelligence Runtime · item 9/11.
> O `Autor` adormecido da fundação (S-35) acorda — **como conceito, não como
> código**.

## O que foi construído

`domain/author.ts` — o Value Object `Autor{tipo, id}` com:

- **`autorDe(texto)`** — interpretação determinística de QUALQUER string já
  gravada nos fatos: `""`/espaços → `nao_registrado` (as Decisions
  pré-E4.2.3); ids de sistema conhecidos (`suggestion-engine`) e o prefixo
  canônico `sistema:` → `sistema`; qualquer outro texto → `humano` (e-mail da
  sessão, o formato da E4.2.3).
- **`textoDe(autor)`** — roundtrip estável para os campos string existentes
  (sistema conhecido SEM prefixo — compatível com as ofertas já gravadas;
  sistemas futuros COM prefixo — pronto para a E5.9).
- **`rotuloDe(autor)`** — os rótulos que as telas já usam, preservados.

Adoção gradual: `rotuloAutor` (a superfície de leitura usada por Browser,
Observation e Outcome) agora delega ao VO — **mesmas saídas de sempre**.

## Decisões de colheita (S-35)

A fundação modelou `Autor{tipo, id, agenteCodigo, confianca}`. A colheita
trouxe o **conceito** e deixou o código adormecido (decisão E5.1.1 intacta):

- **SEM `confianca`** — deliberado: evita a colisão de vocabulário registrada
  no GLOSSARY (três significados de "confiança"); se um dia autoria precisar
  de grau, será decisão nova, com nome novo.
- **SEM `agenteCodigo`** — nenhum caso de uso presente (YAGNI); o prefixo
  `sistema:` cobre a identificação de componentes.

## Retrocompatibilidade — o contrato do item

Campos persistidos **não mudam** (`decisoes.autor`, `ofertas.autor_da_oferta`
— zero migração, append-only intacto). Nenhum fato antigo é reinterpretado
incorretamente (parse total testado). A prova mais forte: **a suíte inteira
passou sem uma única mudança de expectativa** — 419 testes pré-existentes
verdes + 7 novos = 426.

## Verificação

426/426 · typecheck 0 · lint 0. Novos testes: humano/anônimo/sistema
conhecido/prefixo/prefixo-vazio, roundtrip estável, rótulos, retrocompat da
superfície de leitura.

## Evolution Report

**O que aprendemos:** que "acordar" uma semente não é ressuscitar código — é
colher o conceito com as decisões de hoje (o VO nasceu menor que o original,
e cada omissão tem um porquê documentado). E que a retrocompatibilidade de um
VO de leitura se prova da forma mais barata possível: a suíte inteira verde
sem tocar uma expectativa.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Colher ≠ ressuscitar | VO menor que o da fundação, com porquês | S-35 germina sem acordar a fundação |
| Tipagem por leitura dispensa migração | parse determinístico sobre strings gravadas | zero risco, zero SQL |
| O prefixo `sistema:` prepara a E5.9 | textoDe para sistemas futuros | assinatura de componentes já tem forma canônica |
