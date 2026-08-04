# Relatório — quem escreve no catálogo

```
Pedido:    HANDOFF-2026-08-04 §8.2 — "ler quem escreve, antes de restringir"
Varrido:   produtos · produto_variantes · anuncios_gerados · imagens_produto
Base:      master 9d1ee78 · nenhuma migração aplicada · nenhum dado alterado
Achado:    um QUINTO caminho capaz de criar a segunda capa — consertado aqui
Gate:      typecheck · typecheck:test · eslint 0 erros · 2409 testes (eram 2398)
```

> A pergunta que motivou a varredura tem resposta na §4: **a 053 ainda não pode
> voltar** — mas por um motivo diferente do que a derrubou, e que estava
> invisível até esta leitura.

---

## 1 · Por que esta varredura existe

A migração 053 passou um DoD de cinco linhas e quebrou três caminhos de upload
em produção. A lição registrada em `2026-08-04-053-uma-capa-report.md` §7 foi de
método, e ela pedia um trabalho concreto que ainda não tinha sido feito:

> Uma restrição não muda só o banco. Ela muda todo caminho que escrevia contando
> com a ausência dela — e esses caminhos **não estão no schema**.

Então este documento é a lista desses caminhos. Ele não propõe restrição nenhuma:
ele é o que precisa existir **antes** de qualquer proposta.

---

## 2 · O quinto caminho — o achado que virou código

A §7 do relatório da 053 catalogou **quatro** caminhos de upload e consertou os
quatro. Existia um quinto, e ele sobreviveu à correção inteira porque não passa
por `uploadImagemProduto`:

```
src/components/produtos/AbaImagens.tsx  →  criarImagem(...)  →  insert cru
```

É a aba "Imagens" da tela do operador (`/produtos/[id]`), que registra foto por
URL em vez de subir arquivo. Ela montava o payload à mão, com:

```tsx
const [tipo, setTipo] = useState<ImagemProduto["tipoImagem"]>("Principal");
```

O `Select` abre em **"Principal"** — é o primeiro item de `TIPO_IMAGEM` e o valor
inicial do estado. O caminho mais provável desta tela (colar a URL, clicar
"Adicionar imagem") pedia a capa **sem que ninguém tivesse decidido isso**.

É o mesmo defeito de `tipo ?? "Principal"`, na mesma família, escrito de outro
jeito: **a ausência de opinião significando "esta é a capa"**.

### Por que ele escapou

A correção de 04/08 tratou a regra, e tratou bem — `papelDaImagem.ts` é puro,
testado, e a propriedade *"a saída nunca é uma segunda capa"* está provada para
qualquer entrada. O que não existia era qualquer coisa ligando **a regra aos
chamadores**. Um teste de domínio prova que a função está certa; ele não prova
que alguém a chama.

### Um segundo achado, na mesma leitura

`/cliente/imagens` tinha a coreografia de troca de capa **reescrita dentro da
tela** (`tornarCapa`). A ordem estava certa — rebaixava antes —, mas:

| | |
|---|---|
| lia a capa atual de `imagens` (estado do React) | podia estar velho |
| não desfazia | falha depois do rebaixamento ⇒ **produto sem capa nenhuma** |

Produto sem capa não publica. É pior que ter duas.

### O que foi feito

| | |
|---|---|
| `mesmoEscopoDeCapa` | o escopo `(produto, variante)` do índice, agora em TypeScript |
| `registrarImagemPorUrl` | porta com regra para registrar foto por URL |
| `comCapaRebaixada` | a coreografia da troca, em **um** lugar |
| `promoverACapa` | promover foto da galeria, com desfazer |
| `AbaImagens` | passou a usar a porta com regra |
| `/cliente/imagens` | `tornarCapa` delega; a cópia saiu da tela |
| `trocarCapaDoProduto` | passou a usar `comCapaRebaixada` (a coreografia era a 2ª cópia) |

**11 testes novos.** Um deles é estrutural e é o que faltava:

```
nenhuma TELA importa `criarImagem` — o insert cru não tem porta na UI
```

Ele foi **conferido nas duas direções**, porque em 04/08 dois testes acusaram
inocentes: roda contra o código de antes e reprova nomeando
`AbaImagens.tsx`; e um teste-irmão verifica que o padrão casa em código real,
**não** casa em prosa de comentário, e não confunde `criarImagensBulk`.

---

## 3 · `imagens_produto` — o mapa completo

| caminho | papel vem de | sob o índice 053 |
|---|---|---|
| `uploadImagemProduto` | `papelDaFotoNova` | ✅ |
| `trocarCapaDoProduto` (Estúdio IA, "melhorar") | `comCapaRebaixada` | ✅ |
| `registrarImagemPorUrl` ← `AbaImagens` | `papelDaFotoNova` | ✅ **era o defeito** |
| `promoverACapa` ← `/cliente/imagens` | `comCapaRebaixada` | ✅ **era frágil** |
| `criarImagensBulk` ← importação do ML | `i === 0`, só em produto **novo** | ✅ |
| `atualizarImagem` ← "tirar do envio" | só mexe em `status` | ✅ |
| `criarImagem` | **nenhum** — primitiva crua | sem chamador de tela |

