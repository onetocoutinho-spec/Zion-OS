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

> ⚠️ **CORRIGIDO em 06/08 — os números abaixo estavam 8× errados.** Eu havia
> escrito "~306 MB por abertura" e "836 aberturas no mês", calculados com
> `pg_total_relation_size / n_live_tup` — que inclui índices, TOAST e espaço
> livre, e **não é o payload**. Refeito com `pg_column_size`, o dado de verdade:
>
> | tabela | linhas | dados | KB/linha |
> |---|---|---|---|
> | `anuncios_gerados` | 880 | 1.377 KB | 1,56 |
> | — **sem** o jsonb `anuncio` | 880 | 322 KB | 0,37 |
> | `produto_variantes` | 970 | 168 KB | 0,17 |
> | `imagens_produto` | 651 | 138 KB | 0,21 |
> | `produtos` | 80 | 29 KB | 0,36 |

| | por abertura da tela |
|---|---|
| Leilane, 80 produtos | **~1,7 MB** (era "5 MB") |
| empresa, 5.000 produtos | **~40 MB** (era "306 MB") |

Com 250 GB/mês no Pro isso dá **~6.400 aberturas por mês**, não 836. **O egresso
não é a parede.** O que é real a 5.000 produtos:

- **60.625 linhas de variante** atravessando a rede para calcular dois agregados
  por produto (o peso máximo e quais têm peso). É o maior pedaço dos 40 MB, e o
  mais desnecessário — o Postgres devolveria isso em poucos KB.
- **40 MB de latência** num celular, que é problema mesmo cabendo no egresso.
- **5.000 linhas no DOM**, sem virtualização.

**E metade do item E já estava feito.** `ResumoDoAnuncio` +
`COLUNAS_DO_RESUMO` existem desde 03/08, com a mesma medição (o jsonb é 76,6%
da linha), e `/cliente/produtos`, `/cliente/relatorios`, `useEstadoDaLoja` e a
importação já usam. Falta só `/cliente/anuncios`, e por um motivo específico:
a LISTA lê `anuncio.tituloOtimizado` e `anuncio.pendencias[0]` para desenhar
cada linha. Trocar sem projetar esses dois campos apagaria os dois em silêncio —
o mapeador tolera coluna ausente. `quemUsaOResumo.test.ts` guarda isso e aponta
o caminho.

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

## O produto que não precisa do Mercado Livre

*Acrescentado em 06/08, depois da pergunta do dono: "e se deixarmos para concluir
o caminho para o ML somente no final, com a cliente usando?"*

**A resposta é sim, e é melhor que a ordem original.** Existe um produto inteiro
que roda sobre dado que já está no banco, sobre os anúncios que ela **já tem no
ar**, sem escrever uma linha no ML.

### O que já está no banco e nunca chegou na tela dela

| | |
|---|---|
| infrações lidas do ML | **1.060** |
| com o remédio já escrito pelo ML | **1.028** |
| anúncios atingidos por FOTOS | **400** |
| anúncios atingidos por PQT | **327** |
| DOMAIN — a única categoria ainda crescendo (03/08) | 110, em 25 anúncios |

> ⚠️ **CORRIGIDO em 06/08: eu disse "25 anúncios pausados" e estava 5× errado.**
> Aqueles 25 são os anúncios com infração DOMAIN. O estado real vem de outro
> lugar — `anuncios_gerados.status_marketplace`, a palavra do próprio ML, lida
> em 03/08:
>
> | estado no ML | anúncios |
> |---|---|
> | `active` | 491 |
> | **`under_review`** | **155** |
> | **`paused`** | **121** |
> | `closed` | 12 |
> | `inactive` | 2 |
> | `null` — não sabemos | 99 |
>
> Cruzando estado com infração pelas regras de `diagnosticoDaVitrine`:
> **135 fora do ar · 155 em revisão · 182 no ar mas punidos · 320 sem aviso.**
>
> **472 dos 792 anúncios não estão vendendo normalmente — 60% da vitrine.**

### A leitura que só apareceu ao ler o remédio

**Quase tudo é FOTO.** "PQT" parecia ser ficha do produto — não é. O remédio de
344 das 362 é o **mesmo texto** das FOTOS:

```
motivo:  A foto de capa não cumpre os requisitos.
remédio: Corrija suas fotos: descumpre o tamanho mínimo,
         posição e proporção do produto.
```

E DOMAIN (110 infrações, 25 anúncios) diz *"Pausamos o anúncio porque ele
infringe nossas políticas — ajuste o título e/ou substitua as fotos"*.

Somando: **~1.026 das 1.060 são foto.** A loja da Leilane está penalizada por
foto, quase inteiramente.

### O que isso significa para o software

O PLANO-002 já falsificou o conserto automático de capa (o ML **apara** a faixa
branca; a regra é o produto **ocupar** o quadro). Continua valendo, e agora com
mais força: **o software não conserta quase nada disto — é trabalho de
fotógrafo.**

Mas o valor não está em consertar. Está em três coisas que ninguém sabia:

