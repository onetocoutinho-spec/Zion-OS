# AUD-006 — A loja nova, medida

```
Data:      2026-08-25 (parcial)
Ambiente:  preview da branch feat/portal-da-lojista
Host:      zion-os-git-feat-portal-da-lojista-zion-company.vercel.app
Commit:    650916b — confirmado por /api/versao, igual ao HEAD local
Banco:     fivlziuvxvhpuibrjwlq (STAGING) — confirmado no bundle do navegador
```

O T1 do [plano](../../tasks/plan.md): percorrer o caminho da loja nova, passo a
passo, marcando onde alguém da Zion ainda é necessário.

**Este documento está PARCIAL.** O que segue está dividido em duas partes, e a
divisão não é de conveniência: é do que pode ser medido sem criar conta,
autorizar OAuth e publicar anúncio.

---

## Parte 1 — medido em 25/08

Quatro coisas, todas por leitura, nenhuma escreveu nada.

| O que | Resultado |
|---|---|
| O preview serve o código de hoje | ✅ `/api/versao` devolve `650916b`, idêntico ao HEAD |
| Contra qual banco ele fala | ✅ **staging**. O bundle do navegador só traz o ref `fivlziuvxvhpuibrjwlq`; o de produção (`ouynursknlgtmewcdjzr`) não aparece em nenhum dos 18 scripts |
| A porta de entrada existe | ✅ a tela de login traz **"Ainda não tenho conta — criar a minha loja"**, e o clique troca o formulário para "Criar minha conta" |
| O app sobe limpo | ✅ zero erro no console |

A segunda linha é a que mais importa. Ela é a diferença entre medir e estragar:
se o preview estivesse apontado para produção, o percurso escreveria uma loja de
teste na conta que paga. Está apontado para o staging que foi reconstruído em
25/08 — 58 migrações, esquema com md5 idêntico ao de produção
([11](../staging-setup/11-ONDE-O-STAGING-PAROU.md)).

---

## Parte 2 — o percurso, que ainda não foi feito

Nenhuma das linhas abaixo foi medida. Elas exigem ações que não se delegam a um
assistente: criar conta com senha, autorizar o OAuth de uma conta de marketplace
e publicar anúncio.

| # | Passo | Resultado | O que exige |
|---|---|---|---|
| 1 | assinar | ✅ **passou sozinho** (com um tropeço, ver abaixo) | criar conta (e-mail + senha) |
| 2 | provisionar | ✅ **passou sozinho** | — |
| 3 | importar base | ✅ **passou sozinho** — ver abaixo | **uma planilha de ERP real** — não o modelo gerado, que passa por construção |
| 4 | imagens | — | ambiente ✅ confirmado |
| 5 | descrições | — | ambiente ✅ confirmado |
| 6 | atributos | — | ambiente ✅ confirmado |
| 7 | publicar | — | OAuth na conta do ML **de teste ou controlada** — nunca a da lojista |
| 8 | acompanhar | — | depende de 7 |

### Passo 1 — parou na confirmação de e-mail (26/08)

A conta foi criada. O `signUp` funcionou e o app disse a coisa certa na hora:
*"Conta criada. Confirme o e-mail que enviamos para entrar."*

O que parou foi a volta. Tentando entrar antes de confirmar, a tela mostrou:

```
Não foi possível entrar: Email not confirmed
```

Em inglês, sem instrução e sem saída. `AuthGate` traduzia apenas
`Invalid login credentials`; todo o resto caía no `${error.message}` cru.

**E não era hipótese.** Medido na base de PRODUÇÃO no mesmo dia: um cadastro
parado exatamente nesse ponto havia **27 dias** — nunca entrou, nunca virou
perfil, e ninguém percebeu. (O e-mail começa com `zio`, então provavelmente é
teste interno e não cliente perdido. O mecanismo é o mesmo para os dois.)

O e-mail de confirmação some no spam, ou o serviço embutido do Supabase segura
pelo limite, e a pessoa fica olhando uma frase em inglês.

**Consertado no mesmo dia:** a mensagem virou português com instrução, e ganhou
um botão de **reenviar a confirmação** ao lado. Frase sem botão continuaria
sendo parede, só que traduzida. O reenvio responde igual com e sem conta — um
reenvio que dissesse "esse e-mail não tem conta" viraria verificador de cadastro
para quem quisesse descobrir quem usa o produto.

**Destravado no staging para o percurso seguir:** a confirmação pendente foi
marcada direto em `auth.users`, escopada ao único usuário pendente (9 usuários,
0 pendentes depois). Isso é conserto de AMBIENTE, não comportamento de produto —
em produção a confirmação continua exigida, e é ela que o botão de reenvio
atende.

> **Fica em aberto:** se o e-mail de confirmação chega de forma confiável. O
> serviço embutido do Supabase é limitado e cai em spam; um SMTP próprio é a
> diferença entre "a loja assina sozinha" e "a loja assina e espera".

### Passo 1, segunda parte — o tropeço não era do produto

Depois de confirmar o e-mail, a tela mostrou "acesso não liberado". Parecia
defeito grave: a conta nova não entrava.

**Era o host errado.** Havia dois previews vivos, com o mesmo banco atrás:

```
zion-os-git-fix-multitenancy-security-…   "liberar o seu acesso"    presente
                                          "Vamos montar sua loja"   NÃO existe

zion-os-git-feat-portal-da-lojista-…      "Vamos montar sua loja"   presente
                                          "liberar o seu acesso"    NÃO existe
```

O antigo é tão anterior que devolve **404 em `/api/versao`** — o build precede a
própria rota de versão. Nele, conta sem perfil cai em *"Fale com a equipe da
Zion para liberar o seu acesso"*, que é o produto de quando a Zion era agência.

Não é defeito: é outra era do produto, ainda no ar. E foi suficiente para me
fazer procurar erro onde não havia. **Dois previews servindo eras diferentes com
o mesmo banco atrás é armadilha** — o `ML_REDIRECT_URI` apontava para o antigo
até a manhã de 26/08.

> Fica como tarefa: despublicar o preview antigo, ou tirá-lo de todo lugar onde
> ainda esteja anotado.

### Passo 2 — provisionar: passou sozinho

No host certo, a mesma conta caiu em "Vamos montar sua loja", pedindo só o nome.
O que o `/api/loja/provisionar` gravou, medido no banco logo depois:

```
empresa               TESTE NETO
plano                 Essencial
limite_esteira_mes    30
status                Ativo
marketplaces          ["Mercado Livre"]
margem_minima         5.00
perfil                papel=cliente, ativo=true, ligado à loja
```

Exatamente o desenho da rota: o `papel` decidido no servidor, o plano e a cota
vindos do vocabulário do produto, e a loja nascendo Ativa.

**E isto valida o conserto do plano fantasma no fluxo real.** A loja nasceu com
`Essencial`, que até 25/08 não existia em `PLANOS` — abrir e salvar a ficha dela
no painel da equipe reescreveria o plano em silêncio. Hoje o valor faz parte do
vocabulário, e o `PLANO_INICIAL` sai do mesmo lugar que a lista.

