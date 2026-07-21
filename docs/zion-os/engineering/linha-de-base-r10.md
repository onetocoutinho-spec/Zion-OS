# Linha de Base — R10 · Conhecimento de medidas por marca

> **Natureza.** Registro de engenharia. Documenta a construção de uma linha de base.
> **Não é migração, não é Release, não altera arquitetura.**
>
> **Base de evidência:** `src/lib/data/tabelasMedidas.ts` na linha principal `4f3913b`.
> Nenhum arquivo de produção foi modificado.

---

## 1. Objetivo

Construir linha de base própria e suficientemente isolada para a responsabilidade **R10**,
habilitando a futura Pré-Abertura da **Release 008**.

O Protocolo de Migração é a razão desta missão existir: *"sem linha de base mensurável, a
migração **não começa**, pois não haveria como comprovar preservação."* R10 era classificada
como **categoria B** — cobertura apenas compartilhada — pela análise do Grupo B.

---

## 2. Linha de base anterior

| Item | Situação antes desta missão |
|---|---|
| **Arquivo** | `src/lib/data/tabelasMedidas.ts` — 290 linhas |
| **Símbolos públicos** | 6 valores + 3 interfaces |
| **Símbolos internos** | 8 — `normalizarMarca`, `primeiroNumero`, `renderTabela`, `renderLinhas`, `numeroParaLinha`, `linhasDe`, `ehCalcado`, e as constantes `MARCAS_OFICIAIS`, `NOMES_MARCA`, `PADRAO_REFERENCIA` e as 8 tabelas de marca |
| **Dependências de saída** | **Zero.** Arquivo folha |
| **Consumidores reais** | **4** — `mlUserProducts.ts` (`medidasDaMarca`), `contexto.ts` e `cliente/produtos/page.tsx` (`montarTabelaMedidas`), `cliente/medidas/page.tsx` (`MODELOS_PADRAO`) |
| **Testes próprios** | **Nenhum** |
| **Cobertura indireta** | Apenas `medidasDaMarca`, via os 7 testes de `montarBundleUserProducts` (R13) |

**Símbolos desprotegidos antes desta missão:** `PADRAO_BR`, `TABELAS_MARCA`, `COMO_MEDIR`,
`MODELOS_PADRAO`, `montarTabelaMedidas` — cinco dos seis símbolos de valor, incluindo a
função com **dois consumidores de produção**.

---

## 3. Estratégia utilizada

**Princípio adotado:** registrar o comportamento **atual**, não o desejado — critério
**C-S6**, derivado do precedente da Release 003, que registrou um comentário desatualizado
como achado sem corrigi-lo.

**Recorte:** cobrir a superfície pública de R10 e **apenas ela**. Nenhum teste foi escrito
para R12, R13, R15, R2 ou qualquer outra responsabilidade.

**Funções internas não recebem teste direto.** São exercitadas através da superfície
pública. Justificativa: a estratégia de migração registrada no Mapeamento é *"mover arquivo
inteiro"* — as funções internas viajam junto e não são contrato com ninguém. Testá-las
diretamente criaria acoplamento do teste à implementação, tornando a linha de base mais
frágil, não mais forte.

### Justificativa por teste

| # | Teste | Comportamento protegido | Regressão que detecta |
|---|---|---|---|
| 1 | `PADRAO_BR` âncoras | Grade de fallback do sistema | Alteração de valor ou perda de faixa etária |
| 2 | `TABELAS_MARCA` chaves | Conjunto de marcas reconhecidas | Marca removida ou tabela esvaziada |
| 3 | `TABELAS_MARCA` aliases | Marcas do mesmo grupo compartilham **a mesma referência** de tabela | Alias apontando para tabela errada — erro silencioso e caro |
| 4 | `COMO_MEDIR` | Instrução repassada ao comprador no anúncio | Texto truncado ou substituído |
| 5 | `MODELOS_PADRAO` | Seed editável: um modelo por marca, nome de exibição, ordenação e formato `"14,1 cm"` | Perda de modelo, nome cru em vez do de exibição, ordenação quebrada |
| 6 | `medidasDaMarca` marca conhecida | Resolução da grade da marca | Tabela trocada |
| 7 | `medidasDaMarca` normalização | Acento, caixa e pontuação — `"Beira-Rio"`, `"AZALÉIA"` | Regressão em `normalizarMarca`, que faria marcas reais caírem no fallback |
| 8 | `medidasDaMarca` fallback | Marca desconhecida → grade **33–45**, não a `PADRAO_BR` inteira | Vazamento da faixa infantil para anúncio adulto |
| 9 | `medidasDaMarca` marca vazia | Ausência de exceção | Falha dura em vez de fallback |
| 10 | `montarTabelaMedidas` override | Prioridade máxima e aparo de espaços | Inversão da ordem de prioridade |
| 11 | `montarTabelaMedidas` tabela do cliente | Cliente vence hardcoded; tabela vazia é ignorada | Cliente perdendo sua própria tabela cadastrada |
| 12 | `montarTabelaMedidas` marca | Grade completa renderizada; `oficial` conforme `MARCAS_OFICIAIS` | Marca de referência marcada como oficial |
| 13 | `montarTabelaMedidas` padrão | Marca desconhecida com numeração de calçado | Fonte errada, `confiavel` invertido |
| 14 | `montarTabelaMedidas` vazio | Numeração não-calçado → tabela vazia | Tabela de calçado montada para roupa |

