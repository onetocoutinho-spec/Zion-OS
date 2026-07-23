# Evolution Report — E5.9 · System Authorship

> EPIC E7 — Decision Intelligence Runtime · item 10/11. **Fecha a S-30.**
> A pergunta da auditoria evoluiu: de "quem agiu?" para **"qual versão de quê
> agiu?"** — porque auditoria de longo prazo compara comportamentos entre
> versões, não só entre autores.

## O que foi construído

- **`domain/system-authorship.ts`** — `AssinaturaDeSistema {autor,
  versaoEngine, versaoContrato, versaoConfidence, versaoExplainability}`:
  o autor na forma canônica do VO da E5.8 (ids conhecidos sem prefixo —
  compatível com os fatos gravados; componentes futuros nascem
  `sistema:<id>` via `assinaturaDe()` com versões obrigatórias).
  **Regra permanente: nenhuma ação automática sem assinatura.**
- **Migração 026** — 3 colunas aditivas e NULLABLE em `ofertas`
  (`versao_engine`, `versao_confidence`, `versao_explainability`): o log
  append-only fica intocado; ofertas pré-E5.9 permanecem `null` = "anterior
  ao versionamento" — leitura honesta, **nenhum backfill inventa história**.
- **Engine assina completo**: toda Oferta nova grava a
  `ASSINATURA_SUGGESTION_ENGINE` ("suggestion-engine" · E4.2 (R-SE-1) ·
  PD-001+ADR-001 v1 · confidenceDe/estadoDoSlot v1 · explicarConfidence v1).
- **Explainability** (E5.2) expõe as versões na origem de todo Outcome.

## Estado da S-30 após esta release

| Ação automática | Assina? |
|---|---|
| Ofertas (Suggestion Engine) | ✅ completa e versionada |
| Componentes futuros (delegation-runtime etc.) | ✅ obrigatório por regra (`assinaturaDe`) |
| Execuções autônomas do domínio (guia, token, fallback de categoria) | ⚠️ ainda sem rastro — fora do escopo da AIL; assinar exigiria fatos no domínio (candidato a ciclo próprio) |

A S-30 fecha no perímetro da Decision Intelligence; o resíduo do domínio fica
registrado, não escondido.

## Verificação

430/430 testes (4 novos: forma da assinatura, componente futuro com prefixo,
oferta gerada com assinatura completa, roundtrip do mapper com legado → null)
· typecheck 0 · lint 0. **Pendência operacional: aplicar a migração 026 no
SQL Editor** (verificação e rollback no arquivo). Comportamento até lá é
SEGURO por construção: o INSERT falharia → `gerarSugestao` devolve `null` →
**o Engine silencia** ("o fato antes da fala", ADR-001) — nenhuma quebra,
apenas ausência de ofertas até a migração ser aplicada.

## Evolution Report

**O que aprendemos:** que versionar comportamento é barato quando os
mecanismos já têm nome — as "versões" são citações dos artefatos congelados
(RFC/contratos), não números soltos; e que a honestidade do NULL (legado sem
versão) vale mais que um backfill bonito: a auditoria saberá exatamente quando
o versionamento começou.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Versão = citação de artefato congelado | VERSAO_CONFIDENCE = "RFC-AIL-004 §4.3/§4.4 v1" | mudanças de regra exigirão nova citação — rastro automático |
| NULL honesto > backfill | ofertas legadas ficam null | a linha do tempo do versionamento é ela própria auditável |
| A S-30 tem um resíduo fora da AIL | guia/token/fallback sem rastro | candidato registrado a ciclo próprio |
