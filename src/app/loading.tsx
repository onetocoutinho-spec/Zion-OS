// O que aparece entre clicar num item do menu da agência e a tela nova existir.
//
// ===========================================================================
// UM ARQUIVO, TODAS AS ROTAS DA AGÊNCIA
// ===========================================================================
//
// O `loading.tsx` de um segmento vale para ele e para todos os filhos. Este
// fica na raiz, então cobre /agencias, /agentes, /ail, /auditoria-massa,
// /clientes, /esteira, /produtos, /relatorios, /usuarios, /vendas… — inclusive
// as rotas dinâmicas (`[id]`), onde o Next só faz prefetch parcial e navega
// na hora SE houver um `loading.tsx` no caminho. Sem ele, clicar num produto
// deixa a lista anterior congelada até o servidor responder.
//
// `/cliente/*` tem o seu próprio (`cliente/loading.tsx`); o mais próximo vence.
//
// ===========================================================================
// O QUE ISTO COBRE — E O QUE NÃO COBRE
// ===========================================================================
//
// COBRE a troca de rota. NÃO COBRE a busca dos dados, que acontece depois, já
// dentro da tela e no navegador — por essa respondem o `carregando` da
// `<Table>` e a `Superficie`. São dois buracos diferentes.
//
// Renderiza DENTRO da `AppShell` (o layout raiz envolve este arquivo), então a
// sidebar e o cabeçalho continuam na tela: só a área de conteúdo pisca. Nas
// telas que a casca deixa de fora (/definir-senha, /z) ele aparece sozinho,
// o que é aceitável — são raras e não navegam entre si.

import { EsqueletoDeBloco, EsqueletoDeTabela, EsqueletoDeTexto } from "@/components/ui/Skeleton";

export default function CarregandoTelaDaAgencia() {
  return (
    // A geometria imita o formato comum das telas da agência — cabeçalho com
    // título e descrição, uma fileira de KPIs e uma TABELA. Tabela e não bloco:
    // quase toda tela de agência é uma lista densa (agências, lojas, produtos,
    // agentes, auditorias), e o esqueleto de tabela tem a assimetria
    // (identidade larga à esquerda) que a faz ser reconhecida como tal.
    //
    // É um esqueleto genérico de propósito: um que erra pouco em todas as telas
    // é melhor que um exato para uma e errado para trinta.
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <EsqueletoDeBloco altura="h-6" className="w-48" />
          <EsqueletoDeTexto linhas={1} className="w-80 max-w-full" />
        </div>
        {/* O botão de ação primária ("Nova agência", "Novo produto"). */}
        <EsqueletoDeBloco altura="h-9" className="w-32" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <EsqueletoDeBloco key={i} altura="h-20" />
        ))}
      </div>

      <EsqueletoDeTabela colunas={5} linhas={6} />
    </div>
  );
}
