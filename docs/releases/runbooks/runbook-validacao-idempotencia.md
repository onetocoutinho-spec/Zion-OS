# Runbook Operacional — Validação da Idempotência de Guias

> **Para quem é.** Qualquer operador, mesmo sem conhecer a arquitetura interna do
> Zion OS. Basta seguir os passos na ordem.
>
> **O que este teste verifica.** Que, ao publicar **duas vezes o mesmo produto**, o
> sistema **reaproveita a guia de medidas já existente** em vez de criar outra.
>
> **O que este teste NÃO faz.** Não altera código, não altera configuração, não
> altera a arquitetura. Apenas publica e observa.

---

## ⚠️ AVISO — leia antes de começar

**Esta validação coloca um anúncio real no ar.**

A proteção implementada evita a duplicação **da guia de medidas** — **não** do anúncio.
Ao republicar o mesmo produto, o sistema **criará um novo anúncio** no Mercado Livre,
ainda que reutilize a guia corretamente. Isso é esperado e **não** é falha.

**Consequências práticas:**

- A conta do cliente terá **um anúncio a mais** ao final do teste.
- Prefira executar com um **produto de teste**, não com um produto comercial ativo.
- Planeje **pausar ou encerrar** o anúncio gerado após a coleta das evidências.

Se isso não for aceitável no momento, **não execute** — reagende para uma janela
adequada.

---

## 1. Pré-condições

Confirme **todos** os itens antes de iniciar. Se algum falhar, **interrompa**.

**□ 1.1 — Acesso ao painel onde se publica**
*Como verificar:* fazer login em `www.zioncompany.online` e localizar o cliente e o
produto. A publicação é feita pelo painel da equipe.

**□ 1.2 — Acesso aos Runtime Logs de produção**
*Como verificar:* abrir o painel da Vercel do projeto e localizar a seção de
**Runtime Logs**. Sem esse acesso, o teste **não pode ser concluído** — as evidências
vivem ali.

**□ 1.3 — Produto conhecido e identificado**
*Como verificar:* abrir o produto no painel e anotar seu identificador (aparece na URL
do produto).

**□ 1.4 — O produto já foi publicado antes por este sistema**
*Como verificar:* o produto possui anúncio gerado e já publicado anteriormente. Se
nunca foi publicado, use o **Caminho B** (§3.2).

**□ 1.5 — Guia de medidas já existente**
*Como verificar:* decorre de 1.4 — se houve publicação anterior de calçado, a guia foi
criada. Não é necessário localizá-la manualmente; o log a identificará.

**□ 1.6 — Título do produto INALTERADO desde a última publicação**
*Como verificar:* comparar o título atual com o da publicação anterior.
> 🔴 **Crítico.** O nome da guia deriva do título. Se o título mudou, o sistema
> **corretamente** criará uma guia nova — e o teste ficará inconclusivo.
> **Não execute a esteira de otimização antes do teste.**

**□ 1.7 — Cliente conectado ao Mercado Livre**
*Como verificar:* o painel do cliente indica a conexão ativa. Se pedir reconexão,
reconecte **antes** de iniciar.

**□ 1.8 — Janela adequada**
*Como verificar:* o aviso acima foi lido e a criação de um anúncio adicional é aceitável
agora.

---

## 2. Preparação — anotar antes de publicar

Registre em um bloco de notas. Estes dados acompanharão o resultado.

| Campo | Como obter | Valor |
|---|---|---|
| **Data e hora de início** | Relógio local | ____ |
| **Operador** | Quem executa | ____ |
| **Ambiente** | Produção | Produção |
| **Cliente** | Nome no painel | ____ |
| **Produto (identificador)** | URL do produto | ____ |
| **Título exato do produto** | Copiar **integralmente** | ____ |
| **Anúncio anterior (se souber)** | Código MLB da publicação anterior | ____ |
| **`chartId` anterior (se souber)** | Log `ml.guia` da publicação anterior | ____ |

