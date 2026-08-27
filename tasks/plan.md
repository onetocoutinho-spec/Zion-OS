# Plano — o que falta para uma loja assinar e operar sozinha

## Contexto

A intenção confirmada ([docs/intent/zion-os.md](docs/intent/zion-os.md)) é: **uma loja
nova assina, importa a base e publica sem ninguém da Zion em nenhum passo**. A agência
não existe mais; o Zion OS é o produto.

A auditoria [AUD-005](docs/engineering/AUD-005-o-caminho-da-loja-sozinha.md) percorreu
esse caminho contra o código e desmentiu duas das seis travas que existiam de memória:
a publicação já é do lojista, e o cadastro já roda sozinho (falta **cobrança**, não
caminho). Sobrou pouco, e o alçapão da grade já foi consertado.

Este plano cobre o que resta. Ele NÃO segue a ordem da lista de travas: segue a ordem do
que precisa ser **sabido** antes de a próxima decisão poder ser tomada.

Uma medição feita durante o planejamento reordenou a peça mais cara — está na Fase 3.

---

## O grafo de dependências

```
FASE 1 ─┬─ T1  medir o caminho na conta real ──► CHECKPOINT 1 ──► FASE 4 (cobrança)
        └─ T2  o plano fantasma                    │
                                                   │
FASE 2 ─── T3  atributos: guardar o que o ML manda │
              │                                    │
              └─► CHECKPOINT 2 ──► FASE 3 (concorrentes: só se sobrar)
```

T1 e T2 são independentes e podem correr juntos. T3 não depende de nenhum dos dois,
mas o CHECKPOINT 1 pode reordená-lo.

---

## FASE 1

### T1 · Medir o caminho da loja nova — **na conta real** (decidido em 25/08)

Percorrer, como uma lojista de fora, os oito passos de AUD-005: assinar → provisionar →
importar base → imagens → descrições → atributos → publicar → acompanhar.

Tudo em AUD-005 foi **lido, não executado**. Sem T1, a Fase 4 é palpite.

Staging não está de pé e montá-lo custa mais do que o percurso. A medição vai para a base
real — com trilha marcada, porque ali mora a única conta pagante.

**As guardas, e nenhuma é opcional**

1. **A loja de teste nasce identificada.** Nome que ninguém confunde com cliente
   (`ZZ-TESTE-<data>`), e-mail de cadastro próprio. Ela cria linhas de verdade em
   `auth.users`, `clientes` e `perfis`.
2. **Não conectar a conta ML da lojista.** O passo 7 só vai ao ar com uma conta ML de
   teste ou uma conta controlada autorizada só para isso —
   [04-MERCADO-LIVRE-STAGING.md](docs/staging-setup/04-MERCADO-LIVRE-STAGING.md) é
   explícito: o ML **não tem sandbox completo**. Publicar pela conexão da Chinelaria
   colocaria um anúncio de teste na loja que vende.
3. **Sem conta ML de teste, o passo 7 para no dry-run** (`go:false`, o payload montado
   sem enviar) e AUD-006 registra: *medido até o payload, não até o ar*. Meia medição
   dita é melhor que uma medição inteira inventada.
4. **Nenhum anúncio existente é tocado.** Nada de encerrar, republicar ou corrigir item
   real durante o percurso.
5. **Limpeza no fim**, e ela precisa de `service_role`: `perfis`, `clientes` e o usuário
   do Auth estão fechados por RLS ao próprio dono. Se a limpeza não puder ser feita na
   hora, AUD-006 registra o que ficou para trás, com id.

**Critério de aceite**
- `docs/engineering/AUD-006-a-loja-nova-medida.md`, uma linha por passo: *passou sozinho*
  / *parou aqui, por isto*.
- A importação usa **uma planilha de ERP real**, não o modelo de
  `gerarTemplateProdutosCsv`. O modelo passa por construção; o ERP é que morde.
- Todo passo que parou registra a **mensagem exata** que a tela mostrou.
- O documento diz o que foi criado na base real e se foi removido.
- Nenhum anúncio comercial real alterado.

**Verificação**: o próprio documento. Todo passo que parar vira tarefa antes da Fase 4.

---

### T2 · O plano fantasma

