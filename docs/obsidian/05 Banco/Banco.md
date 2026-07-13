---
tipo: moc
area: banco
---

# 🗄️ Banco — Índice

> Navegação do modelo de dados (Supabase/Postgres). Compliance canônico em [[010-database-compliance|010 · Database Compliance]]; modelo do Produto Mestre em [[001-product-master|001]].

## Páginas

- [[Schema]] — organização das tabelas e domínios
- [[Migrations]] — histórico e regra do `down`
- [[Modelo de Dados — Produto Mestre]] — persistência do [[Produto Mestre]]
- [[Versionamento]] — histórico/diff/undo de entidades
- [[RLS]] — Row Level Security, multiempresa deny-by-default

## Documentos-fonte

- [[010-database-compliance|010 · Database Compliance]]
- [[009-pr001-implementation-plan|009 · Plano PR-001 (Foundation)]]
- [[zion-os-audit/05-MODELO-DE-DADOS-SUGERIDO|Auditoria · Modelo de dados sugerido]]

## Estado atual (Zion OS)

Migrações vivas `008`→`016`. RLS por papel (`equipe`/`cliente`) já adotada; a Fase 1 de segurança (016) endurece para deny-by-default. Ver [[RLS]] e [[Migrations]].

---
◀ [[Home]] · [[Glossário]]