### Passo 3 — importar a base: passou, com três achados

Exportação real de ERP: 7,5 MB, 28 colunas, separador `;`, acentos em
Windows-1252. Resultado no banco:

```
1003 produtos · 7224 variações
6973 variações com peso · 6972 com as três dimensões
```

**Duas suspeitas minhas caíram na medição.** Achei que o separador `;` e o
Latin-1 quebrariam a leitura. Não quebram: `detectarDelimitador` e
`decodificarTexto` já tratam os dois, e os acentos chegam corretos. Vale
registrar porque foi a minha primeira hipótese e estava errada.

**A grade foi reconhecida sozinha.** 1003 pais para 7224 derivações, agrupadas
por `Código Pai`. O aviso de alçapão não disparou porque não havia alçapão — o
modo agrupado ligou sozinho pela assinatura `Código` + `Código Pai`.

#### Achado 1 — o produto não avisa que a aba está velha

A primeira importação gravou os 1003 produtos com **peso zero**. O código
publicado estava certo; a ABA é que estava com o pacote antigo, aberta desde
antes do deploy. Três sintomas de uma causa: o `nome` não mapeava sozinho, a
grade funcionava (regra velha) e o peso sumia (campo novo).

O `/api/versao` que eu consultei é o SERVIDOR — e ele estava novo. O JavaScript
da aba vem do cache e é outra coisa.

Isso é o defeito que a própria rota `/api/versao` foi criada para pegar. O
comentário dela diz: *"o autor abriu a tela, não achou um botão que já estava no
ar e não tinha como saber por quê"*. Aconteceu de novo, e desta vez com dado
indo para o banco no meio.

Refeito com `Ctrl+Shift+R`, o peso entrou. Mas ninguém deveria precisar saber
disso.

#### Achado 2 — peso importado ≠ peso confiável

Distribuição dos 6973:

```
6944  entre 50g e 5kg      mediana 450g — coerente com calçado
  18  abaixo de 50g
   1  entre 5 e 30kg
  10  acima de 100kg       máximo exatamente 800,000
```

99,6% plausível. **28 fora** — e o máximo ser exatamente `800.000` num campo
declarado em kg é a assinatura de grama digitada em coluna de quilo.

O importador está certo: ele gravou o que a planilha disse. Mas 800 kg num
chinelo produz frete absurdo e preço mínimo absurdo, e a precificação inteira
depende do peso.

Corrigir dividindo por mil seria INVENTAR dado. O caminho é o que esta base já
usa para custo desde o estrago de R$ 30 milhões: `ehReferenciaDisfarcada`
sinaliza o custo que parece código de modelo, e a pessoa decide. Peso implausível
merece o mesmo — aviso na revisão, antes de gravar, sem bloquear e sem corrigir.

#### Achado 3 — 40 requisições sem indicador de progresso

A gravação são 3 lotes de produtos e 37 de variações, sequenciais. A tela só
troca o texto do botão para "Importando…". Numa loja que opera sozinha, é onde
alguém fecha a aba achando que travou — e a importação não tem transação
cobrindo o conjunto: cair no meio deixa produtos sem parte das variações.

#### Achado 4 — a grade chegou sem cor e sem tamanho (26/08)

Você apontou um cartão de produto e disse que aquilo era **uma variação** — uma
numeração de uma cor. O agrupamento estava certo: era o pai `2344016` com nove
derivações. Medindo o produto no banco apareceu o problema de verdade:

    9 variantes · 1 cor distinta · 1 tamanho distinto

**Nove variações que ninguém consegue distinguir.** Para o Mercado Livre isso é
fatal: `COLOR` e `SIZE` são 2 dos 6 obrigatórios da categoria de calçado, e
[AUD-007](AUD-007-o-que-o-ml-exige-nas-categorias-reais.md) mediu que eles vêm
**do cadastro**, não da resposta do ML.

A causa é a exportação: **28 colunas, nenhuma chamada `Cor` ou `Tamanho`**. A
informação existe grudada dentro de `Nome da Derivação`:

    "SANDALIA MOLEKINHA 2312.260 TURIM FEM (9583 ROSA/SILVER 35)"

Confirmado com você em 26/08: **o Magazord não tem relatório com essas colunas.**
Sem exportação melhor, ou se tira do texto ou a grade não existe.

**A prova do tamanho** é o `Código Agrupador`, que junta produto + cor e **não**
inclui o tamanho. Comparando só letras e dígitos, o parêntese começa com a cauda
do agrupador; o que sobra é o tamanho. Subtração, não palpite — e palpite erraria,
porque há tamanho `37/38` e cor `PRETO 01/CAMEL 1`, com número no meio.

**A prova da cor** é a repetição entre produtos: código de fornecedor é quase
único, palavra de cor repete. Nos 1462 grupos de cor:

    PRETO 394 · BRANCO 194 · ROSA 186 · AZUL 109 · MARINHO 65 · BEGE 64
    ...e 1212 palavras num único produto

O vocabulário sai do próprio arquivo, com três filtros — sem dígito (`15745`
está em 62 produtos e é código), 3+ letras (`N`, `A`, `T` são iniciais de linha),
2+ produtos. A cor é o sufixo que começa na primeira palavra reconhecida.

**Medido pelo importador, no arquivo real:**

| | |
|---|---|
| variações | 7224 |
| com tamanho | 7211 (99,8%) |
| com cor | 7140 (98,8%) |
| produtos com 2+ variações | 900 |
| ainda com variação indistinguível | **2** |

Os 2 restantes são as 13 linhas em que o agrupador não prova nada. Saem com cor
e tamanho **vazios** — e vazio vira pergunta, que é o desfecho certo.

**O que continua aberto, e é decisão de produto:** a cor sai com o material
junto (`"preto nobu"`) e **não** está traduzida para os valores que o ML aceita.
A tradução é a T3, onde a lista vem do marketplace. Cortar o "nobuck" exigiria
uma segunda lista de palavras sem evidência de que a loja não chama a cor assim.

**Consequência para o percurso:** os 1003 produtos importados antes deste achado
estão com nome, cor e tamanho antigos. O passo 3 precisa ser **refeito** antes
dos passos 4 a 8.

---

#### Achado 5 — importar duas vezes dobra o catálogo, em silêncio (26/08)

Apareceu ao responder uma pergunta sua antes de refazer o passo 3: *"excluiu os
já existentes ou não?"*

**Não.** `confirmarImportacaoProdutos` chama `criarProdutos` → `criarVarios`, que
é `insert` puro — sem upsert, sem delete, sem conferir o que já existe. E o banco
não segura: as únicas restrições únicas em `produtos` e `produto_variantes` são
as chaves primárias, medido no staging. Não há índice único em
`(cliente_id, cod_erp)`.

Então a segunda importação da mesma planilha teria deixado **2006 produtos e
14.448 variantes**, sem uma linha de aviso.

