# PLANO-003 — Pronto para a Leilane e pronto para a empresa grande

```
Data:      2026-08-06
Substitui: nada. Continua PLANO-002 com dois cenários em vez de um.
Base:      leitura do banco de produção (ouynursknlgtmewcdjzr), grafo de
           importações do repositório, e as 5 fases de UX de 05–06/08.
```

O PLANO-002 planejou para **uma** loja. Este planeja para **duas situações**: a
Leilane, que existe, e uma empresa grande, que chega. Elas não pedem coisas
diferentes — pedem a **mesma** coisa em ordens diferentes, e é isso que o
documento separa.

Tudo aqui está medido. Onde é estimativa, está dito.

---

## Os números, lidos hoje

### Inquilinos

| | |
|---|---|
| lojistas | 1 |
| usuários com papel `cliente` | 1 |
| usuários com papel `equipe` | 2 |
| canais de marketplace ativos | 1 |
| produtos | 80 |
| variantes | 970 |
| produtos com custo | **30 de 80** |

### O funil, de 90 anúncios que a esteira gerou

| estado | qtd | com MLB | nota | pendências |
|---|---|---|---|---|
| rascunho · reprovado no A10 | **79** | 0 | 35,5 | 8,3 |
| rejeitado · reprovado | 8 | 0 | 44,4 | 4,9 |
| rejeitado · aprovado | 2 | 2 | — | 0 |
| **aprovado · aprovado** | **1** | **0** | **75** | **0** |

Os 790 marcados `publicado` com MLB têm nota 0,2 e zero pendências: são os
anúncios **importados** do ML, não saíram da esteira. O campo `origem` diz
"esteira" para eles — rótulo errado, e vale corrigir para a métrica não mentir.

**Dois fatos que o funil revela:**

1. **A esteira funciona.** Produziu um anúncio aprovado, nota 75, zero
   pendências. Ele está parado, sem MLB, desde 01/08.
2. **Produziu um em noventa.**

---

## A descoberta que reordena o plano

As 658 pendências dos 79 rascunhos se distribuem assim:

| família | ocorrências | % |
|---|---|---|
| grade de variações | 231 | 35,1 |
| resto | 169 | 25,7 |
| atributo de categoria do ML | 134 | 20,4 |
| custo | 68 | 10,3 |
| medidas | 56 | 8,5 |

Mas o número que decide o plano é outro: **177 textos distintos em 279
ocorrências** dentro do balde "resto".

**A pendência é prosa escrita pela IA, não dado tipado.** "Ano de lançamento"
aparece em cinco grafias:

```
⚠️ informação necessária: Ano de lançamento           20×
⚠️ informação necessária: ano de lançamento           15×
⚠️ informação necessária: Ano de lançamento do produto. 9×
⚠️ informação necessária: ano_lancamento               3×
⚠️ informação necessária: Ano de lançamento.           3×
```

Cinquenta ocorrências da mesma coisa, e o sistema não sabe que são a mesma
coisa.

### As três consequências

1. **Missões não podem ser construídas em cima disso.** Uma Missão precisa
   saber *o que falta*, *em qual produto* e *para qual tela levar*. Com 177
   strings livres não há destino, não há agrupamento, não há lote.
2. **Não há medida de progresso.** "Faltam 8,3 pendências" não diz se a lojista
   está perto ou longe, nem o que resolveria mais de uma vez.
3. **Boa parte não é pergunta para a lojista.** "Ano de lançamento", "material
   do solado", "altura do salto", "tipo de fechamento" são **atributos de
   categoria do Mercado Livre** — 20,4% do total. O ML publica o que cada
   categoria exige, e `produto_atributos` e `categoria_templates` já existem no
   banco. Pedir isso à lojista, produto a produto, é perguntar à entidade
   errada.

> **O gargalo não é esforço da lojista. É o sistema pedindo em prosa o que ele
> poderia tipar ou consultar.**

---

## A parede da empresa grande

Não é disco, não é teto de leitura, e as duas suposições anteriores caíram:

- **Disco (Supabase Pro, 8 GB).** Medido: 70 KB por produto. Uma empresa com
  5.000 produtos ocupa 344 MB — **4,2%**. Cabem ~1.489 lojistas do tamanho da
  Leilane. *(No plano Free eram 69% e ~90 lojistas; a migração para Pro já
  aconteceu e derrubou esta parede.)*
- **Teto de leitura.** `src/lib/repositorio.ts` **já pagina**: `PAGINA = 1000`,
  `TETO_PAGINAS = 200` — 200 mil linhas. Não trunca em 1.000, como eu havia
  suspeitado.

A parede real é **o portal ler tabelas inteiras para o navegador**. A tela
`/cliente/produtos` faz cinco leituras de tabela completa (`produtos`,
`anuncios_gerados`, `auditorias`, `produto_variantes`, `imagens_produto`) e
filtra em JavaScript.

| | por abertura da tela |
|---|---|
| Leilane, 80 produtos | **~5 MB** |
| empresa, 1.000 produtos | ~61 MB |
| empresa, 5.000 produtos | **~306 MB** |

Com 250 GB/mês de egresso no Pro, 5.000 produtos dão **836 aberturas dessa tela
no mês inteiro**. Cinco pessoas usando normalmente estouram em uma semana.

> Estimativa por tamanho em disco (`pg_total_relation_size / n_live_tup`), que
> inclui índices — é ordem de grandeza, não byte exato. Para o número exato,
> medir a aba de rede com a tela aberta. A ordem de grandeza basta para
> concluir: **não escala como está.**

Restam duas paredes que nenhum painel resolve:

- **A cota do ML é por aplicação.** Operação em massa da empresa grande toma 429
  e derruba a Leilane junto.
- **Uma chave de IA** para todos os inquilinos.

---

## O que a empresa grande pede e a Leilane não

Uma diferença de **modelo**, não de tela:

- Só existem dois papéis no sistema inteiro: `equipe` e `cliente`. Todo mundo
  da mesma conta tem poder idêntico — mudar preço, publicar no ML, desconectar
  o canal, renomear a loja.
- E a empresa **não consegue adicionar as próprias pessoas**: convidar usuário é
  `/api/usuarios`, que exige `exigirEquipe`. Para o cliente crescer o time,
  alguém da Zion precisa agir. **É a sétima parede** — a mesma classe que
  28/07 derrubou.

O schema aguenta N pessoas por conta (`perfis.cliente_id`); o que falta é papel
dentro da organização e convite pelo próprio cliente, com o RLS acompanhando.

---

## O plano

### A — Tipar a pendência

**Pré-requisito de tudo.** Pendência deixa de ser string e passa a ter tipo,
campo alvo, produto e tela de destino. Converte 177 frases em ~8 tipos.

Sem isto: sem Missões, sem lote, sem medida de progresso, e regerar os 79
rascunhos produz as mesmas 177 frases.

**Pronto quando:** as pendências dos 79 rascunhos são contáveis por tipo, e cada
tipo sabe para qual tela leva.

### B — Publicar o que já passou

Um anúncio, aprovado, nota 75, zero pendências, parado desde 01/08. Publicar e
ver o caminho inteiro funcionar ponta a ponta é a validação mais barata que
existe neste repositório.

**Pronto quando:** esse anúncio tem MLB e a lojista viu acontecer.

### C — Fechar as famílias, na ordem do volume

Com a pendência tipada, cada família vira trabalho conhecido:

| família | % | quem resolve |
|---|---|---|
| grade de variações | 35 | o cadastro (`publication/domain/variacoesDoAnuncio`) |
| atributo de categoria | 20 | **o sistema**, consultando o ML — não a lojista |
| custo | 10 | tela de Precificação, que já edita |
| medidas | 8,5 | tela de Medidas, que já existe |

Só o que sobrar depois disso vira Missão para a lojista.

### D — Apagar a agência

Medido no grafo de importações: **38 páginas, 65 arquivos morrem, 132 ficam,
zero rotas de `/api`**. A API já é a espinha compartilhada; a agência é só UI
por cima.

