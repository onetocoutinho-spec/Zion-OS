# AUD-005 — O caminho da loja sozinha, medido no código

```
Data:    2026-08-25
Base:    branch feat/portal-da-lojista (621 arquivos, +57.336 linhas sobre master)
Origem:  a intenção confirmada em docs/intent/zion-os.md — "uma loja assina e opera sozinha"
Método:  leitura do código, passo a passo do caminho. Nada foi executado.
```

O destino declarado é uma loja nova assinar, importar a base e publicar **sem
ninguém da Zion em nenhum passo**. Este documento percorre esse caminho contra o
código e marca cada passo com uma de três coisas: **roda sozinho**, **existe mas
espera um humano**, **não existe**.

A lista das seis travas que originou esta auditoria veio de memória. **Duas
estavam erradas e apareceram duas que ninguém tinha listado.**

---

## O quadro

| # | Passo | Marca | Onde |
|---|---|---|---|
| 1 | Assinar | **meio** | cadastro roda sozinho; cobrança é zero linha |
| 2 | Provisionar | roda sozinho | `api/loja/provisionar` |
| 3 | Importar base | roda sozinho, **com defeito mudo** — ver adendo | `ImportarProdutos` / `ConferirCatalogo` |
| 4 | Imagens | roda sozinho | `api/imagens/gerar` + `/aprovar` |
| 5 | Descrições | roda sozinho | agentes A0–A12 + `jornada.ts` |
| 6 | Atributos | **espera um humano** | `catalogo.ts` — o Benchmark pede concorrentes |
| 7 | Publicar | roda sozinho | `PublicarAnuncio` + `api/ml/publicar` |
| 8 | Acompanhar | roda sozinho | `api/ml/vendas` → `/cliente/vendas` |

---

## 1 · Assinar — a porta está aberta, falta a catraca

O cadastro existe inteiro e não passa por ninguém:

1. `supabase.auth.signUp` **no navegador**, de propósito (`AuthGate.tsx:69`);
2. sessão sem perfil cai na tela "Vamos montar sua loja" (`AuthGate.tsx` · `TelaMontarLoja`);
3. `POST /api/loja/provisionar` cria `clientes` + `perfis`, idempotente, com
   compensação para loja órfã, e decide `papel: "cliente"` **no servidor** — o
   corpo da requisição só traz o nome da loja.

A tela que dizia *"Fale com a equipe da Zion para liberar o seu acesso"* já foi
substituída. O comentário da rota é explícito: *"a porta de entrada do SaaS"*.

**O que não existe é cobrança.** `PLANO-001-o-que-falta.md:178` — "Billing não
existe. Zero linhas." Confirmado: nenhum Stripe, nenhum checkout, nenhum
provedor de pagamento em `src/`. E `cotaDaEsteira.ts:28` registra a decisão:
*"ampliar pagando é billing, que está fora do caminho crítico por decisão
registrada"*.

> **Correção da lista original.** A trava não é "não existe caminho de
> assinatura". É "existe caminho e ninguém paga por ele".

### Achado novo — o plano fantasma

`api/loja/provisionar/route.ts:40` cria toda loja auto-provisionada com
`plano: "Essencial"` e `limite_esteira_mes: 30`.

`lib/constantes.ts:70` define `PLANOS = ["Início", "Organiza", "Escala", "—"]`.

**"Essencial" não está na lista.** Toda conta que entra sozinha nasce com um
plano que o resto do sistema não reconhece — inclusive o `<Select>` do
`ClienteForm` da equipe, que não consegue exibi-lo.

---

## 3 · Importar base — roda sozinho, e é aqui que mora o risco

O portal tem caminho completo, sem equipe: `EscolherImportacao` pergunta "o que
você tem?" e leva a `ImportarProdutos` (assistente CSV de 3 passos: arquivo →
mapear → revisar), `ImportarCatalogoPdf`, ou a planilha pelo próprio chat.

O mapeamento é automático (`autoMapear`) com presets Bling/Tiny/Magazord e
ajuste manual coluna a coluna. **Só `nome` é obrigatório**
(`importacaoProdutos.ts:424`).

### O defeito mudo

`importacaoProdutos.ts:427`:

```ts
const agrupado = Boolean(cols["skuVariacao"]);
```

Uma linha decide se a planilha vira **produto com grade** ou **um produto por
linha**. Se nenhuma coluna do arquivo casar com `skuVariacao`, o modo cai para
`flat` **em silêncio** — sem aviso, sem pergunta.

Foi exatamente o que aconteceu com o LINX em 19/08/2026, registrado no próprio
código (`importacaoProdutos.ts:147-175`): sete produtos do ERP viraram
**quatorze** no Zion, cada metade com um pedaço das cores, estoques divergentes,
e 14 variações sem SKU porque o código "pertencia a outro produto" — que era o
mesmo produto. A causa foi o export do LINX chamar a coluna de derivação de
`Código`, nome que o mapeador não conhecia.

A lojista **pode** consertar: `skuVariacao` está em `CAMPOS_MAPEAVEIS:194` com a
dica *"Se preenchido, ativa o modo com variações"*. Mas para consertar ela
precisa saber que o arquivo tem derivação, e que o modo existe. **Não é uma
parede — é um alçapão.** Parede para quem, e alçapão para quem não sabe.