Isto não é um defeito de laboratório. Uma lojista operando sozinha vai importar
duas vezes — vai errar o mapeamento de coluna, vai querer refazer, vai achar que
a primeira não pegou (foi exatamente o que aconteceu aqui, com o bundle velho do
achado 1). O caminho de "assina e opera sozinha" tem que sobreviver a isso.

**Corrigido em 26/08**, na parte que era possível: a tela de importação agora
CONTA, antes do clique, quantos códigos da planilha já existem no catálogo, e
diz que reimportar vai duplicá-los — o botão passa a ler "Importar 1003 (1003 em
duplicidade)". Ver `modules/catalog/domain/importacaoRepetida`.

Conta e pergunta, não decide: reimportar de propósito é legítimo (é o que se faz
depois de corrigir o mapeamento), e apagar catálogo por conta própria seria pior
que duplicar — duplicata se resolve, catálogo apagado não.

**Continua aberto:** não existe "substituir". Quem duplicar ainda depende de SQL
para limpar, que é justamente o que uma lojista não tem.

Estado depois da limpeza, para o passo 3 recomeçar do zero:

    TESTE NETO · 0 produtos · 0 variantes · cliente intacto

---

#### Achado 7 — a máquina de quem desenvolve fala com o banco de quem vende (26/08)

Duas vezes no mesmo dia a conta real foi operada por engano. Na segunda, 16
produtos da Chinelaria receberam categoria `MLB273770`.

A causa não era host antigo nem preview: era **`localhost:3000`**.

    .env.local     -> producao   (o que `next dev` carrega)
    .env.staging   -> staging    (nunca carregado)

A documentação do Next explica: `NODE_ENV` só aceita `production`, `development`
e `test`. Não existe `NODE_ENV=staging`, então `.env.staging` nunca entra na
ordem de carga. Todo `npm run dev` desta máquina falava com a produção.

**Consequência medida:** nenhuma. `produtos.categoria_ml` só decide quais
atributos a esteira cobra — não toca anúncio no ar, não publica, não muda preço.
E `MLB273770` é a categoria certa para chinelo. Decidido em 26/08: **os 16
ficam.**

**O que mudou:**

- `npm run dev:staging` — `node --env-file=.env.staging`, que funciona porque
  `process.env` é o primeiro da ordem de busca do Next.
- Migração 080: a produção também se identifica, para a tela distinguir
  "produção" de "não sei".
- A faixa ganhou o terceiro caso: **localhost + produção = vermelho**, com o
  comando certo no texto. Produção fora de localhost continua sem faixa — é a
  lojista no dia dela.

**A lição, e ela é sobre a faixa anterior:** eu tinha escrito que "a ausência
significa produção". A direção estava certa e a regra era insuficiente, porque
**ausência não é mensagem**. Quem está no lugar errado não consegue ler o que
não está na tela.

---

### Antes dos passos 4 a 6 — o ambiente da IA, confirmado

`/api/saude/ia` (sem `?sondar`, que não toca a rede e não custa nada), lida na
sessão do preview:

```
OpenAI (ChatGPT)   temChave: true   ativo: true   modelo: gpt-5
```

Isso importa para a leitura do resultado. Sem chave, os três passos parariam por
AMBIENTE, e "o produto não faz" seria conclusão errada. Com chave, o que sair
deles é resultado do produto.

E vale saber antes de olhar: existe um caminho em que a otimização sai marcada
como `[SIMULAÇÃO]` em vez de falhar. Texto plausível com essa marca **não é a IA
trabalhando** — é o sistema dizendo que não pôde. Sem saber disso, parece que
funcionou.

### Passo 4 — imagens: o caminho em lote existe, e o nome da pasta decidia tudo

O caminho existe e é bom: **"Enviar por pasta (produto → cor → fotos)"**, que
casa cada pasta com um produto, mostra a confiança e exige revisão antes de
gravar. Quase registrei aqui que ele não existia — conferi antes.

O que não funcionava era o caso mais provável. Medido nos 1003 produtos:

| nome da pasta | casou certo | não casou |
|---|---|---|
| Código Pai do ERP | 99,1% | 0% |
| nome completo do produto | 98,0% | 0% |
| **referência do fabricante** (`7208.101`) | **10,8%** | **87,8%** |

A última é como o fabricante entrega. Ela morria por pouco: 2 palavras contra 6
do nome dá 0,33, e o corte de parecença é 0,34.

A correção não foi baixar o corte — isso poria foto no produto errado. **664 dos
1003 produtos têm no nome um código que não se repete no catálogo**, e único é
identidade. Depois: **79,5%**, com as referências repetidas dizendo "não casou"
de propósito. E a tela passou a dizer, ANTES, que o nome da pasta decide.

**Ainda aberto:** não há foto nenhuma na base (0 imagens), e o percurso do passo
4 só termina quando a lojista subir uma pasta real.

---

### Passo 5 — descrições: o briefing afirmava uma medição que não houve

Montei o briefing REAL de um produto, sem chamar a IA. O topo dizia
"ATRIBUTOS OBRIGATÓRIOS DO MERCADO LIVRE (medidos na API da categoria)". Ninguém
mediu: sem categoria, `obrigatoriosDoProduto` cai na lista de calçado com
`procedencia: "palpite"` — e produto recém-importado nunca tem categoria.

    1003 de 1003 entravam assim · 50 deles são bolsa, meia ou kit

Forma exata do [INC-011](incidents/). O briefing passou a dizer de onde a lista
veio, e a proibição de inventar virou teto em vez de fato.

---

### Passo 5b — a categoria, definida antes de gerar (decisão sua, 26/08)

Medido no `domain_discovery` do ML, 201 produtos reais:

    Sandálias e Chinelos 115 · Tênis 30 · Calçados 19 (genérica)
    Águas Minerais 7 (lixo) · Sapatilhas 7

"Papete Slide Modare 7208.101 Nobuck" devolve **Águas Minerais** toda vez. Com
`limit=3`, MLB269718 aparece no top-3 até de uma consulta boa — é ruído do
endpoint. E filtrar por "não é folha" não resolve: `MLB1400 Calçados` é folha e
é publicável.

**O catálogo desmente o erro:** 11 dos 15 papetes acertam. Agrupando pelo tipo e
deixando a moda valer, Águas Minerais cai de 7 para 2 e a categoria genérica de
19 para 5. Grupo com menos de 3 não vota; empate não manda em ninguém.

Entregue: migração 079 (`produtos.categoria_ml`), o módulo do voto, a rota de
lote (que usa só 15 votos por tipo, transformando ~1000 consultas em ~180, e
funciona **sem** conexão ao ML) e a tela `/cliente/categorias`, onde a lojista
aprova por grupo vendo "11 de 15 concordam".

**Falta o percurso:** ninguém clicou ainda. O passo 5 propriamente dito — gerar
as descrições — começa depois de as categorias estarem aprovadas.

---

### Passo 5c — preço e estoque: o que travava não era código (27/08)