Três cuidados, que não são varrer:

1. `src/lib/store.ts` importa `precificacaoVariantes` e `anuncioVariantes`, que
   morrem. O store é compartilhado — editar, não deletar. *(Conferido: o portal
   usa `produtoVariantes.listarTodasVariantes`.)*
2. `src/capabilities/pendencias/*` fica órfã — consumidor único é
   `/app/pendencias/page.tsx`. É decisão de governança sob PLAYBOOK-001, não
   faxina.
3. `/api/ml/diagnostico-guias` não é chamada por ninguém, e o próprio comentário
   dela diz *"Depois de rodar UMA vez em produção, apague este arquivo"*.

Depois disto, toda mudança compartilhada custa metade da conferência.

### E — Volume, antes da empresa grande entrar

Parar de ler tabela inteira no navegador. É o único item que **bloqueia** a
empresa grande — com 5.000 produtos a tela não abre em tempo aceitável e o
egresso do mês acaba em uma semana.

**Pronto quando:** abrir `/cliente/produtos` com 5.000 produtos custa a mesma
ordem de bytes que hoje custa com 80.

### F — Papéis e convite dentro da conta

Dono / operador / leitor, convite pelo próprio cliente, RLS acompanhando. É o
que destrava "empresa grande" como organização, e derruba a sétima parede.

### G — A tela de vocês — uma, não quatro

Ver-como-a-lojista-vê (pendência nº 1 de `docs/agency-panel-separation`, nunca
feita) mais saúde no mesmo lugar: canal do ML, erros na fila, infrações
abertas, rascunhos parados. Contas, Uso e Inteligência viram telas na terceira
conta, não antes.

### H — Verificar as 5 fases de UX com sessão real

Contraste, foco, movimento, foco preso, anúncios por leitor de tela, esqueleto,
tabela em cartão, barra inferior. Portão verde e build passando não provam que
o app funciona — a lição já está registrada.

---

## A ordem, e por quê

```
H  verificar UX          (barato, e destrava confiança no que já foi feito)
B  publicar o aprovado   (prova o caminho inteiro, hoje)
A  tipar a pendência     (pré-requisito de C e das Missões)
D  apagar a agência      (independente; barateia tudo que vem depois)
C  fechar as famílias    (o funil passa a terminar)
E  volume                (bloqueia a empresa grande)
F  papéis e convite      (destrava a empresa grande como organização)
G  a tela de vocês       (suporte deixa de ser adivinhação)
```

**Para a Leilane usar hoje:** H → B → A → C. Ao fim disso o funil termina, que
é a definição de "pronto" já acordada — *a lojista opera sozinha*.

**Para a empresa grande entrar:** o mesmo, mais E e F. Nenhum dos dois é tela;
os dois são modelo.

---

## O que NÃO construir

- **Cobrança.** Fora do caminho crítico por decisão de 03/08.
- **Métrica agregada, coorte, funil de aquisição.** Com uma conta, gráfico é
  enfeite.
- **Contas / Uso / Inteligência como telas separadas.** Na terceira conta.
- **Modo "visualizar como cliente" com troca de papel real.** Contexto
  `view-as` com `clienteId` explícito e tarja permanente — nunca mudar o papel
  de quem está logado.

---

## A lição deste plano

Três suposições minhas caíram contra o banco, e todas eram plausíveis:

1. *"Os 79 rascunhos precisam ser regerados."* — Precisam, mas regerar antes de
   tipar a pendência produz as mesmas 177 frases.
2. *"O portal trunca a leitura em 1.000 linhas."* — Não trunca; `repositorio.ts`
   pagina até 200 mil.
3. *"A parede da empresa grande é disco."* — No Pro é 4,2%. A parede é o portal
   ler tabela inteira para o navegador.

**O que valeu em todas: ler o banco antes de escrever o plano.** As três
suposições sobreviveriam a qualquer revisão de código, porque nenhuma delas é
sobre código — são sobre dado.
