import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Tone } from "@/lib/status";

const ICON_STYLES: Record<Tone, string> = {
  green: "bg-emerald-500/10 text-emerald-400",
  yellow: "bg-amber-500/10 text-amber-400",
  red: "bg-red-500/10 text-red-400",
  blue: "bg-sky-500/10 text-sky-400",
  violet: "bg-violet-500/10 text-violet-400",
  orange: "bg-orange-500/10 text-orange-400",
  cyan: "bg-cyan-500/10 text-cyan-400",
  gray: "bg-zinc-500/10 text-zinc-400",
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  /**
   * Para onde este número leva. Opcional — e a ausência é informação.
   *
   * ===========================================================================
   * POR QUE ISTO EXISTE (24/08/2026)
   * ===========================================================================
   *
   * A Visão geral tinha nove cartões e TRÊS elementos interativos: abrir menu,
   * sair e abrir o assistente. Nenhum número era clicável. A tela dizia
   * "90 anúncios" e "70 pendências" e não havia caminho daquele número até
   * aqueles anúncios — a lojista lia o problema e tinha que ir procurá-lo no
   * menu, sozinha.
   *
   * SEM `href` O CARTÃO CONTINUA UM `div`, e isso é de propósito: um cartão
   * cujo destino seria a própria tela onde ele está não ganha link. A régua diz
   * "o que é interativo tem que PARECER interativo"; o contrário também vale —
   * hover e anel de foco em algo que não navega ensinam a clicar no que não
   * responde.
   */
  href?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "violet",
  href,
}: StatCardProps) {
  const conteudo = (
    // O ÍCONE SAI DO FLUXO DO TEXTO.
    //
    // Ele é decorativo e ocupava 36px + 12px de gap num cartão que no celular
    // tem 165px — quase um terço da largura, roubada do número. Em posição
    // absoluta o texto usa a largura toda e só reserva o canto (`pr-9`).
    //
    // A alternativa que eu tentei antes era `break-words` no valor, e ela
    // produziu o pior defeito do dia: "R$ 16.600" quebrou como "R$ 16.60" /
    // "0" — lê-se dezesseis reais e sessenta. Um valor quebrado no meio não é
    // um número incompleto, é um número ERRADO.
    //
    // E a medição automática aprovou: o script contava texto cortado por
    // `scrollWidth > clientWidth`, e texto quebrado não vaza. Disse "0
    // cortados". Só a captura de tela pegou. Fica registrado porque é a lição
    // do dia: métrica de layout não substitui olhar a tela.
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pr-9 sm:pr-10">
          {/* O RÓTULO NÃO TRUNCA — ele quebra.
              ==============================================
              `truncate` estava aqui e só apareceu quando a grade da home passou
              a duas colunas no celular: em 375px o cartão fica estreito e SEIS
              dos oito rótulos viraram "Clientes em o…", "Tarefas atras…",
              "Faturamento …".
              Um número sem o nome dele é a pior forma deste defeito neste
              projeto — "3" sozinho não informa nada, e a família de defeitos que
              este repositório mais pagou é exatamente número sem significado
              (ver AUD-001). Rótulo em duas linhas custa altura; rótulo cortado
              custa o sentido.
              Medido no navegador em 375px, depois de a troca de grade revelar o
              problema. Nenhuma leitura de código teria mostrado isto: o
              `truncate` estava ali desde sempre e só cortava quando o cartão
              ficasse estreito. */}
          <p className="text-xs leading-snug text-zinc-500">{label}</p>
          {/* `text-2xl` cortava "R$ 16.600" a 84px de 110px num cartão de duas
              colunas — e valor cortado é pior que rótulo cortado: "R$ 16.6" é um
              número ERRADO, não um número incompleto. Medido no navegador. */}
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {value}
          </p>
          {/* 12px, e não 11.
              A dica deixou de ser enfeite: é ela que carrega o DENOMINADOR
              ("de 880 anúncios gerados"), sem o qual "90" ao lado de "26 no ar"
              é uma conta impossível. Informação que resolve contradição não
              pode ser o menor texto da tela — 11px estava abaixo do piso que a
              régua usa para corpo de texto. */}
          {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
        <div
          aria-hidden="true"
          className={`absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${ICON_STYLES[tone]}`}
        >
          <Icon size={17} />
        </div>
      </div>
    </>
  );

  const CAIXA =
    "relative block rounded-xl border border-white/5 bg-[#0e0e16] p-4 transition-colors";

  if (!href) {
    return <div className={`${CAIXA} hover:border-white/10`}>{conteudo}</div>;
  }

  return (
    <Link
      href={href}
      className={
        `${CAIXA} hover:border-violet-500/40 hover:bg-[#12121c] ` +
        // O ANEL DE FOCO, e ele não é detalhe de acabamento.
        //
        // A varredura de 24/08/2026 contou 86 botões e 31 declarações de foco
        // no portal inteiro: quem navega por teclado atravessava a tela sem
        // saber onde estava. `focus-visible` (e não `focus`) para o anel não
        // aparecer no clique de mouse — o teclado ganha a marca, o ponteiro
        // não ganha ruído.
        //
        // `ring-offset` no fundo da página, senão o anel encosta na borda do
        // cartão e some contra ela.
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 " +
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080d]"
      }
    >
      {conteudo}
    </Link>
  );
}
