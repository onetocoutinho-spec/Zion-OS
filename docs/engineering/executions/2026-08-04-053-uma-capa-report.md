# Relatório — migração 053 · uma capa por produto

```
Operação:  create unique index parcial em imagens_produto
Aplicada:  2026-08-04 03:22 UTC, projeto ouynursknlgtmewcdjzr (produção)
Artefatos: Plano = PR #192 + o cabeçalho da própria 053 · Snapshot = §1 · Relatório = este
Risco:     aditivo e reversível — nenhum dado alterado
```

## 1 · Snapshot (antes)

| | |
|---|---|
| índices em `imagens_produto` | `idx_img_anuncio`, `idx_img_produto`, `imagens_produto_pkey` |
| ledger | última = **052** — `052-as-infracoes-da-conta` |
| linhas | **653** · Principal **80** · com `variante_id` **0** |
| produtos com 2+ Principais | **0** |

Nenhum índice único além da primary key: **uma segunda capa entrava calada**.

## 2 · O que foi aplicado

```sql
create unique index idx_imagens_produto_uma_capa
  on public.imagens_produto (
    produto_id,
    coalesce(variante_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where tipo_imagem = 'Principal';
```

Mais o `comment on index` e a linha própria no ledger, como manda a convenção
desde a 024.

## 3 · Definition of Done

| # | verificação | resultado |
|---|---|---|
| 1 | índice existe com a definição exata | ✅ confirmado em `pg_indexes` |
| 2 | ledger registra 053 | ✅ `053 — 053-uma-capa-por-produto`, 04/08 03:22 |
| 3 | **a segunda capa é RECUSADA** | ✅ `unique_violation` |
| 4 | **a segunda Secundária PASSA** | ✅ aceita |
| 5 | nenhuma linha vazou dos testes | ✅ 653 linhas, 80 Principais, zero `.invalid` |

As linhas **3 e 4 são a prova que importa**, e são duas porque o defeito possível
tinha dois lados. Existir não é barrar, e barrar demais teria sido pior que não
barrar: o índice que o PLANO-002 pedia passaria na 3 e **reprovaria na 4**.

Ambas rodaram dentro de bloco `DO` com `EXCEPTION`, que cria savepoint
implícito — o insert de teste nunca commitou em nenhum dos caminhos, e a
linha 5 confirma.

## 4 · A correção de rumo que a medição produziu

O PLANO-002 (C4) pedia único em `(produto_id, tipo_imagem)`. Medido antes de
escrever: **653 linhas, 77 combinações repetidas, 570 linhas envolvidas** —
quase todas galerias legítimas, porque `Secundária` é múltipla por natureza.

Esse índice não protegeria a capa: recusaria a segunda foto de 77 produtos.

E `variante_id` entrou na chave **estando vazio nas 653 linhas**. Esse zero é a
prova, em dado, de que a associação foto↔cor nunca existiu — a causa das 110
infrações `DOMAIN` do ML, a mais recente de 03/08. Quando o DES-003 preencher a
coluna, o índice passa de "uma capa por produto" para "uma capa por cor" sem
migração nova. Um índice só sobre `produto_id` teria de ser derrubado no meio do
trabalho para o qual foi criado.

## 5 · Rollback

```sql
drop index if exists public.idx_imagens_produto_uma_capa;
```

Nada mais. Nenhum dado foi alterado, então derrubar o índice devolve o estado
anterior por completo — inclusive a possibilidade de uma segunda capa entrar
calada, que é o motivo de ele existir.

## 6 · Ordem de aplicação vs. merge

A migração foi aplicada **antes** do merge da PR #192, e nesta direção não há
risco: nenhum código depende do índice. O incidente que ensinou a conferir
migrações antes do deploy foi o inverso — código lendo `perfis.ativo` numa
produção que nunca recebeu a coluna. Aqui o banco está à frente do repositório,
que é o lado seguro da defasagem.
