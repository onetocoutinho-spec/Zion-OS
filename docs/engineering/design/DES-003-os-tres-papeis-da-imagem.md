# DES-003 — Os três papéis da imagem

```
Estado:   DESENHO — nada implementado
Data:     2026-08-01
Decisão:  do dono do produto — o SaaS gera imagem para QUALQUER tipo de produto
Depende:  DES-002 (atributos do ML) só para o contexto do prompt
```

## Por que existe

> *"De que vale o cliente criar todo o anúncio dele no nosso SaaS e não conseguir
> gerar imagem aqui?"*

Um lojista que monta o anúncio inteiro aqui e sai para fazer imagem em outro
lugar não tem um fluxo — tem uma interrupção. Isso contradiz a tese de zero toque
de 28/07, em que o cliente entra, opera e se mantém sozinho.

E há um segundo motivo, medido: **595 fotos, 73 produtos, e só DOIS rótulos** —
`Principal` (73) e `Secundária` (522). Média de 8,2 fotos por produto. As vistas
que um bom anúncio pede provavelmente **já estão lá dentro**; o que não existe é
saber qual é qual.

## Os três papéis

Não descrevem um sapato. Descrevem **o que a compradora precisa decidir**:

| papel | a pergunta que responde | posição no anúncio |
|---|---|---|
| **Apresentação** | "o que é isto?" | capa — fundo branco, sem texto (regra do ML) |
| **Detalhes** | "como é de perto?" | meio |
| **Contexto de uso** | "como fica comigo?" | depois |

Serve para chinelo, liquidificador, vestido e cadeira sem um `if` de categoria.
É a diferença entre um padrão de produto e um padrão de calçado disfarçado.

## A regra que separa transformar de inventar

> **A IA transforma uma foto do produto. Não cria uma vista que ninguém
> fotografou.**

Para um chinelo é o solado. Para um liquidificador é a lâmina. Para um vestido é
o caimento nas costas. Se nenhuma foto mostra, o modelo **preenche** — e a
compradora recebe outra coisa.

É a mesma frase de três incidentes de 2026-08-01: *campo obrigatório sem fonte
tem uma saída só*. SKU inventado (PR #79), pendência inventada (DES-001),
obrigatoriedade inventada (DES-001 D5). Uma vista inventada é a versão que o
comprador vê.

Aplicada aos três papéis:

| papel | fonte | dá sempre? |
|---|---|---|
| **Apresentação** | transforma a foto existente: fundo, recorte, enquadramento | **sim** — 73/73 têm Principal |
| **Contexto de uso** | compõe a cena com o produto real preservado | **sim** |
| **Detalhes** | exige que **alguma** foto mostre aquele detalhe | **condicional** |

Dois dos três são derivação. Só o terceiro depende de existir fonte — e é por
isso que a regra restringe menos do que parece.

### A recusa é um pedido, não um beco

> *"Não tenho foto do solado deste produto. Me mande uma e eu limpo o fundo e
> enquadro."*

Vira Missão. E é melhor que gerar: ela descobre **o que fotografar** em vez de
descobrir pela reclamação.

## Lifestyle: autorizado, com limite

Decisão do dono do produto em 2026-08-01: **pode gerar contexto de uso.**

É o único papel em que o modelo compõe algo que não aconteceu — um pé que não é
de ninguém, num chinelo real. No varejo isso é comum e aceito. O limite é o
mesmo dos outros: **o produto não muda.** Cor, forma, material e detalhes reais
são preservados; muda a cena em volta.

## O que já existe, e o que muda

O gerador **já é agnóstico de categoria**: recebe `imagemUrl`, `produtoNome` e
`beneficios`, e monta o prompt no servidor. Não há nada de calçado nele. O que
está preso são os dois tipos fixos.

### D1 — de dois tipos para três papéis

`TipoGeracao = "melhorar" | "infografico"` vira os três papéis. `montarPrompt`
ganha um ramo por papel, com o mesmo núcleo que já funciona hoje:

> *"NÃO altere cor, forma, material ou detalhes reais do produto."*

Essa frase é a regra escrita em prompt, e ela permanece nos três.

### D2 — o prompt recebe o produto, não só o nome

Hoje vai `produtoNome` e `beneficios` (texto livre). Passa a ir o produto: nome,
categoria e os **atributos** — material, palmilha, solado — que o DES-002 traz
do ML.

É isso que faz o mesmo código servir chinelo e liquidificador. E é isso que dá
ao infográfico algo **verdadeiro** para afirmar: hoje ele cai no default
*"conforto, qualidade e bom custo-benefício"*, que não é sobre produto nenhum.

### D3 — o infográfico só afirma o que está no cadastro

Texto em imagem é afirmação ao comprador. Um título errado se corrige em dez
segundos; um infográfico que diz "Palmilha em EVA" e não é vira reclamação, e já
foi baixado.

Então: **o texto do infográfico vem dos atributos, nunca de frase livre do
modelo.** Sem atributo, sem afirmação — o infográfico sai só com o produto e a
medida, ou não sai.

### D4 — classificar vem antes de gerar

595 fotos em dois rótulos. Classificar o que existe nos três papéis é **leitura**
— uma afirmação conferível olhando —, e resolve a maioria dos casos sem gerar
nada. Errar a classificação custa uma ordenação; errar uma geração custa um
produto falso.

Só depois de classificar dá para dizer, por produto, **qual papel está vazio** —
e é essa lista que alimenta a geração e as Missões de fotografia.

### D5 — toda geração é proposta

Cartão que nomeia o alvo, mostra o que vai ser afirmado, e espera confirmação.
Nunca aplicada sozinha, nunca em lote silencioso.

Não é zelo: é o teto que as 16 ferramentas do Copilot respeitam — `le`,
`rascunha`, `propoe`, e **nenhuma** `escreve`. Uma imagem publicada por conta
própria seria a primeira exceção, e a mais visível.

### D6 — a procedência continua marcada

`salvarImagemGerada` já grava `ia-<papel>-<timestamp>` no nome e *"Gerada por IA
(a partir da foto real)"* nas observações. **Isso permanece**, com o papel no
lugar do tipo.

## Um risco a conferir antes de qualquer lote

`tipo: "melhorar"` salva como `tipo_imagem: "Principal"`. Gerar apresentação em
lote para 73 produtos criaria 73 novas "Principais", e cada produto passaria a
ter duas. **Não está lido se algo impede** — e isso é pré-requisito de qualquer
geração em massa, não detalhe de implementação.

## Como se mede que funcionou

| | antes | esperado |
|---|---|---|
| rótulos de imagem | 2 | 3 papéis, com os 595 classificados |
| produtos com os 3 papéis | desconhecido | medido, e o vazio nomeado |
| infográficos | 0 | > 0, e cada afirmação rastreável a um atributo |
| fotos reais alteradas | — | **nenhuma** — geração só acrescenta |

A última linha é a que importa: gerar **nunca** substitui a foto original.

## O que este desenho NÃO faz

- **Não publica** e não mexe na parede da republicação.
- **Não gera vista que ninguém fotografou** — vira Missão.
- **Não escreve texto de infográfico sem fonte** — ver D3.
- **Não decide sozinho.** Ver D5.
