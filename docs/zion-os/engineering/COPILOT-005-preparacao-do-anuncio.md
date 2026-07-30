# COPILOT-005 — Preparação inteligente do anúncio

**Data:** 2026-07-29
**Ramo:** `feat/copilot-lote-com-escopo-congelado`
**Sucede:** COPILOT-004 (proveniência + pendências, concluído em `72c72ed`)
**Portão:** 1429 testes · TS 0 · lint sem erros · build ok

---

## 1. RECONHECIMENTO — o pipeline REAL

### Motores que já existiam

| Capacidade | Estado | Onde |
|---|---|---|
| Esteira A0–A12 (SEO, título, descrição, ficha, medidas, benchmark, revisão) | **EXISTE E FUNCIONA** | `agentes/catalogo`, `cadeiaEsteira`, `/api/agentes/esteira` |
| Atributos obrigatórios do ML | **EXISTE E FUNCIONA** — 6 medidos na API de MLB273770, resolvidos do cadastro + nome | `atributosDoMarketplace` |
| Grade de variações (cor, tamanho, SKU, EAN) | **EXISTE E FUNCIONA** — a IA não a escreve | `variacoesDoAnuncio` |
| Anúncio preparado, persistido | **EXISTE E FUNCIONA** — `anuncios_gerados`, status rascunho→aguardando→aprovado→publicado | `anunciosGerados` |
| Pricing (piso, envio, margem, comissão) | **EXISTE E FUNCIONA** — resultado tipado que diz o motivo da recusa | `pricing/domain/modeloPreco` |
| Jornada de 6 etapas | **EXISTE E FUNCIONA** | `publication/domain/jornada` |
| Agente de título isolado (A3) | **EXISTE, NÃO ESTAVA LIGADO AO COPILOT** | `catalogo.A3` + `/api/agentes/executar` |
| Imagens | **EXISTE PARCIALMENTE** — CRUD e contagem; sem validação dos requisitos do ML | `imagensProduto` |
| **Categoria ML** | **EXISTE PARCIALMENTE** — campo de texto livre (`categoriaMarketplaceSugerida`) + sugestão da AIL por padrão aprendido. **Não há motor de categorização**; a publicação usa `MLB273770` como padrão | `ProdutoForm` + `MemoriaContextual` |
| Publicação no ML | **EXISTE E FUNCIONA** — **não tocada nesta vertical** | `publicacaoML`, `/api/ml/publicar` |
| Copilot ligado ao pipeline | **EXISTIA MAS NÃO ESTAVA LIGADO** — `propor_anuncio` propunha e navegava; sem estado, sem etapas, sem pricing, e lendo dados do **corpo da requisição** | `propostaDeAnuncio` |

### A descoberta que mudou o desenho

A esteira roda **no navegador** e leva de 25 s (passada única) a minutos (cadeia).
A rota de conversa tem `maxDuration = 60`. Rodar a geração dentro do turno era
inviável — e teria criado um segundo fluxo de preparação, exatamente o que não
se queria.

Então a divisão que sobrou é a certa:

- **o orquestrador calcula o ESTADO** — determinístico, server-side, sem IA
- **a geração de texto continua onde está** — o navegador, a esteira, o cartão
- **`propor_anuncio` virou uma projeção do orquestrador** — um motor só

---

## 2. ORQUESTRADOR

`publication/domain/preparacaoDoAnuncio.ts`. **Não gera nada**: não escreve
título, não escolhe categoria, não calcula preço. Ele responde em que pé está
cada produto, o que cada etapa trava, e o que pode rodar agora.

### As dependências REAIS — descobertas, não supostas

```
IDENTIDADE (marca, modelo, gênero, cor, tamanho, tipo)
   │
   ├──► CONTEÚDO   título, descrição, ficha.
   │               NÃO depende de custo, peso nem foto.
   │
PRICING      custo + peso. INDEPENDENTE do conteúdo.
   │
IMAGENS      independente dos dois.
   │
   └──► PUBLICAÇÃO   conteúdo aprovado + imagem + preço + grade publicável.
```

