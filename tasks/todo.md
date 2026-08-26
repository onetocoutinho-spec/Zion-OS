# Tarefas — uma loja assina e opera sozinha

> **Estado em 25/08/2026:** T2 e T3 feitas e commitadas. **T1 continua aberta** e é a
> única que não sai daqui: exige navegador, e-mail, planilha real e a decisão sobre qual
> conta ML conectar. O CHECKPOINT 1 e a Fase 4 dependem dela.


Plano completo, com o porquê de cada tarefa: [plan.md](plan.md).
Aprovado em 25/08/2026.

Ordem: **T1 e T2 correm juntas** (independentes). **T3** não depende de nenhuma das duas,
mas o CHECKPOINT 1 pode reordená-la. **Fase 4** só abre depois do CHECKPOINT 1.

---

## T1 · Medir o caminho da loja nova — na conta real

> Tudo em AUD-005 foi lido, não executado. Sem isto, cobrança é palpite.

Guardas (nenhuma é opcional):

- [ ] Loja de teste nomeada `ZZ-TESTE-<data>`, com e-mail de cadastro próprio
- [ ] **Não** conectar a conta ML da lojista — só conta ML de teste ou controlada
- [ ] Sem conta ML de teste: o passo 7 para no dry-run (`go:false`) e o documento diz isso
- [ ] Nenhum anúncio comercial real encerrado, republicado ou corrigido
- [ ] Limpeza no fim (precisa de `service_role`: `perfis`, `clientes`, usuário do Auth)

Percurso:

- [ ] 1 · assinar — `signUp` no navegador
- [ ] 2 · provisionar — tela "Vamos montar sua loja"
- [ ] 3 · importar base — **planilha de ERP real**, não o modelo gerado
- [ ] 4 · imagens
- [ ] 5 · descrições
- [ ] 6 · atributos
- [ ] 7 · publicar (ou dry-run, ver guarda 3)
- [ ] 8 · acompanhar

Aceite:

- [ ] `docs/engineering/AUD-006-a-loja-nova-medida.md` existe, uma linha por passo:
      *passou sozinho* / *parou aqui, por isto*
- [ ] Todo passo que parou registra a **mensagem exata** da tela
- [ ] O documento diz o que foi criado na base real e se foi removido

---

## T2 · O plano fantasma

> `provisionar` cria com `plano: "Essencial"`; `PLANOS` não tem "Essencial". Abrir e
> salvar a ficha dessa loja no formulário da equipe reescreve o plano em silêncio.

- [x] "Essencial" entra em `PLANOS` ([lib/constantes.ts:70](../src/lib/constantes.ts:70))
- [x] `PLANO_INICIAL` deixa de ser literal em
      [api/loja/provisionar/route.ts:40](../src/app/api/loja/provisionar/route.ts:40) e
      passa a sair do mesmo módulo
- [x] Teste novo reprova se o plano de entrada não estiver em `PLANOS`
      (idioma de `fontesDeImportacao.test.ts`)
- [x] Abrir e salvar em `ClienteForm` uma loja auto-provisionada **preserva** o plano
- [x] `npm run typecheck` · `npm run lint` · `npm test` verdes

---

## CHECKPOINT 1 — depois de T1

- [ ] Ler AUD-006: **a loja chega ao fim sozinha?**
- [ ] **Chega** → Fase 4 liberada
- [ ] **Não chega** → o que parou vira tarefa; cobrança continua adiada

---

## T3 · Atributos: parar de jogar fora o que o ML manda

> Medido em 25/08 em `/categories/MLB273770/attributes`: 78 atributos, 6 obrigatórios,
> e 5 deles já vêm com a lista de valores aceitos (BRAND 11 · GENDER 6 · COLOR 51 ·
> SIZE 44 · FOOTWEAR_TYPE 4; só MODEL é livre). 49 de 78 trazem lista. O código guarda
> só `{id, nome}`.

- [x] `atributosObrigatorios` e `recorteDaCategoria`
      ([mercadolivre.ts:303](../src/lib/marketplaces/mercadolivre.ts:303)) preservam
      `value_type`, `values` (id + nome), `hint` e `value_max_length`
- [x] `ExigenciaDaCategoria` ganha as opções aceitas; `OBRIGATORIOS_CALCADO` segue como
      fallback sem rede
- [x] `AtributoResolvido` passa a ter três estados: resolvido · escolha entre N opções ·
      pergunta aberta
- [x] Superfície da pergunta **rastreada, não presumida** — seguir o `AtributoResolvido`
      até `preparacaoDoAnuncio.ts`, `briefingDosAtributos` e `api/otimizar/worker`

Aceite:

- [x] Teste com a resposta real do ML **fixada em arquivo** (sem rede no teste) provando
      que `values`, `value_type` e `hint` sobrevivem
- [x] Obrigatório de tipo lista que o cadastro não resolve vira **escolha entre as opções
      do ML**, não pergunta aberta
- [x] Categoria que não responde continua entrando com listas vazias — a falha aberta não
      pode virar bloqueio
- [x] Nenhum valor inventado: fora do cadastro e fora da lista do ML continua `null`
- [x] `npm run typecheck` · `npm run lint` · `npm test` verdes

---

## CHECKPOINT 2 — depois de T3

- [ ] Medir as **categorias reais da conta**: quantos obrigatórios trazem lista de valores
- [ ] Maioria traz → Fase 3 encolhe para atributo livre e posicionamento
- [ ] Poucos trazem → Fase 3 continua sendo o problema grande

---

## FASE 3 · Concorrentes no ML — não planejar ainda

Bloqueada pelo CHECKPOINT 2, de propósito: detalhar antes daquele número é planejar o que
talvez não exista.

## FASE 4 · Cobrança — bloqueada pelo CHECKPOINT 1

"Billing não existe. Zero linhas" (PLANO-001:178). A decisão de mantê-lo fora do caminho
crítico continua de pé até AUD-006 dizer que a loja chega ao fim.

---

## Ao rodar o gate

`npm run gate` **já fica vermelho** nesta branch: `typecheck:test` tem 13 erros anteriores
a este plano, em `trilhaDaConversa`, `faixaLater`, `filaDeCorrecao` e `gradeNoMarketplace`
— nenhum deles tocado por tarefa daqui. Conferido em 25/08 (13 antes, 13 depois). Não é seu.