Com a categoria definida, os três anúncios gerados reprovaram pelo mesmo motivo,
e ele era verdade: **preço zerado, estoque zerado, sem imagens**. As pendências
eram MEDIDAS — "preço: nenhuma das 9 variações tem", "EAN: falta em 5 de 9" —,
nenhuma inventada.

A exportação de derivações do ERP **não tem coluna de preço**, e o `Qtde Estoque`
dela veio com as 7224 linhas zeradas. O número mora em outro relatório.

**Três buracos de código no caminho, e os três consertados:**

1. A importação "Só os custos" tinha o papel `precoVenda` no seletor da tela e
   **jogava o valor fora**. Quem mapeasse via a planilha ser aceita e o preço
   sumir. Agora custo e preço viajam como PAR desde a leitura da linha.
2. Não havia como importar estoque. Agora entra pela mesma porta — com um
   terceiro estado, porque **zero é resposta para estoque e não é para dinheiro**:
   a ausência dele é `-1`, e "esgotou" precisa gravar.
3. O produto recebia o número de uma linha. Estoque é SOMA das variações: 3 do 35
   mais 2 do 36 são 5, e nenhum dos dois é o número do produto.

**O primeiro arquivo do Linx chegou desalinhado** — 11 nomes no cabeçalho e 9
campos em todas as 1505 linhas, porque `REPORTGROUP` é coluna de agrupamento que
não sai nas linhas. `PRECO` recebia 25,13 (o custo) e `QUANTIDADE` recebia 46,90
(o preço). Nasceram daí o detector `cabecalhoDesalinhado` e — o que teria bastado
sozinho — **o valor de exemplo em cada coluna da tela de conferência**.

**E a tela travou duas vezes, com causa medida:**

    1003 produtos × 1505 linhas = 1.509.515 comparações
    casamento por nome: 5,7 SEGUNDOS de laço síncrono

Não é lentidão, é congelamento: o fio principal não desenha nem responde. Quem
recarrega no meio interrompe a importação **entre as duas gravações** — variações
escritas, produtos não. Aconteceu duas vezes, e deixou a base meia gravada.

Consertado em duas frentes: a importação cede o fio a cada 25 produtos, e a
gravação de N linhas com valores diferentes virou **uma requisição** (migração
082, `security invoker` — a RLS continua valendo, verificado: própria loja 1,
loja alheia 0).

**Resultado, medido:**

| | |
|---|---|
| produtos | 1003 |
| com categoria | 998 |
| com custo | 699 |
| com preço e estoque | 693 |
| **completos** (custo + preço + estoque + categoria) | **690** |

Os 313 que faltam não estão no relatório: ele tem 1505 linhas para 7224
variações. Não é defeito do sistema — é o alcance do arquivo.

---

### Passo 6 — a esteira, com tudo no lugar: APROVADO (27/08)

Três produtos completos na fila. O primeiro anúncio aprovado do percurso:

    Kit Meia Cano Ex Longo Actvitta c/3
    MLB108791 Meias · nota 46 · 0 pendências
    veredito: APROVADO · status: aguardando_aprovacao

O motivo que o próprio anúncio deu cita **atributos de meia** — "Gênero, Tipo de
meias e Tipo de comprimento". É a categoria medida funcionando: até 26/08 esse
produto recebia a lista de CALÇADO por suposição e reprovaria por "tipo de
calçado ausente" num produto que não é calçado.

O segundo subiu de 34 para **nota 68** e parou por pouco: falta EAN em 1 de 4
variações e a tabela de medidas de bebê (17/18, 19/20, 21/22), que não existe no
sistema.

**A corrente inteira funciona ponta a ponta:** importar → cor e tamanho por prova
→ categoria pelo voto do catálogo → custo, preço e estoque pelo relatório →
esteira → anúncio aprovado, aguardando a lojista.

---

### Passos 7 e 8 — NÃO percorridos, e o motivo é dado, não código

**Publicar** exige duas coisas que a conta de teste não tem:

- **nenhuma foto** — 0 imagens na base. O caminho em lote existe e foi consertado
  (passo 4), mas ninguém subiu uma pasta.
- **nenhuma conexão com o Mercado Livre** — e
  [04-MERCADO-LIVRE-STAGING](../staging-setup/04-MERCADO-LIVRE-STAGING.md) é
  explícito: o ML não tem sandbox completo. Publicar pela conexão da Chinelaria
  colocaria anúncio de teste na loja que vende, e a guarda 2 deste documento
  proíbe.

**Acompanhar** depende de ter algo no ar.

Registrado como a guarda 3 mandava: **medido até o anúncio aprovado, não até o
ar.**

---

### O que anotar em cada passo

Uma linha por passo, com uma de duas marcas: **passou sozinho** ou **parou aqui,
por isto** — e neste segundo caso, a **mensagem exata** que a tela mostrou. É a
mensagem literal que diz se o produto explica o problema ou empurra a pessoa
para um suporte que não existe mais.

### As guardas que continuam valendo

- **A conta do ML.** Staging isola o banco, não o marketplace. O app é outro,
  mas a conta que autoriza pode ser a mesma da lojista — e aí um anúncio de
  teste vai para a loja que vende. O ML não tem sandbox completo.
- **Sem conta de teste, o passo 7 para no dry-run** (`go:false`): o payload
  montado sem enviar. A medição continua válida e registra *"medido até o
  payload, não até o ar"*.
- **A chave de IA.** Se `OPENAI_API_KEY` não estiver no escopo Preview da
  Vercel, os passos 4 a 6 param por falta de configuração — e isso é resultado
  de ambiente, não do produto. Vale distinguir na anotação.

---

## CHECKPOINT 1 — decidido em 27/08/2026

A pergunta era uma só: **a loja chega ao fim sozinha?**

**Resposta: chega até o anúncio aprovado, e para antes do ar.**

    1 assinar        ✅   (o beco do e-mail foi consertado no percurso)
    2 provisionar    ✅
    3 importar       ✅   1003 produtos · 7140 cores · 7211 tamanhos
    4 imagens        ⚠️   caminho consertado (10,8% → 79,5%), NÃO percorrido
    5 descrições     ✅   com categoria medida, não suposta
    5b categorias    ✅   998 de 1003
    5c preço/estoque ✅   690 completos
    6 atributos      ✅   cobrados da categoria certa
    7 publicar       ⛔   sem foto e sem conta ML de teste
    8 acompanhar     ⛔   depende do 7

**O que isso libera:** nada da Fase 4 ainda. A regra deste checkpoint era
"chega ao fim sozinha", e o fim é o anúncio NO AR — não o anúncio aprovado.

**O que isso desmente:** a suspeita de que o caminho estava quebrado em muitos
lugares. Não estava. Dos treze achados, **onze eram silêncio** — o sistema sabia
a resposta e não contava:

