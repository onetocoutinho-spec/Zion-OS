# Fase 3 — Publicação no Mercado Livre

Pipeline seguro: a equipe aprova o anúncio (trava A10) e publica no ML a partir
da tela **Aprovações**. O **dry-run** (prévia do payload) é 100% local; a
publicação real passa pelo servidor, que detém o segredo do app ML.

## Arquitetura

| Camada | Arquivo | Papel |
|---|---|---|
| Cliente ML (servidor) | `src/lib/marketplaces/mercadolivre.ts` | OAuth refresh, previsão de categoria, `POST /items` |
| Payload (puro) | `src/lib/marketplaces/mlPayload.ts` | Anúncio da esteira → item do ML (atributos, variações, garantia) |
| Rota (servidor) | `src/app/api/ml/publicar/route.ts` | renova token + publica; segredo só no env |
| Canal do cliente | `src/lib/services/canaisMarketplace.ts` | refresh_token + config por cliente (RLS: equipe) |
| Orquestração (cliente) | `src/lib/services/publicacaoML.ts` | dry-run local + envio real + persistência |
| UI | `src/app/esteira/aprovacoes/page.tsx` | botão **Publicar** → modal com payload → **Publicar de verdade** |

## Segurança

- `ML_CLIENT_ID` / `ML_CLIENT_SECRET` vivem **só no `.env` do servidor** — nunca
  `NEXT_PUBLIC_`, nunca no navegador.
- O `refresh_token` de cada cliente fica em `canais_marketplace` (RLS restrita à
  equipe). O ML rotaciona o refresh_token a cada uso; o novo é persistido.

## Para ir ao ar (passos que dependem de você)

1. **Migração 009** no Supabase (`database/migrations/009-marketplace-ml.sql`).
2. **App ML** em https://developers.mercadolivre.com.br → pegue `client_id` e
   `client_secret`. No `.env.local` do servidor (e nas envs da Vercel):
   ```
   ML_CLIENT_ID=...
   ML_CLIENT_SECRET=...
   ```
3. **Conectar cada cliente (OAuth):** rode o fluxo de autorização do ML uma vez
   por cliente para obter o `refresh_token` inicial e grave em
   `canais_marketplace` (cliente_id, refresh_token, tipo_anuncio). O fluxo
   authorize/callback ainda **não tem tela** — por ora insira via SQL ou pelo
   `salvarCanal()`. *(Próximo passo sugerido: tela “Conectar Mercado Livre”.)*
4. **Fotos reais:** o ML exige imagens por **URL** (não aceita os prompts do A12).
   Passe as URLs em `pictures` ao publicar (hoje o payload vai sem fotos → item
   pode ficar incompleto). *(Próximo passo: upload/whitelist de fotos.)*
5. **Categoria:** se o payload não trouxer `category_id`, o servidor prevê pelo
   título (`domain_discovery`). O ideal é confirmar via
   `GET /categories/{id}/attributes` (fonte da verdade dos obrigatórios).

## Fluxo de uso

1. Esteira gera o anúncio → **Aprovações**.
2. Equipe **Aprova** (só passa A10 sem pendências).
3. **Publicar** → modal mostra o payload (dry-run) → **Publicar de verdade**.
4. Item criado no ML → status vira **Publicado** com `ml_item_id` + link “Ver no ML”.
