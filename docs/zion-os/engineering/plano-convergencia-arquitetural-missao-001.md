# Plano de Convergência Arquitetural — Missão 001

> **Natureza.** Plano executivo da **primeira** convergência entre a produção e a Fundação.
> **Não implementa.** Determina, por evidência, qual integração é possível sem alterar
> comportamento, persistência ou contratos.
>
> **Base de evidência:** `HEAD d2b0fe5`. Leitura direta e confronto entre os dois lados.
> Onde a evidência não bastou: **EVIDÊNCIA INSUFICIENTE**.

---

## 1. Objetivo

Descobrir quais componentes classificados **PRONTO** na Auditoria da Fundação podem ser
utilizados **imediatamente** pela aplicação em produção **sem alterar comportamento,
persistência ou contratos públicos**.

O critério é estrito e vem do PASSO 3: se a integração altera comportamento, banco, APIs,
contratos, integrações externas, autenticação, Mercado Livre ou Supabase — o componente
**deixa de ser elegível** para esta missão.

## 2. Escopo

Somente os componentes **PRONTO** da Auditoria:

- Value Objects de domínio: **`Ean`**, **`Dinheiro`**, **`SkuOrigem`**.
- **SDK de conectores** (classificado PRONTO *como contrato*).

Componentes **ADAPTÁVEL** e **EXPERIMENTAL** estão fora por definição da missão.

---

## 3. Componentes auditados

### 3.1 Value Object `Ean`

| Atributo | Evidência |
|---|---|
| **Localização** | `src/domain/shared/value-objects/ean.ts` — 51 linhas |
| **Responsabilidade** | Representar um EAN/GTIN válido |
| **API pública** | `Ean.criar(bruto: string): Result<Ean>`, `igual(outro)` |
| **Dependências** | `resultado.ts`, `erros-dominio.ts` *(da própria Fundação)* |
| **Consumidores atuais** | Testes da Fundação; **0 em produção** |
| **Cobertura** | 4 testes (dígito verificador GTIN + comprimentos 8/12/13/14) |
| **Isolamento** | Alto — sem I/O, sem estado global |

### 3.2 Value Object `Dinheiro`

| Atributo | Evidência |
|---|---|
| **Localização** | `src/domain/shared/value-objects/dinheiro.ts` — 54 linhas |
| **Responsabilidade** | Valor monetário em **centavos inteiros** |
| **API pública** | `Dinheiro.criar(valorEmReais: number): Result<Dinheiro>` |
| **Dependências** | `resultado.ts`, `erros-dominio.ts` |
| **Consumidores atuais** | Testes; **0 em produção** |
| **Cobertura** | 5 testes |
| **Isolamento** | Alto |
| **Representação interna** | `centavos: number` via `Math.round(valorEmReais * 100)` |

### 3.3 Value Object `SkuOrigem`

| Atributo | Evidência |
|---|---|
| **Localização** | `src/domain/shared/value-objects/sku-origem.ts` — 33 linhas |
| **Responsabilidade** | SKU de origem **normalizado** (trim, espaços colapsados, maiúsculas) |
| **API pública** | `SkuOrigem.criar(bruto: string): Result<SkuOrigem>` |
| **Dependências** | `resultado.ts`, `erros-dominio.ts` |
| **Consumidores atuais** | Testes; **0 em produção** |
| **Cobertura** | 3 testes |
| **Isolamento** | Alto |

### 3.4 SDK de conectores

| Atributo | Evidência |
|---|---|
| **Localização** | `src/infrastructure/connectors/` — interfaces + `conformidade.ts` |
| **Responsabilidade** | Contrato uniforme para conectores externos |
| **Consumidores atuais** | Magazord (interno à Fundação); **0 em produção** |
| **Equivalente em produção** | **Nenhum** — 0 arquivos de `lib` com conceito de conector |

---

## 4. Matriz de Elegibilidade

O teste decisivo (PASSO 3) foi aplicado a cada componente: **a produção já faz o que o
componente faz?** Se não, adotá-lo **adiciona** comportamento — e isso reprova.

### 4.1 Confronto produção × Fundação

| Conceito | O que a produção faz hoje | O que o VO faz | Diverge? |
|---|---|---|---|
| **EAN** | `ean.replace(/\D/g, "")` — remove não-dígitos. **Nenhuma** validação de comprimento ou dígito verificador *(0 arquivos validam)* | Valida comprimento **e** dígito verificador GTIN; **rejeita** inválidos | **SIM — comportamento** |
| **Dinheiro** | `precoVenda: number` — float em reais | `centavos: number` inteiro, com arredondamento | **SIM — contrato e representação** |
| **SKU** | Primitivo livre; **0 arquivos** normalizam ou validam | Normaliza (trim, maiúsculas, colapsa espaços) e rejeita vazio | **SIM — comportamento e dado** |
| **Conector** | Integração ML direta em `lib/marketplaces/`; **0 conceito de conector** | Contrato + contract tests | **SIM — não há equivalente a convergir** |