**Nenhum teste redundante:** cada um cobre um símbolo distinto ou um ramo distinto de
`montarTabelaMedidas`. Os cinco ramos da função — `override`, cliente, marca, padrão,
vazio — recebem um teste cada.

---

## 4. Testes adicionados

**Arquivo criado:** `src/lib/data/tabelasMedidas.test.ts` — **14 testes**, teste ao lado da
implementação, conforme a convenção do projeto. Import relativo com extensão `.ts`,
conforme a convenção dos testes existentes.

**Nenhum arquivo de produção foi criado, modificado ou movido.**

---

## 5. Cobertura obtida

| Símbolo público | Tipo | Protegido | Como |
|---|---|---|---|
| `PADRAO_BR` | valor | **Sim** | Teste 1 + fallback do teste 8 |
| `TABELAS_MARCA` | valor | **Sim** | Testes 2 e 3 |
| `COMO_MEDIR` | valor | **Sim** | Teste 4 + propagação nos testes 10 e 14 |
| `MODELOS_PADRAO` | valor | **Sim** | Teste 5 |
| `medidasDaMarca` | função | **Sim** | Testes 6 a 9 |
| `montarTabelaMedidas` | função | **Sim** | Testes 10 a 14 — os 5 ramos |
| `LinhaMedidaLite` | interface | **Sim** | Compilação — usada estruturalmente nos testes 11 e 5 |
| `TabelaClienteLite` | interface | **Sim** | Compilação — construída no teste 11 |
| `ResultadoTabela` | interface | **Sim** | Compilação — campos `fonte`, `confiavel`, `oficial` asseridos nos testes 10 a 14 |

**Cobertura: 9 de 9 símbolos públicos.**

> **Nota sobre interfaces.** Tipos não existem em tempo de execução; não há o que asserir.
> São protegidos pelo **build** — uma alteração incompatível quebra a compilação dos testes
> que os constroem. Registrado como distinção real, não como equivalência.

---

## 6. Evidências

| # | Evidência | Resultado |
|---|---|---|
| **E1** | Testes de R10 | **14 tests · 14 pass · 0 fail** |
| **E2** | Suíte completa do projeto | **215 tests · 215 pass · 0 fail · 0 skipped** |
| **E3** | Build | **`✓ Compiled successfully in 19.1s`** |
| **E4** | Arquivos de produção modificados | **0** |
| **E5** | `tabelasMedidas.ts` — hash vs `HEAD` | **IDENTICO** |
| **E6** | Capacidade de detectar regressão | **7 de 7 mutações detectadas** — ver §6.1 |

### 6.1 Prova de detecção de regressão — critério C-S4

O critério que separa linha de base real de linha de base decorativa é: **o teste falha se
o comportamento mudar.** Provado por mutação, executada em **cópia isolada no diretório
temporário** — o arquivo de produção nunca foi tocado.

| Mutação aplicada | Detectada |
|---|---|
| `PADRAO_BR["38"]` de `25.0` para `25.5` | **Sim** — 1 falha |
| Alias `"beira rio"` apontando para `HAVAIANAS` em vez de `MODARE` | **Sim** — 1 falha |
| `COMO_MEDIR` truncado | **Sim** — 1 falha |
| Nome de exibição `"Havaianas"` para `"HAVAIANAS"` | **Sim** — 1 falha |
| Fallback de `medidasDaMarca` trocado para `PADRAO_BR` | **Sim** — 2 falhas |
| `oficial` sempre `true` em `montarTabelaMedidas` | **Sim** — 1 falha |
| `override` deixando de ser aparado | **Sim** — 1 falha |

**7 de 7.** Cada símbolo público de valor e cada função tiveram ao menos uma mutação
detectada. Esta é a evidência que endereça diretamente o risco **RS1** — *linha de base
complacente* — identificado como o de maior gravidade na análise do Grupo B.

---

## 7. Limitações

Registradas explicitamente. **Nenhuma exceção silenciosa.**

**L1 — O conteúdo numérico integral das 8 tabelas de marca não é asserido.** Os testes
fixam **âncoras** (`Havaianas 35/36 = 23,2`, a grade completa da Modare, extremos do
`PADRAO_BR`), não todas as ~90 entradas. Uma alteração isolada em, por exemplo,
`MOLEKINHO["31/32"]` **não seria detectada**.

*Por que isso não compromete a linha de base para o fim declarado:* a estratégia de
migração registrada no Mapeamento para R10 é **"mover arquivo inteiro"**. Diferentemente de
R11 — que foi extração —, aqui o `git mv` **é aplicável**, e a Fase 3 do Protocolo exige
*"similaridade do rename — 100% é a prova de que nenhum byte mudou"*. **A preservação dos
dados é coberta pela evidência de similaridade; a preservação do comportamento, por estes
testes.** As duas evidências são independentes e complementares, exatamente como o
Protocolo determina: *"as evidências devem ser independentes entre si."*

