# 11 — Onde o staging parou, medido

```
Data:     2026-08-25, logo depois de religar o projeto
Projeto:  zion-os-staging · fivlziuvxvhpuibrjwlq · us-east-1 · criado em 10/07/2026
Método:   comparação de esquema (tabelas, colunas, funções) contra produção e o repositório
```

O projeto estava `INACTIVE` — pausado, não perdido. Religado, voltou íntegro: 29 tabelas,
RLS ligado em todas, e `environment_metadata` presente, que é o marcador de ambiente.

## A resposta

**O staging parou na migração 016.** É exatamente onde
[06-APLICACAO-DAS-MIGRACOES.md](06-APLICACAO-DAS-MIGRACOES.md) mandava parar: base legada →
`001…015` → criar usuários → `016`.

```
staging     016        29 tabelas
repositório 076        75 arquivos numerados em database/migrations/
faltam      022–076    58 migrações
```

Os números `017`–`021` não existem: a sequência pula de `016` para `022`.

### Como isso foi determinado

`list_migrations` devolve vazio nos dois projetos — as migrações deste repositório são
aplicadas à mão, no editor SQL, e não pelo CLI do Supabase. Então a comparação foi por
artefato:

| Marcador | Migração | staging | produção |
|---|---|---|---|
| `produtos.componentes` | 015 | ✅ | ✅ |
| `perfis.ativo` + `eh_equipe()` | 016 | ✅ | ✅ |
| tabela `decisoes` | 022 | ❌ | ✅ |
| tabela `migracoes_aplicadas` | 024 | ❌ | ✅ |
| `clientes.margem_minima` | 029 | ❌ | ✅ |
| `anuncios_gerados.categoria_ml` | 056 | ❌ | ✅ |
| `canais_marketplace.refresh_token_cifrado` | 061 | ❌ | ✅ |
| tabelas `copilot_*`, `agencias`, `imagens_versoes` | 025+ | ❌ | ✅ |

## O achado de passagem: o registro de produção está seis atrás

`migracoes_aplicadas` existe em produção e tem **68 linhas**, indo até a **070**. Mas os
artefatos de `071`–`076` estão todos lá:

```
071  tabela copilot_investigacoes          presente
072  CHECK de copilot_propostas com 'titulo_no_ml'   presente
073  ia_execucoes.ms_ferramentas           presente
074  anuncios_gerados.saude_ml             presente
075  imagens_produto.altura                presente
076  imagens_produto.cor                   presente
```

**Produção está na 076; o registro dela diz 070.** Seis migrações aplicadas sem linha. O
registro existe justamente para responder "onde este banco está" — e responde errado. Quem
confiar nele para preparar o staging vai aplicar seis vezes o que já está aplicado, ou
deixar de aplicar o que falta.

Não é urgente e não quebra nada: as migrações usam `if not exists`. Mas o registro é o
instrumento, e um instrumento descalibrado é pior que nenhum, porque ninguém desconfia dele.

## O que isso significa para o T1

Percorrer o caminho da loja nova no staging exige aplicar **58 migrações** antes — e a
`06` avisa que elas não são idempotentes na ordem errada, porque dependem da base legada e
de `set_updated_at()`.

Não é trabalho de minutos, e é honesto dizer isso antes de alguém abrir o navegador
esperando testar. As duas saídas:

1. **Aplicar as 58** e ter um ambiente que serve para este e para os próximos percursos;
2. **Voltar a medir em produção** com as cinco guardas escritas em
   [tasks/todo.md](../../tasks/todo.md) — mais rápido hoje, e a conta é a única que paga.

A escolha é de quem vai pagar o tempo. O que não dá é achar que religar o projeto já
resolveu: ele voltou como estava em julho.
