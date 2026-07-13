---
tipo: vault-readme
titulo: Zion Platform — Knowledge Base
---

# 🏛️ Zion Platform — Knowledge Base (Obsidian Vault)

Este diretório é a **camada de conhecimento** da Zion Platform: um Centro de Conhecimento navegável construído sobre a documentação que já existe no repositório.

> [!important] Regra de ouro — nada aqui é duplicado
> A **fonte da verdade** continua sendo o Git + o Markdown versionado em `docs/architecture/` e nos demais diretórios de `docs/`. Esta Vault contém **apenas** índices, dashboards, WikiLinks, templates, canvas e mapas de navegação que **apontam** para os documentos existentes. Nenhum documento de arquitetura (000–010) foi copiado ou reescrito.

## Como abrir no Obsidian

1. Instale o [Obsidian](https://obsidian.md).
2. **Open folder as vault** → selecione a pasta **`docs/`** (o pai desta pasta), e **não** o repositório inteiro.
   - Motivo: com a raiz da Vault em `docs/`, os arquivos reais de `architecture/` ficam **dentro** da Vault, então WikiLinks como `[[001-product-master]]` resolvem para o documento verdadeiro — sem cópia.
   - Abrir o repositório inteiro puxaria +1000 arquivos de `node_modules` e poluiria o Graph View. O `.obsidian/app.json` já filtra `node_modules/` por precaução.
3. Abra **[[Home]]** (`obsidian/00 Dashboard/Home.md`) — é o painel principal.
4. Recomendado ativar os core plugins: **Graph View**, **Canvas**, **Templates** (pasta de templates → `obsidian/13 Templates`), **Outgoing/Backlinks** e **Tag pane**.

## Estrutura da Vault

| Pasta | Função |
|-------|--------|
| `00 Dashboard/` | Painel principal ([[Home]]) |
| `01 Arquitetura/` | Índice navegável dos docs 000–010 |
| `02 Engenharia/` | PRs, Engineering Rules, DoD, fluxos |
| `03 Produto/` | Conceitos de produto (Produto Mestre, Variante, SKU…) |
| `04 Integrações/` | Magazord, ML, Shopee, TikTok, SDK, Adapter |
| `05 Banco/` | Schema, migrations, RLS, versionamento |
| `06 IA/` | Workforce A0–A12 (estrutura) |
| `07 Marketplace/` | Domínio marketplace + Engine |
| `08 ERP/` | Domínio ERP (Magazord) |
| `09 Roadmap/` | Timeline de fases e PRs |
| `10 ADR/` | Architecture Decision Records |
| `11 Glossário/` | Linguagem oficial (ubiquitous language) |
| `12 Canvas/` | Mapas visuais (.canvas) |
| `13 Templates/` | Templates de PR, ADR, Capability, etc. |

## Como manter sincronizado com o Git

A Vault vive **dentro** do repositório (`docs/obsidian/`), então versiona junto com o código:

```bash
git add docs/obsidian docs/.obsidian
git commit -m "docs(vault): atualiza knowledge base"
git push
```

> [!tip] Higiene de Git
> - O `.obsidian/workspace.json` (layout de janelas, local a cada máquina) pode ser ignorado no `.gitignore` para evitar ruído. Os arquivos `app.json` e `graph.json` **devem** ser versionados — carregam a configuração compartilhada da Vault.
> - Nunca edite os documentos de `architecture/` a partir de uma nota-índice: use a Vault para **navegar**, e o fluxo normal de PR para **alterar** a fonte da verdade.

## Convenção de links

- **WikiLink para a fonte da verdade:** `[[001-product-master|001 · Product Master]]`
- **WikiLink para conceito da Vault:** `[[Produto Mestre]]`, `[[Connector SDK]]`
- Toda nota conecta-se ao seu MOC (Map of Content) da pasta e ao [[Glossário]].

Ver também: [[Home]] · [[Arquitetura]] · [[Roadmap]] · [[Glossário]]