### As duas portas não avisam a mesma coisa

`ConferirCatalogo.tsx` (caminho do chat/PDF) mostra `faltandoObrigatorias`,
mostra `colunasIgnoradas` e **bloqueia** quando falta obrigatória (`:47`).

`ImportarProdutos.tsx` (assistente CSV) nunca lê `analise.faltandoObrigatorias`
nem `analise.colunasIgnoradas` — recalcula as não-usadas na mão e só valida
`faltaNome` localmente.

Mesma importação, duas telas, avisos diferentes. **Nenhuma das duas comenta a
decisão flat/agrupado**, que é a que mais estraga base.

---

## 6 · Atributos — a única trava que ainda tem forma de Zion

O que **já é automático**: `api/ml/categoria` descobre a categoria pelo título
(`domain_discovery`, precisa de token, roda no servidor) e busca os obrigatórios
em `/categories/{id}/attributes` (público). A rota **não grava** — devolve
proposta.

O que **não é**: o valor de cada atributo. E os agentes foram escritos assumindo
um pesquisador humano:

- `catalogo.ts:307` — Benchmark, entrada necessária: *"Links/prints de 5–10
  concorrentes bem posicionados"*;
- `catalogo.ts:167` — SEO: *"Se houver prints do autocomplete do ML ou títulos
  de concorrentes, use como fonte real. Senão... marque ⚠️ informação
  necessária"*.

**Nada em `src/` busca concorrente no Mercado Livre.** Não há chamada a
`/sites/MLB/search` nem equivalente. A lacuna é de premissa de prompt, não de
código faltando: os agentes esperam alguém que vá olhar.

É a trava de natureza diferente das outras — as cinco restantes eram "tirar a
Zion do caminho"; esta é "construir o que a Zion fazia com os olhos".

---

## 7 · Publicar — já resolvida, e o README é que está velho

`PublicarAnuncio.tsx:5`:

> *"A equipe revisa o payload em JSON e isso está certo para a equipe. Aqui não:
> o lojista vê o título que vai aparecer, o preço que vai cobrar e as fotos que
> vão junto."*

`api/ml/publicar` autoriza com `exigirAcessoAoCliente` — lojista publica a
própria, agência as dela, equipe qualquer. O dry-run revisado pela equipe
continua existindo **para a equipe**; não está no caminho do lojista.

A trava do veredito A10 (`jornada.ts` · `bloqueioDe`) é automática, não humana:
pendência aberta impede aprovar, e o motivo aparece em texto.

> **Correção da lista original.** "A publicação passa por revisão humana" era
> verdade no `README.md`, não no código.

---

## O que esta auditoria NÃO verificou

- **Se as telas de importação estão realmente ligadas** em `/cliente/produtos` no
  fluxo que a lojista encontra — li os componentes, não a montagem completa.
- **Se `autoMapear` acerta** em planilhas reais de Bling/Tiny fora dos aliases
  já conhecidos. O caso LINX mostra que o modo de falha é silencioso; quantos
  outros ERPs caem nele é pergunta em aberto, e só a medição responde.
- **Nada foi executado.** Nenhum número aqui vem de rodar o sistema — todos vêm
  de ler o código e os incidentes já registrados nele.

---

## O que fica de pé, em uma linha

A loja já assina, provisiona, importa, gera, aprova e publica sozinha. **Falta
cobrar por isso, e falta o sistema ir olhar os concorrentes** — mais o alçapão
da grade, que não trava ninguém e por isso é o mais caro dos três.

---

## Adendo — o alçapão fechado, 2026-08-25

No mesmo dia desta auditoria, a trava 3 recebeu conserto. O que mudou:

- **`modules/catalog/domain/gradeAchatada.ts`** (novo, puro, 14 testes) — dado o
  arquivo e o modo em que ele vai cair, responde se há grade sendo achatada. A
  detecção é por VALOR, não por nome de cabeçalho: uma coluna é candidata a
  derivação quando está preenchida em toda linha, varia dentro de cada produto
  repetido, e nunca repete no arquivo. As três provas juntas descartam sozinhas
  a coluna do nome e a do código pai.
- **`analisarProdutosCsv`** passou a devolver `avisoDeGrade`. As colunas já
  usadas entram na busca, e não só as ignoradas: no LINX a derivação chama
  `Código`, apelido conhecido de SKU — procurar só no lixo teria deixado passar
  o caso que originou tudo.
- **`ImportarProdutos`** mostra o aviso no passo de revisão, com um botão que
  aponta a coluna sugerida em "SKU da variação" e reanalisa na hora. O botão
  existe porque "SKU da variação" é vocabulário nosso: quem não o conhece não
  sabe que há conserto.
- **`ConferirCatalogo`** (planilha pelo chat) mostra o aviso e diz **onde**
  ajustar, já que aquela tela não tem mapeamento.

**Não bloqueia**, e isso é decisão: nome repetido em linhas diferentes é
legítimo, e barrar por indício transformaria um alçapão numa parede falsa —
parede falsa ensina a ignorar aviso.

O que o conserto **não** cobre: um arquivo de grade em que cada linha traz um
nome diferente para a mesma peça-mãe. Sem repetição de nome não há sinal, e o
módulo devolve `null` — de propósito, porque o contrário seria adivinhar.
