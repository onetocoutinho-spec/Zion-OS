# INC-012 — O repositório e a produção derivaram, nos dois sentidos

```
Status:      PARCIAL — o `error` engolido foi corrigido; o resto é decisão sua
Detectado:   2026-08-25, comparando o staging recém-migrado com a produção
Severidade:  baixa hoje; o que preocupa é a classe, não o caso
Correção:    exige decisão de quem manda no esquema — não é conserto mecânico
```

## Como apareceu

O staging foi reconstruído aplicando as 58 migrações que faltavam (022–076), e o
esquema resultante foi comparado com o de produção — tabela por tabela, coluna
por coluna, função por função. A comparação existia para pegar erro de
transcrição meu. Não pegou nenhum: **52 tabelas com contagem de colunas
idêntica**. Pegou outra coisa.

## O que difere

```
staging tem, produção não:   3 funções — portal_resumo, portal_anuncios,
                             portal_proximas_acoes  (criadas pela migração 005)
produção tem, staging não:   produtos.cod_magazord  (nenhuma migração a cria)
```

(`environment_metadata`, só no staging, é o marcador de ambiente e é esperado.)

### Produção tem uma coluna que ninguém escreveu

`produtos.cod_magazord` não aparece em nenhum arquivo de `database/`. O único
`cod_magazord` do repositório está em `importacaoProdutos.ts`, e é um **apelido
de cabeçalho de planilha** que mapeia para `codErp` — não tem relação com a
coluna. Ela foi criada à mão, em algum momento, e nunca foi escrita.

Medida: **0 valores em 72 produtos**. Está vazia.

### Produção perdeu três funções que o código ainda chama

A migração 005 cria `portal_resumo`, `portal_proximas_acoes` e `portal_anuncios`.
O ledger de produção registra a 005 como aplicada. As três não existem lá — foram
removidas sem migração.

E `lib/services/perfil.ts` **continua chamando as três** por RPC. Duas não têm
chamador. A terceira tem:

```
app/cliente/page.tsx:81   const { data: proximas } = useLiveQuery(portalProximasAcoes);
app/cliente/page.tsx:441  {(proximas ?? []).length > 0 && (   // a seção "Recados"
```

O wrapper desestrutura só `data` e ignora `error`. Em produção a chamada falha,
`data` vem indefinido, `?? []` devolve lista vazia, e a seção **nunca aparece** —
sem erro na tela, sem erro no log da aplicação.

O efeito prático é pequeno: o comentário do próprio arquivo (`page.tsx:404`)
explica que o RPC lê `tarefas`, "que SÓ a equipe preenche" — e a equipe não
existe mais. A seção estaria vazia de qualquer jeito. Mas ela está vazia pelo
motivo errado, e o motivo errado é invisível.

## O achado que vale mais que os dois

Este INC nasceu porque houve **um segundo banco para comparar**. Enquanto
existia só produção, não havia com o que confrontá-la: o esquema real era, por
definição, o esquema certo.

Junto veio a correção de uma leitura anterior. O
[11-ONDE-O-STAGING-PAROU.md](../staging-setup/11-ONDE-O-STAGING-PAROU.md) dizia
que o ledger de produção parou na 070 por descuido — "seis aplicadas sem linha".
Não é. **Nenhuma das migrações 071–076 tem auto-registro**, nem as 035–042: são
catorze arquivos que não registram a si mesmos, contra a convenção que a própria
024 declarou obrigatória ("toda migração DEVE terminar com o próprio INSERT").

O ledger não falhou. A convenção foi abandonada, duas vezes, e o ledger contou a
verdade sobre o que lhe deram.

## O que fazer com cada um

**`cod_magazord`** — ou vira migração que a documenta (se alguém souber para que
serve), ou vira migração que a remove. Está vazia; remover é barato hoje e fica
mais caro a cada mês em que alguém possa começar a gravar nela.

**As três funções** — ou a 005 volta a valer em produção, ou `perfil.ts` para de
chamá-las e `page.tsx` perde a seção de recados. A segunda parece a certa: o RPC
lê uma tabela que ninguém preenche mais.

**O `error` engolido — CORRIGIDO em 25/08.** Era o defeito de classe, e o único
que não dependia de decisão de ninguém. Os três wrappers passaram a usar
`lerRpcDoPortal`, que lê `error`, registra no log o código do Postgres (42883 é
"função não existe", e o remédio é migração, não dado) e devolve `null`.

`null` e lista vazia deixaram de ser a mesma coisa: vazio é "não há recado",
`null` é "não sei se há". É a mesma regra que `cotaDaEsteira` já sustentava para
a cota, onde "não consegui ler" virava "acabou" e fechava uma parede comercial
por um erro nosso.

A tela não muda de comportamento — a seção continua escondida —, mas agora por
saber que não sabe, e com uma linha no log dizendo o que consertar.

E uma sentinela guarda a classe, não o caso: `rpcNaoEngoleErro.test.ts` varre
todo o `src` e reprova qualquer `const { data } = ... .rpc(`. Os outros 17
pontos de RPC do repositório já liam `error`; o teste é o que impede o número de
voltar a ser três.

**As catorze sem auto-registro** — decidir se a convenção da 024 vale ou não
vale. Uma convenção que catorze arquivos ignoram não é convenção, é folclore.
