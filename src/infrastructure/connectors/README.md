# Connector SDK (`src/infrastructure/connectors/`)

> **PR-002 — a camada universal de integração da Zion Platform.** Um **único contrato** que qualquer sistema externo implementa: Origem do Produto, ERPs, Marketplaces e APIs futuras. Documento canônico: [003 — Connector SDK](../../../docs/architecture/003-connector-sdk.md).
>
> **Só contratos.** Este PR entrega **interfaces + tipos canônicos + capacidades + estratégias de auth + modelo unificado de erros + testes**. **Nenhum** provedor concreto (Magazord/ML/TikTok/Shopee), **nenhum** I/O, **nenhum** Event Bus, **nenhum** banco/Supabase. **Strangler Fig:** vive em paralelo e **dormente** — nada em `src/app`, `src/lib` ou `src/domain` importa isto ainda.

## Por que existe

Adicionar um canal/ERP/fornecedor novo deve ser **implementar uma interface conhecida**, não reescrever o sistema. O SDK padroniza autenticação, sincronização, capacidades declaradas, erros, limites e idempotência — para que o runtime (Marketplace Engine / jobs, PRs futuros) opere qualquer conector sem saber qual é o provedor.

## Mapa

```
connectors/
  conector.ts                 # interface BASE (metadados, conectar, testar, renovar, sincronizar, aplicar)
  conector-origem.ts          # ConectorOrigem  (ingerir)                    — 000: "Origem" = supplier do 003
  conector-erp.ts             # ConectorErp     (lerEstoque, lerCusto, propagar)
  conector-marketplace.ts     # ConectorMarketplace (publicar, atualizarPrecoEstoque, pausar, importar, webhook, categoria)
  conformidade.ts             # verificarConformidade(metadados) — contract test reutilizável (lógica pura)
  shared/
    erros.ts                  # modelo UNIFICADO de erro (auth|config|rate|recuperavel|permanente)
    resultado.ts              # Resultado<T> (ok/erro) — independente do domínio
    capacidades.ts            # Capacidade + declarar/suporta
    limites.ts                # Limites (rate limit) + validação
    operacao.ts               # OperacaoAplicar + ResultadoOperacao + chaveIdempotencia()
    sincronizacao.ts          # ModoSync + OpcoesSync + ResumoSync
    tipos-conector.ts         # TipoConector, ContextoConector, MetadadosConector, Saude
    auth/
      credencial.ts           # ReferenciaCredencial (PONTEIRO, nunca o valor)
      estrategia-auth.ts      # oauth2|api_key|arquivo|nenhuma + ResolvedorCredencial (port)
    canonical/                # DTOs de TRANSPORTE (não são os tipos do domínio)
      identidade / produto-canonico / ingestao / erp / marketplace
```

## Princípios (herdados de 000/003)

- **Segredos server-side, sempre.** O SDK só trafega `ReferenciaCredencial` (ponteiro). O valor real (token/secret) **nunca** é tipado aqui, nunca vai ao navegador, nunca sai em API/log.
- **Erros classificados.** Uma taxonomia única decide retry/backoff/dead-letter/reautorização sem conhecer o provedor.
- **Capacidades declaradas.** O runtime só chama o que o conector diz suportar.
- **Idempotência.** Toda escrita carrega uma `idempotency_key` canônica e determinística.
- **Anticorrupção.** Os tipos `canonical/*` são de transporte e **separados** dos Value Objects do domínio; a conversão canônico↔domínio é da Application (PR futuro). Por isso o SDK **não importa** `src/domain`.

## Como adicionar um conector (PR futuro)

1. Implementar `ConectorOrigem` | `ConectorErp` | `ConectorMarketplace` num adaptador concreto sob `infrastructure/marketplaces/<canal>` ou `infrastructure/connectors/erp/<erp>`.
2. Declarar `metadados()` (tipo, provedor, capacidades, limites) e passar em `verificarConformidade`.
3. Guardar credencial via `ReferenciaCredencial` (cofre server-side); nunca retornar segredo.
4. Cobrir com os contract tests desta pasta.

## Fora deste PR

Provedores concretos, runtime/fila (Engine — 005), transporte de eventos (Event Bus — 004), persistência (`conector_conta`/`execucao_conector`) e a Application que orquestra tudo. Aqui é **só o contrato**.
