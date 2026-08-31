# Zion Platform

Workspace de **implementação** do Compilador Zion. Materializa fielmente os pilares congelados; não define arquitetura nem conceitos.

**Localização canônica:** `/platform`, dentro do repositório Zion (RFC-01, aplicada). O app existente permanece intacto.

**Fonte da verdade (imutável aqui):** `../docs/product/system/` · `../docs/architecture/` · `../docs/decisions/` · `../docs/compiler/` · `../docs/representation/`.

**Toolchain:** TypeScript · Node.js LTS · pnpm workspaces · tsup · Vitest · ESLint · Prettier.

**DAG oficial:** o definido pela **Compiler Specification** (as declarações `Depends On`), codificado nas dependências de workspace de cada `package.json`. Não existe representação linear; o grafo é acíclico, `@zion/shared` não depende de ninguém e os `@zion/generator-*` são independentes entre si.

## Pacotes

| Pacote              | Espelha                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `@zion/shared`      | Core Contracts (Ontologia 000 · Compiler 001/003/005) + Representation Model (representation/001) |
| `@zion/compiler`    | lexer(002) parser(003) semantic(004) ir(005) validator(007) pipeline(006) diagnostics(001)        |
| `@zion/generator-*` | generators 008–013 — independentes entre si, consomem só a IR                                     |
| `@zion/runtime`     | runtime (015)                                                                                     |
| `@zion/cli`         | cli (014)                                                                                         |
| `@zion/lsp`         | language server (016)                                                                             |
| `tests/`            | certification (017)                                                                               |

> **PHASE 01 concluída:** apenas a estrutura física existe. Os diretórios `src/` estão vazios — os primeiros arquivos TypeScript (os contratos) nascem na PHASE 02.
