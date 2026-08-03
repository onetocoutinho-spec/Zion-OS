# DES-005 — A escala é desenho, não conserto

```
Data:      2026-08-03
Motivo:    "se 500 usuários usarem nosso software no máximo, ele quebra?"
Resposta:  Quebra. Este documento diz ONDE, em que ORDEM, e o que muda.
Precede:   DES-003 (foto por cor) — muda o que vale construir lá
```

A pergunta veio de uma tela lenta. A resposta não cabe em "otimizar a
importação", porque a lentidão e a parede de escala têm a mesma causa e ela é
de desenho: **o navegador da lojista é o operário, e a varredura é o motor.**

---

## 1. O que foi medido (e o que continua sendo estimativa)

### Medido no banco de produção, 03/08/2026

| tabela | linhas | tamanho |
|---|---|---|
| `anuncios_gerados` | 880 | 2.704 kB |
| `produto_variantes` | 970 | 1.144 kB |
| `produtos` | 80 | 864 kB |
| `produto_atributos` | 552 | 424 kB |
| `imagens_produto` | 653 | 264 kB |

**≈ 5,5 MB de dados por lojista.** Banco inteiro: 20 MB. E o JSONB `anuncio` é
**76,6% do peso da linha** (1.055 kB de 1.377 kB) — com descrição VAZIA, porque
são anúncios importados. Quando a esteira gerar conteúdo de verdade, cresce.

### Medido no código

- A leitura do ML são **16 páginas sequenciais** + 40 lotes de multiget (6 por
  vez) + uma rodada por categoria, tudo dentro de **uma rota de 60s** que já
  estourou em 02/08 (504 → `Unexpected token '<'`).
- A escrita dos quatro fatos da 051 produz **payload único por linha**, então o
  agrupamento vira identidade: **~790 UPDATEs**, 6 por vez, saindo do navegador.
- `atualizarEstadoNoMarketplaceBulk` agrupa por estado e engole a falha **por
  grupo** — foi assim que "155 não gravaram" apareceu na tela: o balde
  `under_review` inteiro.

### Medido sem token, contra a API do ML

| rota | resposta |
|---|---|
| `/marketplace/moderations/infractions/{id}` | 403 PolicyAgent → existe |
| `/moderations/infractions/{id}` | 403 PolicyAgent → existe |
| `/moderations/last_moderation/{id}-ITM` | 403 PolicyAgent → existe |
| `/users/{id}/infractions` | 404 → **não existe** |

### NÃO medido — e por isso não afirmado

Os números da cota do ML por aplicação, o limite de concorrência do plano Pro da
Vercel e o teto de conexões do Supabase. **Nenhum é estimável**: é leitura de
painel e de documentação. A *forma* do gargalo está estabelecida; a capacidade
exata, não.

---

## 2. A ordem em que quebra

Planos reais: **Vercel Pro**, **Supabase Free**.

| ordem | muro | onde estoura |
|---|---|---|
| 1º | **Egress do Supabase** — 5 GB/mês | ~4 MB por clique em Importar. 500 lojistas × 1/dia ≈ 2 GB/dia → **2,5 dias** |
| 2º | **Disco do Supabase** — 500 MB | 5,5 MB/lojista → **~40 a 90 lojistas**, não 500 |
| 3º | **Cota do ML** | É por **aplicação**. 500 lojistas tomam 429 **juntos** |
| 4º | **A aba** | Fechou, acabou. Oscilou a rede, perdeu 155 linhas. Sem retomada |
| 5º | **Os 60s** | 781 já roça; 2.000 anúncios é impossível por construção |
| 6º | **A chave da IA** | Uma chave, 500 inquilinos — mesmo problema da cota |

Duas observações que mudam a leitura da tabela:

- **O Free pausa o projeto após 7 dias de inatividade.** Isso sozinho
  desqualifica cobrar de alguém — é decisão de plano, não de código.
- **O Vercel Pro não é gargalo.** Ele já permite `maxDuration = 300` (o worker
  usa) e cron por minuto. A rota de importação estar em 60 é resíduo, não
  limite.