### 4.2 Classificação

| Componente | Classificação | Justificativa por evidência |
|---|---|---|
| **`Ean`** | **INTEGRAÇÃO CONDICIONAL** | Como **substituto**, adiciona validação que a produção não tem → muda comportamento (reprova PASSO 3). Só é integrável **de forma aditiva** (novo caminho opt-in), não como troca |
| **`Dinheiro`** | **INTEGRAÇÃO CONDICIONAL** | Representação (centavos int) difere do contrato de produção (`number` float). Substituir altera contrato; adotar exige conversão explícita |
| **`SkuOrigem`** | **INTEGRAÇÃO CONDICIONAL** | Normalização altera o dado gravado. Aditivo é possível; substituição muda comportamento |
| **SDK de conectores** | **INTEGRAÇÃO FUTURA** | Depende da convergência arquitetural — não há consumidor nem conceito equivalente em produção |
| Demais (ADAPTÁVEL/EXPERIMENTAL) | **NÃO ELEGÍVEL** | Fora do escopo da missão |

**Nenhum componente é INTEGRAÇÃO IMEDIATA.**

> **Este é o resultado central da missão, e é uma conclusão — não uma lacuna.** Sob a
> restrição estrita *"sem alterar comportamento, persistência ou contratos"*, **não existe
> componente PRONTO que seja um substituto de impacto zero**, porque a produção **não
> valida nem normaliza** esses conceitos hoje. Todo VO, adotado como troca, **acrescenta**
> comportamento.

---

## 5. Dependências (PASSO 7 — dependências ocultas)

### 5.1 Cadeia transitiva dos VOs

```
Ean / Dinheiro / SkuOrigem
        │
        ├──► domain/shared/resultado.ts ──► domain/shared/erros-dominio.ts (folha)
        └──► domain/shared/erros-dominio.ts (folha)
```

**Dependência oculta confirmada, porém rasa e fechada:** adotar qualquer VO arrasta
**dois** arquivos da Fundação (`resultado.ts`, `erros-dominio.ts`). Ambos terminam em folha,
sem fanout adicional, sem I/O, sem estado global.

### 5.2 Verificações

| Verificação | Resultado |
|---|---|
| Imports implícitos | Apenas os 2 arquivos shared — explícitos, não implícitos |
| Dependências circulares | Nenhuma observada nos VOs; `resultado.ts ↔ erros-dominio.ts` é unidirecional |
| Tipos compartilhados com produção | **Nenhum** — a produção tem seu próprio `ResultadoCriacao`, estrutura diferente e independente (0 imports cruzados) |
| Configurações / variáveis globais | Nenhuma nos VOs |
| Dependências externas (pacotes) | Nenhuma — VOs são TypeScript puro |

### 5.3 Colisão de convenção — registrada

A produção **já usa** tipos de resultado tagueados (`ResultadoCriacao` em `usuarios.ts` e
outros 3 arquivos), mas **estruturalmente distintos** do `Result<T>` genérico da Fundação.
Adotar os VOs introduz uma **segunda convenção de erro funcional** no código de produção.
Não é bloqueio; é custo de coerência a registrar.

---

## 6. Ordem de integração — por risco

Ordenada **exclusivamente** por isolamento, acoplamento, impacto e reversibilidade — **não**
por importância funcional.

| Ordem | Componente | Isolamento | Acoplamento | Impacto | Reversibilidade | Risco |
|---|---|---|---|---|---|---|
| **1º** | **`SkuOrigem`** | Alto | 2 arquivos shared | Aditivo: nenhum consumidor atual | Total — remover o import | **Menor** |
| **2º** | **`Ean`** | Alto | 2 arquivos shared | Aditivo: validação nova opt-in | Total | Baixo |
| **3º** | **`Dinheiro`** | Alto | 2 arquivos shared | Conversão float↔centavos exige cuidado | Total | Médio |
| — | SDK de conectores | Alto | — | Alto — sem equivalente | — | **Fora deste ciclo** |

**Fundamento da ordem:** os três VOs têm isolamento e acoplamento idênticos (mesma cadeia
de 2 arquivos). O desempate é por **impacto da representação**: `SkuOrigem` e `Ean` são
`string → string validada`; `Dinheiro` muda a **forma numérica** (float → centavos), o que
introduz risco de arredondamento se cruzar com a matemática de preço existente. Por isso
`Dinheiro` fica por último.

**Todos são plenamente reversíveis:** cada um é adotado por um único `import`; removê-lo
restaura o estado anterior sem resíduo.

---

## 7. Componentes excluídos

| Componente | Motivo da exclusão |
|---|---|
| Agregados (`ProdutoMestre`, `Listing`) | **ADAPTÁVEL** — exigem migrar o modelo de dados; fora do escopo |
| Casos de uso | **ADAPTÁVEL** — exigem Ports concretos |
| Repositórios Supabase | ProdutoMestre ADAPTÁVEL; Listing INCOMPLETO |
| Conector Magazord | **EXPERIMENTAL** — nunca conectado |
| Motor de Intake | **ADAPTÁVEL** — sem consumidor |
| Conector Mercado Livre da Fundação | **INCOMPLETO** — só interface |

