# Auditoria Arquitetural — Zion OS

> **O que é isto:** um **diagnóstico técnico e visual** do Zion OS (SaaS), feito sobre o código real do repositório `C:\Users\usuario\zion-os` (Next.js 16 + TypeScript + Supabase). É um **retrato do estado atual + proposta de evolução incremental** — **não** uma implementação. Nenhum código, migração, credencial ou funcionalidade foi alterado para produzir estes documentos.
>
> **Data:** 2026-07-09 · **Escopo:** SaaS multiempresa (portal da equipe + Portal do Cliente `/cliente/*`). O *toolkit Python* em `Zion Tools — Marketplace OS` (scripts de foto/preço via Excel) é uma camada operacional paralela e está fora do escopo, exceto menção de contexto.

## Como ler

Cada afirmação de estado vem com **evidência** (`arquivo:linha`). O relatório separa sempre:

- **FATO** — o que está no código hoje (com citação).
- **RECOMENDAÇÃO** — o que sugerimos mudar (não está implementado).
- **NÃO CONFIRMADO** — algo que não foi possível verificar só pelo código.

## Índice

| # | Documento | Para quê |
|---|-----------|----------|
| — | [README.md](./README.md) | Este índice. |
| 01 | [01-RESUMO-EXECUTIVO.md](./01-RESUMO-EXECUTIVO.md) | Diagnóstico geral, o que manter, top correções, próximas 5 tarefas. **Comece por aqui.** |
| 02 | [02-ARQUITETURA-ATUAL.md](./02-ARQUITETURA-ATUAL.md) | Stack, camadas, IA, fila/worker, marketplaces, mapa de pastas. |
| 03 | [03-FLUXO-ATUAL.md](./03-FLUXO-ATUAL.md) | Fluxos reais ponta a ponta (importar → otimizar → aprovar → publicar → vender). |
| 04 | [04-PROBLEMAS-E-RISCOS.md](./04-PROBLEMAS-E-RISCOS.md) | Riscos classificados (crítico/alto/médio/baixo) com evidência e correção. |
| 05 | [05-MODELO-DE-DADOS-SUGERIDO.md](./05-MODELO-DE-DADOS-SUGERIDO.md) | Tabelas atuais × modelo-alvo multiempresa. Esboço, sem migração. |
| 06 | [06-ARQUITETURA-RECOMENDADA.md](./06-ARQUITETURA-RECOMENDADA.md) | Arquitetura-alvo, contrato de adaptador, fila de publicação, observabilidade. |
| 07 | [07-WIREFRAMES-TEXTUAIS.md](./07-WIREFRAMES-TEXTUAIS.md) | Navegação e wireframes textuais por tela. |
| 08 | [08-PLANO-DE-EVOLUCAO.md](./08-PLANO-DE-EVOLUCAO.md) | Fases 0–5 com objetivo, arquivos afetados, riscos e critério de conclusão. |
| 09 | [09-BACKLOG-PRIORIZADO.md](./09-BACKLOG-PRIORIZADO.md) | Tabela Manter/Melhorar/Refatorar/Substituir/Criar por área + prioridade. |
| 10 | [10-PERGUNTAS-E-DECISOES.md](./10-PERGUNTAS-E-DECISOES.md) | Decisões em aberto que travam o próximo passo. |

## Veredito em uma linha

O Zion OS é um **MVP funcional caminhando para produção de 1 cliente** (Chinelaria): tem Supabase real, OAuth ML funcionando, IA real (Gemini/Claude), fila com worker e deploy real. **Ainda não está pronto para escala multi-tenant madura** — os bloqueios estão em [04](./04-PROBLEMAS-E-RISCOS.md) e a rota de saída em [08](./08-PLANO-DE-EVOLUCAO.md).