O caminho da importação (`importarAnunciosML.ts:957`) é seguro por uma guarda
que é fácil perder de vista: `if (casados[gi]) return`. Só produtos
**recém-criados** ganham foto, e um produto recém-criado não tem capa. O
comentário ao lado dele justifica a decisão pela *ausência* do índice — a
justificativa envelheceu, a decisão não: ela continua certa pelo outro motivo
citado ali (o defeito de cor).

---

## 4 · A 053 pode voltar? — ainda não, e o motivo mudou

A regra registrada é `código em produção → restrição`. O código agora está
correto nos sete caminhos acima. **Mesmo assim a resposta é não**, por uma coisa
que só apareceu nesta leitura:

O índice chaveia por `(produto_id, coalesce(variante_id, <uuid zero>))`. A única
tela que **preenche** `variante_id` é justamente a `AbaImagens` — ela tem um
`Select` de variação. Hoje isso é inofensivo: `variante_id` está vazio nas 653
linhas. Mas a regra em código ignorava a variante por completo, e o índice não.

Por isso o escopo virou uma função (`mesmoEscopoDeCapa`) em vez de ficar
implícito: **é a chave do índice escrita em TypeScript**, para que os dois lados
não possam divergir calados. É exatamente a divergência que custou 04/08.

O que falta, e não é código:

