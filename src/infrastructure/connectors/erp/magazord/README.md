# Magazord Connector — Read Only (`erp/magazord/`)

> **PR-004 — o primeiro conector real da Zion Platform.** Lê o catálogo da Magazord (o ERP) e o converte para o **DTO canônico do Connector SDK** (PR-002), pronto para a **Application Layer** (PR-003). **Somente leitura.**

## Escopo

**Implementa:** autenticação (config `api_key`), leitura de **produtos**, **variações**, **imagens**, **categorias**, e a **conversão para o DTO canônico**.

**NÃO implementa** (fora de escopo, por design): escrita/atualização, estoque, custo, preço, publicação, Mercado Livre, Event Bus, filas, webhooks. `aplicar()` é rejeitado como *read-only*.

## Arquitetura

```
Magazord (HTTP)                      ← MODELO de endpoints/auth a confirmar
   │  MagazordApiFetch (I/O, segredo server-side)   ← única peça que fala rede
   ▼
MagazordApi (Port)                   ← costura injetável; fakeável nos testes
   ▼
MagazordConnector (implements Conector do SDK)   ← auth/config + orquestração de leitura
   │  mapeadores.ts (anticorrupção, puro)
   ▼
DTO Canônico do SDK                  ← ProdutoCanonico / VarianteCanonica / IdentidadeCanonica
   ▼
Application Layer                    ← CriarProdutoMestreCommand (compatível — ver teste)
```

- **Produtos/variações → canônico do SDK.** `identidade.skuOrigem` = SKU de fornecedor (se houver) senão o código Magazord; `identidade.erpSku` = código Magazord; `ean` complementar.
- **Imagens/categorias → DTOs locais** (`ImagemLida`/`CategoriaLida`). O SDK canônico **não define** imagem nem categoria de ERP, e este PR **não altera o SDK**; ficam locais até o SDK ganhar esses canônicos (PR futuro).
- **Estoque/custo/preço não são lidos** — pertencem ao PR futuro de ERP (estoque/custo/propagação).

## Segredos & auth

- Estratégia `api_key` (SDK). O conector só valida que o `ContextoConector.credencial` traz `estrategia: "api_key"` e um `ref` não vazio — **falha segura** (config) caso contrário, sem chamar a API.
- O **valor** do token nunca passa pelo conector: chega já resolvido server-side ao `MagazordApiFetch` (via `ResolvedorCredencial` do SDK, num composition root futuro). Nunca vai ao navegador nem é retornado.

## Testabilidade

O conector depende do Port `MagazordApi` (não de `fetch`), então os testes injetam um fake e cobrem: leitura→canônico, produto inexistente, `aplicar` read-only, falhas de config (estratégia/credencial), `testarConexao`/`sincronizar`, e a **compatibilidade com a Application** (canônico → `CriarProdutoMestreCommand` → domínio). O `MagazordApiFetch` é a borda de I/O, validada em integração (não em unitário).

## ⚠️ A confirmar na integração real

Endpoints (`/produtos`, `/produtos/{id}/variacoes`, …), esquema de auth (Bearer/Basic/token) e os campos dos `*Raw` são um **modelo** — não há doc/credencial neste ambiente. Ajustá-los afeta apenas `magazord-api-fetch.ts` e `tipos-magazord.ts`; o conector, o domínio e a Application permanecem intactos (anticorrupção).