[api/loja/provisionar/route.ts:40](src/app/api/loja/provisionar/route.ts:40) cria toda
conta auto-provisionada com `plano: "Essencial"`.
[lib/constantes.ts:70](src/lib/constantes.ts:70) define
`PLANOS = ["Início", "Organiza", "Escala", "—"]`. **"Essencial" não está lá.**

Não há CHECK no banco nem união no tipo (`Cliente.plano` é `string`), então nada falha —
e é isso que o torna um alçapão, não uma parede. O dano concreto:
[ClienteForm.tsx:84](src/components/forms/ClienteForm.tsx:84) monta um
`<Select options={PLANOS}>` com `value="Essencial"`, que não casa com opção nenhuma.
Abrir e salvar a ficha de uma loja auto-provisionada **reescreve o plano dela em
silêncio**.

**Fatia vertical**: constante → rota de provisionamento → tela da equipe → teste que
guarda.

**Decidido em 25/08**: "Essencial" **entra em `PLANOS`**. É um conceito de produto real —
o plano de quem entra sem falar com ninguém. Os quatro atuais são vocabulário da era
agência, e reaproveitar "Início" tornaria a conta self-service indistinguível de uma que
a equipe cadastrou.

- O plano de entrada passa a sair do mesmo módulo que `PLANOS`. `PLANO_INICIAL` deixa de
  ser literal na rota.
- Um teste reprova se o plano de entrada não estiver em `PLANOS` — o idioma que este
  repositório já usa em `fontesDeImportacao.test.ts` ("um teste guarda essa ausência").

**Critério de aceite**
- Nenhuma string de plano literal em `api/loja/provisionar/route.ts`.
- Teste novo falha se as duas listas divergirem.
- Abrir e salvar em `ClienteForm` uma loja auto-provisionada **preserva** o plano.
- `npm test` verde.

---

## CHECKPOINT 1 — FECHADO em 27/08/2026

A pergunta era: **a loja chega ao fim sozinha?**

**Chega até o anúncio APROVADO, e para antes do ar.** O percurso inteiro foi
percorrido até o passo 6; os passos 7 e 8 pararam por falta de DADO, não de código:
nenhuma foto na base e nenhuma conta de teste no Mercado Livre. Ver
[AUD-006](../docs/engineering/AUD-006-a-loja-nova-medida.md).

**A Fase 4 (cobrança) continua ADIADA**, e a regra deste checkpoint é a razão: o
fim é o anúncio no ar, não o anúncio aprovado. Abrir a porta antes de a casa se
sustentar gasta a primeira impressão de uma conta nova, que não se repõe.

**O que o T1 desmentiu:** o caminho não estava quebrado em muitos lugares. Dos
treze achados, **onze eram silêncio** — o sistema sabia a resposta e não contava.
Os outros dois eram trabalho que faltava (importar preço, importar estoque).

**O que abre agora, e não é código:**

1. uma pasta de fotos organizada `Produto → Cor → fotos`;
2. uma conta de teste no Mercado Livre, para o passo 7 sem tocar a loja que vende.

**Próximo checkpoint:** repetir 7 e 8 quando as duas existirem.

---

## FASE 2

### T3 · Atributos: parar de jogar fora o que o ML manda

**Medido em 25/08/2026**, endpoint público `/categories/MLB273770/attributes`:

```
78 atributos · 6 obrigatórios
BRAND 11 valores · GENDER 6 · COLOR 51 · SIZE 44 · FOOTWEAR_TYPE 4 · MODEL 0
49 de 78 atributos da categoria trazem lista de valores aceitos
```

Cinco dos seis obrigatórios **já vêm com o vocabulário que o ML aceita**. Além de
`values`, a resposta traz `value_type`, `value_max_length` e `hint`.

[mercadolivre.ts:303](src/lib/marketplaces/mercadolivre.ts:303) e `recorteDaCategoria`
guardam **só `{id, nome}`** e descartam todo o resto.

Isso reordena a trava que parecia a mais cara. "Preencher atributo pesquisando
concorrente" é, em boa parte, escolher dentro de uma lista que o próprio ML publica —
não pesquisa nenhuma.

**Reusar, não recriar**:
[atributosDoMarketplace.ts](src/modules/publication/domain/atributosDoMarketplace.ts) já
resolve os obrigatórios a partir do cadastro (marca, cor, tamanho) e do nome (gênero,
tipo), com lista fechada de palavras, e devolve `null` quando não sabe — "null vira
pergunta, nunca chute". A mudança é dar a essa pergunta as **opções do ML**.