---

## 8. Riscos

| # | Risco | Evidência | Mitigação registrada *(não proposta de implementação)* |
|---|---|---|---|
| **R1** | Adotar um VO como **substituto** rejeita entradas que a produção aceita hoje | EAN: produção não valida dígito verificador; VO valida | Adoção **aditiva** (validar sem rejeitar) mantém comportamento; adoção como troca, não |
| **R2** | `Dinheiro` altera a matemática de preço | float reais × centavos inteiros | Manter conversão explícita na fronteira; não trocar o tipo de `precoVenda` |
| **R3** | Segunda convenção de erro funcional no código | Produção usa `ResultadoCriacao` próprio | Custo de coerência; não bloqueia |
| **R4** | Dependência oculta nos 2 arquivos shared | Cadeia `resultado.ts`/`erros-dominio.ts` | Rasa e reversível; entra junto com o VO |

---

## 9. Evidências

| # | Evidência | Resultado |
|---|---|---|
| **EV1** | Produção valida EAN (dígito/comprimento)? | **Não** — 0 arquivos |
| **EV2** | Produção normaliza/valida SKU? | **Não** — 0 arquivos |
| **EV3** | Representação de dinheiro em produção | `number` float (`precoVenda`) |
| **EV4** | Representação no VO `Dinheiro` | `centavos` inteiro |
| **EV5** | Cadeia de dependência dos VOs | 2 arquivos shared, folha-terminante |
| **EV6** | Produção importa VOs hoje | **0 arquivos** |
| **EV7** | Produção importa SDK de conectores | **0 arquivos** |
| **EV8** | Compatibilidade de `Result` | Tipos independentes, 0 imports cruzados |
| **EV9** | Cobertura dos VOs | Ean 4 · Dinheiro 5 · SkuOrigem 3 testes, verdes |
| **EV10** | Dependências circulares nos VOs | Nenhuma observada |

---

## 10. Conclusão

Os três Value Objects **PRONTO** são ativos reais, testados e de dependência rasa — os
candidatos naturais à primeira convergência. Porém, sob a restrição estrita da missão,
**nenhum é substituto de impacto zero**: a produção não valida nem normaliza EAN, SKU ou
dinheiro hoje, de modo que adotar qualquer VO **como troca acrescenta comportamento** e
reprova o PASSO 3.

**A primeira convergência possível existe, mas é CONDICIONAL, não IMEDIATA** — realizável
apenas de forma **aditiva** (o VO valida/normaliza em um novo caminho, sem alterar o
existente), começando pelo componente de menor impacto de representação.

---

## Parecer final

**Existe uma primeira integração possível?**
**SIM — condicional.** Os VOs podem convergir com a produção de forma **aditiva**. Não há
integração **imediata** (substituição de impacto zero), por evidência: a produção não
executa hoje a validação/normalização que os VOs trazem.

**Qual é o menor passo arquitetural existente?**
Adotar **um único Value Object** — **`SkuOrigem`** — via um único `import`, de forma
**aditiva**. É o de menor impacto de representação (`string → string`), plenamente
reversível, com dependência oculta de apenas 2 arquivos folha.

**Qual componente oferece maior benefício com menor risco?**
Entre os candidatos, **`Ean`**: valida dígito verificador GTIN — uma regra que a produção
**não tem** (EV1) —, com risco baixo (aditivo, reversível). Benefício concreto e mensurável;
risco contido. Fica em 2º na ordem por risco apenas porque `SkuOrigem` tem impacto de
representação ainda menor.

**Existe algum Quick Win?**
**Não no sentido estrito de "troca de impacto zero".** A evidência é explícita: nenhum
componente PRONTO substitui comportamento de produção sem alterá-lo, porque não há
comportamento equivalente a substituir. O *menor passo real* é a adoção aditiva de um VO —
valioso, mas **não** um drop-in. **Registrar isto é o principal resultado da missão:**
evita o movimento arriscado de "apenas trocar o tipo", que a evidência mostra que mudaria
comportamento.

> **EVIDÊNCIA INSUFICIENTE** para afirmar que a adoção aditiva de um VO traria benefício
> **observável em produção** sem um consumidor concreto definido — o benefício (validação,
> normalização) é real no código, mas seu efeito operacional depende de onde for aplicado,
> o que esta missão não decide.

**Esta missão não recomenda executar a convergência.** Estabelece que ela é possível de
forma condicional e aditiva, ordena os candidatos por risco, e registra que o passo estrito
de "impacto zero" não existe entre os componentes PRONTO — conclusão que protege a produção
de uma troca aparentemente inócua.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · sem alteração de código, arquitetura,
banco ou governança.*