Isto responde a pergunta que o pedido mandou descobrir em vez de assumir: **sim,
dá para gerar título e descrição com o pricing travado.** O texto sai da
identidade do produto, não do que ele custa. É essa independência que faz
"prepare o que conseguir" avançar de verdade.

### Duas perguntas diferentes sobre conteúdo

|  | Responde |
|---|---|
| `etapas.conteudo` | **dá para gerar o texto?** — identidade basta |
| `bloqueiosParaGerar` | **vale gastar a cota agora?** — não, se voltar com pendência |

A segunda é **política**, documentada e testada desde o PR #84, e continua
idêntica. A primeira é **fato** sobre o pipeline, e é ela que permite dizer "o
texto eu consigo, o preço não".

---

## 3. READINESS — estados

```
nao_apto             identidade incompleta — nem o texto sai
precisa_humano       o texto sairia, mas voltaria com pendência
apto_para_preparar   pode gerar agora
preparado            o anúncio existe, com pendências
pronto_para_publicar aprovado, com imagem, preço e grade
publicado            já está no ar
```

**`em_preparacao` não existe, de propósito.** A esteira roda no navegador e grava
o progresso em `localStorage` (`progressoGeracao`). O servidor não observa isso,
e inventar um estado que ele não mede produziria uma tela dizendo "preparando"
para uma aba que já fechou.

---

## 4. CATEGORIA — capacidade real

**Não existe motor de categorização.** Existe um campo
(`produtos.categoriaMarketplaceSugerida`), preenchível na tela da equipe, com
uma sugestão da AIL quando há padrão aprendido — e a publicação usa `MLB273770`
como padrão de calçados.

Por isso esta vertical **não inventa categoria**. Ela não entrou como etapa do
orquestrador: uma etapa que só sabe dizer "o campo está vazio" seria burocracia.
Quando existir um categorizador, ele entra como etapa e o resto não muda.

"Por que essa categoria?" tem resposta parcial hoje, e ela vem da vertical
anterior: `procedencia` sabe dizer se o valor foi informado, e a AIL registra o
padrão que originou a sugestão. Não há evidência de processo além disso, e
fabricar uma seria pior que a ausência.

---

## 5. ATRIBUTOS — capacidade real

`resolverObrigatorios` já distingue as três origens, e o orquestrador as leva
até o modelo e a tela:

| origem | significado |
|---|---|
| `cadastro` | marca, modelo, cor e tamanho — colunas reais |
| `nome` | gênero e tipo de calçado, **lidos** de uma lista fechada |
| `ausente` | ninguém sabe — vira pergunta, nunca chute |

Nome sem gênero devolve `null` e o produto fica `nao_apto`. **Não existe
caminho que preencha "material: sintético" porque parece provável.**

---

## 6. TÍTULO — capacidade real, agora ligada

`propor_titulo` roda o **agente A3 do catálogo** — o mesmo prompt da tela de
Agentes IA. `agenteDeTitulo.ts` é um chamador, não um segundo motor: escrever um
prompt novo produziria dois títulos diferentes para o mesmo produto dependendo
de onde foi pedido.

O que o cartão mostra:

```
Hoje (13 caracteres)      Papete Modare
Proposto (33 caracteres)  Papete Modare Salto Bloco Feminina
```

**Os dois, sempre.** Trocar título é a coisa mais fácil de piorar sem ver.

O domínio recusa antes de virar proposta: vazio, igual ao atual, ou acima dos 60
caracteres do ML. E a mensagem ao modelo lista só fatos do cadastro, com a trava
explícita contra afirmar material, tecnologia, garantia e origem.

**Aplicar o título passa por Proposal** (`tipo: "titulo"`, migração 039) — com
revalidação: a precondição guarda a **impressão** do título atual, e se alguém o
trocou entre a proposta e o clique, a proposta fica obsoleta e nada é
sobrescrito.

---

## 7. DESCRIÇÃO E IMAGENS