- a aba velha que não avisava;
- o peso implausível que passava;
- a grade sem cor e sem tamanho;
- a importação que duplicava sem dizer;
- o briefing que afirmava medição sem ter medido;
- o `preço de venda` aceito na tela e descartado na gravação;
- a lista do `<select>` ilegível no tema escuro;
- o cabeçalho desalinhado que punha custo no lugar do preço;
- o "Aplicar" que apagava a linha sem gravar;
- a máquina local falando com a conta que paga;
- a aba congelada que parecia programa morto.

Os dois restantes eram trabalho que faltava: importar preço e importar estoque.

**O que trava o passo 7 NÃO é código.** É uma pasta de fotos e uma conta de teste
no Mercado Livre. As duas são decisão de quem opera, não linha para escrever.

**Próximo checkpoint:** repetir os passos 7 e 8 quando existir conta ML de teste.
Até lá, este documento diz o que foi medido e onde parou — que é o que a guarda 3
exigia.

---

## Depois do CHECKPOINT 1 — o passo 4 foi percorrido (27/08, à tarde)

O checkpoint fechou com **"o que trava o passo 7 NÃO é código: é uma pasta de
fotos e uma conta de teste no Mercado Livre"**. A pasta de fotos chegou no mesmo
dia, e percorrê-la mudou a linha 4 de ⚠️ para ✅ — e derrubou **metade** do que
travava o passo 7.

    4 imagens   ✅  845 de 981 produtos com foto (86%) · 7.985 imagens

### O que o percurso custou, e o que ele achou

Enviar 8 mil fotos com o casador que existia teria sido o pior resultado
possível: ele funciona bem o bastante para o estrago passar por acerto. Seis
defeitos apareceram, e nenhum deles era visível antes de tentar.

| achado | o que era | como apareceu |
|---|---|---|
| **casamento por palavra** | pasta com código caía na parecença de nome quando o código não resolvia | 53 grupos, **470 fotos no produto errado** — "Sandalia 7162219 Floather" virou MOCASSIM 7397.101 |
| **leitura truncada** | `imagens_produto` lida sem `range`, e o PostgREST corta em 1000 | o banco recusou 6 lotes: `idx_imagens_produto_uma_capa` pegou o que o código deixou passar |
| **amostra presa num galho** | o nível do produto era escolhido pelas 30 PRIMEIRAS pastas, todas do primeiro TIPO | 543 grupos viraram 18, e os 11 que casaram foram todos para o mesmo produto |
| **peso como código** | `152g` → `152G`: 4 caracteres com dígito, o mínimo para virar referência única | dois slimes diferentes casando num terceiro, "por identidade" |
| **tamanho como código** | `24/25` → `2425`, e o conserto do primeiro item transformou isso em trava | 23 grupos deixaram de casar por causa do próprio conserto |
| **palavra no lugar do SKU** | 22 produtos com "inativoo", "iinnattivo", "inatt" — recado do ERP lido como código | entraram como produto, 19 receberam foto, e um estava na lista de "faltam fotos" |

**O padrão dos seis é o mesmo do checkpoint:** cinco eram silêncio. O sistema
tinha o dado e não contava. O único que não era silêncio — a leitura truncada —
só apareceu porque uma **restrição do banco** gritou; sem a migração 053, ele
teria corrompido as capas em silêncio também.

### O que foi desfeito

- **547 fotos removidas** do produto errado (Storage e banco), com a capa
  recomposta nos 20 produtos que ficaram só com secundárias.
- **22 produtos apagados** — os marcadores do ERP —, com 148 fotos, 28 variantes
  e 1 anúncio órfão que o `on delete set null` teria deixado para trás.

Nada disso é perda: os originais estão em disco e a planilha está com a lojista.

### O passo 7, hoje

    sem foto ................. RESOLVIDO para 845 de 981 (86%)
    sem conta ML de teste .... CONTINUA

A guarda 2 segue de pé: publicar pela conexão da Chinelaria poria anúncio de
teste na loja que vende, e o ML não tem sandbox completo.

**Então o checkpoint não muda de resposta** — "chega até o anúncio aprovado, e
para antes do ar" — mas muda de motivo. Era falta de dado E de conta; agora é só
de conta.

### O que sobrou, e de quem é

| o que | quantos | de quem depende |
|---|---|---|
| conta ML de teste | — | decisão de quem opera |
| crédito da OpenAI | 579 na fila, **224 com tudo pronto** | faturamento |
| fotos que não existem | 136 produtos, 6.467 pares parados | fotógrafo |
| fotos sem produto | ~2.700 imagens | uma pessoa no seletor da tela |

**361 anúncios estão publicáveis** — aprovados, com zero pendências, foto,
preço, grade e categoria. Nenhum deles espera código.

---

## O resto do dia 27/08 — o que percorrer o passo 4 ainda cobrou

A seção acima fechou com os seis defeitos do casamento de fotos. O dia continuou,
e o que veio depois não estava em documento nenhum além dos commits — que não é
onde alguém procura em novembro.

### O seletor de pastas: 4 erros em 5, e a tela não dizia

O envio pela tela falhou **cinco vezes seguidas**, e o casamento não tinha culpa.
O seletor do Chrome abre dentro da última pasta usada e escolhe a pasta em que se
**está**, não a que aparece destacada. Quatro tentativas mandaram a mesma pasta de
COR.

O contorno do dia foi subir pelo terminal. Isso resolveu o dia e **não resolveu o
produto**: a lojista não tem terminal, e este é um dos passos que ela faz sozinha.

**Não dá para consertar, só para dizer.** `webkitRelativePath` começa NA PASTA
ESCOLHIDA — o nome do produto não está em lugar nenhum do que o navegador
entrega. `modules/catalog/domain/pastaEscolhidaErrada` reconhece o formato e
avisa antes do envio, com dois sinais e só dois: pasta sem subpasta que não casa
(folha da árvore) e escolha idêntica à anterior. Confirmado funcionando na tela.

### Nove segundos por escolha de pasta, e dois deles eram meus

|  | antes | depois | o que era |
|---|---|---|---|
| casador | 5,3 s | 0,2 s | reindexava os 981 produtos a cada uma das 543 pastas — **síncrono**, congelava a tela |
| contagem de fotos | 3,6 s | 0,4 s | baixava as 8.090 imagens (4,8 MB) para montar 929 contagens |

O primeiro eu **introduzi** no commit do desempate, na mesma manhã: a regra
estava certa e o custo passou despercebido porque os testes usam catálogos de
cinco produtos. O segundo é a migração **083**, aplicada nos dois bancos e
conferida contra os dados de cada um — 929 chaves iguais no staging, 121 na
produção, zero divergências dos dois lados.

A distinção importa e ficou escrita: congelamento é interface morta, espera é
interface viva. Só o primeiro parece "o software travou".

### O erro que eu causei, e o que o salvou

Onze pares de produtos com o mesmo nome e SKUs diferentes pareciam duplicata. Eu
copiei 142 fotos de um irmão para o outro **antes** de comparar as grades. Elas
não têm uma combinação de cor+tamanho em comum: são o mesmo MODELO partido em
duas linhas do ERP **por cor**. Pus foto de chinelo rosa em chinelo preto — a
mesma classe de erro que o dia inteiro foi gasto removendo.

