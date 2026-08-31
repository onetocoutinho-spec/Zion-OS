# INC-012 — O repositório e a produção derivaram, nos dois sentidos

```
Status:      FECHADO em 25/08 — migração 077, nos dois bancos
Detectado:   2026-08-25, comparando o staging recém-migrado com a produção
Severidade:  baixa hoje; o que preocupava era a classe, não o caso
Aberto:      nada — a convenção da 024 foi reparada pela 078 e ganhou sentinela
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

## O desfecho — migração 077, 25/08/2026

Decidido remover os dois. A [077](../../../database/migrations/077-a-coluna-sem-migracao-e-as-funcoes-sem-tabela.sql)
apaga `produtos.cod_magazord` e as três funções, e foi aplicada **nos dois
bancos**. Ela recusa se a coluna tiver ganhado valor desde a medição, confere o
próprio efeito, e confere também que o resto do portal continuou de pé —
`portal_margem_minima` sumir junto seria a loja perder margem e custos.

O código saiu no mesmo commit: `perfil.ts` perdeu os três wrappers e os três
tipos, `cliente/page.tsx` perdeu a seção "Recados". Ela não estava condicional;
estava morta e *parecia* condicional.

**A prova de que os dois bancos convergiram:** o md5 do esquema — nome de cada
coluna por tabela, mais assinatura de cada função — é **idêntico** nos dois, com
52 tabelas cada (fora o `environment_metadata`, que é o marcador do staging).

```
colunas   b8acf288b759bfc8814a4508bdd03c88
funcoes   f0437304ed3d01f98ed54c16a5b1d84f
```

E a 077 honra a convenção da 024: registra a si mesma.

## O que sobrou aberto


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

## As catorze sem auto-registro — reparadas pela 078

Decidido que a convenção vale. A
[078](../../../database/migrations/078-o-ledger-recupera-as-catorze.sql) registra
035–042 e 071–076 por **baseline com evidência**: cada linha só entra se o
artefato dela existir naquele banco, e onde não existe a ausência continua
significando "não aplicada".

Os catorze arquivos NÃO foram alterados. A regra é da própria 024, escrita
quando ela registrou 001–016: *"migrações anteriores são DOCUMENTOS HISTÓRICOS —
não são alteradas retroativamente"*. Editá-los faria os arquivos mentirem sobre
o que rodou naquele dia, e não consertaria banco nenhum — arquivo não roda
sozinho.

Duas evidências (040 e 072) são CHECKs que migrações posteriores reescrevem
mantendo o valor: provam que o EFEITO está presente, não que aquele arquivo
específico rodou. Está dito na migração e aqui, para ninguém ler mais do que
está escrito. É a mesma limitação do baseline da 024.

Resultado nos dois bancos, medido depois de aplicar:

```
76 linhas no ledger · última 078 · nenhum número sem linha
```

(017–021 não existem como arquivo; 001b é seed de demonstração e a 024 decidiu
não registrá-la.)

**E a décima quinta não acontece.** `scripts/migracaoSeRegistra.test.ts` reprova
qualquer migração ≥ 024 sem o próprio INSERT. A lista de históricas é congelada
em catorze e só pode encolher — um terceiro teste prova que ela é EXATAMENTE o
conjunto de arquivos que não se registram, então ela não pode isentar um arquivo
novo em silêncio.