1. **Que é foto.** Os três subgrupos escondiam isso — só ler o texto do remédio
   revelou que PQT e DOMAIN são a mesma causa. Medido pela regra que ficou no
   código: **438 anúncios, 95% dos punidos.**
2. **Que 135 anúncios estão FORA DO AR agora**, e 155 em revisão. Perdendo
   venda enquanto a tela dizia só "Pausado no ML", sem o porquê.
3. **Em que ordem refazer.** Por urgência (fora do ar antes de punido) e, dentro
   dela, por quantas infrações — não por ordem alfabética.

### A peça tipada já existe

`src/modules/catalog/domain/lacunasDoProduto.ts` já é o modelo que o item A
propunha construir:

```ts
export type TipoLacunaProduto = "custo" | "peso" | "foto" | "preco";
export interface LacunaProduto {
  tipo: TipoLacunaProduto;
  rotulo: string;   // duas ou três palavras
  impede: string;   // o que isto impede
  href?: string;    // onde se resolve, JÁ COM O PRODUTO no endereço
}
```

Há **dois** sistemas de pendência no repositório: este, tipado, no nível do
**catálogo**; e `anuncio.pendencias`, prosa da IA, no nível do **anúncio**. Só o
segundo bloqueia o A10 — e só o A10 bloqueia publicar.

**Adiar o ML adia o item A junto**, que era o pré-requisito mais caro do plano.

### E o dado passa a se pagar sozinho

Na ordem original a lojista preenchia custo para alimentar um pipeline que ela
não vê. Nesta, preenche custo **para descobrir a própria margem**. Os 50 produtos
sem custo deixam de ser lição de casa e viram a pergunta dela.

---

## O plano

### I — O produto diagnóstico

*"O que está errado na minha loja e quanto está me custando."* Roda sobre dado
que já existe, sem escrever no ML:

- **Os 25 pausados**, primeiro — estão fora do ar agora.
- **As 400 com foto reprovada**, ordenadas por quanto custam (estoque parado,
  venda perdida) — a tela mostra e prioriza; quem resolve é fotógrafo.
- **Margem real**: 17 produtos em risco, e os 50 sem custo aparecendo como
  *"não sei te dizer, e é por isto"*.
- **Lacunas por produto** — `lacunasDoProduto`, que já está pronto e tipado.

**Pronto quando:** a Leilane abre o portal e vê, sem perguntar a ninguém, o que
está fora do ar, o que está penalizado e o que está dando prejuízo.

### A — Tipar a pendência do anúncio

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

*Reescrito em 06/08 depois de medir o dado em vez do disco.*

**Feito, e já estava:** a leitura estreita (`ResumoDoAnuncio`) existe e é usada
por Produtos, Relatórios, o estado da loja e a importação. `quemUsaOResumo.test.ts`
trava a regressão — trocar de volta é uma linha, e agora fica vermelho.

**O que falta, em ordem de tamanho:**

1. **As 60.625 linhas de variante.** A tela puxa todas para calcular o peso
   máximo por produto e quais têm peso. É o maior pedaço dos 40 MB. Vira um
   agregado no Postgres, e a tela passa a receber uma linha por produto.
2. **`/cliente/anuncios` ainda paga o jsonb**, porque a lista lê dois campos de
   dentro dele. Projetar `anuncio->>tituloOtimizado` e `anuncio->pendencias->>0`
   no `select` resolve — e o teste já diz isso.
3. **5.000 linhas no DOM**, sem virtualização.

**Pronto quando:** abrir `/cliente/produtos` com 5.000 produtos custa a mesma
ordem de bytes que hoje custa com 80.

> Os três precisam ser VISTOS. Cada um tem o mesmo formato de risco: o mapeador
> tolera coluna ausente, então uma leitura estreita mal feita entrega dado vazio
> com cara de dado real, sem erro nenhum. Portão verde não pega isso.

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
H  verificar as 5 fases de UX     barato, e ainda pendente
B  publicar O anúncio aprovado    a prova da cadeia, um clique
D  apagar a agência               65 arquivos, medidos; barateia tudo depois
I  o produto diagnóstico          ← A CLIENTE COMEÇA A USAR AQUI
E  volume                         bloqueia a empresa grande
F  papéis e convite               bloqueia a empresa grande
──────── a cliente usando, e a empresa grande entrando ────────
A  tipar a pendência do anúncio
C  fechar as famílias do A10
   publicar em escala