Desfeito por inteiro, e o que tornou o desfazer exato foi a **procedência**:
cada linha copiada levava `"Copiada do cadastro gêmeo 2356812"` em `observacoes`,
gravada com a justificativa de que "senão ninguém entende daqui a um mês". Ela
serviu vinte minutos depois, para outra coisa.

**A regra que sobrou disso**, e que vale mais que o conserto: aja para descobrir
quando a ação é REVERSÍVEL; meça antes quando ela NÃO É — e meça a **premissa**,
não o volume. A pergunta errada foi "quantas fotos vou copiar"; a certa era
"estes dois são mesmo o mesmo produto?".

### O que os números dizem no fim do dia

    produtos 981 · fotos 8.090 · anúncios 410 · PUBLICÁVEIS 361
    fila: 398 concluídos · 579 pendentes · 4 em erro
    sem foto 129 · cadastro incompleto 302
    dos 583 sem anúncio, 230 já prontos para a esteira rodar

### O que ainda não foi olhado

- **4 itens em erro na fila** — o motivo nunca foi lido. Provavelmente crédito.
- **40 modelos partidos em 89 linhas de produto** por cor. É a versão grande dos
  "gêmeos": hoje cada linha vira um anúncio, quando o ML quer um anúncio com as
  cores como variação. Mexe no ERP, não só aqui.
- **~2.700 fotos sem produto** — 630 grupos, e a maioria é de produto que não
  está neste catálogo. Só 26 grupos têm candidato real e pedem uma pessoa.
- **13 erros de `typecheck:test`**, anteriores a esta branch, em quatro arquivos.

---

## 28/08 — O ENSAIO DO PASSO 7, E O QUE ELE ACHOU

O passo 7 nunca foi percorrido, e a guarda 3 do plano dizia o que fazer nesse
caso: **parar no dry-run — o payload montado sem enviar.** Isso foi feito hoje.

### Primeiro achado: o ensaio não media o que o real recusa

`go: false` saía no **passo 4** de `publicarNoMercadoLivre`, e a conferência que
prevê a recusa do ML — `obrigatoriosAusentes` contra `atributosObrigatorios` da
categoria — só roda no **passo 4.5**. O ensaio validava credencial e categoria e
devolvia `dry: true` para um anúncio que o ML reprovaria.

Um ensaio que aprova o que o real reprova responde a outra pergunta. A saída
passou para depois da conferência e antes de `criarItem` — a única linha do
fluxo que escreve. `oEnsaioMedeOQueORealRecusa.test.ts` guarda a ordem nos dois
fluxos, porque ela não aparece no retorno da função.

O caminho **User Products** sai antes da conferência, porque o caminho REAL dele
também não confere. Agora ele diz isso na resposta (`obrigatoriosConferidos:
false`) em vez de deixar quem conta supor que conferiu.

### Segundo achado: 63% dos publicáveis seriam recusados

Medido em 28/08 com `scripts/ensaioDaPublicacao.mjs`, contra a base real, sem
rede autenticada e sem enviar nada:

    anúncios 880 · publicáveis 793

    passariam na conferência da categoria ..... 291
    faltando atributo obrigatório ............. 500
    sem categoria / sem produto ...............   2
    categoria que o ML não respondeu ..........   0

    500  GENDER
    410  FOOTWEAR_TYPE

**"Publicável" queria dizer "passou nas regras da esteira", não "o ML aceita".**
A esteira cobra foto, grade, preço e categoria; ela nunca cobrou os obrigatórios
da categoria, que é o que o ML de fato exige.

### Terceiro achado: o dado existe, e é jogado fora

    dos 500 recusados, o resolvedor responde TODOS os ausentes em 497

    497  GENDER          cadastro
    410  FOOTWEAR_TYPE   cadastro
      3  GENDER          ausente

`resolverObrigatorios` lê `produto_atributos` — o que a lojista preencheu — e já
roda hoje: alimenta o BRIEFING que o modelo recebe. O que ele não faz é entrar
no payload. `montarItemML` monta `attributes` **só** a partir da ficha técnica
que o modelo escreveu, e numa amostra de 400 aprovados a ficha traz "Gênero" e
"Tipo de calçado" em apenas 159.

Ou seja: pede-se ao modelo, e não se garante. Quando ele esquece, a resposta que
estava no banco não chega ao ML.

Os 497 vêm todos de **cadastro** — resposta da lojista, não palpite pelo nome.
Aproveitá-los não fere "null vira pergunta, nunca chute"; os 3 que sobram viram
pergunta, que é o comportamento certo.

### O que isso muda no CHECKPOINT 1

Continua "chega até o anúncio aprovado, e para antes do ar" — mas o número de
anúncios que sobreviveriam ao ar é **291, não 793**, e sobe para ~788 com um
conserto que não pede nada a ninguém: fazer o payload levar o que o resolvedor
já sabe.

### O conserto, e por que no payload

Costurado em `publicarNoMercadoLivre`, no passo imediatamente anterior à recusa:
antes de recusar por atributo ausente, pergunta ao cadastro.

**No servidor, e não no navegador**, porque a resposta depende da CATEGORIA — e
a categoria muitas vezes só existe ali. `payload.category_id` chega vazio do
navegador e é preenchido no servidor por `preverCategoria`, que precisa do token
do lojista, que nunca desce. Resolver no navegador funcionaria só para quem já
sabia a categoria, que é a minoria. No servidor vale para os três caminhos —
tela da equipe, portal e confirmação de proposta do chat — porque os três
atravessam a mesma função.

**Só o que ela respondeu.** `doCadastroParaOPayload` aceita origem `cadastro` e
`marketplace`, e recusa `nome`. Dedução pelo título serve para sugerir num
briefing; publicada, vira uma afirmação da lojista que ela não fez, num anúncio
que fica no ar sob a conta dela. Excluí-la não custou nada: os 497 resolvíveis
vêm todos do cadastro.

**Leitura que falha não bloqueia.** Erro de banco devolve lista vazia, e o efeito
é o de antes desta função existir: o obrigatório continua ausente e a recusa é a
que já existia. Enriquecimento não pode inventar um modo novo de falhar.

### Medido de novo, depois do conserto

    passariam na conferência da categoria .... 788   (era 291)
      destes, completados pelo cadastro ...... 500
    faltando atributo obrigatório ............   3   (era 500)

Os 3 que sobram são o mesmo produto — "Chinelo Havaianas Top Liso", sem gênero no
cadastro e sem gênero no nome. Viram pergunta, que é o comportamento certo.

O que continua fora: o modelo **User Products** não confere obrigatórios em
caminho nenhum, e por isso o ensaio dele responde `obrigatoriosConferidos:
false`. Medir aquele caminho é tarefa própria.

### CORREÇÃO, no mesmo dia: o 788 vale para 119 anúncios, não para 793