**Fatia vertical**: resposta do ML → tipo do domínio → `resolverObrigatorios` →
o lugar onde a pergunta aparece.

- `atributosObrigatorios` / `recorteDaCategoria` passam a preservar `value_type`,
  `values` (id + nome), `hint` e `value_max_length`.
- `ExigenciaDaCategoria` ganha as opções aceitas. `OBRIGATORIOS_CALCADO` (a lista
  embutida) continua válida como fallback sem rede.
- `AtributoResolvido` passa a distinguir três estados, não dois: **resolvido**,
  **escolha entre estas N opções**, **pergunta aberta**. Hoje só existem os extremos.
- A superfície da pergunta deve ser **rastreada na implementação** — os consumidores são
  `preparacaoDoAnuncio.ts`, `briefingDosAtributos` (que alimenta os agentes) e
  `api/otimizar/worker`. Não presumir qual tela mostra: seguir o `AtributoResolvido`.

**Critério de aceite**
- Teste com a resposta real do ML fixada em arquivo (não rede no teste) provando que
  `values`, `value_type` e `hint` sobrevivem à leitura.
- Um obrigatório de tipo lista que o cadastro não resolve produz **escolha entre as
  opções do ML**, não pergunta aberta.
- Categoria que não responde continua entrando com listas vazias — a falha aberta que
  `recorteDaCategoria` documenta não pode virar bloqueio.
- Nenhum valor inventado: o que não estiver no cadastro nem na lista do ML continua
  `null`.

---

## CHECKPOINT 2 — depois de T3

Rodar a medição contra as **categorias reais da conta**, não só MLB273770: quantos
obrigatórios trazem lista, e quantos ficam de fora.

- **A maioria traz lista** → a Fase 3 encolhe para os atributos livres e para decisão de
  posicionamento. Pode nem valer o custo.
- **Poucos trazem** → a Fase 3 continua sendo o problema grande que era.

Esta é a razão de a Fase 3 não estar detalhada aqui: detalhá-la antes deste número seria
planejar o que talvez não exista.

---

## FASE 3 · Concorrentes no ML — **não planejar ainda**

Nada em `src/` busca concorrente no Mercado Livre. Os agentes pedem isso por prompt
([catalogo.ts:307](src/lib/agentes/catalogo.ts:307) e
[:167](src/lib/agentes/catalogo.ts:167)) e marcam "⚠️ informação necessária" quando falta.

É a peça mais cara e a mais incerta. O CHECKPOINT 2 decide o tamanho dela.

---

## FASE 4 · Cobrança — **gated pelo CHECKPOINT 1**

"Billing não existe. Zero linhas" ([PLANO-001:178](docs/engineering/PLANO-001-o-que-falta.md:178)),
e [cotaDaEsteira.ts:28](src/modules/workspace/domain/cotaDaEsteira.ts:28) registra a
decisão de mantê-lo fora do caminho crítico. A decisão continua de pé até o CHECKPOINT 1.

Quando abrir, T2 já terá deixado o vocabulário de planos coerente — que é a única
dependência real que cobrança tem no código de hoje.

---

## Verificação

```bash
npm run gate
```

**Atenção ao ler o resultado**: `typecheck:test` já falha nesta branch com **13 erros
anteriores a este plano**, em quatro arquivos que nenhuma tarefa daqui toca
(`trilhaDaConversa`, `faixaLater`, `filaDeCorrecao`, `gradeNoMarketplace`). Conferido em
25/08 guardando as modificações no stash: 13 antes, 13 depois. Quem rodar o gate vai ver
vermelho e não é seu.

O que tem que ficar verde por tarefa:

- **T2** — `npm test` (3.748 + o teste novo), `npm run typecheck`, `npm run lint`.
- **T3** — idem, mais o teste com a resposta do ML fixada em arquivo.
- **T1** — não roda teste: produz AUD-006.

Fora do gate, T1 é a única verificação ponta a ponta que existe neste plano. As outras
duas provam unidade; só ela prova a jornada.

---

## Onde isto está

Este documento é `tasks/plan.md`. A lista de execução, com os critérios de aceite em
forma de caixa, está em `tasks/todo.md`. Aprovado em 25/08/2026.