1. **Medir de novo em produção.** O snapshot da §1 do relatório da 053 ("0
   produtos com 2+ Principais") é de **antes** do dia inteiro de uploads. Reaplicar
   sem remedir repete o erro de confiar num número velho.
2. **Decidir o DES-003** (HANDOFF §6). Se `variante_id` vai ser preenchido, o
   índice muda de significado sozinho — e é bom que mude, mas isso deve ser
   escolha, não surpresa.
3. **Exercer os quatro caminhos com sessão real.** Nenhum dos consertos de hoje
   (nem os de 04/08) falou com o banco de produção. O gate prova a lógica; ele
   não prova a fiação.

---

## 5 · `produtos` — só quatro pontos físicos de escrita

| ponto | onde | quem |
|---|---|---|
| repositório genérico | `lib/repositorio.ts` via `services/produtos.ts` | telas, importações |
| insert admin | `criacaoDeProduto.ts:126` | cadastro pelo chat (Proposal confirmada) |
| RPC | `copilot_executar_custo` (046), `copilot_executar_preco` (047) | chat, atômico |
| **código morto** | `proposta/route.ts:576`, `precificacaoDoCopilot.ts:337` | **ninguém** |

**Nenhuma ferramenta do assistente escreve em `produtos` diretamente.** A
invariante do chat continua de pé: o caminho é sempre proposta persistida →
confirmação → RPC.

Ausências das quais o código **depende** — cada uma é uma restrição que
alguém poderia querer criar, e não deve sem ler isto antes:

| | por que não pode ser criada de leve |
|---|---|
| **sem UNIQUE em `sku` / `cod_erp` / `nome`** | a dedup é toda em JS (`casarComProdutoExistente`), e a base tem **117 SKUs repetidos**. Um UNIQUE derrubaria inserts em lote de 500 **inteiros**, e o retry×6 repetiria o erro |
| **sem CHECK nos enums textuais** | `status_*`, `prioridade`, `marketplace` recebem string livre de planilha; a normalização é app-level |
| **`margem` / `preco_minimo` nullable** | `null` = "não sei"; `0` afirmaria "sem margem". Vários caminhos usam `?? undefined` **para não escrever** |
| **`vendedor_paga_frete` nullable** | `null` = "não se sabe", e o cálculo assume que o vendedor paga |
| **upsert proibido de fato** | o upsert valida `NOT NULL` na linha *proposta*: `{id, custo}` morre mesmo com a linha existindo. Foi assim que "a importação de custos de 1.806 produtos gravou 1" |

---

## 6 · `produto_variantes` e `anuncios_gerados`

Mapeados por inteiro (13 caminhos em `produto_variantes`, 14 em
`anuncios_gerados`). O que importa para uma decisão:

- **`status_marketplace` tem exatamente 5 escritores**, e a invariante se
  sustenta em todos: **nunca existe `?? "active"`**. Ausência de estado fica
  `NULL` e a tela diz *"Estado desconhecido"*, nunca "no ar". Essa é a
  invariante mais bem cuidada do sistema — é a que impede o Zion de afirmar ao
  lojista algo que o ML não disse.
- **`variante_id` não existe em nenhuma das duas tabelas.** A associação
  foto↔cor que resolveria as 110 infrações `DOMAIN` não tem coluna em
  `anuncios_gerados`: hoje ela vive em `observacoes` como texto livre
  (`observacoes: a.mlb`). Confirma a §6.2 do handoff — não está desenhada em
  lugar nenhum.
- **Assimetria real no peso**: o caminho da proposta protege o que já está
  preenchido (`peso <= 0` como predicado, dentro do UPDATE). A tela
  `/cliente/peso` e a planilha **sobrescrevem qualquer peso**. É o INC-002,
  fechado em um caminho e aberto nos outros dois.

---

## 7 · O padrão que atravessa as três tabelas: `observacoes`

Este é o achado com maior alcance, e **não foi consertado** — ver §9.

`observacoes` é `text DEFAULT ''` em todas as tabelas, e acumulou **cinco
significados incompatíveis**: sentinela de origem, motivo de rejeição, log de
falha de publicação, proveniência de irmão de família, marcação de tela. Em
`produto_variantes` ela ainda guarda o **MLB**.

E ela é usada como **chave de DELETE em massa**:

```sql
delete from anuncios_gerados where cliente_id = ? and observacoes ilike 'Importado do %'
delete from produtos          where cliente_id = ? and observacoes ilike 'Importado do %'
```

Ao mesmo tempo, `rejeitarAnuncioGerado` faz `observacoes: motivo` —
**sobrescreve**, não concatena. Verificado nos dois lados
(`anunciosGerados.ts:156` e `:259`).

**A consequência, por leitura:** um anúncio importado do ML que passe por
"Refazer" (botão do portal), por rejeição na revisão, ou por migração de anúncio
perde a sentinela. Numa reimportação em modo `"substituir"`, ele **não é
apagado** — mas o produto dele é (a `observacoes` do produto não foi tocada), e
`anuncios_gerados.produto_id` é `ON DELETE SET NULL`. O anúncio sobrevive órfão,
e a importação recria o registro.

**O que eu NÃO estou afirmando:** que isso já aconteceu. Existe um órfão real
consertado em 02/08 (`database/manutencao/2026-08-02-orfao-da-familia-papete.sql`),
e **a causa dele foi outra** — `family_name` que não bate com o nome do produto.
Li o script inteiro antes de escrever esta frase, justamente para não empilhar
uma evidência que não existe.

O conserto certo é uma coluna `origem`, não um remendo no texto. É migração, e
migração agora tem uma ordem a respeitar.

---

## 8 · Onde a mesma regra ainda está escrita mais de uma vez

O handoff pediu isto literalmente. Além das duas cópias da capa (§2, fechadas):

| regra | cópias | risco |
|---|---|---|
| conversão peso g→kg + "não sobrescrever" | TS (`proposta/route.ts`) **e** SQL (migração 045) | o TS está inalcançável hoje e serve de fallback: se a fiação mudar, ele grava **com regra diferente** |
| "qual custo é confiável" | `importacaoCustos` escreve `preco_minimo`; `definirCustoEscolhido` **deliberadamente não** | divergência documentada e intencional, mas invisível de fora |
| dedup de importação | `casarComProdutoExistente` (nome) **e** `construirAgrupado` (`codErp \|\| nome \|\| sku`) | dois critérios de identidade para a mesma pergunta |

**Funções órfãs que ainda gravam se alguém as chamar** — todas com cliente
`admin`, todas sem o lock transacional das RPCs que as substituíram:
`aplicarTitulo`, `aplicarPreco`, `excluirAnuncioGerado`, `arquivarVariante`,
`correcaoPeloChat.executarProposta`.

---

## 9 · O que NÃO foi feito, e por quê

| | por quê |
|---|---|
| **reaplicar a 053** | §4: falta remedir produção e falta a decisão do DES-003. E a ordem `código → restrição` exige o conserto **no ar**, não só no gate |
| **coluna `origem`** (§7) | é migração, e é decisão de desenho — não se cria restrição no dia em que se descobre o problema |
| **escopo por variante em produção** | `mesmoEscopoDeCapa` alinha o código ao índice **sem mudar comportamento hoje** (653 linhas com `variante_id` vazio). Onde a foto por cor mora continua sendo decisão do dono (handoff §6.2) |
| **remover as órfãs** (§8) | apagar código que ninguém chama é seguro; fazê-lo no mesmo commit de um conserto de invariante não é |
| **INC-002 nos dois caminhos abertos** (§6) | é mudança de comportamento para a lojista — precisa de decisão, não de conserto |

---

## 10 · Ordem sugerida

1. **Exercer os quatro caminhos de imagem com sessão real.** O gate prova a
   lógica; ele não prova a fiação. Isso vale para os consertos de hoje **e** para
   os de 04/08, que também nunca falaram com produção.
2. **Remedir `imagens_produto`** antes de qualquer conversa sobre a 053: quantos
   produtos têm 2+ `Principal` **hoje**, depois de um dia inteiro de uploads.
3. **Decidir o DES-003** (handoff §6) — continua travando o desenho.
4. **Decidir sobre `origem`** (§7), que é o mesmo defeito de fundo do dia: um
   invariante que existe, importa, e não pode ser lido em lugar nenhum.
