"use client";

// As cinco áreas ao alcance do polegar.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// No celular, trocar de área custava TRÊS toques: abrir o hambúrguer, esperar a
// gaveta cobrir a tela, escolher. E o hambúrguer fica no canto superior
// esquerdo — a diagonal mais longa do polegar em qualquer telefone.
//
// A gaveta continua existindo, e continua sendo a resposta certa para as
// SUB-TELAS (Catálogo tem cinco). O que ela não deveria ser é o caminho para as
// cinco perguntas principais, que é o movimento que se repete o dia inteiro.
//
// ===========================================================================
// POR QUE CINCO, E POR QUE ESTAS CINCO
// ===========================================================================
//
// Não é uma escolha nova: são as `AREAS` de `modules/portal/domain/navegacao`,
// as mesmas da sidebar, na mesma ordem. Cinco é o teto usual de uma barra
// inferior, e aqui ele não apertou nada — o modelo já tinha cinco, porque
// quinze itens eram o problema que ele resolveu.
//
// Se um dia virarem seis, esta barra quebra antes de ficar feia: ver o teste.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Megaphone, TrendingUp, Settings } from "lucide-react";
import { AREAS, areaDaRota, type ContextoPortal } from "@/modules/portal/domain/navegacao";

/** O mesmo ícone por área da sidebar — trocar de tamanho de tela não troca o mapa. */
const ICONE_DA_AREA: Record<ContextoPortal, typeof Home> = {
  hoje: Home,
  catalogo: Package,
  anuncios: Megaphone,
  pulso: TrendingUp,
  zion: Settings,
};

export function NavegacaoDeBaixo() {
  const pathname = usePathname();
  const areaAtual = areaDaRota(pathname);

  return (
    <nav
      aria-label="Áreas"
      /* `lg:hidden` casa com o `lg:block` da sidebar: em telas grandes existe
         uma navegação, em telas pequenas existe a outra, e nunca as duas.

         O `padding-bottom` com `env(safe-area-inset-bottom)` é o mesmo remédio
         do botão flutuante — sem ele os rótulos ficam sob a faixa do indicador
         de home do iPhone, e o toque vira gesto do sistema. */
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-[#0b0b12]/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {AREAS.map((area) => {
          const aberta = areaAtual?.contexto === area.contexto;
          const Icon = ICONE_DA_AREA[area.contexto];
          return (
            <li key={area.contexto}>
              <Link
                href={area.principal}
                aria-current={aberta ? "page" : undefined}
                /* `min-h-14` (56px) e não os 44 do mínimo: é a última fileira
                   da tela, onde o polegar tem menos precisão, e onde um erro
                   de alvo tira a pessoa da tela em que ela estava. */
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                  aberta ? "text-violet-300" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={19} className={aberta ? "text-violet-400" : undefined} />
                {/* O rótulo fica. Ícone sozinho vira adivinhação — "Pulso" não
                    tem desenho óbvio, e nem "Zion". */}
                <span className="text-[11px] leading-none">{area.titulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