O número acima mede a conferência do **fluxo clássico**. Só que
`publicarNoMercadoLivre` BIFURCA antes dela, no passo 3.5: categoria em
`CATEGORIAS_USER_PRODUCTS` segue outro caminho e nunca chega ao passo 4.5.

E MLB273770 — calçado — está nessa lista. Medido:

    User Products (MLB273770) ... 674   85% dos publicáveis
    clássico (as outras 5) ...... 119

Então o conserto de hoje cobre **119**, não 793. Para os 674, o portão é outro:
`montarBundleUserProducts`, que monta a guia de tamanhos e RECUSA quando não
acha o dado. Medido nos 674:

    bundle monta ...... 258
    bundle recusa ..... 416
        408  gênero ausente ou não reconhecido na ficha técnica
          8  nenhuma variação com tamanho publicável + medida da marca

**É o mesmo defeito, na mesma linha, por outra porta.** `montarBundleUserProducts`
lê o gênero de `fichaValor(anuncio, ["genero", ...])` — a ficha técnica que o
modelo escreveu, e que traz "Gênero" em 159 de 400. A resposta continua em
`produto_atributos`, e continua sem chegar.

O que de fato atravessaria os portões que controlamos, hoje:

    119 clássicos + 258 User Products = 377 de 793

**Como o erro passou:** medi a conferência sem antes perguntar qual caminho o
catálogo toma. O ensaio rodou a função certa sobre o conjunto errado, e o
número saiu grande e convincente. A pergunta que faltou é de uma linha —
`precisaUserProducts(categoria)` — e ela estava no mesmo arquivo que eu editei.

### A porta do User Products, consertada e medida (28/08)

Mesmo defeito, mesma fonte de verdade, endereço diferente:
`montarBundleUserProducts` lê o gênero de `fichaValor(anuncio, ["genero", ...])`
— a ficha que o modelo escreveu — e recusa sem ele.

`fichaValor` passou a consultar `produto_atributos` **quando a ficha não
responde**. A ficha continua mandando: o anúncio é o trabalho do modelo sobre
este produto, e o cadastro é a resposta de antes; sobrescrever uma pela outra
trocaria a nova pela velha sem ninguém pedir.

Três chamadores recebem o cadastro, e o terceiro não é simetria: o ensaio
congelado da proposta do chat É o pedido que o clique publica. Se ele recusasse
enquanto o navegador monta o dele com o cadastro, o cartão e a tela passariam a
discordar sobre o mesmo anúncio.

Medido nos 674 publicáveis de calçado:

    sem cadastro   monta 258 · recusa 416
                       408  gênero ausente na ficha técnica
                         8  sem tamanho publicável + medida da marca

    COM cadastro   monta 641 · recusa  33
                        30  sem tamanho publicável + medida da marca
                         3  gênero ausente na ficha técnica

As recusas por medida de marca subiram de 8 para 30, e **isso não é regressão**:
são anúncios que antes morriam antes, no gênero, e nunca chegavam a esta
conferência. O bloqueio seguinte ficou visível — Molekinho (13), Ipanema (7),
Modare (6), Yvate (3), Beira Rio (1) não têm medida cadastrada para os tamanhos
que esses anúncios usam.

### Onde os dois portões deixam o catálogo

    User Products ... 641 de 674   (era 258)
    clássico ........ 119 de 119   (era ~29)
    ------------------------------------------
    total ........... 760 de 793   (era 377)

Continua parado no mesmo lugar do CHECKPOINT 1: **falta a conta ML de teste**.
Nenhum destes 760 foi ao ar, e nenhum vai antes dessa decisão.

### As medidas de marca que faltam (28/08)

Os 30 recusados por medida foram medidos um a um. Todos por TAMANHO FORA DA
FAIXA da tabela embutida no software — nenhum por erro de leitura:

    Molekinho  19 a 24   a tabela embutida começa em 25/26   (bebê)
    Ipanema    25 e 26   começa em 33/34                     (infantil)
    Yvate      41 a 43   termina em 40
    Beira Rio  41        termina em 40
    Modare     33        começa em 34

(O sufixo "BR" do cadastro — "38 BR", "41-42 BR", "36,0 BR", 34 das 67 formas
distintas — foi conferido e NÃO é o problema: `normalizarTamanho` já o resolve.)

**Essas medidas não estão no software e não é para estarem.** Centímetro de
calçado é o que a compradora usa para decidir o pé; inventar aqui é a mesma
falta que `medidaDoTamanho` recusa quando escolhe entre 35 e 36 e "inventa 0,7
cm". Não cadastrei nenhuma.

O que faltava era a resposta DELA chegar. A lojista tem editor em
`/cliente/medidas` e 14 tabelas gravadas em `tabelas_medidas` — e
`medidasDaMarca` lia só a lista embutida. Ela editava, salvava, e a publicação
não mudava: a parede não tinha maçaneta.

Agora a tabela dela COMPLETA a embutida — acrescenta o que falta, corrige o que
ela discorda, e não apaga o que ela não repetiu. E a recusa deixou de ser um
beco:

    antes   nenhuma variação com tamanho publicável + medida da marca "Molekinho"
    agora   a tabela de medidas da marca "Molekinho" não cobre o tamanho 21.
            Abra Medidas, acrescente essa numeração na tabela da Molekinho e
            publique de novo.

**Medido, e o número de hoje não muda:** 641 de 674, igual — as 14 tabelas dela
são cópia das embutidas, então não há nada novo para acrescentar ainda. O que
mudou é que agora existe o que fazer. Simulando em memória as faltantes (nada
gravado no banco):

    hoje ............................ 641 de 674
    se ela cadastrar as faltantes ... 671 de 674

Os 3 restantes são os sem gênero em lugar nenhum.

### As numerações cadastradas — 11 das 16, e por que não 16 (28/08)

Escritas em `tabelas_medidas` da loja por `scripts/completarTabelasDeMedida.mjs`:

    Molekinho   21=14,0  22=14,5  23=15,0  24=15,5
    Ipanema     25=16,0  26=16,7
    Yvate       41=27,3  42=28,0  43=28,7
    Beira Rio   41=27,3
    Modare      33=21,5

**Nenhum número foi interpolado.** Todos saíram de `PADRAO_BR`, em
`tabelasMedidas.ts`, cuja fonte declarada é "guias da Chinelaria Leilane Neves
(05_Guias_de_Medidas)" e cuja faixa adulta o próprio arquivo diz estar "alinhada
ao guia Azaleia/Yvate".

**Molekinho 19 e 20 NÃO foram escritos**: `PADRAO_BR` começa em 21, e não há
fonte para eles em lugar nenhum do repositório. Inventar dois valores para
destravar 4 anúncios seria pôr no anúncio um comprimento de pé que ninguém
mediu. Ficam como pergunta para quem tem a tabela do fabricante.

