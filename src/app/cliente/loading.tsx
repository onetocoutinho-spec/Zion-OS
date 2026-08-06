// O que aparece entre clicar num item do menu e a tela nova existir.
//
// ===========================================================================
// O QUE ISTO COBRE — E O QUE NÃO COBRE
// ===========================================================================
//
// COBRE a troca de rota: o Next busca o pedaço da tela nova antes de montá-la,
// e sem este arquivo a tela ANTERIOR fica congelada nesse intervalo. Clicar em
// "Anúncios" e continuar vendo "Produtos" por meio segundo faz a pessoa clicar
// de novo.
//
// NÃO COBRE a busca dos dados, que acontece depois, já dentro da tela nova e no
// navegador. Essa é a espera longa, e quem responde por ela é o `carregando` da
// `<Table>` e a `Superficie` — não este arquivo. São dois buracos diferentes e
// seria fácil achar que um tapa o outro.
//
// Fica DENTRO da casca (`cliente/layout.tsx` envolve este arquivo), então a
// sidebar e o cabeçalho continuam na tela: só a área de conteúdo pisca.

import { EsqueletoDeBloco, EsqueletoDeTexto } from "@/components/ui/Skeleton";

export default function CarregandoTelaDoPortal() {
  return (
    // A geometria imita o formato comum das telas do portal — cabeçalho, uma
    // fileira de cartões e um bloco grande. Não é a de nenhuma tela específica,
    // e é de propósito: um esqueleto genérico que erra pouco em todas é melhor
    // que um exato para uma e errado para dezesseis.
    <div className="space-y-6">
      <div className="space-y-2">
        <EsqueletoDeBloco altura="h-6" className="w-48" />
        <EsqueletoDeTexto linhas={1} className="max-w-md" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <EsqueletoDeBloco key={i} altura="h-20" />
        ))}
      </div>

      <EsqueletoDeBloco altura="h-64" />
    </div>
  );
}