---

## 3. O desenho

### 3.1 Parar de varrer, passar a ouvir

O ML notifica. Tópicos que interessam: **`items`**, **`items_prices`**,
**`stock-location`**, **`user_products_families`**.

Hoje: 500 lojistas × 800 anúncios = **400.000 leituras/dia**.
Ouvindo: ~2.000 mudanças/dia. **Duas ordens de grandeza** — é isto que faz a
cota por aplicação fechar.

**Três regras da doc que são restrições de projeto, não detalhes:**

1. **HTTP 200 em 500 ms.** O callback **não pode processar nada**. Ele grava a
   notificação e responde. Trabalho síncrono estoura o prazo e o ML **desativa o
   tópico** — a falha não é lenta, é surda.
2. **Retry por 1 hora, depois descarte.** Notificação perdida é perdida. Por
   isso **a varredura não morre**: ela vira rede de segurança periódica, não
   motor.
3. **Não existe tópico de moderação/infração.** Ouvir resolve item, preço e
   estoque. **Não resolve a categoria que ameaça a conta** — infração continua
   sendo consulta periódica ao `/infractions`.

O callback se configura no painel `applications.mercadolibre.com`. **É clique,
não código.**

### 3.2 A importação vira job, não requisição

Uma linha numa tabela com cursor e estado, e um worker consumindo fatias.

O que isso resolve de uma vez:

- os **60s** deixam de ser teto — cada fatia cabe;
- a **aba** deixa de ser o operário: fecha e continua;
- os **155 perdidos** viram retentativa do worker, não clique dela;
- **500 inquilinos viram fila** — justa e limitada — em vez de 500 estouros
  simultâneos.

O padrão já existe no repo (`fila_otimizacao_produto` + `/api/otimizar/worker`).
Não é módulo novo: é o mesmo padrão aplicado à importação.

### 3.3 Um acelerador só, por marketplace

A cota é por aplicação, então o limite tem que morar **num lugar**. Hoje são
três constantes espalhadas, cada uma calibrada por um incidente diferente:
`SIMULTANEOS = 6` no multiget, `SIMULTANEAS = 6` no update, chunks de 100/200/500.

Subir qualquer uma troca "demorado" por `Failed to fetch` — já aconteceu duas
vezes nesta base.

### 3.4 O que muda no DES-003

A foto por cor pressupunha varredura para descobrir o que consertar. Com
notificação, o gatilho passa a ser o evento do ML. **Por isso este documento vem
antes.**

---

## 4. O que NÃO fazer

- **Aumentar os limites de concorrência sem mudar o desenho.** Troca lentidão
  por perda silenciosa.
- **Processar dentro do callback.** 500 ms é o prazo, e estourar desativa o
  tópico.
- **Confiar só na notificação.** O descarte após 1 hora exige a varredura de
  segurança.
- **Adivinhar endpoint.** Custou duas tardes em 02–03/08. A medida sem token
  custa trinta segundos.

---

## 5. A ordem sugerida

1. **Egress** — o muro mais próximo. *(feito em 03/08: o JSONB saiu das
   telas de lista e dos três caminhos da importação — 76,6% da linha)*
2. **`maxDuration` 60 → 300** na importação. Uma linha, reversível, o Pro já
   permite e o worker já usa.
3. **Job retomável** — mata a aba como operário e os 155 perdidos.
4. **Callback + tópicos** — precisa do clique no painel do ML.
5. **Acelerador único.**
6. **Plano do Supabase** — decisão de negócio, e ela chega antes do segundo
   cliente, não do quingentésimo.

---

## 6. A pergunta que precede cada item

**Qual é o resultado observável, e como ele é medido depois?**

Para este desenho o candidato é: *"importação de 781 anúncios termina com a aba
fechada e zero linhas perdidas"*.

"O código respondeu sem erro" não é medição — foi assim que três sucessos falsos
foram afirmados no mesmo recurso em 03/08, verificando sempre o passo seguinte
em vez do resultado.