**O que estes números são, e o que não são.** São REFERÊNCIA, não medida de
fabricante. Conferido marca a marca antes de escrever:

    Yvate       a tabela dela É o PADRAO_BR de 34 a 40, valor a valor —
                continuar em 41 a 43 pela mesma grade é exato.
    Modare      grade própria, passo 0,7 terminando em 26,5. A continuação dela
    Beira Rio   daria 27,2 em 41 e 21,6 em 33; a fonte diz 27,3 e 21,5.
                Diferença de 1 mm, e o valor escrito é o da fonte, não o meu.
    Molekinho   tabela em pares; o 25/26 dela bate com o 25 do PADRAO_BR.
    Ipanema     grade Grendene em pares; a infantil dela não foi conferida.

Quem tiver a tabela do fabricante corrige por cima em `/cliente/medidas` — é
exatamente para isso que a tabela dela passou a completar a embutida.

**Reversível**: o estado anterior das 14 tabelas foi salvo antes da escrita, e o
que mudou são 11 linhas acrescentadas em 5 delas. Nenhuma linha existente foi
alterada ou removida.

### Onde os dois portões deixam o catálogo agora

    User Products ... 667 de 674   (era 258 de manhã, 641 depois do cadastro)
    clássico ........ 119 de 119   (era ~29)
    ------------------------------------------
    total ........... 786 de 793   (era 377)

Os 7 que sobram: 3 sem gênero em lugar nenhum e 4 Molekinho de numeração 19/20,
os dois números sem fonte. Nenhum deles é código.

E continua faltando o mesmo de manhã: **a conta ML de teste**.

---

## CORREÇÃO — 28/08, fim do dia: eu medi a base errada

Tudo que este documento registrou hoje sob "os 793 publicáveis" foi medido em
**produção**, não na base do percurso T1. São duas bases, e elas não se parecem:

                          staging (T1)   produção (loja real)
    produtos                     983               72
    fotos                      8.090              641
    anúncios                     410              880
    publicáveis                  361              793
    JÁ NO AR                       0              792
    produto_atributos              0              549
    tabelas_medidas                0               14

O erro entrou no primeiro comando do dia: `ensaioDaPublicacao.mjs` rodou com
`--env-file=.env.local`, que aponta para produção. Cheguei a rodá-lo com o
cliente do T1 (`065e0f75`), recebi "anúncios: 0" e li isso como id errado — em
vez de como base errada. Troquei o id e segui.

**O que isso muda:**

- Os números de hoje — 291→788 no clássico, 258→641→667 no User Products —
  descrevem anúncios que **já estão no ar**: 792 dos 793. Que os portões os
  deixem passar é coerente (eles passaram), mas "prontos para publicar" está
  errado. Havia **um** anúncio publicável sem MLB.
- As 11 numerações de medida foram gravadas nas tabelas da **loja real**. É onde
  elas servem — ela usa aquelas tabelas —, mas eu as descrevi como conserto do
  catálogo do percurso, e não são.
- Na base do T1 os dois consertos de hoje **não resolvem nada**: `produto_atributos`
  e `tabelas_medidas` estão VAZIAS ali. O ensaio contra staging diz, com todas as
  letras: `destes, completados pelo cadastro ..... 0`.

**O passo 7 medido na base certa (28/08, staging, cliente 065e0f75):**

    publicáveis 361 · User Products 189 · clássico 172

    User Products   bundle monta 146 · recusa 43
                        12  gênero ausente na ficha técnica
                        31  marca sem tabela de medidas (Ipanema infantil,
                            Olympikus, Under Armour — marcas que não têm
                            tabela nenhuma, embutida ou da loja)

    conferência da categoria (sobre os 361)
                    passariam 288 · faltando atributo 70 · sem categoria 3
                        56 GENDER · 6 SOCKS_TYPE · 6 LENGTH_TYPE · 4 FOOTWEAR_TYPE

O corte por caminho dentro dos 70 não foi medido — é a mesma conta que eu já
errei uma vez hoje ao aplicar a conferência clássica ao conjunto inteiro, e não
vou repetir de cabeça.

**O que continua valendo do dia:** os consertos de código. Eles são corretos e
os testes os provam; o que estava errado era o conjunto sobre o qual eu contei.
Numa loja nova — que é o caso do T1 — `produto_atributos` chega vazio, então o
que preenche a ficha ali é a importação, não o cadastro.

**Como não repetir:** o script não diz em que base está falando. Imprimir a
origem (`NEXT_PUBLIC_SUPABASE_URL`) na primeira linha teria posto "produção" na
tela em cada uma das seis medições de hoje.

---

## POR QUE A LOJA NOVA CHEGA SEM ATRIBUTO — investigado em 28/08

A pergunta era por que o T1 tem ZERO linhas em `produto_atributos` e a loja real
tem 549. A resposta explica as duas, e abre um buraco no caminho da intenção.

`produto_atributos` tem **exatamente dois escritores**:

1. `components/produtos/AbaAtributos.tsx` — um por vez, à mão, na tela
   `/produtos/[id]`, que é **da equipe**.
2. `services/importarAnunciosML.ts` — o "enriquecer", que copia de volta os
   atributos dos anúncios que a loja **já tem publicados** no Mercado Livre.

A loja de produção tem 549 porque já vende no ML: o enriquecer leu os anúncios
vivos dela. O T1 tem zero porque veio de planilha de ERP e nunca publicou.

### O laço, e ele está fechado

Para quem nunca publicou, os quatro caminhos até o gênero:

| caminho | estado |
|---|---|
| planilha do ERP | `CAMPOS_MAPEAVEIS` tem 18 campos, **nenhum** é atributo |
| enriquecer do ML | precisa de anúncio publicado, e publicar é o que falta |
| a lojista | o portal dela **não tem** onde informar atributo |
| pelo nome | responde **2 dos 12** medidos, e publicar dedução foi recusado |

**Atributo vem de anúncio publicado; publicar exige atributo.** É a mesma forma
do defeito que peso e dimensão tiveram em 26/08, e que aquele arquivo registra:
*"o importador NÃO TINHA ONDE COLOCAR. Não era falha de mapeamento: o campo não
existia."*

E está no caminho crítico da intenção — "publica sem ninguém da Zion em nenhum
passo". Hoje, para esses anúncios, ela não publica: o único lugar de informar o
atributo é uma tela da Zion.

### O que o conserto de hoje realmente cobre

Ele funcionou nos 500 anúncios da loja real **porque ela já vendia**. Numa loja
nova não há o que completar. `oCadastroDaLojaNovaChegaVazio.test.ts` fixa isso —
falha no dia em que o laço se abrir, que é o dia de reescrever esta seção.

### A decisão que fica para você

Três saídas, e nenhuma é minha para escolher:

- **coluna no importador** — o ERP da Chinelaria traz gênero? Se traz, é o
  conserto mais barato e tem precedente exato (peso/dimensão, 26/08).
- **perguntar no portal** — a pendência já existe e é lida; falta onde responder.
  É a que mais serve à intenção, e a mais cara.
- **aceitar a dedução pelo nome** — barata e cobre 2 de 12. Publica sob a conta
  dela uma afirmação que ela não fez, e hoje foi recusada de propósito.