**Descrição:** o motor é a esteira, e ela já monta a grade a partir do cadastro
com a trava contra SKU inventado. Esta vertical não a tocou.

**Imagens:** o orquestrador conta as imagens do produto e trava a publicação
quando não há nenhuma. Não há validação dos requisitos do ML (resolução,
proporção) porque ela não existe no domínio, e não houve geração de imagem —
está fora do escopo declarado.

---

## 8. PRICING — integrado, não redesenhado

A etapa reusa `precoMinimo` inteiro, **inclusive o motivo da recusa**:
`sem_peso`, `margem_impossivel`. E respeita `vendedorPagaFrete: false` — cobrar
peso de quem nunca vai pagar frete seria um "falta frete" eterno.

**O painel NÃO publica um piso calculado.** A comissão exata vem da API na tela
de precificação; um número aqui pareceria o piso real e não seria. A pergunta
desta vertical é "dá para calcular?" e "o que falta?" — as duas não dependem da
comissão exata. O preço tem vertical própria, e ela não foi antecipada.

---

## 9. LOTE

`selecionarParaPreparar` roda no **backend**. O modelo recebe contagens, motivos
agrupados e uma amostra de até 8 nomes — nunca 300 objetos de produto.

- quem **já tem anúncio** fica de fora: "prepare todos que estiverem prontos"
  não é "refaça o que já está feito"
- os travados vêm **agrupados pelo primeiro bloqueio**, do mais comum ao menos
- o **truncamento é dito** com o total real
- `consolidarLote` registra o desfecho **item a item**: "preparei 50" quando 47
  funcionaram é o tipo de mentira que só aparece três dias depois

---

## 10. SEGURANÇA

**`Efeito` continua `le | rascunha | propoe`.** Nenhum valor novo, `escreve`
continua não existindo, e há teste varrendo as ferramentas novas.

| Tool | Efeito | Por quê |
|---|---|---|
| `preparacao_de_anuncio` | `le` | consultar estado não muda nada |
| `propor_titulo` | `propoe` | trocar título é alteração operacional |

**Tenant.** `propor_anuncio` lia `contexto.paraAnunciar` — montado pela tela e
enviado no corpo. Agora lê do banco, pelo porto, com o tenant da sessão. O
caminho antigo fica como fallback para telas que ainda não passam o contexto
novo.

**Stale e idempotência.** A proposta de título revalida a impressão do título
atual e passa pela mesma reserva atômica `pendente → executada`.

**PREPARAR NÃO É PUBLICAR.** Nada nesta vertical chama `/api/ml/publicar`. A
etapa `publicacao` é estado, nunca ação — e há teste varrendo as saídas das
ferramentas atrás de qualquer menção a publicação.

---

## 11. PROVENIÊNCIA

O título aplicado registra procedência com **origem `zion`**, não `cliente`: quem
escreveu foi o agente da Zion, e o lojista apenas aprovou. Chamar isso de
"cliente" atribuiria a ele uma frase que ele não redigiu.

Os atributos carregam a origem (`cadastro` | `nome` | `ausente`) até a tela — o
que foi **lido** do nome não se confunde com o que veio do cadastro.

---

## 12. AUDITORIA

Reusa as primitives existentes, sem log paralelo:

```
conversa  → copilot_conversas / copilot_mensagens
proposta  → copilot_propostas (tipo, alvos, texto, precondições, resumo lido)
execução  → copilot_acoes (antes: título velho · depois: título novo)
origem    → procedencia_de_campo (campo `tituloAnuncio`, origem `zion`)
```

---

## 13. UI — estados funcionais

`PainelDaPreparacao` e `CartaoDeTitulo`, com as decisões em
`cartaoDaPreparacao.ts` (domínio provado).

| Estado | O que aparece |
|---|---|
| lote | quantos podem virar anúncio, quantos travados e por quê, quantos já têm |
| produto | as 5 etapas com ✓ / ! / · e o que falta em cada uma |
| bloqueio | a etapa em âmbar, com o dado que falta |
| título | atual e proposto lado a lado, com as duas contagens |
| concluído | qualquer desfecho tira o botão |

