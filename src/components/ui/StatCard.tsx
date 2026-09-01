import { type LucideIcon } from "lucide-react";
import Link from "next/link";
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
   * Para onde o número leva. Um número que não abre nada é relatório; com
   * `href` o cartão vira a porta da lista que ele conta.
   */
  href?: string;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "violet", href }: StatCardProps) {
  const classe = `relative block rounded-xl border border-white/5 bg-surface-raised p-4 transition-colors hover:border-white/10 ${
    href ? "hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500" : ""
  }`;
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
          {/* 12px, e nao 11: a dica carrega o DENOMINADOR ("de 880 anuncios
              gerados"), sem o qual "90" ao lado de "26 no ar" e conta
              impossivel. Informacao que resolve contradicao nao pode ser o
              menor texto da tela. */}
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
  return href ? (
    <Link href={href} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}
