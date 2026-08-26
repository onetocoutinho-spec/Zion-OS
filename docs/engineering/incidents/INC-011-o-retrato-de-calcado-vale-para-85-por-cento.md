# INC-011 — O retrato de calçado é passado à mão para 118 anúncios que não são calçado

```
Status:      Aberto — registrado e quantificado, NÃO corrigido
Detectado:   2026-08-25, no CHECKPOINT 2 do plano (AUD-007)
Severidade:  pendência falsa trava publicação; exigência real fica sem cobrança
Correção:    fora do escopo do T3 — muda o comportamento de 792 anúncios
```

## O defeito

Cinco caminhos resolvem atributos obrigatórios passando `OBRIGATORIOS_CALCADO`
**à mão**:

- `api/otimizar/worker/route.ts`
- `app/cliente/anunciar/page.tsx`
- `modules/assistant/domain/propostaDeAnuncio.ts` (dois lugares)
- `modules/publication/domain/preparacaoDoAnuncio.ts` (como padrão)

O comentário de `api/ml/categoria/route.ts` já dizia por quê: *"os cinco
caminhos passam `OBRIGATORIOS_CALCADO` à mão porque NINGUÉM SABE A CATEGORIA"*.

Medido em 25/08/2026 ([AUD-007](../AUD-007-o-que-o-ml-exige-nas-categorias-reais.md)),
a conta tem **seis** categorias, e o retrato só vale para uma:

```
MLB273770   674 anúncios   o retrato está certo
MLB23332     94 anúncios   exige 5, não 6 — não tem FOOTWEAR_TYPE
MLB7022       8 anúncios   exige 2: marca e modelo
MLB1400       8 anúncios   FOOTWEAR_TYPE é `string`, não lista fechada
MLB275574     7 anúncios   exige 5
MLB108791     1 anúncio    exige 7, incluindo SOCKS_TYPE e LENGTH_TYPE
```

**118 de 792 anúncios (15%) estão em categorias onde o retrato erra** — e erra
nas duas direções.

## Os dois estragos, e o primeiro é o que trava

**Cobra o que a categoria não pede.** Em MLB23332 (94 anúncios) o retrato exige
`FOOTWEAR_TYPE`, que aquela categoria não pede. Quando o produto não resolve
esse atributo, nasce uma pendência que **não existe** — e publicar exige a lista
de pendências vazia (`veredito A10`). É o mesmo defeito que o DES-001 arrancou
do A10, voltando por outra porta: ali o A10 inventava exigência de cabeça; aqui
a exigência vem de uma lista certa, aplicada à categoria errada.

**Não cobra o que a categoria pede.** MLB108791 exige `SOCKS_TYPE` e
`LENGTH_TYPE`. Como o retrato não os conhece, ninguém pergunta, o payload sai
sem eles, e quem recusa é o ML — depois do clique, sem causa legível.

## Por que não foi corrigido junto

O T3 tinha escopo declarado: parar de descartar o que o ML publica. Isto é
outra coisa — mudar **de onde sai a lista de obrigatórios** em cinco caminhos
que decidem o que trava publicação. Mexer nisso altera o comportamento dos 792
anúncios da conta, e merece a sua própria fatia com medição antes e depois.

## O conserto já está meio construído

`api/ml/categoria` **já** descobre a categoria pelo título (`domain_discovery`)
e busca os obrigatórios reais. O que falta é os cinco caminhos chamarem, com
duas quedas honestas:

1. o produto já publicado tem a categoria medida em `anuncios_gerados.categoria_ml`
   (a coluna existe desde 10/08 e é o caminho barato — nada de rede);
2. o produto novo cai no `domain_discovery` pelo título;
3. e quando nenhum dos dois responde, o retrato de calçado continua sendo o
   palpite — mas **dito como palpite**, não como medição.

A terceira é a que impede este INC de virar uma parede nova: categoria
desconhecida não pode passar a travar publicação.