O painel **não tem botão de preparar** — quem traz o botão (e o aviso de minutos
e cota) é o cartão de `propor_anuncio`. O painel responde "em que pé está", não
"faça agora".

---

## 14. HIGGSFIELD — estados para a jornada

Não são cards isolados: é uma jornada, e é assim que valem ser desenhados.

| # | Estado | Dado real por trás |
|---|---|---|
| 1 | **produto apto** | `apto_para_preparar` + as 5 etapas verdes |
| 2 | **preparação em progresso** | hoje só no navegador (`progressoGeracao`) — ver limitações |
| 3 | **preparação concluída** | `preparado` com nota, veredito e nº de pendências |
| 4 | **bloqueio** | etapa + dado que falta + a consequência |
| 5 | **decisão humana** | `precisa_humano` com `bloqueiosParaGerar` |
| 6 | **anúncio preparado** | registro em `anuncios_gerados`, status e pendências |
| 7 | **lote** | analisados / elegíveis / travados agrupados / já preparados |
| 8 | **resultado parcial** | `consolidarLote`: preparados, bloqueados, falharam |
| 9 | **pronto para publicar** | aprovado + imagem + preço + grade |
| 10 | **título lado a lado** | atual, proposto, as duas contagens, justificativa |

O eixo que mais pede desenho: **as 5 etapas como trilha**, com as dependências
visíveis — é a peça que transforma "está bloqueado" em "falta isto, aqui".

---

## 15. MIGRATIONS

| # | Estado |
|---|---|
| 035 — propostas e conversas | **APLICADA** |
| 036 — índices da busca forte | **PENDENTE** |
| 037 — cadastro conversacional | **PENDENTE** |
| 038 — procedência de campo | **PENDENTE** |
| 039 — proposta de título | **PENDENTE** (entregue nesta sessão) |

Nenhuma aplicada. Nenhuma anterior modificada.

---

## 16. TESTES

| Arquivo | Novos |
|---|---|
| `preparacaoDoAnuncio.test.ts` | 37 |
| `anuncioPelaFerramenta.test.ts` | 26 |
| **Total novo** | **63** |
| **Suíte** | **1429** (era 1366) |

Os 13 testes de `propostaDeAnuncio` continuam passando **sem alteração** — a
prova de que o wrapper preservou o comportamento.

---

## 17. PORTÃO

```
1429 testes · TS 0 · typecheck:test 0 · lint sem erros · build ok
```

---

## 18. LIMITAÇÕES REAIS

1. **O Copilot não EXECUTA a esteira.** Ele avalia, propõe e monta o cartão; a
   geração roda no navegador, onde sempre rodou. Movê-la para o servidor
   estouraria os 60 s da rota e criaria o segundo fluxo que o pedido proibiu.
2. **`em_preparacao` não é observável pelo servidor.** O progresso vive no
   `localStorage` da aba que está rodando.
3. **Não há motor de categoria.** O campo existe, a sugestão da AIL existe, o
   classificador não. "Por que essa categoria?" só responde o que a procedência
   registrar.
4. **Imagens só são contadas.** Não há validação de resolução, proporção ou
   quantidade mínima por categoria — isso não existe no domínio.
5. **O pricing não devolve número aqui.** Só "dá para calcular" e "o que falta".
   O piso real depende da comissão da conta, que só a tela de precificação
   consulta.
6. **O lote analisa 300 produtos por vez**, e o truncamento é dito com o total.
7. **"Prepare todos que estiverem prontos" seleciona, não dispara.** O Copilot
   devolve a lista de elegíveis e o cartão por produto; disparar N esteiras de
   uma vez é uma capacidade de execução em lote que não existe e não foi
   inventada aqui.
8. **039 não aplicada.** Até lá, `propor_titulo` monta o cartão mas a Proposal
   falha ao gravar (o `check` recusa `tipo = 'titulo'`) — e sem id não há botão,
   que é o comportamento seguro.
9. **Nada foi exercido em tela.** A bateria manual continua adiada.