**L2 — O texto exato de `COMO_MEDIR` não é fixado.** O teste verifica prefixo, três
trechos distintivos e comprimento mínimo. Decisão deliberada: duplicar um parágrafo inteiro
dentro do teste cria manutenção mecânica por copiar-e-colar, que degrada em vez de
proteger. A mutação de truncamento foi detectada.

**L3 — Funções internas não têm teste direto.** Justificado na §3. São exercitadas pela
superfície pública; as mutações 2, 5 e 7 confirmam que regressões nelas são percebidas.

**L4 — Interfaces são protegidas por compilação, não por asserção de runtime.** Distinção
registrada na §5.

---

## 8. Achado registrado — não corrigido

**A1 — Comentários desatualizados sobre Vizzano, Moleca e Actvitta.**

Três comentários afirmam que essas marcas estão pendentes e caem no padrão BR:

- l. 9–10: *"Vizzano/Moleca/Actvitta ainda pendentes → caem no padrão BR."*
- l. 72: *"Vizzano/Moleca/Actvitta pendentes (padrão BR)."*
- l. 279: *"Marca sem tabela ainda (ex.: Vizzano/Moleca/Actvitta): grade padrão BR."*

**O código faz o contrário.** As três possuem tabela própria em `TABELAS_MARCA`
(`VIZZANO`, `MOLECA`, `ACTVITTA`) e as três constam de `MARCAS_OFICIAIS` — portanto
retornam `oficial: true`.

*Decisão:* **não corrigido.** Corrigir comentário alteraria o arquivo de produção, o que
esta missão veda, e quebraria a similaridade de 100% da futura migração — precedente
estabelecido na Release 003, que registrou achado equivalente sem corrigi-lo.

*Efeito sobre os testes:* nenhum. Os testes registram o **comportamento do código**, não a
afirmação dos comentários.

*Destino:* registrado para deliberação futura.

---

## 9. Parecer final

# LINHA DE BASE SUFICIENTE

**Fundamentação:**

**Mensurabilidade (C-S1).** A linha de base produz números reexecutáveis: 14 testes,
14 aprovados, 0 falhas.

**Verdes antes (C-S2).** Todos passam antes de qualquer migração. A suíte completa do
projeto permanece integralmente verde — 215 de 215.

**Cobertura da superfície consumida (C-S3).** Os 4 consumidores reais importam
`medidasDaMarca`, `montarTabelaMedidas` e `MODELOS_PADRAO` — os três protegidos. A
cobertura vai além do exigido e alcança **os 9 símbolos públicos**, atendendo ao critério
de sucesso desta missão, mais estrito que C-S3.

**Capacidade de detectar regressão (C-S4).** Demonstrada por mutação: **7 de 7**
detectadas, cobrindo todos os símbolos de valor e ambas as funções. Este é o argumento
central do parecer — os demais critérios comprovam que a linha de base **existe**; apenas
este comprova que ela **funciona**.

**Proporcionalidade (C-S5).** R10 é classificada como risco **Médio** pelo Mapeamento,
por seus consumidores, sendo três telas. A cobertura entregue — 14 testes, todos os
símbolos, todos os ramos de decisão, prova de mutação — é proporcional.

**Comportamento preservado (C-S6).** Nenhum arquivo de produção foi modificado: hash
idêntico ao de `HEAD`. Não havia como alterar comportamento.

**A Pré-Abertura da Release 008 pode ser iniciada.** R10 deixa de ser **categoria B** —
cobertura apenas compartilhada — e passa a **categoria A**, linha de base própria.

O critério **C10** do Checklist de Elegibilidade — *"linha de base mensurável existente"* —,
que reprovaria R10 antes desta missão, agora encontra evidência.

> **Ressalva de escopo, registrada.** Este parecer atesta **exclusivamente** a suficiência
> da linha de base. Não antecipa nem substitui a Pré-Abertura da Release 008, que deverá
> executar os 17 critérios do Checklist na íntegra, incluindo a busca de consumidores por
> código e a leitura da redação dos bloqueios de governança vigentes.

---

## 10. Estado resultante do Grupo B

| Resp. | Categoria antes | Categoria agora |
|---|---|---|
| **R10** | **B** — cobertura compartilhada | **A** — linha de base própria ✔ |
| **R13** | A — já possuía | A — inalterada |
| **R12** | C — sem cobertura | C — inalterada |
| **R2** | C — sem cobertura | C — inalterada |
| **R15** | C — sem cobertura | C — inalterada |

**Distribuição: 2 em A · 0 em B · 3 em C.**

Com R10 em categoria A e R13 já pronta, **as duas primeiras migrações do Grupo B
(Releases 008 e 009) deixam de estar bloqueadas por ausência de linha de base.** Restam as
três de categoria C — R12, R2 e R15 —, cujas estratégias já estão registradas.
