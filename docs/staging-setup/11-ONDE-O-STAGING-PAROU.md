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

## O achado de passagem: o registro de produção não parou por descuido

`migracoes_aplicadas` existe em produção, tem **68 linhas** e vai até a **070**.
Os artefatos de `071`–`076` estão todos lá — `copilot_investigacoes`, o CHECK com
`titulo_no_ml`, `ia_execucoes.ms_ferramentas`, `anuncios_gerados.saude_ml`,
`imagens_produto.altura` e `.cor`. Produção está na 076.

A primeira leitura disto foi "seis aplicadas sem linha", como se alguém tivesse
esquecido. **Está errada.** Nenhuma das migrações 071–076 tem auto-registro — nem
as 035–042. São catorze arquivos que não registram a si mesmos, contra a
convenção que a própria 024 declarou obrigatória: *"toda migração DEVE terminar
com o próprio INSERT em migracoes_aplicadas"*.

O ledger não falhou. A convenção foi abandonada duas vezes, e o ledger contou
fielmente o que lhe deram. Uma convenção que catorze arquivos ignoram não é
convenção — é folclore, e o instrumento que depende dela mede o folclore.

## O que isso significou para o T1

Percorrer o caminho da loja nova no staging exigia aplicar **58 migrações** antes — e a
`06` avisa que elas não são idempotentes na ordem errada, porque dependem da base legada e
de `set_updated_at()`.

Foram aplicadas em 25/08. O adendo abaixo diz como, com as ressalvas de método e o
resultado da conferência.

---

## Adendo — as 58 aplicadas, 2026-08-25

As 58 migrações foram aplicadas ao staging na ordem, em treze lotes, com
`apply_migration`. As que se autoverificam passaram — 041, 042, 043, 044, 045,
046, 047, 048, 052, 059, 060, 061, 062, 063 e 064 levantam exceção se o efeito
não se confirmar, e nenhuma levantou.

Duas ressalvas de método, ditas porque mudam o que a aplicação significa:

1. **Os comentários `--` dos arquivos não foram transcritos.** Eles são
   documentação para quem lê o repositório e não chegam ao banco. Todo
   `comment on table/column/function/index` — que É metadado de esquema — foi
   preservado.
2. **Duas linhas de ledger foram inventadas e desfeitas.** No começo registrei
   `035` e `036`, que os arquivos não registram. Removidas assim que percebi:
   staging tem que reproduzir o que os arquivos fazem, inclusive onde eles não
   fazem nada — se o ledger do staging ficasse mais completo que o de produção,
   ele esconderia exatamente o defeito descrito acima.

### A conferência

Esquema do staging comparado com o de produção, tabela a tabela: **52 tabelas com
contagem de colunas idêntica**. Nenhum erro de transcrição.

A comparação achou outra coisa — deriva entre repositório e produção, nos dois
sentidos. Está em
[INC-012](../engineering/incidents/INC-012-o-repositorio-e-a-producao-derivaram-nos-dois-sentidos.md).

### A segunda conferência, que o pre-commit exigiu

O hook pediu a varredura de `database/verificacoes/alcance-da-agencia.sql` depois
de aplicar migração. Ela não olha forma de tabela: compara, contra uma
classificação escrita, **onde a política `agencia_escopo` está e onde não está** —
sobra é vazamento, falta é a agência perder um pedaço do produto em silêncio.

**Zero divergências nos dois bancos.** Vale como validação independente da
reconstrução: as 58 migrações não só criaram as colunas certas, como deixaram o
RLS exatamente onde a classificação manda. E o arquivo avisa por que isso não era
garantido — o laço da 054 rodou UMA vez, então toda tabela criada depois dela
depende da política escrita na própria migração.

### O que o staging ainda NÃO tem


Esquema não é ambiente. Continuam faltando, e estão no
[tasks/todo.md](../../tasks/todo.md): variáveis de ambiente, um app ML separado
com `ML_REDIRECT_URI` próprio, e a decisão sobre qual conta do Mercado Livre
conectar — que staging não resolve, porque o banco é outro mas a conta do
marketplace pode ser a mesma.
