---
tipo: nota
area: banco
---

# Schema

> Organização das tabelas do Supabase/Postgres. Página de navegação — o desenho canônico está em [[010-database-compliance|010]] e [[001-product-master|001]]; os arquivos SQL vivem em `database/`.

## Domínios de tabelas (visão)

- **Tenancy:** `organizacoes`, `clientes`, `perfis` — escopo de [[RLS]].
- **Produto:** [[Produto Mestre|produtos]], variações, `imagens_produto`, atributos — ver [[Modelo de Dados — Produto Mestre]].
- **Canais:** `canais_marketplace` ([[Conta Marketplace]]), `anuncios_gerados` ([[Listing]]).
- **Operação IA:** `fila_otimizacao_produto` ([[Workflow]]), tabelas de medidas, `componentes` (kit/combo).
- **Fundação (alvo 007):** `evento`/`entrega` ([[004-event-bus|Event Bus]]), `operacao_marketplace` ([[Marketplace Engine]]), staging de Pré-Produto ([[Zion Intake]]).

> [!note] Fonte da verdade do SQL
> Os DDLs reais estão em `database/` (fora desta Vault por design). Esta nota apenas mapeia. Não editar SQL a partir daqui — usar o [[Fluxo de Desenvolvimento]].

Ver também: [[Migrations]] · [[RLS]] · [[Versionamento]]

---
◀ [[Banco]] · [[Glossário]]
