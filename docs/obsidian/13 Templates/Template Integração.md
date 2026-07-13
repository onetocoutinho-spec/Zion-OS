---
tipo: template
alvo: integracao
---

# Integração — <nome> (<ERP | Marketplace | Fornecedor>)

> Toda integração implementa o [[Connector SDK]]; todo marketplace implementa o [[Marketplace Adapter]].

- **Tipo de conector:** `SupplierConnector` | `ErpConnector` | `MarketplaceConnector`
- **Contrato:** [[Connector SDK]] · (marketplace) [[Marketplace Adapter]]
- **Fase / PR:** <...> ([[PRs]])

## Autenticação

- OAuth/credenciais **server-side** (nunca no browser). Ver [[RLS]].

## Operações

- [ ] Publicar / cadastrar
- [ ] Atualizar (PUT preço / estoque)
- [ ] Pausar
- [ ] Reconciliar (webhooks → estado/venda)

## Limites & resiliência

- `limites()` (rate-limit por conta) · retry/backoff · idempotência (`idempotency_key`).
- Erros **sanitizados** (sem segredo).

## Eventos

- **Emite:** <...>
- **Consome:** <...>

## Testes

- [ ] Payload (mapeamento Produto Mestre ↔ canal)
- [ ] Idempotência (reenvio = no-op)
- [ ] Webhook → reconciliação

---
◀ [[Integrações]] · [[Templates]]