> Os dois últimos campos são **opcionais**. Se não os tiver, o teste ainda funciona — o
> log da segunda publicação trará o `chartId` reutilizado.

---

## 3. Execução

### 3.1 — Caminho A (recomendado): republicar produto já publicado

**Passo 1 — Confirmar o estado inicial.**
Abrir o produto no painel e confirmar que o título é **exatamente** o anotado em §2.
*Conclusão:* título confere.

**Passo 2 — Publicar.**
Executar a publicação normalmente, pelo mesmo caminho de sempre. **Não** alterar dados
do produto, **não** rodar a esteira, **não** editar o anúncio.
*Conclusão:* a publicação foi disparada.

**Passo 3 — Aguardar a conclusão.**
Esperar a resposta na tela (sucesso ou erro). Normalmente leva poucos segundos.
**Anotar o horário de conclusão.**
*Conclusão:* a tela apresentou um resultado.

**Passo 4 — Localizar os Runtime Logs.**
No painel da Vercel, abrir **Runtime Logs** e filtrar pelo intervalo de tempo da
execução. Procurar por linhas contendo:
- `ml.publicar`
- `ml.guia`
*Conclusão:* ambas as marcações foram localizadas.

**Passo 5 — Capturar tudo.**
Copiar as linhas **completas**, sem recortar campos. Todas as linhas de `ml.publicar` e
a linha de `ml.guia`.
*Conclusão:* evidências copiadas e salvas.

> **Nesta etapa não se interpreta nada.** Apenas coletar. A análise é a §5.

### 3.2 — Caminho B (alternativo): ciclo completo com produto novo

Use se o produto nunca foi publicado, ou se quiser observar o ciclo inteiro.

1. Publicar um produto **novo** → coletar logs (**1ª publicação**).
2. **Sem alterar nada**, publicar o **mesmo produto** de novo → coletar logs (**2ª
   publicação**).

Produz evidência mais completa, ao custo de **dois** anúncios criados.

---

## 4. Evidências a coletar

| Evidência | Origem | Formato esperado | Por que é coletada |
|---|---|---|---|
| Linha `ml.guia` **completa** | Runtime Logs | Uma linha em formato de dados, com vários campos | É **a evidência principal** — diz se a guia foi reutilizada |
| `chartId` | Dentro de `ml.guia` | Número | Identifica **qual** guia foi usada |
| `origem` | Dentro de `ml.guia` | `reuse` ou `create` | Diz se reutilizou ou criou |
| `motivo` | Dentro de `ml.guia` | `guia_existente`, `criada` ou `rebusca_pos_colisao` | Explica **por quê** |
| `buscaStatus` | Dentro de `ml.guia` | `ok` ou código de erro | Diz se a busca funcionou |
| `candidatosEncontrados` | Dentro de `ml.guia` | Número | Quantas guias foram examinadas |
| `paginasConsultadas` | Dentro de `ml.guia` | Número | Confirma o comportamento de paginação |
| `nomeComparado` | Dentro de `ml.guia` | Texto | Mostra o nome usado na comparação |
| `source` e `viaFallback` | Dentro de `ml.guia` | `GET` e `0` | Confirmam que as medidas vieram corretas |
| Linhas `ml.publicar` | Runtime Logs | Várias linhas em sequência | Mostram o fluxo do início ao fim |
| `publishId` | Em ambas as marcações | Código único | Liga todas as linhas da mesma publicação |
| Resultado dos itens | `ml.publicar` | Códigos MLB | Confirma o que foi publicado |
| Horários | Logs e anotação | Data e hora | Ordem e duração |

**Regra de coleta:** copiar as linhas **inteiras**. Um campo omitido pode ser exatamente
o que decide o parecer.

---

## 5. Critérios de Aprovação

Conferir na linha `ml.guia` da **segunda** publicação:

**□ `origem` = `reuse`**
**□ `motivo` = `guia_existente`**
**□ `chartId` idêntico ao da publicação anterior** *(se o valor anterior for conhecido)*
**□ `buscaStatus` = `ok`**
**□ `source` = `GET`**
**□ `viaFallback` = `0`**
**□ Nenhuma menção a `chart_name_unavailable`** em qualquer linha
**□ `ml.publicar` termina com `resumo` e `status` de sucesso**
**□ Nenhuma guia nova criada** — decorre de `origem = reuse`

**Aprovação exige TODOS os itens marcados.** Um item não conferido conta como **não
atendido**.

---

## 6. Critérios de Reprovação

A validação é **reprovada** se **qualquer** um ocorrer:

- **`origem` = `create`** na segunda publicação, **com o título comprovadamente
  inalterado** → a reutilização falhou.
- **`chartId` diferente** entre as duas publicações → guia duplicada.
- **`chart_name_unavailable`** aparece em qualquer linha → a proteção não operou.
- **`motivo` = `rebusca_pos_colisao`** sem que duas publicações simultâneas tenham
  ocorrido → a busca não encontrou o que existia.
- **`buscaStatus` diferente de `ok`** → a busca falhou.
- **`ml.publicar` termina em erro** → houve regressão.

**Caso inconclusivo (nem aprovado, nem reprovado):** o título havia sido alterado, ou a
esteira foi executada antes do teste, ou os logs não puderam ser localizados. Nesse
caso, **não emitir parecer** — corrigir a pré-condição e reagendar.

---

## 7. Registro

Preencher e arquivar junto com as evidências:

```
VALIDAÇÃO OPERACIONAL — IDEMPOTÊNCIA DE GUIAS

Data/hora início: ____        Data/hora conclusão: ____
Operador: ____
Ambiente: Produção
Cliente: ____
Produto: ____
Título (exato): ____
Caminho executado: ( ) A — republicação   ( ) B — ciclo completo

EVIDÊNCIAS COLETADAS
Linha ml.guia (completa): ____
Linhas ml.publicar (completas): ____
publishId: ____
chartId observado: ____
Anúncio(s) criado(s): ____

CONFERÊNCIA
[ ] origem = reuse          [ ] motivo = guia_existente
[ ] chartId idêntico        [ ] buscaStatus = ok
[ ] source = GET            [ ] viaFallback = 0
[ ] sem chart_name_unavailable
[ ] resumo com sucesso

RESULTADO: ( ) APROVADO   ( ) REPROVADO   ( ) INCONCLUSIVO

Observações: ____
Anúncio gerado foi pausado/encerrado? ( ) Sim ( ) Não ( ) N/A
```

---

## 8. Encerramento

**Se APROVADO:**
Registrar que **a Sprint 0 encontra-se operacionalmente validada** e pode ser
considerada definitivamente encerrada. A reutilização de guias está confirmada por
observação em ambiente real.

**Se REPROVADO:**
Registrar as evidências **exatamente como observadas** e **não tomar nenhuma conclusão
arquitetural**. Uma reprovação **não** significa que a arquitetura está errada — significa
que o comportamento observado divergiu do previsto, e essa divergência precisa ser
investigada antes de qualquer decisão.

O caminho correto é a **abertura de uma RFC fundamentada nas evidências observadas**,
seguindo o processo de governança. Nenhuma alteração de código, arquitetura ou
documentação deve ocorrer antes disso.

**Se INCONCLUSIVO:**
Não registrar parecer. Corrigir a pré-condição que falhou e reagendar. Uma validação
inconclusiva **não conta** como tentativa reprovada.

**Em todos os casos:**
- Não repetir a validação sem necessidade — cada execução cria um anúncio.
- Não interpretar comportamento sem evidência.
- Não concluir além do que foi observado.
- Providenciar o tratamento do anúncio gerado, conforme decidido na §7.