G  a tela de vocês
```

**Para a Leilane usar:** H → B → D → I. Ela passa a ver o que está fora do ar, o
que está penalizado e o que dá prejuízo — sobre a loja que ela já tem.

**Para a empresa grande entrar:** mais E e F. Nenhum dos dois é tela; os dois são
modelo.

**Depois, com ela usando:** A → C → publicar em escala.

### A distinção que sustenta esta ordem

**Adiar o ENDURECIMENTO do caminho do ML, não a PROVA.**

Existe um anúncio aprovado, nota 75, zero pendências, parado sem MLB desde
01/08. Publicar esse **um** valida a cadeia inteira ponta a ponta e custa um
clique. Publicar os 79 é o trabalho que espera.

O risco de adiar os dois juntos está registrado neste repositório: **866 testes
verdes enquanto a IA inventava SKU e cor** (PR #79), descoberto só ao rodar
contra o provedor real. Construir `esteira → A10 → publicar` por meses sem nunca
executá-la de verdade repete exatamente esse erro, em escala maior.

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
4. *"PQT é a ficha do produto."* — É foto. O nome do subgrupo enganou; só o
   **texto do remédio** desmentiu, e com ele a conclusão mudou de "três
   problemas diferentes" para "um problema, 1.026 vezes".
5. *"Tipar a pendência é construir do zero."* — `lacunasDoProduto` já é
   exatamente isso, para o catálogo. Faltava só ler o que já existe.
6. *"A tela custa 306 MB com 5.000 produtos e o egresso acaba em uma semana."*
   — custa ~40 MB e cabem ~6.400 aberturas. Usei tamanho em DISCO
   (`pg_total_relation_size`, que inclui índices e TOAST) onde precisava do
   tamanho do DADO (`pg_column_size`). Errei por 8×.
7. *"Metade do item E é trabalho novo."* — `ResumoDoAnuncio` já existia desde
   03/08, com a mesma medição que eu refiz do zero.
8. *"O diagnóstico precisa de margem real e lacunas por produto."* — as duas
   telas já existiam. Listei no plano antes de olhar.

**O padrão das oito:** três vieram de instrumento errado (disco por dado, grep
por grafo, rótulo por texto) e três de não ter lido o que já estava no
repositório. Nenhuma veio de raciocínio ruim sobre código.

**O que valeu em todas: ler o banco antes de escrever o plano** — e, na 4,
**ler o TEXTO e não o rótulo.** Nenhuma das cinco sobreviveria a uma revisão de
código, porque nenhuma é sobre código: são sobre dado.

---

## A credencial do Mercado Livre — o que foi medido em 06/08

A tela de Precificação e a de Vendas mostravam, em inglês, num box vermelho:

```
Falha ao renovar token do ML: the client_id does not match the original
```

### As duas metades do problema

**A metade que era software, e está consertada.** Nove rotas renovam token.
`/api/ml/publicar` já classificava a recusa pelo HTTP do ML (4xx = a credencial
não vale; 5xx = o ML está fora) e devolvia 409 com `motivo: "reconectar"`, que a
tela converte num caminho de saída. As outras **oito** faziam
`catch (e) { e.message }` e despejavam a prosa do ML.

Pior que a prosa: em Vendas, `pedidos` voltava vazio e a tela desenhava a loja
inteira zerada — subtítulo `"Nenhuma venda nos últimos 30 dias"`, sete cartões
de R$ 0 — sobre uma lista que **ninguém conseguiu ler**. Vazio ali significa
"não consegui perguntar", nunca "ela não vendeu". É o defeito que atravessa este
projeto, desta vez sobre o faturamento dela.

O acerto de `publicar` virou peça compartilhada
(`modules/integration/domain/credencialRecusada.ts` +
`infrastructure/renovacaoDaRota.ts`), e uma sentinela varre o diretório de
rotas: uma décima rota que renove token cai no teste no dia em que nascer.

**A metade que é credencial, e não é minha.** Medido:

| | |
|---|---|
| `ML_CLIENT_ID` em `.env.local` | `7058066068734529` |
| resposta do ML a esse par (client_id + refresh_token guardado) | recusa, às 17:23 UTC |
| `canais_marketplace.atualizado_em` | **15:50 UTC do mesmo dia** |
| a linha se moveu durante 1h54 de tentativas locais | **não** |

Só duas coisas escrevem `atualizado_em`: uma renovação **bem-sucedida** e o
callback do OAuth. Qualquer uma das duas significa o mesmo: às 15:50 **algum
ambiente conseguiu**, com um `client_id` que não é o do `.env.local`. E como
`ML_REDIRECT_URI` aponta para produção — e a rota de autorização recusa
`redirect_uri` que não seja https —, esse ambiente só pode ser o publicado.

**A leitura, dita como leitura e não como fato:** produção provavelmente está
funcionando, e quem está fora é o ambiente local. Não consegui confirmar
diretamente porque as rotas exigem sessão e eu não tenho login em produção. O
teste de dez segundos é abrir `/cliente/vendas` no site publicado: se a tela
mostrar vendas, está confirmado.

### A decisão que sobra para o dono

Não é só "copiar o client_id". Local e produção compartilham **a mesma linha**
de `canais_marketplace` no banco de produção, e o ML **rotaciona** o
refresh_token a cada renovação.

- **Alinhar `.env.local` com o app do servidor** — o local volta a falar com o
  ML, e a partir daí cada carregamento de tela em desenvolvimento **rotaciona a
  credencial viva da lojista**. Duas rotações concorrentes derrubam uma delas.
- **Deixar como está** — o local não fala com o ML, e agora diz isso em
  português com um caminho, em vez da prosa em inglês. Produção não muda.

A segunda é a mais segura enquanto houver uma lojista real na base.
